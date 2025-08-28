// injection.js - runs in page context
// Listens for window.postMessage from content script with { source: 'ext-injector', url, patchedCode? }
// If patchedCode is present it will execute that. Otherwise it will fetch the URL itself (page-context fetch),
// patch, and attempt to inject via blob or new Function. It posts back the result { source: 'ext-injector-result', url, ok }.

(function () {
  if (window.__EXT_PATCH_INJECTED__) return;
  window.__EXT_PATCH_INJECTED__ = true;

  function patchCode(code) {
    code = code.replace(/=>\s*(['"])free\1/g, '=> "schools"');
    code = code.replace(
      /\[\s*(['"])\s*schools\s*\1\s*,\s*(['"])\s*beta course\s*\2\s*,\s*(['"])\s*revenue paused\s*\3\s*\]/g,
      (match, q1) => `[${q1}schools${q1}, ${q1}beta course${q1}, ${q1}revenue paused${q1}, ${q1}free${q1}]`
    );
    return code;
  }

  async function fetchPatchAndRun(url) {
    try {
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error('fetch failed ' + res.status);
      const original = await res.text();
      const patched = patchCode(original);

      // try blob injection
      try {
        const blob = new Blob([patched], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        const s = document.createElement('script');
        s.src = blobUrl;
        s.async = false;
        s.setAttribute('data-ext-patched', 'true');
        (document.currentScript && document.currentScript.parentNode)
          ? document.currentScript.parentNode.insertBefore(s, document.currentScript)
          : (document.head || document.documentElement).appendChild(s);
        return true;
      } catch (errBlob) {
        console.warn('blob injection failed', errBlob);
      }

      // fallback: new Function
      try {
        const fn = new Function(patched + "\n//# sourceURL=patched-app.js");
        fn();
        return true;
      } catch (errEval) {
        console.warn('eval injection failed', errEval);
        return false;
      }
    } catch (err) {
      console.error('page fetch/patch failed', err);
      return false;
    }
  }

  window.addEventListener('message', async (ev) => {
    if (!ev.data || ev.source !== window) return;
    const d = ev.data;
    if (d && d.source === 'ext-injector' && d.url) {
      let ok = false;
      if (d.patchedCode) {
        // execute patchedCode directly
        try {
          // try blob creation first
          try {
            const blob = new Blob([d.patchedCode], { type: 'application/javascript' });
            const blobUrl = URL.createObjectURL(blob);
            const s = document.createElement('script');
            s.src = blobUrl;
            s.async = false;
            s.setAttribute('data-ext-patched', 'true');
            (document.currentScript && document.currentScript.parentNode)
              ? document.currentScript.parentNode.insertBefore(s, document.currentScript)
              : (document.head || document.documentElement).appendChild(s);
            ok = true;
          } catch (bErr) {
            // fallback to new Function
            const fn = new Function(d.patchedCode + "\n//# sourceURL=patched-app.js");
            fn();
            ok = true;
          }
        } catch (errExec) {
          console.error('executing patchedCode failed', errExec);
          ok = false;
        }
        window.postMessage({ source: 'ext-injector-result', url: d.url, ok }, '*');
        return;
      } else {
        // no patched code provided: attempt to fetch/patch/run in page context
        ok = await fetchPatchAndRun(d.url);
        window.postMessage({ source: 'ext-injector-result', url: d.url, ok }, '*');
        return;
      }
    }
  }, false);

  // signal ready if useful
  window.postMessage({ source: 'ext-injector-ready' }, '*');
})();

// exploit_banner_injector.js
const script = document.createElement('script');
script.textContent = `
(function() {
  const originalAppend = Element.prototype.appendChild;
  Element.prototype.appendChild = function(child) {
    try {
      if (child.classList && child.classList.contains("vp1gi")) {
        child.innerHTML = \`
          Exploit found by apersongithub
          <div style="margin-top:10px;">
            <a href="https://www.buymeacoffee.com/aperson" target="_blank">
              <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
                   alt="Buy Me A Coffee"
                   style="height: 60px !important; width: 217px !important;">
            </a>
          </div>
        \`;
      }
    } catch (e) {}
    return originalAppend.call(this, child);
  };
})();
`;
(document.head || document.documentElement).appendChild(script);
script.remove();