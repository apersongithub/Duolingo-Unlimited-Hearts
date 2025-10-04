// background.js - service worker for MV3
// This script runs in the background of the Chrome extension. Its primary role is to
// intercept requests for specific JavaScript files, fetch their original content,
// apply custom modifications ("patches") to them, and then serve the patched
// version to the browser. It also caches the patched scripts to speed up subsequent
// loads and provide an offline fallback.

/**
 * Asynchronously fetches the text content of a given URL.
 * It uses 'no-store' to bypass the browser cache, ensuring the latest version
 * of the script is always fetched from the server.
 * @param {string} url - The URL of the resource to fetch.
 * @returns {Promise<string>} A promise that resolves with the text content of the response.
 * @throws {Error} Throws an error if the network request fails (e.g., 404 Not Found).
 */
async function fetchText(url) {
  // Use 'no-store' to prevent caching and 'include' to send cookies.
  const resp = await fetch(url, { cache: 'no-store', credentials: 'include' });
  if (!resp.ok) throw new Error('fetch failed ' + resp.status);
  return await resp.text();
}

/**
 * Acts as a router to apply the correct patch based on the script's filename.
 * It examines the URL, extracts the filename, and uses regular expressions to match it
 * against known script patterns that require modification.
 * @param {string} url - The original URL of the script.
 * @param {string} code - The original JavaScript code as a string.
 * @returns {string} The patched code, or the original code if no patch is applicable or if an error occurs.
 */
function applyPatches(url, code) {
  try {
    // Extract the filename (e.g., "app-123.js") from the full URL.
    const name = (url || "").split("/").pop() || "";
    // Apply patches sequentially based on filename patterns.
    if (/^app([.-].*|)\.js(\?.*|)?$/i.test(name)) code = patchApp(code);
    if (/^7220[^/]*\.js(\?.*|)?$/i.test(name)) code = patch7220(code);
    if (/^6150[^/]*\.js(\?.*|)?$/i.test(name)) code = patch6150(code);
    if (/^4370[^/]*\.js(\?.*|)?$/i.test(name)) code = patch4370(code);
    return code;
  } catch (e) {
    // If any patch fails, return the original code to prevent breaking the application.
    return code;
  }
}

/**
 * Applies several modifications to the main application bundle (`app-*.js`).
 * These patches are designed to unlock premium features by altering the application's state.
 * @param {string} code - The original code of the app bundle.
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

/**
 * Applies simple string replacements to a specific code chunk (e.g., `7220-*.js`).
 * These patches typically target boolean flags to enable/disable UI elements or features.
 * @param {string} code - The original code of the chunk.
 * @returns {string} The modified code.
 */
function patch7220(code) {
  // Enables UI components by changing `isDisabled:!0` (true) to `isDisabled: false`.
  code = code.replace(/isDisabled:\s*!0\s*,/g, "isDisabled: false,");
  code = code.replace(/isDisabled:!0,/g, "isDisabled: false,");
  // Hides a "Super" badge.
  code = code.replace(/showSuperBadge:\s*!e\s*,/g, "showSuperBadge: false,");
  code = code.replace(/showSuperBadge:!e,/g, "showSuperBadge: false,");
  // Inverts the logic for a check, likely enabling a feature meant for non-plus users.
  code = code.replace(/e\s*=>\s*e\.user\.hasPlus/g, "e => !e.user.hasPlus");
  return code;
}

/**
 * Applies a complex patch to a specific code chunk (e.g., `6150-*.js`).
 * This function locates a specific `onButtonClick` handler related to reviewing mistakes
 * and replaces its entire body with a simple, direct navigation call. This bypasses any
 * conditional logic (e.g., premium checks) within the original handler.
 * @param {string} code - The original, potentially minified code of the chunk.
 * @returns {string} The patched code.
 */
