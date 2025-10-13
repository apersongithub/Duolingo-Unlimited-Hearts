import { applyPatches, setPatchMode } from './shared/patches.js';

// Fetch helper
async function fetchText(url) {
  const resp = await fetch(url, { cache: 'no-store', credentials: 'include' });
  if (!resp.ok) throw new Error('fetch failed ' + resp.status);
  return resp.text();
}

async function getSelectedPatchMode() {
  try {
    const data = await chrome.storage.sync.get('settings');
    const mode = Number(data?.settings?.selectedPatch) || 1;
    return Math.min(Math.max(mode, 1), 9);
  } catch {
    return 1;
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'FETCH_AND_PATCH') {
    const { url } = msg;
    (async () => {
      const mode = await getSelectedPatchMode();
      setPatchMode(mode);
      const cacheKey = `patched:${mode}:${url}`;
      const cachedAtKey = `cachedAt:${mode}:${url}`;
      try {
        const original = await fetchText(url);
        const patched = applyPatches(url, original);
        await chrome.storage.local.set({
          [cacheKey]: patched,
          [cachedAtKey]: Date.now()
        });
        sendResponse({ ok: true, patched, fromCache: false });
      } catch (err) {
        const cached = (await chrome.storage.local.get(cacheKey))[cacheKey];
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
    const { url, patchMode } = msg;
    (async () => {
      const mode = Math.min(Math.max(Number(patchMode) || (await getSelectedPatchMode()), 1), 9);
      const cacheKey = `patched:${mode}:${url}`;
      const cached = (await chrome.storage.local.get(cacheKey))[cacheKey];
      sendResponse(cached ? { ok: true, patched: cached } : { ok: false });
    })();
    return true;
  }
});