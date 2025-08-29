// background.js - Firefox MV2 background script
// - Intercepts app-*.js and 7220/6150/4370 chunks via webRequest.filterResponseData
//   and patches BEFORE execution (avoids race conditions).
// - Keeps caching to chrome.storage.local (same keys as before).
// - Still supports FETCH_AND_PATCH/GET_CACHED messages as a fallback.

async function fetchText(url) {
  const resp = await fetch(url, { cache: 'no-store', credentials: 'include' });
  if (!resp.ok) throw new Error('fetch failed ' + resp.status);
  return await resp.text();
}

function applyPatches(url, code) {
  try {
    const name = (url || "").split("/").pop() || "";
    if (/^app([.-].*|)\.js(\?.*|)?$/i.test(name)) code = patchApp(code);
    if (/^7220[^/]*\.js(\?.*|)?$/i.test(name)) code = patch7220(code);
    if (/^6150[^/]*\.js(\?.*|)?$/i.test(name)) code = patch6150(code);
    if (/^4370[^/]*\.js(\?.*|)?$/i.test(name)) code = patch4370(code);
    return code;
  } catch {
    return code;
  }
}

// ----- Patches -----
  function patchApp(code) {
    code = code.replace(
      /([A-Za-z_$][\w$]*)\s*=\s*e\s*=>\s*e\.items(?!\s*[\.\[(])\s*(?=[,;)}]|$)/g,
      `$1=e=>({...e.items,inventory:{...e.items.inventory,gold_subscription:{itemName:"gold_subscription",subscriptionInfo:{vendor:"STRIPE",renewing:true,isFamilyPlan:true,expectedExpiration:9999999999000}}}})`
    );
    // lu: lastUser, lpu: lastPatchedUser, cu: currentUser
    code = code.replace(
      /([A-Za-z_$][\w$]*)\s*=\s*e\s*=>\s*e\.user(?!\s*[\.\[(])\s*(?=[,;)}]|$)/g,
      `$1=(()=>{let lu=null,lpu=null;return e=>{const cu=e.user;if(cu===lu)return lpu;lu=cu;lpu={...cu,hasPlus:true};return lpu;};})()`
    );
    code = code.replace(
      /([A-Za-z_$][\w$]*)\s*=\s*!!window\.webkitSpeechRecognition\s*&&\s*\(\s*[A-Za-z_$][\w$]*\.Z\.chrome\s*\|\|\s*[A-Za-z_$][\w$]*\.Z\.edgeSupportedSpeaking\s*\)/g,
      (_, v) => `${v} = !!(window.SpeechRecognition || window.webkitSpeechRecognition)`
    );
    return code;
  }

function patch7220(code) {
  code = code.replace(/isDisabled:\s*!0\s*,/g, "isDisabled: false,");
  code = code.replace(/isDisabled:!0,/g, "isDisabled: false,");
  code = code.replace(/showSuperBadge:\s*!e\s*,/g, "showSuperBadge: false,");
  code = code.replace(/showSuperBadge:!e,/g, "showSuperBadge: false,");
  code = code.replace(/e\s*=>\s*e\.user\.hasPlus/g, "e => !e.user.hasPlus");
  return code;
}

