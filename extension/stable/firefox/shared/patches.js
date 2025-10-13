// Shared patch logic for both background and in-page module (injection.js)

const APP_RE = /^app([.-].*|)\.js(\?.*|)?$/i;
const CHUNK_7220_RE = /^7220[^/]*\.js(\?.*|)?$/i;
const CHUNK_6150_RE = /^6150[^/]*\.js(\?.*|)?$/i;
const CHUNK_4370_RE = /^4370[^/]*\.js(\?.*|)?$/i;

export const isAppUrl = url => APP_RE.test((url || '').split('/').pop() || '');

// Patch mode selection (1..9)
let PATCH_MODE = 1;
export function setPatchMode(mode) {
  const m = Number(mode) || 1;
  PATCH_MODE = Math.min(Math.max(m, 1), 9);
}
export function getPatchMode() {
  return PATCH_MODE;
}

export function applyPatches(url, code) {
  try {
    const name = (url || '').split('/').pop() || '';

    switch (PATCH_MODE) {
      case 1: {
        // Original behavior (legacy patches)
        if (APP_RE.test(name)) code = patchApp(code);
        if (CHUNK_7220_RE.test(name)) code = patch7220(code);
        if (CHUNK_6150_RE.test(name)) code = patch6150(code);
        if (CHUNK_4370_RE.test(name)) code = patch4370(code);
        return code;
      }
      case 2: {
        // Patch 2: app*.js only
        if (APP_RE.test(name)) code = patch2(code);
        return code;
      }
      case 3: {
        // Patch 3: app*.js only
        if (APP_RE.test(name)) code = patchCode3(code);
        return code;
      }
      case 4:
      case 5:
        // Userscript modes: no code mutation here. Userscripts are injected separately at document-start.
        return code;

      case 6: {
        // Premium subscription variant (same process as patch 1 but different subscription name)
        if (APP_RE.test(name)) code = patchAppPremium(code);
        if (CHUNK_7220_RE.test(name)) code = patch7220(code);
        if (CHUNK_6150_RE.test(name)) code = patch6150(code);
        if (CHUNK_4370_RE.test(name)) code = patch4370(code);
        return code;
      }
      case 7: {
        // Immersive subscription variant (same process as patch 1 but different subscription name)
        if (APP_RE.test(name)) code = patchAppImmersive(code);
        if (CHUNK_7220_RE.test(name)) code = patch7220(code);
        if (CHUNK_6150_RE.test(name)) code = patch6150(code);
        if (CHUNK_4370_RE.test(name)) code = patch4370(code);
        return code;
      }

      case 8:
      case 9:
        // Userscript modes (linked to userscripts/patch6.js and userscripts/patch7.js from content script)
        return code;

      default:
        return code;
    }
  } catch {
    return code;
  }
}

/**
 * Patch 1 (existing)
 * Patches below intentionally concise; keep replacements identical to legacy versions.
 */
export function patchApp(code) {
  // Inject premium subscription + hasPlus + speech recognition unlock

  // --- Patch e.items ---
  code = code.replace(
    /([A-Za-z_$][\w$]*)\s*=\s*e\s*=>\s*e\.items(?!\s*[\.\[(])\s*(?=[,;)}]|$)/g,
    `$1=e=>({...e.items,inventory:{...e.items.inventory,gold_subscription:{itemName:"gold_subscription",subscriptionInfo:{vendor:"STRIPE",renewing:true,isFamilyPlan:true,expectedExpiration:9999999999000}}}})`
  );

  // --- Patch e.user ---
  code = code.replace(
    /([A-Za-z_$][\w$]*)\s*=\s*e\s*=>\s*e\.user(?!\s*[\.\[(])\s*(?=[,;)}]|$)/g,
    `$1=(()=>{let lu=null,lpu=null;return e=>{const cu=e.user;if(cu===lu)return lpu;lu=cu;lpu={...cu,hasPlus:true};return lpu;};})()`
  );

  // --- Patch SpeechRecognition check ---
  code = code.replace(
    /([A-Za-z_$][\w$]*)\s*=\s*!!window\.webkitSpeechRecognition\s*&&\s*\(\s*[A-Za-z_$][\w$]*\.Z\.chrome\s*\|\|\s*[A-Za-z_$][\w$]*\.Z\.edgeSupportedSpeaking\s*\)/g,
    (_, v) => `${v} = !!(window.SpeechRecognition || window.webkitSpeechRecognition)`
  );
  return code;
}