function patch6150(code) {
  // This patch ensures that clicking a specific button always navigates to the mistakes review page.
  const TARGET_ROUTE = '/mistakes-review';
  let out = code;
  let cursor = 0; // Tracks the search position in the code string.

  /** Helper to find a valid JavaScript identifier (variable name) before a given position. */
  function findIdentifierBeforeDot(str, dotPos) {
    let i = dotPos - 1;
    while (i >= 0 && /\s/.test(str[i])) i--; // Skip whitespace
    if (i < 0 || !/[A-Za-z0-9_$]/.test(str[i])) return null;
    let end = i;
    while (i >= 0 && /[A-Za-z0-9_$]/.test(str[i])) i--;
    return str.slice(i + 1, end + 1);
  }

  /** Helper to find the matching closing brace `}` for an opening brace `{`, correctly handling nested structures, strings, and comments. */
  function findMatchingBrace(str, braceStart) {
    let depth = 1; // Start at depth 1 for the initial brace.
    for (let k = braceStart + 1; k < str.length; k++) {
      const ch = str[k];
      if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) return k; // Found the matching brace.
      } else if (ch === '"' || ch === "'" || ch === '`') { // Skip over strings
        const qc = ch;
        k++;
        while (k < str.length) {
          if (str[k] === '\\') { k += 2; continue; }
          if (str[k] === qc) break;
          k++;
        }
      } else if (ch === '/') { // Skip over comments
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

  // Main loop to find and replace all relevant handlers in the code.
  while (true) {
    // 1. Find the navigation call, e.g., `.push('/mistakes-review')`.
    const pushDot = out.indexOf('.push(', cursor);
    if (pushDot === -1) break;

    // 2. Extract the argument to confirm it's the target route.
    let p = pushDot + '.push('.length;
    while (p < out.length && /\s/.test(out[p])) p++;
    const quote = out[p];
    if (quote !== '"' && quote !== "'") { cursor = pushDot + 1; continue; } // Not a string literal.
    let q = p + 1;
    let arg = null;
    while (q < out.length) {
      if (out[q] === '\\') { q += 2; continue; }
      if (out[q] === quote) { arg = out.slice(p + 1, q); break; }
      q++;
    }
    if (arg !== TARGET_ROUTE) { cursor = pushDot + 1; continue; }

    // 3. Identify the router variable (e.g., `router` in `router.push(...)`).
    const routerVar = findIdentifierBeforeDot(out, pushDot);
    if (!routerVar) { cursor = pushDot + 1; continue; }

    // 4. Find the nearest `onButtonClick` property definition to the left.
    const onKeyPos = out.lastIndexOf('onButtonClick', pushDot);
    if (onKeyPos === -1) { cursor = pushDot + 1; continue; }
    const afterOn = onKeyPos + 'onButtonClick'.length;
    const colonPos = out.indexOf(':', afterOn);
    if (colonPos === -1 || colonPos > pushDot) { cursor = pushDot + 1; continue; }
    let braceStart = out.indexOf('{', colonPos);
    if (braceStart === -1 || braceStart > pushDot) { cursor = pushDot + 1; continue; }

    // 5. Find the start and end of the entire handler function body.
    const braceEnd = findMatchingBrace(out, braceStart);
    if (braceEnd === -1 || braceEnd < pushDot) { cursor = pushDot + 1; continue; }

    // 6. Define the exact code slice to be replaced.
    let replaceFrom = onKeyPos;
    let replaceTo = braceEnd;
    let commaAfter = ''; // Preserve a trailing comma if one exists.
    if (replaceTo + 1 < out.length && out[replaceTo + 1] === ',') {
      commaAfter = ',';
      replaceTo++;
    }
    
    // 7. Construct the minimal replacement handler.
    const replacement = `onButtonClick:()=>{${routerVar}.push("${TARGET_ROUTE}");}${commaAfter}`;

    // 8. Apply the replacement and advance the cursor.
    out = out.slice(0, replaceFrom) + replacement + out.slice(replaceTo + 1);
    cursor = replaceFrom + replacement.length;
  }

  return out;
}


/**
 * Applies a complex patch to another specific code chunk (e.g., `4370-*.js`).
 * This function is similar to `patch6150` but has an additional step: besides simplifying
 * the `onButtonClick` handler, it also finds the parent object containing that handler and
 * removes any `disabled: !<some_variable>` property from it. This ensures the button
or link is always enabled.
 * @param {string} code - The original, potentially minified code of the chunk.
 * @returns {string} The patched code.
 */
function patch4370(code) {
  const TARGET_ROUTE = '/practice-hub/words/practice';
  let out = code;
  let cursor = 0;

  // Re-using the same robust helper functions from patch6150.
  function findIdentifierBeforeDot(str, dotPos) { /* ... implementation from patch6150 ... */ }
  function findMatchingBrace(str, braceStart) { /* ... implementation from patch6150 ... */ }
  // (Implementations omitted for brevity, they are identical to the ones in patch6150)
  
  // (Identical helper function implementations from patch6150 are assumed here)
  function findIdentifierBeforeDot(str, dotPos) {let i=dotPos-1;while(i>=0&&/\s/.test(str[i]))i--;if(i<0||!/[A-Za-z0-9_$]/.test(str[i]))return null;let end=i;while(i>=0&&/[A-Za-z0-9_$]/.test(str[i]))i--;return str.slice(i+1,end+1);}
  function findMatchingBrace(str,braceStart){let depth=1;for(let k=braceStart+1;k<str.length;k++){const ch=str[k];if(ch==='{'){depth++;}else if(ch==='}'){depth--;if(depth===0)return k;}else if(ch==='"'||ch==="'"||ch==='`'){const qc=ch;k++;while(k<str.length){if(str[k]==='\\'){k+=2;continue;}
  if(str[k]===qc)break;k++;}}else if(ch==='/'){const next=str[k+1];if(next==='/'){k+=2;while(k<str.length&&str[k]!==
  '\n')k++;}else if(next==='*'){k+=2;while(k+1<str.length&&!(str[k]==='*'&&str[k+1]==='/'))k++;k+=1;}}}
  return-1;}
  
  /** Helper to find and remove a `disabled: !...` property within a given object code string. */
  function removeDisabledInObject(currentOut, objStart, objEnd, replaceFrom, replaceTo) {
    const objStr = currentOut.slice(objStart, objEnd + 1);
    
    // Match common patterns for the disabled property, with or without commas.
    let m = objStr.match(/disabled\s*:\s*!\s*([A-Za-z_$][\w$]*)\s*,/); // `disabled: !e,`
    let relIndex = -1;
    let matchLen = 0;
    if (m) {
      relIndex = objStr.indexOf(m[0]);
      matchLen = m[0].length;
    } else {
      m = objStr.match(/,\s*disabled\s*:\s*!\s*([A-Za-z_$][\w$]*)\s*/); // `, disabled: !e`
      if (m) {
        relIndex = objStr.indexOf(m[0]);
        matchLen = m[0].length;
      }
    }

    if (relIndex === -1) return { out: currentOut, replaceFrom, replaceTo, removed: false };

    // Remove the matched property string.
    const absIdx = objStart + relIndex;
    const newOut = currentOut.slice(0, absIdx) + currentOut.slice(absIdx + matchLen);
    const removedLen = matchLen;
    
    // Adjust the replacement indices for the main `onButtonClick` patch, since we've
    // now shifted the string content.
    if (absIdx < replaceFrom) replaceFrom -= removedLen;
    if (absIdx <= replaceTo) replaceTo -= removedLen;
    
    // Perform a small cleanup to fix potential syntax errors like `,,` or `{,`.
    const cleanMid = newOut.slice(absIdx - 2, absIdx + 2).replace(/,\s*,/g, ',').replace(/\{\s*,/g, '{');
    const finalOut = newOut.slice(0, absIdx - 2) + cleanMid + newOut.slice(absIdx + 2);

    return { out: finalOut, replaceFrom, replaceTo, removed: true };
  }

  // Main loop, similar to patch6150.
  while (true) {
    // 1. Find the navigation call.
    const pushDot = out.indexOf('.push(', cursor);
    if (pushDot === -1) break;

    // 2. Extract and verify the route argument.
    // ... (logic is identical to patch6150)
    let p=pushDot+'.push('.length;while(p<out.length&&/\s/.test(out[p]))p++;const quote=out[p];if(quote!=='"'&&quote!=="'"){cursor=pushDot+1;continue;}
    const qch=quote;let q=p+1;let arg=null;while(q<out.length){if(out[q]==='\\'){q+=2;continue;}
    if(out[q]===qch){arg=out.slice(p+1,q);break;}
    q++;}
    if(arg!==TARGET_ROUTE){cursor=pushDot+1;continue;}

    // 3. Identify the router variable.
    const routerVar = findIdentifierBeforeDot(out, pushDot);
    if (!routerVar) { cursor = pushDot + 1; continue; }

    // 4. Find the `onButtonClick` property definition.
    // ... (logic is identical to patch6150)
    const onKeyPos = out.lastIndexOf('onButtonClick', pushDot);
    if(onKeyPos===-1){cursor=pushDot+1;continue;}
    const afterOn=onKeyPos+'onButtonClick'.length;const colonPos=out.indexOf(':',afterOn);if(colonPos===-1||colonPos>pushDot){cursor=pushDot+1;continue;}
    let braceStart=out.indexOf('{',colonPos);if(braceStart===-1||braceStart>pushDot){cursor=pushDot+1;continue;}
    
    // 5. Find the handler's body boundaries.
    const braceEnd = findMatchingBrace(out, braceStart);
    if (braceEnd === -1 || braceEnd < pushDot) { cursor = pushDot + 1; continue; }

    let replaceFrom = onKeyPos;
    let replaceTo = braceEnd;

    // --- Additional Step for patch4370 ---
    // 6. Find the parent object and remove the `disabled` property from it.
    let objStart = -1;
    let objEnd = -1;
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
      }
    }
    if (objStart !== -1) {
      const res = removeDisabledInObject(out, objStart, objEnd, replaceFrom, replaceTo);
      if (res.removed) {
        // If the disabled property was removed, update our code string and indices.
        out = res.out;
        replaceFrom = res.replaceFrom;
        replaceTo = res.replaceTo;
      }
    }
    // --- End of Additional Step ---
    
    // 7. Define the replacement slice and preserve the trailing comma.
    let commaAfter = '';
    if (replaceTo + 1 < out.length && out[replaceTo + 1] === ',') {
      commaAfter = ',';
      replaceTo++;
    }
    
    // 8. Construct and apply the final replacement.
    const replacement = `onButtonClick:()=>{${routerVar}.push("${TARGET_ROUTE}");}${commaAfter}`;
    out = out.slice(0, replaceFrom) + replacement + out.slice(replaceTo + 1);
    cursor = replaceFrom + replacement.length;
  }

  // Final cleanup of any stray commas.
  out = out.replace(/,\s*,/g, ',').replace(/\{\s*,/g, '{');
  return out;
}

/**
 * Main message listener for the service worker.
 * This handles communication from other parts of the extension, such as content scripts
 * or the declarativeNetRequest rules engine.
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // --- Handler for FETCH_AND_PATCH requests ---
  // This is the primary workflow: fetch, patch, cache, and respond.
  if (msg?.type === 'FETCH_AND_PATCH') {
    const url = msg.url;
    (async () => {
      const key = 'patched:' + url;
      try {
        // Fetch fresh code from the network.
        const original = await fetchText(url);
        // Apply all relevant patches.
        const patched = applyPatches(url, original);
        // Store the patched version in local storage for future use.
        await chrome.storage.local.set({ [key]: patched, ['cachedAt:' + url]: Date.now() });
        // Send the fresh, patched code back.
        sendResponse({ ok: true, patched, fromCache: false });
      } catch (err) {
        // If fetching or patching fails, try to serve from the cache as a fallback.
        const cached = (await chrome.storage.local.get(key))[key];
        if (cached) {
          sendResponse({ ok: true, patched: cached, fromCache: true });
        } else {
          // If there's no cached version, respond with an error.
          sendResponse({ ok: false, error: String(err) });
        }
      }
    })();
    return true; // Indicates an asynchronous response.
  } 
  // --- Handler for GET_CACHED requests ---
  // This allows retrieving a patched script from the cache without a network request.
  else if (msg?.type === 'GET_CACHED') {
    const url = msg.url;
    const key = 'patched:' + url;
    (async () => {
      const cached = (await chrome.storage.local.get(key))[key];
      if (cached) {
        sendResponse({ ok: true, patched: cached });
      } else {
        sendResponse({ ok: false });
      }
    })();
    return true; // Indicates an asynchronous response.
  }
});