function patch6150(code) {
  const TARGET_ROUTE = '/mistakes-review';
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
    let depth = 1;
    for (let k = braceStart + 1; k < str.length; k++) {
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

  while (true) {
    const pushDot = out.indexOf('.push(', cursor);
    if (pushDot === -1) break;

    let p = pushDot + '.push('.length;
    while (p < out.length && /\s/.test(out[p])) p++;
    const quote = out[p];
    if (quote !== '"' && quote !== "'") { cursor = pushDot + 1; continue; }
    let q = p + 1, arg = null;
    while (q < out.length) {
      if (out[q] === '\\') { q += 2; continue; }
      if (out[q] === quote) { arg = out.slice(p + 1, q); break; }
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
    let commaAfter = '';
    if (replaceTo + 1 < out.length && out[replaceTo + 1] === ',') { commaAfter = ','; replaceTo++; }

    const replacement = `onButtonClick:()=>{${routerVar}.push("${TARGET_ROUTE}");}${commaAfter}`;
    out = out.slice(0, replaceFrom) + replacement + out.slice(replaceTo + 1);
    cursor = replaceFrom + replacement.length;
  }

  return out;
}

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
    let depth = 1;
    for (let k = braceStart + 1; k < str.length; k++) {
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

  function removeDisabledInObject(currentOut, objStart, objEnd, replaceFrom, replaceTo) {
    const objStr = currentOut.slice(objStart, objEnd + 1);
    let m = objStr.match(/disabled\s*:\s*!\s*([A-Za-z_$][\w$]*)\s*,/);
    let relIndex = -1;
    let matchLen = 0;
    if (m) { relIndex = objStr.indexOf(m[0]); matchLen = m[0].length; }
    else {
      m = objStr.match(/,\s*disabled\s*:\s*!\s*([A-Za-z_$][\w$]*)\s*/);
      if (m) { relIndex = objStr.indexOf(m[0]); matchLen = m[0].length; }
    }
    if (relIndex === -1) return { out: currentOut, replaceFrom, replaceTo, removed: false };

    const absIdx = objStart + relIndex;
    const newOut = currentOut.slice(0, absIdx) + currentOut.slice(absIdx + matchLen);
    const removedLen = matchLen;
    if (absIdx < replaceFrom) replaceFrom -= removedLen;
    if (absIdx <= replaceTo) replaceTo -= removedLen;

    const cleanMid = newOut.slice(absIdx - 2, absIdx + 2).replace(/,\s*,/g, ',').replace(/\{\s*,/g, '{');
    const finalOut = newOut.slice(0, absIdx - 2) + cleanMid + newOut.slice(absIdx + 2);

    return { out: finalOut, replaceFrom, replaceTo, removed: true };
  }

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

    let objStart = -1, objEnd = -1;
    const scanLimit = 2000;
    const leftBound = Math.max(0, replaceFrom - scanLimit);
    for (let j = replaceFrom - 1; j >= leftBound; j--) {
      if (out[j] === '{') {
        const match = findMatchingBrace(out, j);
        if (match !== -1 && match >= replaceTo) { objStart = j; objEnd = match; break; }
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
    if (replaceTo + 1 < out.length && out[replaceTo + 1] === ',') { commaAfter = ','; replaceTo++; }

    const replacement = `onButtonClick:()=>{${routerVar}.push("${TARGET_ROUTE}");}${commaAfter}`;
    out = out.slice(0, replaceFrom) + replacement + out.slice(replaceTo + 1);
    cursor = replaceFrom + replacement.length;
  }

  out = out.replace(/,\s*,/g, ',').replace(/\{\s*,/g, '{');
  return out;
}

// ----- Message-based fallback (kept) -----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'FETCH_AND_PATCH') {
    const url = msg.url;
    (async () => {
      const key = 'patched:' + url;
      try {
        const original = await fetchText(url);
        const patched = applyPatches(url, original);
        await chrome.storage.local.set({ [key]: patched, ['cachedAt:' + url]: Date.now() });
        sendResponse({ ok: true, patched, fromCache: false });
      } catch (err) {
        const cached = (await chrome.storage.local.get(key))[key];
        if (cached) {
          sendResponse({ ok: true, patched: cached, fromCache: true });
        } else {
          sendResponse({ ok: false, error: String(err) });
        }
      }
    })();
    return true;
  } else if (msg?.type === 'GET_CACHED') {
    const url = msg.url;
    const key = 'patched:' + url;
    (async () => {
      const cached = (await chrome.storage.local.get(key))[key];
      if (cached) sendResponse({ ok: true, patched: cached });
      else sendResponse({ ok: false });
    })();
    return true;
  }
});

// ----- Firefox network-level patch for ALL target chunks -----
(function setupResponseFilter() {
  if (typeof browser === 'undefined' || !browser.webRequest || !browser.webRequest.filterResponseData) return;

  const CHUNK_RE = /(^|\/)(app|7220|6150|4370)[^/]*\.js(\?.*)?$/i;

  browser.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (!CHUNK_RE.test(details.url)) return {};

      const filter = browser.webRequest.filterResponseData(details.requestId);
      const decoder = new TextDecoder('utf-8');
      const encoder = new TextEncoder();
      const chunks = [];

      filter.ondata = (event) => {
        if (event && event.data) chunks.push(event.data);
      };

      filter.onstop = async () => {
        let originalText = '';
        try {
          if (chunks.length) {
            let totalLen = 0;
            for (const c of chunks) totalLen += (c.byteLength || c.length || 0);
            const merged = new Uint8Array(totalLen);
            let offset = 0;
            for (const c of chunks) {
              const u8 = c instanceof Uint8Array ? c : new Uint8Array(c);
              merged.set(u8, offset);
              offset += u8.byteLength;
            }
            originalText = decoder.decode(merged);
          }

          const patched = applyPatches(details.url, originalText);
          await chrome.storage.local.set({
            ['patched:' + details.url]: patched,
            ['cachedAt:' + details.url]: Date.now()
          });

          filter.write(encoder.encode(patched));
        } catch (e) {
          try {
            const key = 'patched:' + details.url;
            const cached = (await chrome.storage.local.get(key))[key];
            if (cached) {
              filter.write(encoder.encode(cached));
            } else {
              for (const c of chunks) filter.write(c);
            }
          } catch {
            for (const c of chunks) filter.write(c);
          }
        } finally {
          try { filter.close(); } catch {}
        }
      };

      filter.onerror = () => {
        try { filter.close(); } catch {}
      };

      return {};
    },
    { urls: ["<all_urls>"], types: ["script"] },
    ["blocking"]
  );
})();