// background.js (Firefox MV2)
// Uses filterResponseData to intercept and rewrite app-*.js responses.
const APP_JS_URL_REGEX = /\/app-[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)?\.js(?:\?.*)?$/i;

// patch function
function patchCode(code) {
  // 1) arrow replacement
  code = code.replace(/=>\s*(['"])free\1/g, '=> "schools"');

  // 2) append "free" to exact array ["schools","beta course","revenue paused"]
  code = code.replace(
    /\[\s*(['"])\s*schools\s*\1\s*,\s*(['"])\s*beta course\s*\2\s*,\s*(['"])\s*revenue paused\s*\3\s*\]/g,
    (match, q1) => `[${q1}schools${q1}, ${q1}beta course${q1}, ${q1}revenue paused${q1}, ${q1}free${q1}]`
  );

  return code;
}

// filterResponseData handler
chrome.webRequest.onBeforeRequest.addListener(function(details) {
  // No-op placeholder to ensure the webRequest permission/filters are in place.
}, { urls: ["<all_urls>"], types: ["script"] }, ["blocking"]);

chrome.webRequest.onBeforeRequest.addListener(function(details) {
  if (!APP_JS_URL_REGEX.test(details.url)) return;
  try {
    const filter = chrome.webRequest.filterResponseData(details.requestId);
    const decoder = new TextDecoder("utf-8");
    const encoder = new TextEncoder();
    let str = "";

    filter.ondata = event => {
      str += decoder.decode(event.data, { stream: true });
    };

    filter.onstop = () => {
      try {
        // finalize and patch
        str += decoder.decode();
        const patched = patchCode(str);
        filter.write(encoder.encode(patched));
      } catch (e) {
        console.error('filterResponseData patch error:', e);
        try {
          // fallback: write original bytes back
          filter.write(encoder.encode(str));
        } catch (e2) {}
      } finally {
        filter.disconnect();
      }
    };

    filter.onerror = (e) => {
      console.error('filter error', e);
      try { filter.disconnect(); } catch (e) {}
    };
  } catch (err) {
    console.error('filterResponseData not available or failed', err);
  }
}, { urls: ["<all_urls>"], types: ["script"] }, ["blocking"]);

// Also keep message-based fetch/patch/caching for content-script fallback
async function fetchText(url) {
  const resp = await fetch(url, { cache: 'no-store', credentials: 'include' });
  if (!resp.ok) throw new Error('fetch failed ' + resp.status);
  return await resp.text();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'FETCH_AND_PATCH') {
    const url = msg.url;
    (async () => {
      const key = 'patched:' + url;
      try {
        const original = await fetchText(url);
        const patched = patchCode(original);
        const obj = {};
        obj[key] = patched;
        obj['cachedAt:' + url] = Date.now();
        chrome.storage.local.set(obj, function() {
          sendResponse({ ok: true, patched, fromCache: false });
        });
      } catch (err) {
        console.warn('background fetch/patch failed', err);
        chrome.storage.local.get(key, function(items) {
          const cached = items ? items[key] : null;
          if (cached) {
            sendResponse({ ok: true, patched: cached, fromCache: true });
          } else {
            sendResponse({ ok: false, error: String(err) });
          }
        });
      }
    })();
    return true;
  } else if (msg?.type === 'GET_CACHED') {
    const url = msg.url;
    const key = 'patched:' + url;
    chrome.storage.local.get(key, function(items) {
      const cached = items ? items[key] : null;
      if (cached) sendResponse({ ok: true, patched: cached });
      else sendResponse({ ok: false });
    });
    return true;
  }
});
