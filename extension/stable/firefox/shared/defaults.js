// Centralized helper for determining the default patch mode.
// Reads it from the remote JSON and falls back to 1 if anything fails.
// Exposes global functions for MV2 contexts (content scripts, background, pages).

(function () {
  const DEFAULT_PATCH_FALLBACK = 1; // Only applied when remote fetch fails.
  const REMOTE_CONFIG_URL = 'https://raw.githubusercontent.com/apersongithub/Duolingo-Unlimited-Hearts/refs/heads/main/extension-version.json';

  async function fetchDefaultPatch() {
    try {
      const res = await fetch(REMOTE_CONFIG_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('remote default fetch failed');
      const data = await res.json();
      const m = Number(data?.PATCH);
      if (!Number.isFinite(m)) return DEFAULT_PATCH_FALLBACK;
      return Math.min(Math.max(m, 1), 9);
    } catch {
      return DEFAULT_PATCH_FALLBACK;
    }
  }

  // Expose to all relevant globals
  const root = typeof globalThis !== 'undefined' ? globalThis
            : typeof self !== 'undefined' ? self
            : typeof window !== 'undefined' ? window
            : this;

  root.DEFAULT_PATCH_FALLBACK = DEFAULT_PATCH_FALLBACK;
  root.fetchDefaultPatch = fetchDefaultPatch;

  // Optional: CommonJS export (not used by MV2, but harmless)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DEFAULT_PATCH_FALLBACK, fetchDefaultPatch };
  }
})();