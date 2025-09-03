# Release Log: Duolingo Unlimited Hearts Firefox MV2 Extension

## Version 3.0.1 (2025-09-03)

### Major Changes
- **Full Network-Level Patching for All Target Chunks:**  
  The extension now intercepts and patches all relevant JavaScript files (`app-*.js`, `7220-*.js`, `6150-*.js`, `4370-*.js`) at the network level using Firefox's `webRequest.filterResponseData`. This ensures all overrides are applied before script execution, preventing race conditions and guaranteeing feature unlocks.

- **Unified Caching Logic:**  
  All patched chunks are cached identically (`chrome.storage.local`), using the same keys as previous versions, improving reliability and offline fallback for all target scripts.

- **No More Page-Level Script Blocking:**  
  The extension no longer removes or blocks script tags for target chunks in the page. All patching is performed on the response stream, matching the robust approach used previously for `app-*.js`.

### Security & Robustness
- **SRI/CORS Attribute Removal:**  
  The extension strips `integrity`, `crossorigin`, and `nonce` attributes from all target `<script>` tags as soon as they're detected, both in the initial DOM and for dynamically inserted scripts. This ensures patched scripts are not blocked by Subresource Integrity (SRI) or CSP headers.

- **Page Hook Refactor:**  
  The page hook (`page_hook.js`) now acts only to remove SRI/CORS/nonce attributes from scripts, never blocking their insertion. This supports CSP edge cases and ensures compatibility.

### Fallback & Compatibility
- **Injection Fallback Unchanged:**  
  The fallback orchestrator (`injection.js`) remains in the extension for edge cases or future compatibility, but is not normally invoked due to robust network-level patching.

### Manifest & Permissions
- **MV2 Manifest:**  
  Still uses Manifest V2 for full compatibility with Firefox's webRequest API.
- **Permissions Updated:**  
  Ensures `webRequest`, `webRequestBlocking`, and all necessary host permissions are present.

### Bug Fixes
- **Consistent Patch Application:**  
  Target chunks (`7220-*.js`, `6150-*.js`, `4370-*.js`) are now patched with the same guarantees and reliability as the main application bundle.

### Usage Notes
- No user action required for updates; simply reload the extension and refresh Duolingo for changes to take effect.
- If you experience issues with script loading, ensure you are using an up-to-date version of Firefox that supports `webRequest.filterResponseData`.

---

**This release ensures unlimited hearts and premium features are unlocked reliably, with robust patching and no script race conditions or SRI-related failures.**