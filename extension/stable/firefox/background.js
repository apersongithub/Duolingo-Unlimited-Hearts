import { applyPatches, setPatchMode, setSpeechPatchEnabled } from './shared/patches.js';

// Fetch helper
async function fetchText(url) {
  const resp = await fetch(url, { cache: 'default', credentials: 'include' });
  if (!resp.ok) throw new Error('fetch failed ' + resp.status);
  return resp.text();
}

function clampPatch(n) {
  const x = Number(n);
  return Math.min(Math.max(Number.isFinite(x) ? x : 1, 1), 9);
}

async function getSelectedPatchMode() {
  try {
    const data = await chrome.storage.sync.get('settings');
    const s = data?.settings || {};
    const sync = s.syncDefaultPatch !== false;
    const overridden = s.userOverridden === true;
    const stored = Number(s.selectedPatch);

    if (sync && !overridden) {
      // Follow remote default while not overridden
      const remote = await (globalThis.fetchDefaultPatch?.() || Promise.resolve(1));
      return clampPatch(remote);
    }
    if (Number.isFinite(stored)) {
      return clampPatch(stored);
    }
    // No user selection -> use remote default with fallback
    const remote = await (globalThis.fetchDefaultPatch?.() || Promise.resolve(1));
    return clampPatch(remote);
  } catch {
    return 1;
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'FETCH_AND_PATCH') {
    const { url, patchMode } = msg;
    (async () => {
      const mode = clampPatch(Number(patchMode) || (await getSelectedPatchMode()));
      setPatchMode(mode);
      // Read speech patch setting
      try {
        const data = await new Promise(r => chrome.storage.sync.get('settings', r));
        setSpeechPatchEnabled(data?.settings?.enableSpeechPatch !== false);
      } catch { setSpeechPatchEnabled(true); }
      try {
        const original = await fetchText(url);
        const patched = applyPatches(url, original);
        sendResponse({ ok: true, patched, fromCache: false });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  if (msg?.type === 'GET_CACHED') {
    const { url, patchMode } = msg;
    (async () => {
      const mode = clampPatch(Number(patchMode) || (await getSelectedPatchMode()));
      const cacheKey = `patched:${mode}:${url}`;
      const cached = (await chrome.storage.local.get(cacheKey))[cacheKey];
      sendResponse(cached ? { ok: true, patched: cached } : { ok: false });
    })();
    return true;
  }
});

// Poll remote default patch once on startup/installed and broadcast via storage.local if it changed
async function refreshRemoteDefault() {
  try {
    const remote = clampPatch(await (globalThis.fetchDefaultPatch?.() || Promise.resolve(1)));
    const { remoteDefaultPatch: prev } = await chrome.storage.local.get('remoteDefaultPatch');
    if (remote !== prev) {
      await chrome.storage.local.set({
        remoteDefaultPatch: remote,
        remoteDefaultChangedAt: Date.now()
      });
      // content scripts and options listen to storage.onChanged -> no tabs permission needed
    }
  } catch {
    // silent
  }
}

// Trigger a single refresh on extension installed/startup (no periodic alarms)
chrome.runtime.onInstalled.addListener(() => {
  refreshRemoteDefault();
  // Store install date on first install for money-saved calculation
  chrome.storage.local.get('installDate', data => {
    if (!data.installDate) {
      chrome.storage.local.set({ installDate: Date.now() });
    }
  });
});
chrome.runtime.onStartup.addListener(() => refreshRemoteDefault());