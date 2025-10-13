// injection.js - page-context orchestrator (fallback)
// Lightweight, non-invasive injector that can fetch, patch, and re-execute JS chunks
// Now uses shared/patches.js provided by the extension.

(function () {
  // avoid double-injection
  if (window.__EXT_PATCH_INJECTED__) return;
  window.__EXT_PATCH_INJECTED__ = true;

  // selected patch mode (default 'patch1'); ask content script for the current mode
  let selectedMode = 'patch1';
  try { window.postMessage({ source: 'ext-injector-get-mode' }, '*'); } catch {}
  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || ev.source !== window) return;
    if (d.source === 'ext-injector-mode' && ['patch1','patch2','patch3','patch4','patch5'].includes(d.mode)) {
      selectedMode = d.mode;
    }
  });

  // ensure shared patches are available in the page
  let isAppUrlFn = (url) => /(^|\/)app[^/]*\.js(\?.*)?$/i.test(url); // fallback until shared loads

  const patchesReady = (async () => {
    if (window.__PATCHES__) {
      if (window.__PATCHES__.isAppUrl) isAppUrlFn = window.__PATCHES__.isAppUrl;
      return;
    }
    await new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL('shared/patches.js');
      s.async = false;
      s.onload = () => {
        if (window.__PATCHES__ && window.__PATCHES__.isAppUrl) {
          isAppUrlFn = window.__PATCHES__.isAppUrl;
        }
        resolve();
      };
      s.onerror = () => resolve(); // fail-safe: keep fallback regex
      (document.documentElement || document.head || document).appendChild(s);
    });
  })();

  // helper: match the main app chunk filename (often "app.*.js")
  const isAppUrl = (url) => isAppUrlFn(url);

  // work queue and maps
  const queue = [];               // URLs queued for execution (maintain order)
  const codeMap = new Map();      // url -> patched code
  const executed = new Set();     // url's we've already executed
  let appReady = false;           // set once the app chunk runs (controls flush)

  // fetch a script from the page context (credentials included)
  async function pageFetchText(url) {
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) throw new Error('fetch failed ' + res.status);
    return await res.text();
  }

  // execute patched code
  function execPatched(url, code) {
    if (executed.has(url)) return true; // idempotent
    try {
      const blob = new Blob([code], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      const s = document.createElement('script');
      s.src = blobUrl;
      s.async = false; // preserve execution order
      s.setAttribute('data-ext-patched', 'true');
      s.onload = () => {
        if (isAppUrl(url) && !appReady) {
          appReady = true;
          try { window.dispatchEvent(new Event('ext-app-ready')); } catch {}
          flushQueue();
        }
      };
      (document.currentScript && document.currentScript.parentNode)
        ? document.currentScript.parentNode.insertBefore(s, document.currentScript)
        : (document.head || document.documentElement).appendChild(s);
      executed.add(url);
      return true;
    } catch (errBlob) {
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
        console.warn('exec failed', url, errEval);
        return false;
      }
    }
  }

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
    for (let i = queue.length - 1; i >= 0; i--) {
      if (executed.has(queue[i])) queue.splice(i, 1);
    }
    if (progressed && queue.some(u => codeMap.has(u) && !executed.has(u))) {
      flushQueue();
    }
  }

  window.addEventListener('message', (ev) => {
    const d = ev.data;
    if (!d || ev.source !== window) return;

    if (d.source === 'ext-injector-enqueue' && d.url) {
      if (!queue.includes(d.url)) queue.push(d.url);
      return;
    }

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

      (async () => {
        try {
          await patchesReady;
          const original = await pageFetchText(url);
          const patched = (window.__PATCHES__ && window.__PATCHES__.applyPatches)
            ? window.__PATCHES__.applyPatches(url, original, selectedMode)
            : original;
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

  window.addEventListener('ext-app-ready', flushQueue);
})();