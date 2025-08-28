// content_script.js (Firefox) - remove integrity/crossorigin attributes early,
// observe future script tags, and act as a fallback coordinator.

const APP_REGEX = /(^|\/)app-[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)?\.js(?:\?.*)?$/i;

function removeIntegrityAttrs(node) {
  try {
    if (node.hasAttribute && node.src && APP_REGEX.test(node.src)) {
      if (node.hasAttribute('integrity')) node.removeAttribute('integrity');
      if (node.hasAttribute('crossorigin')) node.removeAttribute('crossorigin');
    }
  } catch (e) {
    // ignore
  }
}

// scan existing script tags at document_start
try {
  const scripts = Array.from(document.getElementsByTagName('script'));
  for (const s of scripts) removeIntegrityAttrs(s);
} catch (e) { console.error(e); }

// observe future script insertions to remove integrity attributes early
const mo = new MutationObserver(mutations => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node && node.tagName === 'SCRIPT') removeIntegrityAttrs(node);
    }
  }
});
mo.observe(document.documentElement || document, { childList: true, subtree: true });

// If filterResponseData works, the background filter will do the rewrite.
// But keep the fallback: if background can't fetch/patch, injection.js can fetch/patch in page context.
// We don't remove the original script tags here; the filter will handle replacement.
// For older Firefox or edge cases, the injector may be used by other flows implemented elsewhere.
