// content_script.js (MV3)
// This script runs in an isolated content script environment.
// Its primary jobs are to:
// 1. Bypass the page's Content Security Policy (CSP) by injecting a script from the extension's own origin (`page_hook.js`).
// 2. Intercept requests for specific JavaScript "chunk" files.
// 3. Coordinate with the background script to fetch and patch these files.
// 4. Ensure the patched scripts are executed in the correct order within the page's own context.

// A regular expression to identify specific JavaScript "chunk" files used by the target web application.
// This is used to filter which scripts need to be intercepted and patched.
const CHUNK_REGEX = /(^|\/)(app|7220|6150|4370)[^/]*\.js(\?.*)?$/i;

// A Set to keep track of script URLs that have already been processed.
// This prevents redundant work if the same script is detected multiple times.
const processed = new Set();

/**
 * Asynchronously requests the background script to fetch and patch a script.
 * This is the primary method for patching, as the background script has fewer restrictions
 * (e.g., can bypass CORS) than the content script or the page itself.
 * @param {string} url - The URL of the script to fetch.
 * @returns {Promise<object|undefined>} A promise that resolves with the background script's response,
 * which may contain the patched code.
 */
async function tryBackgroundFetch(url) {
  return new Promise(resolve => {
    // Sends a message to the service worker (background script) to perform the fetch.
    chrome.runtime.sendMessage({ type: 'FETCH_AND_PATCH', url }, (resp) => resolve(resp));
  });
}

/**
 * Injects 'injection.js' into the page.
 * 'injection.js' acts as an orchestrator within the page's context (the "main world").
 * It receives patched code from this content script and executes it.
 * This script is injected only when a target chunk is first identified.
 */
function injectInjector() {
  // Check if the script is already present to avoid multiple injections.
  if (document.getElementById('__ext_injector_script__')) return;
  const inj = document.createElement('script');
  inj.id = '__ext_injector_script__';
  // Get the URL from the extension's own packaged files, which is allowed by most CSPs.
  inj.src = chrome.runtime.getURL('injection.js');
  inj.async = false; // Ensure it loads and executes predictably.
  (document.head || document.documentElement).appendChild(inj);
}

/**
 * Injects 'page_hook.js' into the page at the earliest possible moment.
 * This "hook" script runs in the page's context and overrides native browser functions
 * to intercept script creation before they are blocked by CSP. It then notifies this
 * content script about the blocked script via a custom event.
 */
function injectPageHook() {
  // Check if the script is already present.
  if (document.getElementById('__ext_page_hook__')) return;
  const s = document.createElement('script');
  s.id = '__ext_page_hook__';
  // Load from the extension's origin to be CSP-compliant.
  s.src = chrome.runtime.getURL('page_hook.js');
  s.async = false; // Must run before other page scripts.
  (document.documentElement || document.head || document).appendChild(s);
}

/**
 * Sends a script URL to the in-page orchestrator ('injection.js') to be queued.
 * This ensures that even if scripts are patched out of order, they are executed
 * in the order the page originally intended.
 * @param {string} url - The original URL of the script to enqueue.
 */
function enqueueUrlInPage(url) {
  // Use postMessage for secure communication from the isolated content script world
  // to the page's main world.
  window.postMessage({ source: 'ext-injector-enqueue', url }, '*');
}

/**
 * Sends the patched script code to the in-page orchestrator ('injection.js').
 * If the patched code is not available (e.g., background fetch failed), it sends
 * a null payload, signaling the orchestrator to try fetching and patching itself as a fallback.
 * @param {string} url - The original URL of the script.
 * @param {string|null} patchedCode - The modified JavaScript code, or null.
 */
function sendPatchedToPage(url, patchedCode) {
  // Dispatches the patched code to the page.
  window.postMessage(
    patchedCode
      ? { source: 'ext-injector', url, patchedCode }
      // If patching failed in the background, send just the URL.
      // 'injection.js' will then handle fetching it directly.
      : { source: 'ext-injector', url },
    '*'
  );
}

/**
 * The main handler function for a detected script URL.
 * It coordinates the entire process: injecting necessary scripts, queing the URL,
 * attempting to patch via the background, and sending the result to the page.
 * @param {string} url - The URL of the script to handle.
 */
function handleUrl(url) {
  // Ignore empty URLs, already processed URLs, or URLs that don't match the target chunks.
  if (!url || processed.has(url) || !CHUNK_REGEX.test(url)) return;
  processed.add(url);

  // 1. Ensure the in-page orchestrator is ready.
  injectInjector();
  // 2. Tell the orchestrator to expect this script, preserving its load order.
  enqueueUrlInPage(url);

  // 3. Attempt to fetch and patch via the background script.
  tryBackgroundFetch(url).then(resp => {
    // If successful, send the patched code to the page.
    if (resp && resp.ok && resp.patched) {
      sendPatchedToPage(url, resp.patched);
    } else {
      // If it fails, trigger the in-page fallback mechanism.
      sendPatchedToPage(url, null);
    }
  }).catch(() => {
    // Also trigger fallback on any unexpected errors.
    sendPatchedToPage(url, null);
  });
}

// --- SCRIPT EXECUTION FLOW ---

// 1) Install the early hook immediately.
// This is the most critical step and must run before any of the page's own scripts
// to reliably intercept their attempts to load other scripts.
injectPageHook();

// 2) Listen for notifications from the early hook ('page_hook.js').
// When the hook intercepts a script that would be blocked by CSP, it dispatches
// this custom event, allowing the content script to handle the URL.
window.addEventListener('ext-script-blocked', (ev) => {
  const url = ev?.detail?.url;
  handleUrl(url);
});

// 3) Scan the initial HTML for scripts that might have been present at load time.
// This handles scripts that are hardcoded in the server-rendered HTML.
function scanAndReplace() {
  const scripts = Array.from(document.getElementsByTagName('script'));
  for (const sc of scripts) {
    if (sc.src && CHUNK_REGEX.test(sc.src)) {
      // Remove the original script tag to prevent the browser from trying to load it.
      sc.remove();
      // Process the URL to load our patched version instead.
      handleUrl(sc.src);
    }
  }
}
// Run the scan as early as possible. If the document is still loading, run it
// immediately and then again after the DOM is fully parsed just in case.
if (document.readyState === 'loading') {
  scanAndReplace();
  document.addEventListener('DOMContentLoaded', scanAndReplace, { once: true });
} else {
  // If loading is already complete, just run it once.
  scanAndReplace();
}

// 4) Use a MutationObserver as a final fallback to catch scripts added dynamically.
// This covers cases where scripts are inserted into the DOM by other JavaScript
// after the initial page load, which the earlier methods might miss.
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes || []) {
      // If a new node is a SCRIPT tag with a matching src, intercept it.
      if (node && node.tagName === 'SCRIPT' && node.src && CHUNK_REGEX.test(node.src)) {
        node.remove();
        handleUrl(node.src);
      }
    }
  }
});
// Observe the entire document for changes to its structure.
observer.observe(document.documentElement || document, { childList: true, subtree: true });