// Orchestrates patch execution in page context using UMD-exposed Patches
const P = (typeof window !== 'undefined' ? window : globalThis).__PATCHES__ || {};
const applyPatches = P.applyPatches;
const isAppUrl = P.isAppUrl;

if (!window.__EXT_PATCH_INJECTED__) {
  window.__EXT_PATCH_INJECTED__ = true;

  const queue = [];
  const codeMap = new Map();
  const executed = new Set();
  let appReady = false;

  async function pageFetchText(url) {
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) throw new Error('fetch failed ' + res.status);
    return res.text();
  }

  function execPatched(url, code) {
    if (executed.has(url)) return true;
    try {
      const blob = new Blob([code], { type: 'application/javascript' });
      const s = document.createElement('script');
      s.src = URL.createObjectURL(blob);
      s.async = false;
      s.onload = () => {
        if (typeof isAppUrl === 'function' && isAppUrl(url) && !appReady) {
          appReady = true;
          window.dispatchEvent(new Event('ext-app-ready'));
          flushQueue();
        }
      };
      (document.head || document.documentElement).appendChild(s);
      executed.add(url);
      return true;
    } catch {
      try {
        // Fallback
        (new Function(code + '\n//# sourceURL=patched-' + (url.split('/').pop() || 'chunk')))();
        executed.add(url);
        if (typeof isAppUrl === 'function' && isAppUrl(url) && !appReady) {
          appReady = true;
          window.dispatchEvent(new Event('ext-app-ready'));
          flushQueue();
        }
        return true;
      } catch (e) {
        console.warn('exec failed', url, e);
        return false;
      }
    }
  }

  function flushQueue() {
    if (!appReady) return;
    let progressed = false;
    for (const url of queue) {
      if (executed.has(url)) continue;
      const code = codeMap.get(url);
      if (code && execPatched(url, code)) progressed = true;
    }
    for (let i = queue.length - 1; i >= 0; i--) {
      if (executed.has(queue[i])) queue.splice(i, 1);
    }
    if (progressed && queue.some(u => codeMap.get(u) && !executed.has(u))) flushQueue();
  }

  window.addEventListener('message', ev => {
    const d = ev.data;
    if (!d || ev.source !== window) return;

    if (d.source === 'ext-injector-enqueue' && d.url) {
      if (!queue.includes(d.url)) queue.push(d.url);
      return;
    }

    if (d.source === 'ext-injector' && d.url) {
      const { url } = d;

      if (typeof d.patchedCode === 'string') {
        try {
          const patched = d.patchedCode;
          codeMap.set(url, patched);
          if ((typeof isAppUrl === 'function' && isAppUrl(url)) || appReady) execPatched(url, patched);
          window.postMessage({ source: 'ext-injector-result', url, ok: true }, '*');
        } catch {
          window.postMessage({ source: 'ext-injector-result', url, ok: false }, '*');
        }
        return;
      }

      (async () => {
        try {
          const original = await pageFetchText(url);
          const patched = typeof applyPatches === 'function' ? applyPatches(url, original) : original;
          codeMap.set(url, patched);
          if ((typeof isAppUrl === 'function' && isAppUrl(url)) || appReady) execPatched(url, patched);
          window.postMessage({ source: 'ext-injector-result', url, ok: true }, '*');
        } catch (err) {
          console.error('page fetch/patch failed', url, err);
          window.postMessage({ source: 'ext-injector-result', url, ok: false }, '*');
        }
      })();
    }
  });

  window.addEventListener('ext-app-ready', flushQueue);
}