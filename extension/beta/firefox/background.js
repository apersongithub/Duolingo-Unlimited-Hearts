// background.js - Firefox MV2 background script
// Uses shared/patches.js (loaded first by manifest) via window/self.__PATCHES__
// - Intercepts app-*.js and 7220/6150/4370 chunks via webRequest.filterResponseData
//   and patches BEFORE execution (avoids race conditions).
// - Keeps caching to chrome.storage.local (same keys as before).
// - Still supports FETCH_AND_PATCH/GET_CACHED messages as a fallback.

const PATCHES = (typeof self !== 'undefined' ? self.__PATCHES__ : (typeof window !== 'undefined' ? window.__PATCHES__ : null));
if (!PATCHES) {
  console.warn('shared/patches.js not loaded; patching will be disabled.');
}
const applyPatches = (url, code) => {
  try {
    return PATCHES ? PATCHES.applyPatches(url, code) : code;
  } catch {
    return code;
  }
};

async function fetchText(url) {
  const resp = await fetch(url, { cache: 'no-store', credentials: 'include' });
  if (!resp.ok) throw new Error('fetch failed ' + resp.status);
  return await resp.text();
}

// ----- Message-based fallback (kept) -----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'FETCH_AND_PATCH') {
    const url = msg.url;
    (async () => {
      const key = 'patched:' + url;
      try {
        const original = await fetchText(url);
        const patched = applyPatches(url, original);
        await chrome.storage.local.set({ [key]: patched, ['cachedAt:' + url]: Date.now() });
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

// ----- Firefox network-level patch for ALL target chunks -----
(function setupResponseFilter() {
  if (typeof browser === 'undefined' || !browser.webRequest || !browser.webRequest.filterResponseData) return;

  const CHUNK_RE = /(^|\/)(app|7220|6150|4370)[^/]*\.js(\?.*)?$/i;

  browser.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (!CHUNK_RE.test(details.url)) return {};

      const filter = browser.webRequest.filterResponseData(details.requestId);
      const decoder = new TextDecoder('utf-8');
      const encoder = new TextEncoder();
      const chunks = [];

      filter.ondata = (event) => {
        if (event && event.data) chunks.push(event.data);
      };

      filter.onstop = async () => {
        let originalText = '';
        try {
          if (chunks.length) {
            let totalLen = 0;
            for (const c of chunks) totalLen += (c.byteLength || c.length || 0);
            const merged = new Uint8Array(totalLen);
            let offset = 0;
            for (const c of chunks) {
              const u8 = c instanceof Uint8Array ? c : new Uint8Array(c);
              merged.set(u8, offset);
              offset += u8.byteLength;
            }
            originalText = decoder.decode(merged);
          }

          const patched = applyPatches(details.url, originalText);
          await chrome.storage.local.set({
            ['patched:' + details.url]: patched,
            ['cachedAt:' + details.url]: Date.now()
          });

          filter.write(encoder.encode(patched));
        } catch (e) {
          try {
            const key = 'patched:' + details.url;
            const cached = (await chrome.storage.local.get(key))[key];
            if (cached) {
              filter.write(encoder.encode(cached));
            } else {
              for (const c of chunks) filter.write(c);
            }
          } catch {
            for (const c of chunks) filter.write(c);
          }
        } finally {
          try { filter.close(); } catch {}
        }
      };

      filter.onerror = () => {
        try { filter.close(); } catch {}
      };

      return {};
    },
    { urls: ["<all_urls>"], types: ["script"] },
    ["blocking"]
  );
})();