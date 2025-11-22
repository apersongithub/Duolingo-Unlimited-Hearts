import { fetchDefaultPatch } from './shared/defaults.js';

const DEFAULT_SETTINGS = {
  enableNotifications: true,
  major: { weeks: 0, days: 3, hours: 0, minutes: 0 },
  minor: { weeks: 1, days: 0, hours: 0, minutes: 0 },
  selectedPatch: 1,
  syncDefaultPatch: true,
  userOverridePatch: false
};

// Token key to signal all content scripts to clear page localStorage
const CLEAR_LS_TOKEN_KEY = '__ext_clear_localstorage_token__';

let REMOTE_DEFAULT = 1;

function byId(id) { return document.getElementById(id); }

function setRadioMode(mode) {
  byId('patch1').checked = mode === 1;
  byId('patch2').checked = mode === 2;
  byId('patch3').checked = mode === 3;
  byId('patch4').checked = mode === 4;
  byId('patch5').checked = mode === 5;
  const p6 = byId('patch6'); if (p6) p6.checked = mode === 6;
  const p7 = byId('patch7'); if (p7) p7.checked = mode === 7;
  const p8 = byId('patch8'); if (p8) p8.checked = mode === 8;
  const p9 = byId('patch9'); if (p9) p9.checked = mode === 9;
}

function markDefaultPatchStar(defaultPatch) {
  document.querySelectorAll('label .default-star').forEach(n => n.remove());
  const input = byId('patch' + defaultPatch);
  if (!input) return;
  const label = input.closest('label');
  if (!label) return;
  const star = document.createElement('span');
  star.className = 'default-star';
  star.textContent = '⭐ DEFAULT';
  label.appendChild(star);
}

function applySettings(s) {
  const mode = Number(s.selectedPatch) || 1;
  setRadioMode(mode);

  byId('syncDefaultPatch').checked = s.syncDefaultPatch !== false;

  byId('enableNotifications').checked = !!s.enableNotifications;
  byId('majorWeeks').value = s.major.weeks;
  byId('majorDays').value = s.major.days;
  byId('majorHours').value = s.major.hours;
  byId('majorMinutes').value = s.major.minutes;
  byId('minorWeeks').value = s.minor.weeks;
  byId('minorDays').value = s.minor.days;
  byId('minorHours').value = s.minor.hours;
  byId('minorMinutes').value = s.minor.minutes;
}

function readSelectedPatch() {
  if (byId('patch2').checked) return 2;
  if (byId('patch3').checked) return 3;
  if (byId('patch4').checked) return 4;
  if (byId('patch5').checked) return 5;
  if (byId('patch6')?.checked) return 6;
  if (byId('patch7')?.checked) return 7;
  if (byId('patch8')?.checked) return 8;
  if (byId('patch9')?.checked) return 9;
  return 1;
}

function readSettings() {
  return {
    selectedPatch: readSelectedPatch(),
    syncDefaultPatch: byId('syncDefaultPatch').checked,
    enableNotifications: byId('enableNotifications').checked,
    major: {
      weeks: +byId('majorWeeks').value || 0,
      days: +byId('majorDays').value || 0,
      hours: +byId('majorHours').value || 0,
      minutes: +byId('majorMinutes').value || 0
    },
    minor: {
      weeks: +byId('minorWeeks').value || 0,
      days: +byId('minorDays').value || 0,
      hours: +byId('minorHours').value || 0,
      minutes: +byId('minorMinutes').value || 0
    }
  };
}

function showStatus(msg) {
  const el = byId('status');
  el.textContent = msg;
  if (msg) setTimeout(() => (el.textContent = ''), 2000);
}

function debounce(fn, delay = 400) {
  let t;
  const debounced = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn.apply(null, args);
    }, delay);
  };
  debounced.flush = () => {
    if (t) {
      clearTimeout(t);
      t = null;
      fn();
    }
  };
  return debounced;
}

async function getStoredSettings() {
  return await new Promise(resolve => chrome.storage.sync.get('settings', s => resolve(s?.settings || {})));
}

async function saveSettingsImmediate(next) {
  await chrome.storage.sync.set({ settings: next });
}

const saveSettings = debounce(async () => {
  const data = await getStoredSettings();
  const next = { ...DEFAULT_SETTINGS, ...data, ...readSettings() };
  await chrome.storage.sync.set({ settings: next });
}, 300);