// Patch 6: Premium subscription variant of patchApp
export function patchAppPremium(code) {
  // --- Patch e.items (premium_subscription) ---
  code = code.replace(
    /([A-Za-z_$][\w$]*)\s*=\s*e\s*=>\s*e\.items(?!\s*[\.\[(])\s*(?=[,;)}]|$)/g,
    `$1=e=>({...e.items,inventory:{...e.items.inventory,premium_subscription:{itemName:"premium_subscription",subscriptionInfo:{vendor:"STRIPE",renewing:true,isFamilyPlan:true,expectedExpiration:9999999999000}}}})`
  );

  // Keep the rest same as patchApp
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

// Patch 7: Immersive subscription variant of patchApp
export function patchAppImmersive(code) {
  // --- Patch e.items (immersive_subscription) ---
  code = code.replace(
    /([A-Za-z_$][\w$]*)\s*=\s*e\s*=>\s*e\.items(?!\s*[\.\[(])\s*(?=[,;)}]|$)/g,
    `$1=e=>({...e.items,inventory:{...e.items.inventory,immersive_subscription:{itemName:"immersive_subscription",subscriptionInfo:{vendor:"STRIPE",renewing:true,isFamilyPlan:true,expectedExpiration:9999999999000}}}})`
  );

  // Keep the rest same as patchApp
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

export function patch7220(code) {
  code = code.replace(/isDisabled:\s*!0\s*,/g, 'isDisabled: false,')
             .replace(/isDisabled:!0,/g, 'isDisabled: false,')
             .replace(/showSuperBadge:\s*!e\s*,/g, 'showSuperBadge: false,')
             .replace(/showSuperBadge:!e,/g, 'showSuperBadge: false,')
             .replace(/e\s*=>\s*e\.user\.hasPlus/g, 'e => !e.user.hasPlus');
  return code;
}

export function patch6150(code) {
  return replaceOnButtonClick(code, '/mistakes-review', { removeDisabled: true });
}

export function patch4370(code) {
  return replaceOnButtonClick(code, '/practice-hub/words/practice', { removeDisabled: true });
}

/**
 * Patch 2 (app.js only)
 */
export function patch2(code) {
  // 1) change => "free" or => 'free' to => "schools"
  code = code.replace(/=>\s*(['"])free\1/g, '=> "schools"');

  // 2) append "free" to exact array ["schools","beta course","revenue paused"]
  code = code.replace(
    /\[\s*(['"])\s*schools\s*\1\s*,\s*(['"])\s*beta course\s*\2\s*,\s*(['"])\s*revenue paused\s*\3\s*\]/g,
    (match, q1) => `[${q1}schools${q1}, ${q1}beta course${q1}, ${q1}revenue paused${q1}, ${q1}free${q1}]`
  );

  return code;
}

/**
 * Patch 3 (app.js only)
 */
export function patchCode3(code) {
  return code.replace(
    /(?<!const\s+\w+\s*=\s*)(\w+\s*=\s*\w*\s*=>\s*\[[^\]]*?)(\]\.includes\(\w*\))/g,
    (match, start, end) => {
      // Skip if "free" already present
      if (/["']free["']/.test(match)) return match;
      return `${start}, "free"${end}`;
    }
  );
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

    // Extra: remove disabled property in parent object
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
        if (i < str.length && str[i] === '\\') { i += 2; continue; }
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