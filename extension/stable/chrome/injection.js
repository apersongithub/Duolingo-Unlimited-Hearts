// Orchestrates patch execution in page context
import { applyPatches, isAppUrl, setPatchMode } from './shared/patches.js';

if (!window.__EXT_PATCH_INJECTED__) {
  window.__EXT_PATCH_INJECTED__ = true;

  const queue = [];
  const codeMap = new Map();
  const executed = new Set();
  let appReady = false;

  // Default patch mode
  setPatchMode(1);

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
        if (isAppUrl(url) && !appReady) {
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
        if (isAppUrl(url) && !appReady) {
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

    // Explicitly set patch mode from content script (handshake-safe)
    if (d.source === 'ext-set-patch-mode' && typeof d.patchMode === 'number') {
      const m = Math.min(Math.max(d.patchMode, 1), 9);
      setPatchMode(m);
      return;
    }

    if (d.source === 'ext-injector-enqueue') {
      if (typeof d.patchMode === 'number') setPatchMode(d.patchMode);
      if (d.url && !queue.includes(d.url)) queue.push(d.url);
      return;
    }

    if (d.source === 'ext-injector' && d.url) {
      const { url } = d;
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
          const original = await pageFetchText(url);
          const patched = applyPatches(url, original);
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

  // Signal readiness so content_script can safely send mode and enqueue
  try {
    window.postMessage({ source: 'ext-injector-ready' }, '*');
  } catch {}
}