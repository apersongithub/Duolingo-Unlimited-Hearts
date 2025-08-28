// background.js - service worker
// Listens for FETCH_AND_PATCH requests from content script and returns patched code (and caches it).

// Utility: fetch text with credentials included
async function fetchText(url) {
  const resp = await fetch(url, { cache: 'no-store', credentials: 'include' });
  if (!resp.ok) throw new Error('fetch failed ' + resp.status);
  return await resp.text();
}

function patchCode(code) {
  // 1) change => "free" or => 'free' to => "schools"
  code = code.replace(/=>\s*(['"])free\1/g, '=> "schools"');

  // 2) append "free" to exact array ["schools","beta course","revenue paused"]
  code = code.replace(
    /\[\s*(['"])\s*schools\s*\1\s*,\s*(['"])\s*beta course\s*\2\s*,\s*(['"])\s*revenue paused\s*\3\s*\]/g,
    (match, q1) => `[${q1}schools${q1}, ${q1}beta course${q1}, ${q1}revenue paused${q1}, ${q1}free${q1}]`
  );

  return code;
}

// handle messages from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'FETCH_AND_PATCH') {
    const url = msg.url;
    (async () => {
      const key = 'patched:' + url;
      try {
        const original = await fetchText(url);
        const patched = patchCode(original);
        // store in cache
        await chrome.storage.local.set({ [key]: patched, ['cachedAt:' + url]: Date.now() });
        sendResponse({ ok: true, patched, fromCache: false });
      } catch (err) {
        console.warn('background fetch/patch failed', err);
        // try to return cached patched version if present
        const cached = (await chrome.storage.local.get(key))[key];
        if (cached) {
          sendResponse({ ok: true, patched: cached, fromCache: true });
        } else {
          sendResponse({ ok: false, error: String(err) });
        }
      }
    })();
    return true; // indicate async response
  } else if (msg?.type === 'GET_CACHED') {
    const url = msg.url;
    const key = 'patched:' + url;
    (async () => {
      const cached = (await chrome.storage.local.get(key))[key];
      if (cached) sendResponse({ ok: true, patched: cached });
      else sendResponse({ ok: false });
    })();
    return true;
  }
});
