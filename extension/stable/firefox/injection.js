// injection.js - page-context orchestrator (fallback)
// Lightweight, non-invasive injector that can fetch, patch, and re-execute JS chunks
// Keep this file small and readable — add small comments near tricky bits to help contributors.

(function () {
  // avoid double-injection
  if (window.__EXT_PATCH_INJECTED__) return;
  window.__EXT_PATCH_INJECTED__ = true;

  // helper: match the main app chunk filename (often "app.*.js")
  const isAppUrl = (url) => /(^|\/)app[^/]*\.js(\?.*)?$/i.test(url);

  // work queue and maps
  const queue = [];               // URLs queued for execution (maintain order)
  const codeMap = new Map();      // url -> patched code
  const executed = new Set();     // url's we've already executed
  let appReady = false;           // set once the app chunk runs (controls flush)

  // apply a set of targeted patches based on filename patterns
  function applyPatches(url, code) {
    try {
      const name = (url || "").split("/").pop() || "";
      // app chunk gets a few behavior tweaks
      if (/^app([.-].*|)\.js(\?.*|)?$/i.test(name)) code = patchApp(code);
      if (/^7220[^/]*\.js(\?.*|)?$/i.test(name)) code = patch7220(code);
      if (/^6150[^/]*\.js(\?.*|)?$/i.test(name)) code = patch6150(code);
      if (/^4370[^/]*\.js(\?.*|)?$/i.test(name)) code = patch4370(code);
      return code;
    } catch {
      // on any failure, return original unmodified code (fail-safe)
      return code;
    }
  }

  // app chunk patches: three small regex-based rewrites
  function patchApp(code) {
    // 1) Force gold_subscription presence in inventory (shallow merge)
    code = code.replace(
      /([A-Za-z_$][\w$]*)\s*=\s*e\s*=>\s*e\.items(?!\s*[\.\[(])\s*(?=[,;)}]|$)/g,
      `$1=e=>({...e.items,inventory:{...e.items.inventory,gold_subscription:{itemName:"gold_subscription",subscriptionInfo:{vendor:"STRIPE",renewing:true,isFamilyPlan:true,expectedExpiration:9999999999000}}}})`
    );

    // 2) Ensure user object reports hasPlus: true while minimizing allocations:
    //    each incoming user is memoized to avoid unnecessary new objects on identity-equal users.
    code = code.replace(
      /([A-Za-z_$][\w$]*)\s*=\s*e\s*=>\s*e\.user(?!\s*[\.\[(])\s*(?=[,;)}]|$)/g,
      `$1=(()=>{let lu=null,lpu=null;return e=>{const cu=e.user;if(cu===lu)return lpu;lu=cu;lpu={...cu,hasPlus:true};return lpu;};})()`
    );

    // 3) Normalize speech recognition feature-detection across browsers
    code = code.replace(
      /([A-Za-z_$][\w$]*)\s*=\s*!!window\.webkitSpeechRecognition\s*&&\s*\(\s*[A-Za-z_$][\w$]*\.Z\.chrome\s*\|\|\s*[A-Za-z_$][\w$]*\.Z\.edgeSupportedSpeaking\s*\)/g,
      (_, v) => `${v} = !!(window.SpeechRecognition || window.webkitSpeechRecognition)`
    );

    return code;
  }

  // small chunk-specific tweaks: flip disabled flags, etc.
  function patch7220(code) {
    // normalize different minified forms to explicit false
    code = code.replace(/isDisabled:\s*!0\s*,/g, "isDisabled: false,");
    code = code.replace(/isDisabled:!0,/g, "isDisabled: false,");
    code = code.replace(/showSuperBadge:\s*!e\s*,/g, "showSuperBadge: false,");
    code = code.replace(/showSuperBadge:!e,/g, "showSuperBadge: false,");
    // invert a specific predicate that was minified to "e => e.user.hasPlus"
    code = code.replace(/e\s*=>\s*e\.user\.hasPlus/g, "e => !e.user.hasPlus");
    return code;
  }

  // more involved transformation: find .push('/mistakes-review') entries and simplify handler
  function patch6150(code) {
    const TARGET_ROUTE = '/mistakes-review';
    let out = code;
    let cursor = 0;

    // small helpers for scanning the minified code
    function findIdentifierBeforeDot(str, dotPos) {
      let i = dotPos - 1;
      while (i >= 0 && /\s/.test(str[i])) i--;
      if (i < 0 || !/[A-Za-z0-9_$]/.test(str[i])) return null;
      let end = i;
      while (i >= 0 && /[A-Za-z0-9_$]/.test(str[i])) i--;
      return str.slice(i + 1, end + 1);
    }
    function findMatchingBrace(str, braceStart) {
      // naive but robust brace matcher that skips strings and comments
      let depth = 0;
      for (let k = braceStart; k < str.length; k++) {
        const ch = str[k];
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) return k; }
        else if (ch === '"' || ch === "'" || ch === '`') {
          const qc = ch; k++;
          while (k < str.length) {
            if (str[k] === '\\') { k += 2; continue; }
            if (str[k] === qc) break;
            k++;
          }
        } else if (ch === '/') {
          const next = str[k + 1];
          if (next === '/') { k += 2; while (k < str.length && str[k] !== '\n') k++; }
          else if (next === '*') { k += 2; while (k + 1 < str.length && !(str[k] === '*' && str[k + 1] === '/')) k++; k += 1; }
        }
      }
      return -1;
    }

    // walk occurrences of ".push(" and inspect the argument string
    while (true) {
      const pushDot = out.indexOf('.push(', cursor);
      if (pushDot === -1) break;

      // advance to the string literal argument
      let p = pushDot + '.push('.length;
      while (p < out.length && /\s/.test(out[p])) p++;
      const quote = out[p];
      if (quote !== '"' && quote !== "'") { cursor = pushDot + 1; continue; }
      const qch = quote; let q = p + 1; let arg = null;
      while (q < out.length) {
        if (out[q] === '\\') { q += 2; continue; }
        if (out[q] === qch) { arg = out.slice(p + 1, q); break; }
        q++;
      }
      if (arg !== TARGET_ROUTE) { cursor = pushDot + 1; continue; }

      // find the router variable used right before ".push"
      const routerVar = findIdentifierBeforeDot(out, pushDot);
      if (!routerVar) { cursor = pushDot + 1; continue; }

      // locate an onButtonClick property close to this push; we'll replace its body
      const onKeyPos = out.lastIndexOf('onButtonClick', pushDot);
      if (onKeyPos === -1) { cursor = pushDot + 1; continue; }
      const afterOn = onKeyPos + 'onButtonClick'.length;
      const colonPos = out.indexOf(':', afterOn);
      if (colonPos === -1 || colonPos > pushDot) { cursor = pushDot + 1; continue; }
      let braceStart = out.indexOf('{', colonPos);
      if (braceStart === -1 || braceStart > pushDot) { cursor = pushDot + 1; continue; }

      const braceEnd = findMatchingBrace(out, braceStart);
      if (braceEnd === -1 || braceEnd < pushDot) { cursor = pushDot + 1; continue; }

      // replace the entire onButtonClick: { ... } with a minimal redirect handler
      let replaceFrom = onKeyPos;
      let replaceTo = braceEnd;
      let commaAfter = '';
      if (out[replaceTo + 1] === ',') { commaAfter = ','; replaceTo = replaceTo + 1; }

      const minimalForm = `onButtonClick:()=>{${routerVar}.push("${TARGET_ROUTE}");}${commaAfter}`;
      const originalSnippet = out.slice(replaceFrom, replaceTo + 1);
      // if already minimal, skip
      if (originalSnippet === minimalForm || originalSnippet === `onButtonClick:()=>{${routerVar}.push('${TARGET_ROUTE}');}${commaAfter}`) {
        cursor = replaceTo + 1;
        continue;
      }

      // perform the replacement
      const replacement = `onButtonClick:()=>{${routerVar}.push("${TARGET_ROUTE}");}${commaAfter}`;
      out = out.slice(0, replaceFrom) + replacement + out.slice(replaceTo + 1);
      cursor = replaceFrom + replacement.length;
    }

    return out;
  }

  // similar to patch6150 but with extra logic to remove "disabled:!x" inside nearby objects
  function patch4370(code) {
    const TARGET_ROUTE = '/practice-hub/words/practice';
    let out = code;
    let cursor = 0;

    function findIdentifierBeforeDot(str, dotPos) {
      let i = dotPos - 1;
      while (i >= 0 && /\s/.test(str[i])) i--;
      if (i < 0 || !/[A-Za-z0-9_$]/.test(str[i])) return null;
      let end = i;
      while (i >= 0 && /[A-Za-z0-9_$]/.test(str[i])) i--;
      return str.slice(i + 1, end + 1);
    }
    function findMatchingBrace(str, braceStart) {
      let depth = 0;
      for (let k = braceStart; k < str.length; k++) {
        const ch = str[k];
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) return k; }
        else if (ch === '"' || ch === "'" || ch === '`') {
          const qc = ch; k++;
          while (k < str.length) {
            if (str[k] === '\\') { k += 2; continue; }
            if (str[k] === qc) break;
            k++;
          }
        } else if (ch === '/') {
          const next = str[k + 1];
          if (next === '/') { k += 2; while (k < str.length && str[k] !== '\n') k++; }
          else if (next === '*') { k += 2; while (k + 1 < str.length && !(str[k] === '*' && str[k + 1] === '/')) k++; k += 1; }
        }
      }
      return -1;
    }

    // try to remove "disabled: !someVar" entries inside objects that contain the onButtonClick we are targeting
    function removeDisabledInObject(currentOut, objStart, objEnd, replaceFrom, replaceTo) {
      const objStr = currentOut.slice(objStart, objEnd + 1);
      let m = objStr.match(/disabled\s*:\s*!\s*([A-Za-z_$][\w$]*)\s*,/);
      let relIndex = -1;
      let matchLen = 0;
      if (m) { relIndex = objStr.indexOf(m[0]); matchLen = m[0].length; }
      else {
        // try the case where the disabled property is after a comma
        m = objStr.match(/,\s*disabled\s*:\s*!\s*([A-Za-z_$][\w$]*)\s*/);
        if (m) { relIndex = objStr.indexOf(m[0]); matchLen = m[0].length; }
      }
      if (relIndex === -1) return { out: currentOut, replaceFrom, replaceTo, removed: false };

      const absIdx = objStart + relIndex;
      const newOut = currentOut.slice(0, absIdx) + currentOut.slice(absIdx + matchLen);
      const removedLen = matchLen;
      if (absIdx < replaceFrom) replaceFrom -= removedLen;
      if (absIdx <= replaceTo) replaceTo -= removedLen;

      // clean up accidental ",," or "{," that deletion may create
      const cleanStart = Math.max(0, absIdx - 40);
      const cleanEnd = Math.min(newOut.length, absIdx + 40);
      const before = newOut.slice(0, cleanStart);
      const mid = newOut.slice(cleanStart, cleanEnd).replace(/,\s*,/g, ',').replace(/\{\s*,/g, '{');
      const after = newOut.slice(cleanEnd);
      return { out: before + mid + after, replaceFrom, replaceTo, removed: true };
    }

    // main scan loop: same pattern as patch6150 but with disabled removal pass
    while (true) {
      const pushDot = out.indexOf('.push(', cursor);
      if (pushDot === -1) break;

      let p = pushDot + '.push('.length;
      while (p < out.length && /\s/.test(out[p])) p++;
      const quote = out[p];
      if (quote !== '"' && quote !== "'") { cursor = pushDot + 1; continue; }
      const qch = quote; let q = p + 1; let arg = null;
      while (q < out.length) {
        if (out[q] === '\\') { q += 2; continue; }
        if (out[q] === qch) { arg = out.slice(p + 1, q); break; }
        q++;
      }
      if (arg !== TARGET_ROUTE) { cursor = pushDot + 1; continue; }
      const routerVar = findIdentifierBeforeDot(out, pushDot);
      if (!routerVar) { cursor = pushDot + 1; continue; }
      const onKeyPos = out.lastIndexOf('onButtonClick', pushDot);
      if (onKeyPos === -1) { cursor = pushDot + 1; continue; }
      const afterOn = onKeyPos + 'onButtonClick'.length;
      const colonPos = out.indexOf(':', afterOn);
      if (colonPos === -1 || colonPos > pushDot) { cursor = pushDot + 1; continue; }
      let braceStart = out.indexOf('{', colonPos);
      if (braceStart === -1 || braceStart > pushDot) { cursor = pushDot + 1; continue; }
      const braceEnd = findMatchingBrace(out, braceStart);
      if (braceEnd === -1 || braceEnd < pushDot) { cursor = pushDot + 1; continue; }

      let replaceFrom = onKeyPos;
      let replaceTo = braceEnd;

      // attempt to locate a surrounding object that may contain a disabled property to remove
      let objStart = -1, objEnd = -1;
      const scanLimit = 2000;
      const leftBound = Math.max(0, replaceFrom - scanLimit);
      for (let j = replaceFrom - 1; j >= leftBound; j--) {
        if (out[j] === '{') {
          const match = findMatchingBrace(out, j);
          if (match !== -1 && match >= replaceTo) { objStart = j; objEnd = match; break; }
        } else if (out[j] === ';' || out[j] === '(') {
          // bail if we've gone too far out of the expression
          if (replaceFrom - j > 200) break;
        }
      }

      if (objStart !== -1) {
        const res = removeDisabledInObject(out, objStart, objEnd, replaceFrom, replaceTo);
        if (res.removed) {
          out = res.out;
          replaceFrom = res.replaceFrom;
          replaceTo = res.replaceTo;
        }
      }

      let commaAfter = '';
      if (out[replaceTo + 1] === ',') { commaAfter = ','; replaceTo = replaceTo + 1; }
      const minimalForm = `onButtonClick:()=>{${routerVar}.push("${TARGET_ROUTE}");}${commaAfter}`;
      const originalSnippet = out.slice(replaceFrom, replaceTo + 1);
      if (originalSnippet === minimalForm || originalSnippet === `onButtonClick:()=>{${routerVar}.push('${TARGET_ROUTE}');}${commaAfter}`) {
        cursor = replaceTo + 1;
        continue;
      }
      const replacement = `onButtonClick:()=>{${routerVar}.push("${TARGET_ROUTE}");}${commaAfter}`;
      out = out.slice(0, replaceFrom) + replacement + out.slice(replaceTo + 1);
      cursor = replaceFrom + replacement.length;
    }

    // final cleanup for stray commas
    out = out.replace(/,\s*,/g, ',').replace(/\{\s*,/g, '{');
    return out;
  }

  // fetch a script from the page context (credentials included)
  async function pageFetchText(url) {
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) throw new Error('fetch failed ' + res.status);
    return await res.text();
  }

  // execute patched code: prefer Blob -> script injection, fallback to Function eval
  function execPatched(url, code) {
    if (executed.has(url)) return true; // idempotent
    try {
      // create a blob URL so tools/devtools can still show the loaded script
      const blob = new Blob([code], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      const s = document.createElement('script');
      s.src = blobUrl;
      s.async = false; // preserve execution order
      s.setAttribute('data-ext-patched', 'true');
      s.onload = () => {
        // when the app chunk runs, mark appReady and flush queued non-app chunks
        if (isAppUrl(url) && !appReady) {
          appReady = true;
          try { window.dispatchEvent(new Event('ext-app-ready')); } catch {}
          flushQueue();
        }
      };
      // insert near the current script if possible, otherwise use head
      (document.currentScript && document.currentScript.parentNode)
        ? document.currentScript.parentNode.insertBefore(s, document.currentScript)
        : (document.head || document.documentElement).appendChild(s);
      executed.add(url);
      return true;
    } catch (errBlob) {
      // blob construction may fail in some contexts; try a direct eval as fallback
      try {
        const fn = new Function(code + "\n//# sourceURL=patched-" + (url.split('/').pop() || 'chunk'));
        fn();
        executed.add(url);
        if (isAppUrl(url) && !appReady) {
          appReady = true;
          try { window.dispatchEvent(new Event('ext-app-ready')); } catch {}
          flushQueue();
        }
        return true;
      } catch (errEval) {
        // if both strategies fail, report and skip
        console.warn('exec failed', url, errEval);
        return false;
      }
    }
  }

  // once the app is ready, try to run all queued chunks for which we have patched code
  function flushQueue() {
    if (!appReady) return;
    let progressed = false;
    for (let i = 0; i < queue.length; i++) {
      const url = queue[i];
      if (executed.has(url)) continue;
      const code = codeMap.get(url);
      if (code) {
        if (execPatched(url, code)) progressed = true;
      }
    }
    // remove any executed items from the queue
    for (let i = queue.length - 1; i >= 0; i--) {
      if (executed.has(queue[i])) queue.splice(i, 1);
    }
    // if we ran something and there are still runnable items, recurse to ensure order
    if (progressed && queue.some(u => codeMap.has(u) && !executed.has(u))) {
      flushQueue();
    }
  }

  // listen for messages from the extension background/content script
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || ev.source !== window) return;

    // enqueue a URL for later execution (keeps order)
    if (d.source === 'ext-injector-enqueue' && d.url) {
      if (!queue.includes(d.url)) queue.push(d.url);
      return;
    }

    // handle a direct patch request: either patchedCode provided, or fetch+patch
    if (d.source === 'ext-injector' && d.url) {
      const url = d.url;
      if (typeof d.patchedCode === 'string') {
        try {
          const patched = d.patchedCode;
          codeMap.set(url, patched);
          if (isAppUrl(url) || appReady) execPatched(url, patched);
          window.postMessage({ source: 'ext-injector-result', url, ok: true }, '*');
        } catch {
          window.postMessage({ source: 'ext-injector-result', url, ok: false }, '*');
        }
        return;
      }

      // fetch original page script, apply patches, then store & maybe execute
      (async () => {
        try {
          const original = await pageFetchText(url);
          const patched = applyPatches(url, original);
          codeMap.set(url, patched);
          if (isAppUrl(url) || appReady) execPatched(url, patched);
          window.postMessage({ source: 'ext-injector-result', url, ok: true }, '*');
        } catch (err) {
          console.error('page fetch/patch failed', url, err);
          window.postMessage({ source: 'ext-injector-result', url, ok: false }, '*');
        }
      })();
    }
  });

  // allow manual flush triggers as well
  window.addEventListener('ext-app-ready', flushQueue);
})();