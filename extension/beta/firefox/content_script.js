// content_script.js (Firefox MV2)
// Changes:
// - Do NOT block any scripts. Let background.js patch responses at network level
//   for app-*.js and 7220/6150/4370.
// - Remove integrity/crossorigin/nonce early so SRI doesn't block patched responses.
// - Keep observing dynamically added scripts to strip SRI.

const SCRIPT_RE = /(^|\/)(app|7220|6150|4370)[^/]*\.js(\?.*)?$/i;

function stripSriAttrs(node) {
  try {
    if (!node || node.tagName !== 'SCRIPT') return;
    const src = node.src || '';
    if (SCRIPT_RE.test(src)) {
      if (node.hasAttribute('integrity')) node.removeAttribute('integrity');
      if (node.hasAttribute('crossorigin')) node.removeAttribute('crossorigin');
      if (node.hasAttribute('nonce')) node.removeAttribute('nonce');
    }
  } catch {}
}

// Strip SRI from existing scripts ASAP
(function scanAndStrip() {
  const scripts = Array.from(document.getElementsByTagName('script'));
  for (const sc of scripts) stripSriAttrs(sc);
})();

// Observe for dynamically added scripts and strip SRI
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes || []) {
      if (node && node.tagName === 'SCRIPT') {
        stripSriAttrs(node);
      }
    }
  }
});
observer.observe(document.documentElement || document, { childList: true, subtree: true });

// Optional: inject page_hook.js as a lightweight safety net to strip SRI even if CSP blocks content script early.
(function injectPageHook() {
  if (document.getElementById('__ext_page_hook__')) return;
  const s = document.createElement('script');
  s.id = '__ext_page_hook__';
  s.src = chrome.runtime.getURL('page_hook.js');
  s.async = false;
  (document.documentElement || document.head || document).appendChild(s);
})();