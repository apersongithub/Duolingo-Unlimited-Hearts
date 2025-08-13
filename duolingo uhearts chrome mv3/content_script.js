// content_script.js
// Runs at document_start. Finds script tags matching app-*.js, removes them, attempts to get a patched copy
// from the background service worker, injects injection.js, and coordinates fallback logic.

const APP_REGEX = /(^|\/)app-[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)?\.js(?:\?.*)?$/i;
const processed = new Set();

async function tryBackgroundFetch(url) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'FETCH_AND_PATCH', url }, (resp) => {
      resolve(resp);
    });
  });
}

function injectExtensionInjectorAndSend(url, patchedCode) {
  // inject injection.js (page-context) and send patched code or just the url
  const inj = document.createElement('script');
  inj.src = chrome.runtime.getURL('injection.js');
  inj.async = false;
  inj.onload = () => {
    if (patchedCode) {
      // send patched code directly to page injector
      window.postMessage({ source: 'ext-injector', url, patchedCode }, '*');
    } else {
      // tell page injector to fetch itself
      window.postMessage({ source: 'ext-injector', url }, '*');
    }
  };
  (document.head || document.documentElement).appendChild(inj);
}

function reinsertOriginal(url) {
  const s = document.createElement('script');
  s.src = url;
  s.async = false;
  (document.head || document.documentElement).appendChild(s);
}

function handleFoundScript(s) {
  const url = s.src;
  if (processed.has(url)) return;
  processed.add(url);
  s.remove();

  // 1) Ask background to fetch & patch
  tryBackgroundFetch(url).then(resp => {
    if (resp && resp.ok && resp.patched) {
      // inject patched code straight away
      injectExtensionInjectorAndSend(url, resp.patched);
    } else {
      // Background couldn't fetch/patch -> fall back to page-context fetch by injecting injector
      injectExtensionInjectorAndSend(url, null);

      // Listen for injector result; if injection fails, background might still have cached version or we reinsert original
      function onResult(ev) {
        if (!ev.data || ev.source !== window || ev.data.source !== 'ext-injector-result') return;
        if (ev.data.url !== url) return;
        window.removeEventListener('message', onResult);

        if (ev.data.ok) {
          // success — nothing else to do
        } else {
          // failed — try to get cached from background, else reinsert original to avoid white screen
          chrome.runtime.sendMessage({ type: 'GET_CACHED', url }, (cachedResp) => {
            if (cachedResp && cachedResp.ok && cachedResp.patched) {
              // send cached patched code to injector
              window.postMessage({ source: 'ext-injector', url, patchedCode: cachedResp.patched }, '*');
            } else {
              // final fallback: reinsert original script so site still runs (prevents white screen)
              reinsertOriginal(url);
            }
          });
        }
      }
      window.addEventListener('message', onResult);
    }
  }).catch(err => {
    console.error('Background fetch error', err);
    // fallback to page fetch
    injectExtensionInjectorAndSend(url, null);
  });
}

function scanAndReplace() {
  const scripts = Array.from(document.getElementsByTagName('script'));
  for (const s of scripts) {
    if (s.src && APP_REGEX.test(s.src)) {
      handleFoundScript(s);
    }
  }
}

// initial scan and observe future insertions
try { scanAndReplace(); } catch (e) { console.error(e); }
const mo = new MutationObserver(scanAndReplace);
mo.observe(document.documentElement || document, { childList: true, subtree: true });
