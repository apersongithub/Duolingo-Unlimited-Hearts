// Intercepts creation of target chunk scripts and notifies content script.
(function () {
  if (window.__EXT_PAGE_HOOK_INSTALLED__) return;
  window.__EXT_PAGE_HOOK_INSTALLED__ = true;

  const SCRIPT_RE = /(^|\/)(app|7220|6150|4370)[^/]*\.js(\?.*)?$/i;
  const origAppend = Element.prototype.appendChild;
  const origInsertBefore = Element.prototype.insertBefore;

  function maybeBlock(node) {
    try {
      if (node?.tagName === 'SCRIPT' && SCRIPT_RE.test(node.src)) {
        window.dispatchEvent(new CustomEvent('ext-script-blocked', { detail: { url: node.src } }));
        return true;
      }
    } catch {}
    return false;
  }

  Element.prototype.appendChild = function (child) {
    if (maybeBlock(child)) return child;
    return origAppend.call(this, child);
  };
  Element.prototype.insertBefore = function (child, ref) {
    if (maybeBlock(child)) return child;
    return origInsertBefore.call(this, child, ref);
  };
})();