// injection.js - runs in page context; fallback fetch+patch+inject if needed.
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

      // try blob injection first
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
        try {
          // try blob
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
        ok = await fetchPatchAndRun(d.url);
        window.postMessage({ source: 'ext-injector-result', url: d.url, ok }, '*');
        return;
      }
    }
  }, false);

  window.postMessage({ source: 'ext-injector-ready' }, '*');
})();
