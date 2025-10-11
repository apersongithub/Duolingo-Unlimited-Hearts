(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.__PATCHES__ = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Shared patch logic for both background and in-page module (injection.js)

  const APP_RE = /^app([.-].*|)\.js(\?.*|)?$/i;
  const CHUNK_7220_RE = /^7220[^/]*\.js(\?.*|)?$/i;
  const CHUNK_6150_RE = /^6150[^/]*\.js(\?.*|)?$/i;
  const CHUNK_4370_RE = /^4370[^/]*\.js(\?.*|)?$/i;

  const isAppUrl = url => APP_RE.test((url || '').split('/').pop() || '');

  function applyPatches(url, code) {
    try {
      const name = (url || '').split('/').pop() || '';
      if (APP_RE.test(name)) code = patchApp(code);
      if (CHUNK_7220_RE.test(name)) code = patch7220(code);
      if (CHUNK_6150_RE.test(name)) code = patch6150(code);
      if (CHUNK_4370_RE.test(name)) code = patch4370(code);
      return code;
    } catch {
      return code;
    }
  }

  // Patches below intentionally concise; keep replacements identical to legacy versions.

  function patchApp(code) {
    // Inject premium subscription + hasPlus + speech recognition unlock
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

  function patch7220(code) {
    code = code.replace(/isDisabled:\s*!0\s*,/g, 'isDisabled: false,')
               .replace(/isDisabled:!0,/g, 'isDisabled: false,')
               .replace(/showSuperBadge:\s*!e\s*,/g, 'showSuperBadge: false,')
               .replace(/showSuperBadge:!e,/g, 'showSuperBadge: false,')
               .replace(/e\s*=>\s*e\.user\.hasPlus/g, 'e => !e.user.hasPlus');
    return code;
  }

  function patch6150(code) {
    return replaceOnButtonClick(code, '/mistakes-review', { removeDisabled: true });
  }

  function patch4370(code) {
    return replaceOnButtonClick(code, '/practice-hub/words/practice', { removeDisabled: true });
  }

  // Generic handler used by patch6150 & patch4370
  function replaceOnButtonClick(code, targetRoute, opts = {}) {
    let out = code;
    let cursor = 0;

    while (true) {
      const pushIdx = out.indexOf('.push(', cursor);
      if (pushIdx === -1) break;

      let p = pushIdx + '.push('.length;
      while (p < out.length && /\s/.test(out[p])) p++;
      const q = out[p];
      if (!q || (q !== '"' && q !== '\'')) {
        cursor = pushIdx + 1;
        continue;
      }
      let q2 = p + 1; let arg = '';
      while (q2 < out.length) {
        if (out[q2] === '\\') { q2 += 2; continue; }
        if (out[q2] === q) break;
        arg += out[q2++];
      }
      if (arg !== targetRoute) {
        cursor = pushIdx + 1;
        continue;
      }

      const routerIdent = identBefore(out, pushIdx);
      if (!routerIdent) {
        cursor = pushIdx + 1;
        continue;
      }

      const keyPos = out.lastIndexOf('onButtonClick', pushIdx);
      if (keyPos === -1) {
        cursor = pushIdx + 1;
        continue;
      }
      const colon = out.indexOf(':', keyPos + 'onButtonClick'.length);
      if (colon === -1 || colon > pushIdx) {
        cursor = pushIdx + 1;
        continue;
      }
      const braceStart = out.indexOf('{', colon);
      if (braceStart === -1 || braceStart > pushIdx) {
        cursor = pushIdx + 1;
        continue;
      }
      const braceEnd = matchBrace(out, braceStart);
      if (braceEnd === -1 || braceEnd < pushIdx) {
        cursor = pushIdx + 1;
        continue;
      }

      let replaceFrom = keyPos;
      let replaceTo = braceEnd;
      let commaAfter = '';
      if (out[replaceTo + 1] === ',') {
        commaAfter = ',';
        replaceTo++;
      }

      // Extra: remove disabled property in parent object (originally for 4370 only)
      if (opts.removeDisabled) {
        const parentInfo = removeDisabled(out, replaceFrom, replaceTo);
        out = parentInfo.out;
        replaceFrom = parentInfo.replaceFrom;
        replaceTo = parentInfo.replaceTo;
      }

      const replacement = `onButtonClick:()=>{${routerIdent}.push("${targetRoute}");}${commaAfter}`;
      out = out.slice(0, replaceFrom) + replacement + out.slice(replaceTo + 1);
      cursor = replaceFrom + replacement.length;
    }

    return out.replace(/,\s*,/g, ',').replace(/\{\s*,/g, '{');
  }

  // Helpers
  function identBefore(str, dotPos) {
    let i = dotPos - 1;
    while (i >= 0 && /\s/.test(str[i])) i--;
    if (i < 0 || !/[A-Za-z0-9_$]/.test(str[i])) return null;
    let end = i;
    while (i >= 0 && /[A-Za-z0-9_$]/.test(str[i])) i--;
    return str.slice(i + 1, end + 1);
  }

  function matchBrace(str, start) {
    let depth = 0;
    for (let i = start; i < str.length; i++) {
      const ch = str[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return i;
      } else if (ch === '"' || ch === '\'' || ch === '`') {
        const q = ch; i++;
        while (i < str.length) {
          if (str[i] === '\\') { i += 2; continue; }
          if (str[i] === q) break;
          i++;
        }
      } else if (ch === '/') {
        const n = str[i + 1];
        if (n === '/') {
          i += 2;
          while (i < str.length && str[i] !== '\n') i++;
        } else if (n === '*') {
          i += 2;
          while (i + 1 < str.length && !(str[i] === '*' && str[i + 1] === '/')) i++;
          i++;
        }
      }
    }
    return -1;
  }

  function removeDisabled(out, replaceFrom, replaceTo) {
    // Scan backwards to find parent object open brace
    const scanLimit = 2000;
    const leftBound = Math.max(0, replaceFrom - scanLimit);
    let objStart = -1;
    for (let j = replaceFrom - 1; j >= leftBound; j--) {
      if (out[j] === '{') {
        const end = matchBrace(out, j);
        if (end !== -1 && end >= replaceTo) {
          objStart = j;
          break;
        }
      }
    }
    if (objStart === -1) return { out, replaceFrom, replaceTo };

    const objEnd = matchBrace(out, objStart);
    const objStr = out.slice(objStart, objEnd + 1);
    const patts = [
      /disabled\s*:\s*!\s*[A-Za-z_$][\w$]*\s*,/,
      /,\s*disabled\s*:\s*!\s*[A-Za-z_$][\w$]*/,
      /^\{\s*disabled\s*:\s*!\s*[A-Za-z_$][\w$]*\s*\}$/
    ];
    for (const r of patts) {
      const m = objStr.match(r);
      if (m) {
        const rel = objStr.indexOf(m[0]);
        const abs = objStart + rel;
        out = out.slice(0, abs) + out.slice(abs + m[0].length);
        const removedLen = m[0].length;
        if (abs < replaceFrom) replaceFrom -= removedLen;
        if (abs <= replaceTo) replaceTo -= removedLen;
        break;
      }
    }
    return { out: out.replace(/,\s*,/g, ','), replaceFrom, replaceTo };
  }

  return {
    applyPatches,
    isAppUrl,
    patchApp,
    patch7220,
    patch6150,
    patch4370
  };
}));