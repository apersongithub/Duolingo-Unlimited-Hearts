// injection.js - page-context orchestrator (fallback)
// Lightweight, non-invasive injector that can fetch, patch, and re-execute JS chunks
// Now uses shared/patches.js provided by the extension.

(function () {
  // avoid double-injection
  if (window.__EXT_PATCH_INJECTED__) return;
  window.__EXT_PATCH_INJECTED__ = true;

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

      (async () => {
        try {
          await patchesReady;
          const original = await pageFetchText(url);
          const patched = (window.__PATCHES__ && window.__PATCHES__.applyPatches)
            ? window.__PATCHES__.applyPatches(url, original)
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

  // allow manual flush triggers as well
  window.addEventListener('ext-app-ready', flushQueue);
})();