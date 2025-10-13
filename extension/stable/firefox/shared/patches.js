// shared/patches.js
// UMD: exposes window.__PATCHES__ in browser contexts and module.exports in Node-like contexts
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.__PATCHES__ = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const APP_RE = /^app([.-].*|)\.js(\?.*|)?$/i;
  const CHUNK_7220_RE = /^7220[^/]*\.js(\?.*|)?$/i;
  const CHUNK_6150_RE = /^6150[^/]*\.js(\?.*|)?$/i;
  const CHUNK_4370_RE = /^4370[^/]*\.js(\?.*|)?$/i;

  function isAppUrl(url) {
    const name = (url || '').split('/').pop() || '';
    return APP_RE.test(name);
  }

  // mode: 'patch1' (default) | 'patch2' | 'patch3' | 'patch4' | 'patch5'
  // - patch1: legacy (app + 7220/6150/4370)
  // - patch2: app.js only (user-provided Patch 2)
  // - patch3: app.js only (user-provided Patch 3)
  // - patch4/patch5: no network patching; content_script injects userscripts
  function applyPatches(url, code, mode) {
    const sel = (mode === 'patch2' || mode === 'patch3' || mode === 'patch4' || mode === 'patch5') ? mode : 'patch1';
    try {
      const name = (url || '').split('/').pop() || '';

      if (sel === 'patch2') {
        if (APP_RE.test(name)) code = patch2(code);
        return code;
      }

      if (sel === 'patch3') {
        if (APP_RE.test(name)) code = patch3(code);
        return code;
      }

      if (sel === 'patch4' || sel === 'patch5') {
        // Userscript-based modes do not patch network chunks
        return code;
      }

      // patch1 (legacy) behavior
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
    code = code.replace(
      /([A-Za-z_$][\w$]*)\s*=\s*e\s*=>\s*e\.items(?!\s*[\.\[(])\s*(?=[,;)}]|$)/g,
      `$1=e=>({...e.items,inventory:{...e.items.inventory,gold_subscription:{itemName:"gold_subscription",subscriptionInfo:{vendor:"STRIPE",renewing:true,isFamilyPlan:true,expectedExpiration:9999999999000}}}})`
    );

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

  // User-provided Patch 2 (applies to app.js only)
  function patch2(code) {
    // 1) change => "free" or => 'free' to => "schools"
    code = code.replace(/=>\s*(['"])free\1/g, '=> "schools"');

    // 2) append "free" to exact array ["schools","beta course","revenue paused"]
    code = code.replace(
      /\[\s*(['"])\s*schools\s*\1\s*,\s*(['"])\s*beta course\s*\2\s*,\s*(['"])\s*revenue paused\s*\3\s*\]/g,
      (match, q1) => `[${q1}schools${q1}, ${q1}beta course${q1}, ${q1}revenue paused${q1}, ${q1}free${q1}]`
    );

    return code;
  }

  // User-provided Patch 3 (applies to app.js only)
  function patch3(code) {
    return code.replace(
      /(?<!const\s+\w+\s*=\s*)(\w+\s*=\s*\w*\s*=>\s*\[[^\]]*?)(\]\.includes\(\w*\))/g,
      (match, start, end) => {
        // Skip if "free" already present
        if (/["']free["']/.test(match)) return match;
        return `${start}, "free"${end}`;
      }
    );
  }

  function patch7220(code) {
    return code
      .replace(/isDisabled:\s*!0\s*,/g, 'isDisabled: false,')
      .replace(/isDisabled:!0,/g, 'isDisabled: false,')
      .replace(/showSuperBadge:\s*!e\s*,/g, 'showSuperBadge: false,')
      .replace(/showSuperBadge:!e,/g, 'showSuperBadge: false,')
      .replace(/e\s*=>\s*e\.user\.hasPlus/g, 'e => !e.user.hasPlus');
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
      if (!q || (q !== '"' && q !== "'")) {
        cursor = pushIdx + 1;
        continue;
      }
      let q2 = p + 1;
      let arg = '';
      while (q2 < out.length) {
        if (out[q2] === '\\') {
          q2 += 2;
          continue;
        }
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

      // Optional: remove disabled property in parent object
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
      } else if (ch === '"' || ch === "'" || ch === '`') {
        const q = ch;
        i++;
        while (i < str.length) {
          if (str[i] === '\\') {
            i += 2;
            continue;
          }
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
    isAppUrl,
    applyPatches,
    patchApp,
    patch2,
    patch3,
    patch7220,
    patch6150,
    patch4370
  };
});