// Centralized helper for determining the default patch mode.
// Reads it from the remote JSON and falls back to 1 if anything fails.

export const DEFAULT_PATCH_FALLBACK = 1;
export const REMOTE_CONFIG_URL = 'https://raw.githubusercontent.com/apersongithub/Duolingo-Unlimited-Hearts/refs/heads/main/extension-version.json';

export async function fetchDefaultPatch() {
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