import { applyPatches } from './shared/patches.js';

// Fetch helper
async function fetchText(url) {
  const resp = await fetch(url, { cache: 'no-store', credentials: 'include' });
  if (!resp.ok) throw new Error('fetch failed ' + resp.status);
  return resp.text();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'FETCH_AND_PATCH') {
    const { url } = msg;
    (async () => {
      const key = 'patched:' + url;
      try {
        const original = await fetchText(url);
        const patched = applyPatches(url, original);
        await chrome.storage.local.set({
          [key]: patched,
          ['cachedAt:' + url]: Date.now()
        });
        sendResponse({ ok: true, patched, fromCache: false });
      } catch (err) {
        const cached = (await chrome.storage.local.get(key))[key];
        if (cached) {
          sendResponse({ ok: true, patched: cached, fromCache: true });
        } else {
          sendResponse({ ok: false, error: String(err) });
        }
      }
    })();
    return true;
  }

  if (msg?.type === 'GET_CACHED') {
    const { url } = msg;
    const key = 'patched:' + url;
    (async () => {
      const cached = (await chrome.storage.local.get(key))[key];
      sendResponse(cached ? { ok: true, patched: cached } : { ok: false });
    })();
    return true;
  }
});