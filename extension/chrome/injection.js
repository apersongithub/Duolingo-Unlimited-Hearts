// injection.js - page-context orchestrator
// This script is injected into the web page's context. Its primary role is to intercept
// JavaScript files requested by the page, apply custom modifications ("patches"), and
// then execute them in the correct order. It specifically ensures that the main
// application script (app-*.js) is patched and runs before any other dependent scripts.

(function () {
  // A simple guard to prevent the script from being injected and running multiple times.
  if (window.__EXT_PATCH_INJECTED__) return;
  window.__EXT_PATCH_INJECTED__ = true;

  /**
   * Checks if a given URL points to the main application script (e.g., "app.js", "app-123abc.js").
   * @param {string} url The URL to test.
   * @returns {boolean} True if the URL matches the app script pattern.
   */
  const isAppUrl = (url) => /(^|\/)app[^/]*\.js(\?.*)?$/i.test(url);

  // --- State Management ---
  // The queue maintains the original execution order of scripts that were intercepted.
  const queue = [];
  // The codeMap stores the patched source code for each script URL before it's executed.
  const codeMap = new Map();
  // The executed set tracks which script URLs have already been run to prevent re-execution.
  const executed = new Set();
  // A flag that indicates whether the main `app-*.js` script has been successfully executed.
  let appReady = false;

  /**
   * Acts as a dispatcher for patching. It examines the script's URL and,
   * if it matches a known pattern, applies the corresponding patch function.
   * @param {string} url The URL of the script being patched.
   * @param {string} code The original JavaScript code of the script.
   * @returns {string} The patched code, or the original code if no patch was applied.
   */
  function applyPatches(url, code) {
    try {
      // Extract the filename from the URL for easier matching.
      const name = (url || "").split("/").pop() || "";
      if (/^app([.-].*|)\.js(\?.*|)?$/i.test(name)) code = patchApp(code);
      if (/^7220[^/]*\.js(\?.*|)?$/i.test(name)) code = patch7220(code);
      if (/^6150[^/]*\.js(\?.*|)?$/i.test(name)) code = patch6150(code);
      if (/^4370[^/]*\.js(\?.*|)?$/i.test(name)) code = patch4370(code);
      return code;
    } catch (e) {
      // If any patch fails, return the original code to prevent the site from breaking.
      return code;
    }
  }

  // --- PART 1: app*.js Patches ---
  /**
   * Applies all patches related to the main application chunk (`app-*.js`).
   * These patches typically modify the core application logic to unlock features.
   * @param {string} code The original code of the app script.
   * @returns {string} The modified code.
   */
  function patchApp(code) {
    // --- Patch e.items ---
    // This patch targets a function that selects `e.items` from the application's state.
    // It modifies this function to inject a fake 'gold_subscription' object.
    // This tricks the application into believing the user has an active premium subscription.
    code = code.replace(
      /([A-Za-z_$][\w$]*)\s*=\s*e\s*=>\s*e\.items(?!\s*[\.\[(])\s*(?=[,;)}]|$)/g,
      `$1=e=>({...e.items,inventory:{...e.items.inventory,gold_subscription:{itemName:"gold_subscription",subscriptionInfo:{vendor:"STRIPE",renewing:true,isFamilyPlan:true,expectedExpiration:9999999999000}}}})`
    );

    // --- Patch e.user ---
    // This patch targets a function that selects `e.user` from the state.
    // It wraps the original function to add `hasPlus: true` to the user object.
    // A small caching mechanism (`lastUser`, `lastPatchedUser`) is used for efficiency,
    // ensuring the user object is only modified when it actually changes.
    code = code.replace(
      /([A-Za-z_$][\w$]*)\s*=\s*e\s*=>\s*e\.user(?!\s*[\.\[(])\s*(?=[,;)}]|$)/g,
      `$1=(()=>{let lu=null,lpu=null;return e=>{const cu=e.user;if(cu===lu)return lpu;lu=cu;lpu={...cu,hasPlus:true};return lpu;};})()`
    );

    // --- Patch SpeechRecognition check ---
    // This patch replaces a very specific check for Chrome/Edge's `webkitSpeechRecognition`
    // with a more general check that includes the standard `window.SpeechRecognition`.
    // This enables voice recognition features on a wider range of browsers (like Firefox).
    code = code.replace(
      /([A-Za-z_$][\w$]*)\s*=\s*!!window\.webkitSpeechRecognition\s*&&\s*\(\s*[A-Za-z_$][\w$]*\.Z\.chrome\s*\|\|\s*[A-Za-z_$][\w$]*\.Z\.edgeSupportedSpeaking\s*\)/g,
      (_, v) => `${v} = !!(window.SpeechRecognition || window.webkitSpeechRecognition)`
    );

    return code;
  }


  // --- PART 2: Other Chunk Patches ---
  /**
   * Applies patches to a specific chunk (`7220*.js`).
   * These are targeted fixes, often to enable UI elements or alter logic
   * that is dependent on a premium subscription.
   * @param {string} code The original code of the chunk.
   * @returns {string} The modified code.
   */
  function patch7220(code) {
    // Replaces `isDisabled:!0` (or `isDisabled: !0`) with `isDisabled: false`.
    // This is likely used to enable buttons that are normally disabled for free users.
    code = code.replace(/isDisabled:\s*!0\s*,/g, "isDisabled: false,");
    code = code.replace(/isDisabled:!0,/g, "isDisabled: false,");
    // Disables the "Super" badge, which is likely a premium indicator.
    code = code.replace(/showSuperBadge:\s*!e\s*,/g, "showSuperBadge: false,");
    code = code.replace(/showSuperBadge:!e,/g, "showSuperBadge: false,");
    // Inverts a logic check. If the original code was checking for `e.user.hasPlus`,
    // this changes it to check for `!e.user.hasPlus`. This might be used to
    // show a feature to "non-plus" users that was originally intended for plus users.
    code = code.replace(/e\s*=>\s*e\.user\.hasPlus/g, "e => !e.user.hasPlus");
    return code;
  }

  /**
   * Applies a robust patch to a specific chunk (`6150*.js`). Its goal is to find any
   * complex `onButtonClick` handler that eventually navigates to the '/mistakes-review'
   * page and replace it with a simple, direct navigation call. This bypasses any
   * intermediate logic (like premium checks) within the original handler.
   * @param {string} code The original code of the chunk.
   * @returns {string} The modified code.
   */
  function patch6150(code) {
    // The target navigation route we are looking for.
    const TARGET_ROUTE = '/mistakes-review';
    let out = code;
    let cursor = 0; // The position in the code to continue searching from.
    let made = 0; // A counter for replacements made.

    /**
     * Helper function to find a valid JavaScript identifier (variable name)
     * immediately to the left of a given position (e.g., before a '.' in '.push').
     */
    function findIdentifierBeforeDot(str, dotPos) {
      let i = dotPos - 1;
      while (i >= 0 && /\s/.test(str[i])) i--; // Skip whitespace
      if (i < 0 || !/[A-Za-z0-9_$]/.test(str[i])) return null;
      let end = i;
      while (i >= 0 && /[A-Za-z0-9_$]/.test(str[i])) i--;
      return str.slice(i + 1, end + 1);
    }

    /**
     * Helper function to find the matching closing brace '}' for a given
     * opening brace '{', correctly handling nested braces and content inside strings.
     */
    function findMatchingBrace(str, braceStart) {
      let depth = 0;
      for (let k = braceStart; k < str.length; k++) {
        const ch = str[k];
        if (ch === '{') {
          depth++;
        } else if (ch === '}') {
          depth--;
          if (depth === 0) return k;
        } else if (ch === '"' || ch === "'" || ch === '`') { // Skip strings
          const qc = ch;
          k++;
          while (k < str.length) {
            if (str[k] === '\\') { k += 2; continue; }
            if (str[k] === qc) break;
            k++;
          }
        } else if (ch === '/') { // Skip comments
          const next = str[k + 1];
          if (next === '/') {
            k += 2;
            while (k < str.length && str[k] !== '\n') k++;
          } else if (next === '*') {
            k += 2;
            while (k + 1 < str.length && !(str[k] === '*' && str[k + 1] === '/')) k++;
            k += 1;
          }
        }
      }
      return -1; // Not found
    }

    // Main loop to find and replace all occurrences.
    while (true) {
      // 1. Find the target navigation call.
      const pushDot = out.indexOf('.push(', cursor);
      if (pushDot === -1) break;

      // 2. Verify it's pushing our target route as a string literal.
      let p = pushDot + '.push('.length;
      while (p < out.length && /\s/.test(out[p])) p++;
      const quote = out[p];
      if (quote !== '"' && quote !== "'") {
        cursor = pushDot + 1;
        continue;
      }
      const qch = quote;
      let q = p + 1;
      let arg = null;
      while (q < out.length) {
        if (out[q] === '\\') { q += 2; continue; }
        if (out[q] === qch) { arg = out.slice(p + 1, q); break; }
        q++;
      }
      if (arg !== TARGET_ROUTE) {
        cursor = pushDot + 1;
        continue;
      }

      // 3. Identify the router variable (e.g., `t` in `t.push(...)`).
      const routerVar = findIdentifierBeforeDot(out, pushDot);
      if (!routerVar) { cursor = pushDot + 1; continue; }

      // 4. Work backwards to find the `onButtonClick` property key.
      const onKeyPos = out.lastIndexOf('onButtonClick', pushDot);
      if (onKeyPos === -1) { cursor = pushDot + 1; continue; }
      const afterOn = onKeyPos + 'onButtonClick'.length;
      const colonPos = out.indexOf(':', afterOn);
      if (colonPos === -1 || colonPos > pushDot) { cursor = pushDot + 1; continue; }
      let braceStart = out.indexOf('{', colonPos);
      if (braceStart === -1 || braceStart > pushDot) { cursor = pushDot + 1; continue; }

      // 5. Find the entire function body of the handler.
      const braceEnd = findMatchingBrace(out, braceStart);
      if (braceEnd === -1 || braceEnd < pushDot) { cursor = pushDot + 1; continue; }

      // 6. Define the span of code to be replaced.
      let replaceFrom = onKeyPos;
      let replaceTo = braceEnd;
      let commaAfter = '';
      if (out[replaceTo + 1] === ',') {
        commaAfter = ',';
        replaceTo = replaceTo + 1; // Include the comma in the replacement span.
      }

      // 7. Build the minimal replacement handler.
      const replacement = `onButtonClick:()=>{${routerVar}.push("${TARGET_ROUTE}");}${commaAfter}`;
      const originalSnippet = out.slice(replaceFrom, replaceTo + 1);
      const minimalForm = `onButtonClick:()=>{${routerVar}.push("${TARGET_ROUTE}");}${commaAfter}`;
      if (originalSnippet === minimalForm || originalSnippet === `onButtonClick:()=>{${routerVar}.push('${TARGET_ROUTE}');}${commaAfter}`) {
        cursor = replaceTo + 1;
        continue; // Avoid infinite loops if already patched.
      }

      // 8. Apply the replacement.
      out = out.slice(0, replaceFrom) + replacement + out.slice(replaceTo + 1);
      made++;
      cursor = replaceFrom + replacement.length; // Move cursor past the new code.
    }

    return out;
  }

  /**
   * Applies patches to chunk `4370*.js`. This function has two goals:
   * 1. Like `patch6150`, it simplifies any `onButtonClick` handler that navigates to
   * `/practice-hub/words/practice` to bypass potential premium checks.
   * 2. It also searches the object containing that button handler for a `disabled: !...`
   * property and removes it, effectively enabling the button.
   * @param {string} code The original code of the chunk.
   * @returns {string} The modified code.
   */
  function patch4370(code) {
    const TARGET_ROUTE = '/practice-hub/words/practice';
    let out = code;
    let cursor = 0;
    let made = 0;

    // Helper functions (same as in patch6150).
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
        if (ch === '{') {
          depth++;
        } else if (ch === '}') {
          depth--;
          if (depth === 0) return k;
        } else if (ch === '"' || ch === "'" || ch === '`') {
          const qc = ch;
          k++;
          while (k < str.length) {
            if (str[k] === '\\') { k += 2; continue; }
            if (str[k] === qc) break;
            k++;
          }
        } else if (ch === '/') {
          const next = str[k + 1];
          if (next === '/') {
            k += 2;
            while (k < str.length && str[k] !== '\n') k++;
          } else if (next === '*') {
            k += 2;
            while (k + 1 < str.length && !(str[k] === '*' && str[k + 1] === '/')) k++;
            k += 1;
          }
        }
      }
      return -1;
    }

    /**
     * Helper to find and remove a `disabled: !identifier` property within a given
     * object string. It handles various comma placements and adjusts the indices
     * of the main replacement to account for the removed code.
     */
    function removeDisabledInObject(currentOut, objStart, objEnd, replaceFrom, replaceTo) {
      const objStr = currentOut.slice(objStart, objEnd + 1);
      let m = objStr.match(/disabled\s*:\s*!\s*([A-Za-z_$][\w$]*)\s*,/); // `disabled: !ident,`
      let relIndex = -1;
      let matchLen = 0;
      if (m) {
        relIndex = objStr.indexOf(m[0]);
        matchLen = m[0].length;
      } else {
        m = objStr.match(/,\s*disabled\s*:\s*!\s*([A-Za-z_$][\w$]*)\s*/); // `,disabled: !ident`
        if (m) {
          relIndex = objStr.indexOf(m[0]);
          matchLen = m[0].length;
        } else {
          m = objStr.match(/^\s*\{\s*disabled\s*:\s*!\s*([A-Za-z_$][\w$]*)\s*\}\s*$/); // `{disabled: !ident}`
          if (m) {
            relIndex = 0;
            matchLen = objStr.length;
          }
        }
      }

      if (relIndex === -1) return { out: currentOut, replaceFrom, replaceTo, removed: false };

      const absIdx = objStart + relIndex;
      const newOut = currentOut.slice(0, absIdx) + currentOut.slice(absIdx + matchLen);
      const removedLen = matchLen;
      if (absIdx < replaceFrom) replaceFrom -= removedLen;
      if (absIdx <= replaceTo) replaceTo -= removedLen;

      // Clean up potential leftover commas like `,,` or `{,`.
      const cleanStart = Math.max(0, absIdx - 40);
      const cleanEnd = Math.min(newOut.length, absIdx + 40);
      const before = newOut.slice(0, cleanStart);
      const mid = newOut.slice(cleanStart, cleanEnd).replace(/,\s*,/g, ',').replace(/\{\s*,/g, '{');
      const after = newOut.slice(cleanEnd);

      return { out: before + mid + after, replaceFrom, replaceTo, removed: true };
    }

    // Main replacement loop (similar to patch6150).
    while (true) {
      const pushDot = out.indexOf('.push(', cursor);
      if (pushDot === -1) break;
      let p = pushDot + '.push('.length;
      while (p < out.length && /\s/.test(out[p])) p++;
      const quote = out[p];
      if (quote !== '"' && quote !== "'") {
        cursor = pushDot + 1;
        continue;
      }
      const qch = quote;
      let q = p + 1;
      let arg = null;
      while (q < out.length) {
        if (out[q] === '\\') { q += 2; continue; }
        if (out[q] === qch) { arg = out.slice(p + 1, q); break; }
        q++;
      }
      if (arg !== TARGET_ROUTE) {
        cursor = pushDot + 1;
        continue;
      }
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

      // --- This is the additional step ---
      // Before replacing `onButtonClick`, find its parent object and try to remove the `disabled` property.
      let objStart = -1, objEnd = -1;
      const scanLimit = 2000;
      const leftBound = Math.max(0, replaceFrom - scanLimit);
      for (let j = replaceFrom - 1; j >= leftBound; j--) {
        if (out[j] === '{') {
          const match = findMatchingBrace(out, j);
          if (match !== -1 && match >= replaceTo) {
            objStart = j;
            objEnd = match;
            break;
          }
        } else if (out[j] === ';' || out[j] === '(') {
          if (replaceFrom - j > 200) break;
        }
      }

      if (objStart !== -1) {
        const res = removeDisabledInObject(out, objStart, objEnd, replaceFrom, replaceTo);
        if (res.removed) {
          out = res.out; // The code has changed.
          replaceFrom = res.replaceFrom; // Indices must be updated.
          replaceTo = res.replaceTo;
        }
      }
      // --- End of additional step ---

      let commaAfter = '';
      if (out[replaceTo + 1] === ',') {
        commaAfter = ',';
        replaceTo = replaceTo + 1;
      }
      const originalSnippet = out.slice(replaceFrom, replaceTo + 1);
      const minimalForm = `onButtonClick:()=>{${routerVar}.push("${TARGET_ROUTE}");}${commaAfter}`;
      if (originalSnippet === minimalForm || originalSnippet === `onButtonClick:()=>{${routerVar}.push('${TARGET_ROUTE}');}${commaAfter}`) {
        cursor = replaceTo + 1;
        continue;
      }
      const replacement = `onButtonClick:()=>{${routerVar}.push("${TARGET_ROUTE}");}${commaAfter}`;
      out = out.slice(0, replaceFrom) + replacement + out.slice(replaceTo + 1);
      made++;
      cursor = replaceFrom + replacement.length;
    }

    out = out.replace(/,\s*,/g, ',').replace(/\{\s*,/g, '{');
    return out;
  }

  /**
   * Fetches the text content of a script from its URL in the page's context.
   * Caching is disabled to ensure the original, unmodified script is fetched.
   * @param {string} url The URL of the script to fetch.
   * @returns {Promise<string>} A promise that resolves with the script's text content.
   */
  async function pageFetchText(url) {
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) throw new Error('fetch failed ' + res.status);
    return await res.text();
  }

  /**
   * Executes a given string of JavaScript code by injecting it into the page.
   * @param {string} url The original URL of the script (used for tracking).
   * @param {string} code The patched JavaScript code to execute.
   * @returns {boolean} True on success, false on failure.
   */
  function execPatched(url, code) {
    if (executed.has(url)) return true; // Don't execute twice.

    try {
      // The preferred method: create a script tag with a Blob URL.
      // This is clean, executes in the correct scope, and its `onload` event
      // reliably signals when the script has finished executing.
      const blob = new Blob([code], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      const s = document.createElement('script');
      s.src = blobUrl;
      s.async = false;
      s.setAttribute('data-ext-patched', 'true');
      s.onload = () => {
        // If this was the main app script, set the `appReady` flag and
        // trigger the flushing of any queued scripts.
        if (isAppUrl(url) && !appReady) {
          appReady = true;
          try { window.dispatchEvent(new Event('ext-app-ready')); } catch {}
          flushQueue();
        }
      };
      // Inject the script into the DOM.
      (document.currentScript && document.currentScript.parentNode)
        ? document.currentScript.parentNode.insertBefore(s, document.currentScript)
        : (document.head || document.documentElement).appendChild(s);

      executed.add(url);
      return true;
    } catch (errBlob) {
      // Fallback method: if creating a Blob URL fails, use `new Function`.
      // This is similar to eval() but safer. The sourceURL comment helps debugging.
      try {
        const fn = new Function(code + "\n//# sourceURL=patched-" + (url.split('/').pop() || 'chunk'));
        fn();
        executed.add(url);
        // The fallback doesn't have an onload event, so we must trigger app-ready logic here.
        if (isAppUrl(url) && !appReady) {
          appReady = true;
          try { window.dispatchEvent(new Event('ext-app-ready')); } catch {}
          flushQueue();
        }
        return true;
      } catch (errEval) {
        console.warn('exec failed', url, errEval);
        return false;
      }
    }
  }

  /**
   * Processes the script queue. This function is called once the main app script
   * is ready. It iterates through the queued URLs and executes any that have
   * their patched code available.
   */
  function flushQueue() {
    if (!appReady) return; // Do nothing until the app is ready.

    let progressed = false;
    for (let i = 0; i < queue.length; i++) {
      const url = queue[i];
      if (executed.has(url)) continue;
      const code = codeMap.get(url);
      if (code) {
        if (execPatched(url, code)) {
          progressed = true;
        }
      }
    }

    // Clean up the queue by removing scripts that have been executed.
    for (let i = queue.length - 1; i >= 0; i--) {
      if (executed.has(queue[i])) queue.splice(i, 1);
    }

    // If progress was made and there are still items in the queue, re-run the flush.
    // This handles cases where executing one script might be a prerequisite for another.
    if (progressed && queue.some(u => codeMap.has(u) && !executed.has(u))) {
      flushQueue();
    }
  }

  // --- Message Handling ---
  // Sets up a listener for messages from the extension's content script.
  // This is the primary communication channel for coordinating the patching process.
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || ev.source !== window) return;

    // A script was blocked by the extension's request listener. Add its URL to our
    // execution queue to preserve the original script order.
    if (d.source === 'ext-injector-enqueue' && d.url) {
      if (!queue.includes(d.url)) queue.push(d.url);
      return;
    }

    // Received a request to patch and execute a script.
    if (d.source === 'ext-injector' && d.url) {
      const url = d.url;

      // Case 1: The extension has already patched the code (e.g., in the background script)
      // and sent it to us.
      if (typeof d.patchedCode === 'string') {
        try {
          const patched = d.patchedCode;
          codeMap.set(url, patched); // Store the patched code.

          // If it's the app script, execute it immediately.
          // If it's another script and the app is already ready, execute it.
          // Otherwise, it will be executed later by `flushQueue`.
          if (isAppUrl(url) || appReady) {
            execPatched(url, patched);
          }
          // Notify the content script of success.
          window.postMessage({ source: 'ext-injector-result', url, ok: true }, '*');
        } catch (err) {
          window.postMessage({ source: 'ext-injector-result', url, ok: false }, '*');
        }
        return;
      }

      // Case 2: No patched code was provided. This script must fetch the original code,
      // patch it, and then handle execution.
      (async () => {
        try {
          const original = await pageFetchText(url);
          const patched = applyPatches(url, original);
          codeMap.set(url, patched);

          if (isAppUrl(url) || appReady) {
            execPatched(url, patched);
          } // Otherwise, wait for flushQueue.

          window.postMessage({ source: 'ext-injector-result', url, ok: true }, '*');
        } catch (err) {
          console.error('page fetch/patch failed', url, err);
          window.postMessage({ source: 'ext-injector-result', url, ok: false }, '*');
        }
      })();
    }
  });

  // Also listen for our own custom "app-ready" event. This ensures the queue
  // is flushed as soon as the app script finishes executing, regardless of how
  // it was initiated.
  window.addEventListener('ext-app-ready', flushQueue);
})();