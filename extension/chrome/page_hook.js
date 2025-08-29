// page_hook.js (runs in the page world)
// Hooks script insertion to block app/7220/6150/4370 chunks before they load.
// Dispatches a CustomEvent so the content script can fetch+patch and re-inject.
(function () {
  if (window.__EXT_PAGE_HOOK_INSTALLED__) return;
  window.__EXT_PAGE_HOOK_INSTALLED__ = true;

  const RE = /(^|\/)(app|7220|6150|4370)[^/]*\.js(\?.*)?$/i;
  const origAppend = Element.prototype.appendChild;
  const origInsertBefore = Element.prototype.insertBefore;

  function maybeBlock(node) {
    try {
      if (node && node.tagName === 'SCRIPT' && typeof node.src === 'string' && RE.test(node.src)) {
        const url = node.src;
        // Prevent original script from being added/executed
        window.dispatchEvent(new CustomEvent('ext-script-blocked', { detail: { url } }));
        return true;
      }
    } catch {}
    return false;
  }

  Element.prototype.appendChild = function(child) {
    if (maybeBlock(child)) return child;
    return origAppend.call(this, child);
  };

  Element.prototype.insertBefore = function(child, ref) {
    if (maybeBlock(child)) return child;
    return origInsertBefore.call(this, child, ref);
  };
})();