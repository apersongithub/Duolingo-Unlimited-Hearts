// Coordinates patch pipeline: hook early, enqueue targets, ask background for patched code.
const CHUNK_REGEX = /(^|\/)(app|7220|6150|4370)[^/]*\.js(\?.*)?$/i;
const processed = new Set();

function tryBackgroundFetch(url) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'FETCH_AND_PATCH', url }, resp => resolve(resp));
  });
}

function injectInjector() {
  if (document.getElementById('__ext_injector_script__')) return;
  const s = document.createElement('script');
  s.id = '__ext_injector_script__';
  s.type = 'module';
  s.src = chrome.runtime.getURL('injection.js');
  s.async = false;
  (document.head || document.documentElement).appendChild(s);
}

function injectPageHook() {
  if (document.getElementById('__ext_page_hook__')) return;
  const s = document.createElement('script');
  s.id = '__ext_page_hook__';
  s.src = chrome.runtime.getURL('page_hook.js');
  s.async = false;
  (document.documentElement || document.head).appendChild(s);
}

function enqueue(url) {
  window.postMessage({ source: 'ext-injector-enqueue', url }, '*');
}

function sendPatched(url, patchedCode) {
  window.postMessage(
    patchedCode
      ? { source: 'ext-injector', url, patchedCode }
      : { source: 'ext-injector', url },
    '*'
  );
}

function handleUrl(url) {
  if (!url || processed.has(url) || !CHUNK_REGEX.test(url)) return;
  processed.add(url);
  injectInjector();
  enqueue(url);

  tryBackgroundFetch(url)
    .then(resp => {
      if (resp && resp.ok && resp.patched) sendPatched(url, resp.patched);
      else sendPatched(url, null);
    })
    .catch(() => sendPatched(url, null));
}

injectPageHook();

window.addEventListener('ext-script-blocked', ev => {
  handleUrl(ev?.detail?.url);
});

function scan() {
  for (const sc of document.getElementsByTagName('script')) {
    if (sc.src && CHUNK_REGEX.test(sc.src)) {
      sc.remove();
      handleUrl(sc.src);
    }
  }
}

if (document.readyState === 'loading') {
  scan();
  document.addEventListener('DOMContentLoaded', scan, { once: true });
} else {
  scan();
}

const mo = new MutationObserver(muts => {
  for (const m of muts) {
    for (const n of m.addedNodes || []) {
      if (n && n.tagName === 'SCRIPT' && n.src && CHUNK_REGEX.test(n.src)) {
        n.remove();
        handleUrl(n.src);
      }
    }
  }
});
mo.observe(document.documentElement, { childList: true, subtree: true });