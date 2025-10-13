// page_hook.js (runs in the page world)
// Purpose now: DO NOT block scripts. Just strip SRI-related attributes on-the-fly
// for app/7220/6150/4370 so patched responses from background aren't rejected.
(function () {
  if (window.__EXT_PAGE_HOOK_INSTALLED__) return;
  window.__EXT_PAGE_HOOK_INSTALLED__ = true;

  const SCRIPT_RE = /(^|\/)(app|7220|6150|4370)[^/]*\.js(\?.*)?$/i;
  const origAppend = Element.prototype.appendChild;
  const origInsertBefore = Element.prototype.insertBefore;

  function maybeAdjust(node) {
    try {
      if (node && node.tagName === 'SCRIPT' && typeof node.src === 'string' && SCRIPT_RE.test(node.src)) {
        if (node.hasAttribute('integrity')) node.removeAttribute('integrity');
        if (node.hasAttribute('crossorigin')) node.removeAttribute('crossorigin');
        if (node.hasAttribute('nonce')) node.removeAttribute('nonce');
      }
    } catch {}
    return false; // never block
  }

  Element.prototype.appendChild = function(child) {
    maybeAdjust(child);
    return origAppend.call(this, child);
  };

  Element.prototype.insertBefore = function(child, ref) {
    maybeAdjust(child);
    return origInsertBefore.call(this, child, ref);
  };
})();