async function restore() {
  chrome.storage.sync.get('settings', async data => {
    const existing = (data && data.settings) || null;
    const remoteDefault = await fetchDefaultPatch();
    REMOTE_DEFAULT = remoteDefault;
    markDefaultPatchStar(remoteDefault);

    if (!existing || typeof existing.selectedPatch !== 'number') {
      const merged = { ...DEFAULT_SETTINGS, selectedPatch: remoteDefault, syncDefaultPatch: true, userOverridePatch: false };
      applySettings(merged);
      await chrome.storage.sync.set({ settings: merged });
      return;
    }

    // If syncing and not overridden, update selection to remote default now
    if ((existing.syncDefaultPatch !== false) && (existing.userOverridePatch !== true)) {
      const updated = { ...DEFAULT_SETTINGS, ...existing, selectedPatch: remoteDefault, syncDefaultPatch: true, userOverridePatch: false };
      applySettings(updated);
      await chrome.storage.sync.set({ settings: updated });
      return;
    }

    // Otherwise, keep user's selection
    applySettings({ ...DEFAULT_SETTINGS, ...existing });
  });
}

byId('reset').addEventListener('click', async () => {
  if (!confirm('Reset all settings to defaults?')) return;
  try {
    const remoteDefault = await fetchDefaultPatch();
    REMOTE_DEFAULT = remoteDefault;
    const merged = {
      ...DEFAULT_SETTINGS,
      selectedPatch: remoteDefault,
      syncDefaultPatch: true,
      userOverridePatch: false
    };
    await chrome.storage.sync.set({ settings: merged });

    // Signal all content scripts (on duolingo.com) to clear page localStorage immediately
    await chrome.storage.sync.set({ [CLEAR_LS_TOKEN_KEY]: Date.now() });

    applySettings(merged);
    markDefaultPatchStar(remoteDefault);
    showStatus('✅ Settings reset, localStorage cleared.');
  } catch {
    const merged = { ...DEFAULT_SETTINGS, selectedPatch: 1, syncDefaultPatch: true, userOverridePatch: false };
    await chrome.storage.sync.set({ settings: merged });

    // Still trigger localStorage clear
    await chrome.storage.sync.set({ [CLEAR_LS_TOKEN_KEY]: Date.now() });

    applySettings(merged);
    markDefaultPatchStar(1);
    showStatus('✅ Settings reset, localStorage cleared.');
  }
});

function registerAutosaveListeners() {
  // Radio changes: if sync is ON and selection != remote default -> turn sync OFF automatically
  const radios = Array.from(document.querySelectorAll('input.patchChoice'));
  radios.forEach(r => {
    r.addEventListener('change', async () => {
      const selected = readSelectedPatch();
      const syncToggle = byId('syncDefaultPatch');
      const currentSync = syncToggle.checked;

      if (currentSync && selected !== REMOTE_DEFAULT) {
        // Turn sync OFF and set manual override immediately
        syncToggle.checked = false;
        const existing = await getStoredSettings();
        const next = {
          ...DEFAULT_SETTINGS,
          ...existing,
          ...readSettings(),
          selectedPatch: selected,
          syncDefaultPatch: false,
          userOverridePatch: true
        };
        await saveSettingsImmediate(next);
        // Optional: clear localStorage on patch mode change
        // await chrome.storage.sync.set({ [CLEAR_LS_TOKEN_KEY]: Date.now() });
        return;
      }

      // Selecting the default patch while sync is OFF should not auto-enable sync
      const existing = await getStoredSettings();
      const next = {
        ...DEFAULT_SETTINGS,
        ...existing,
        ...readSettings(),
        selectedPatch: selected,
        // Preserve override; if sync off we keep userOverridePatch true
        userOverridePatch: currentSync ? existing.userOverridePatch : true
      };
      await saveSettingsImmediate(next);
      // Optional LS clear:
      // await chrome.storage.sync.set({ [CLEAR_LS_TOKEN_KEY]: Date.now() });
    });
  });

  // Sync toggle changes
  const syncToggle = byId('syncDefaultPatch');
  syncToggle.addEventListener('change', async () => {
    const turnOn = syncToggle.checked;
    const existing = await getStoredSettings();

    if (turnOn) {
      // Switch to remote default and clear override
      setRadioMode(REMOTE_DEFAULT);
      const next = {
        ...DEFAULT_SETTINGS,
        ...existing,
        ...readSettings(),
        selectedPatch: REMOTE_DEFAULT,
        syncDefaultPatch: true,
        userOverridePatch: false
      };
      await saveSettingsImmediate(next);
    } else {
      // Keep current patch, mark override
      const next = {
        ...DEFAULT_SETTINGS,
        ...existing,
        ...readSettings(),
        syncDefaultPatch: false,
        userOverridePatch: true
      };
      await saveSettingsImmediate(next);
    }
  });

  // Other inputs (notifications + durations)
  const inputs = Array.from(document.querySelectorAll('input')).filter(el => !radios.includes(el) && el.id !== 'syncDefaultPatch');
  inputs.forEach(el => {
    const evt = (el.type === 'number' || el.type === 'text') ? 'input' : 'change';
    el.addEventListener(evt, () => saveSettings());
  });

  window.addEventListener('beforeunload', () => saveSettings.flush());
}

document.addEventListener('DOMContentLoaded', () => {
  registerAutosaveListeners();
  restore();
});