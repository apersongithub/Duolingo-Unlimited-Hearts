import { applyPatches, setPatchMode } from './shared/patches.js';
import { fetchDefaultPatch } from './shared/defaults.js';

const DEFAULT_SETTINGS = {
  enableNotifications: true,
  major: { weeks: 0, days: 3, hours: 0, minutes: 0 },
  minor: { weeks: 1, days: 0, hours: 0, minutes: 0 },
  selectedPatch: 1,
  syncDefaultPatch: true,
  userOverridePatch: false
};

async function getSettings() {
  try {
    const data = await chrome.storage.sync.get('settings');
    return { ...(data?.settings || {}) };
  } catch {
    return {};
  }
}

async function saveSettings(s) {
  await chrome.storage.sync.set({ settings: s });
}

async function ensureSettingsSeeded() {
  const s = await getSettings();
  if (typeof s.selectedPatch === 'number') return s; // already seeded
  const remote = await fetchDefaultPatch();
  const merged = { ...DEFAULT_SETTINGS, selectedPatch: remote };
  await saveSettings(merged);
  return merged;
}

async function maybeSyncSelectedPatch(s) {
  if (s.syncDefaultPatch === false || s.userOverridePatch === true) return s;
  const remote = await fetchDefaultPatch();
  if (remote !== s.selectedPatch) {
    const next = { ...s, selectedPatch: remote };
    await saveSettings(next);
    return next;
  }
  return s;
}

async function fetchText(url) {
  const resp = await fetch(url, { cache: 'no-store', credentials: 'include' });
  if (!resp.ok) throw new Error('fetch failed ' + resp.status);
  return resp.text();
}

async function getSelectedPatchMode() {
  let s = await ensureSettingsSeeded();
  s = await maybeSyncSelectedPatch(s);
  const mode = Number(s?.selectedPatch) || 1;
  return Math.min(Math.max(mode, 1), 9);
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureSettingsSeeded();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'FETCH_AND_PATCH') {
    const { url } = msg;
    (async () => {
      const mode = await getSelectedPatchMode();
      setPatchMode(mode);
      const cacheKey = `patched:${mode}:${url}`;
      const cachedAtKey = `cachedAt:${mode}:${url}`;
      try {
        const original = await fetchText(url);
        const patched = applyPatches(url, original);
        await chrome.storage.local.set({
          [cacheKey]: patched,
          [cachedAtKey]: Date.now()
        });
        sendResponse({ ok: true, patched, fromCache: false });
      } catch (err) {
        const cached = (await chrome.storage.local.get(cacheKey))[cacheKey];
        if (cached) {
          sendResponse({ ok: true, patched: cached, fromCache: true });
        } else {
          sendResponse({ ok: false, error: String(err) });
        }
      }
    })();
    return true;
  }

  if (msg?.type === 'GET_CACHED') {
    const { url, patchMode } = msg;
    (async () => {
      const mode = Math.min(Math.max(Number(patchMode) || (await getSelectedPatchMode()), 1), 9);
      const cacheKey = `patched:${mode}:${url}`;
      const cached = (await chrome.storage.local.get(cacheKey))[cacheKey];
      sendResponse(cached ? { ok: true, patched: cached } : { ok: false });
    })();
    return true;
  }

  // NEW: flush old patch caches when switching modes
  if (msg?.type === 'FLUSH_PATCH_CACHE') {
    const keepMode = Number(msg.keepMode);
    (async () => {
      try {
        const all = await chrome.storage.local.get(null);
        const removeKeys = [];
        for (const k of Object.keys(all)) {
          const isPatched = k.startsWith('patched:');
          const isTs = k.startsWith('cachedAt:');
            // remove everything except keys for keepMode if provided
          if (isPatched || isTs) {
            if (Number.isFinite(keepMode)) {
              if (!k.startsWith(`patched:${keepMode}:`) && !k.startsWith(`cachedAt:${keepMode}:`)) {
                removeKeys.push(k);
              }
            } else {
              removeKeys.push(k);
            }
          }
        }
        if (removeKeys.length) await chrome.storage.local.remove(removeKeys);
        sendResponse({ ok: true, removed: removeKeys.length });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
});