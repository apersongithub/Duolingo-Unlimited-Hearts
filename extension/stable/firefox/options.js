// Default values (your hard-coded ones)
const DEFAULT_SETTINGS = {
  enableNotifications: true,
  // 'patch1' | 'patch2' | 'patch3' | 'patch4' | 'patch5'
  patchMode: 'patch1',
  major: { weeks: 0, days: 3, hours: 0, minutes: 0 },
  minor: { weeks: 1, days: 0, hours: 0, minutes: 0 }
};

const PATCH_IDS = ['patch1', 'patch2', 'patch3', 'patch4', 'patch5'];

function byId(id) { return document.getElementById(id); }

// Helper to apply settings to UI fields
function applySettingsToUI(s) {
  byId('enableNotifications').checked = !!s.enableNotifications;

  const mode = PATCH_IDS.includes(s.patchMode) ? s.patchMode : DEFAULT_SETTINGS.patchMode;
  PATCH_IDS.forEach(id => {
    const el = byId(id);
    if (el) el.checked = (id === mode);
  });

  byId('majorWeeks').value = s.major.weeks;
  byId('majorDays').value = s.major.days;
  byId('majorHours').value = s.major.hours;
  byId('majorMinutes').value = s.major.minutes;
  byId('minorWeeks').value = s.minor.weeks;
  byId('minorDays').value = s.minor.days;
  byId('minorHours').value = s.minor.hours;
  byId('minorMinutes').value = s.minor.minutes;
}

// Determine the selected patch mode (supports radios or checkbox fallback)
function getSelectedPatchMode() {
  // Preferred: radios with name="patchChoice"
  const radio = document.querySelector('input[name="patchChoice"]:checked');
  if (radio && PATCH_IDS.includes(radio.id)) return radio.id;

  // Fallback: exclusive checkboxes by id
  for (const id of PATCH_IDS) {
    const el = byId(id);
    if (el && el.checked) return id;
  }
  return DEFAULT_SETTINGS.patchMode;
}

function readSettingsFromUI() {
  return {
    enableNotifications: byId('enableNotifications').checked,
    patchMode: getSelectedPatchMode(),
    major: {
      weeks: parseInt(byId('majorWeeks').value) || 0,
      days: parseInt(byId('majorDays').value) || 0,
      hours: parseInt(byId('majorHours').value) || 0,
      minutes: parseInt(byId('majorMinutes').value) || 0,
    },
    minor: {
      weeks: parseInt(byId('minorWeeks').value) || 0,
      days: parseInt(byId('minorDays').value) || 0,
      hours: parseInt(byId('minorHours').value) || 0,
      minutes: parseInt(byId('minorMinutes').value) || 0,
    }
  };
}

function showStatus(msg) {
  const el = byId('status');
  if (!el) return;
  el.textContent = msg;
  if (msg) setTimeout(() => (el.textContent = ''), 2000);
}

// Debounce helper to avoid hitting chrome.storage.sync write quotas
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

const saveSettings = debounce(() => {
  const settings = readSettingsFromUI();
  chrome.storage.sync.set({ settings }, () => {
    // Intentionally no success status message on autosave
  });
}, 400);

// Enforce mutual exclusivity only if using checkboxes (radios already exclusive)
function setupPatchExclusivityFallback() {
  const boxes = PATCH_IDS
    .map(id => byId(id))
    .filter(Boolean);

  if (!boxes.length) return;

  const allRadios = boxes.every(b => b.type === 'radio');
  if (allRadios) return; // radios don't need custom exclusivity

  function ensureOneSelected(changed) {
    if (changed && changed.checked) {
      boxes.forEach(b => { if (b !== changed) b.checked = false; });
    }
    // Prevent all unchecked; default to patch1
    if (!boxes.some(b => b.checked)) {
      const def = byId(DEFAULT_SETTINGS.patchMode);
      if (def) def.checked = true;
    }
  }

  boxes.forEach(b => b.addEventListener('change', () => {
    ensureOneSelected(b);
  }));

  // Initialize state
  ensureOneSelected();
}

// Restore settings (or defaults)
function restoreOptions() {
  chrome.storage.sync.get('settings', (data = {}) => {
    const s = (data && data.settings) ? data.settings : DEFAULT_SETTINGS;
    if (!PATCH_IDS.includes(s.patchMode)) s.patchMode = DEFAULT_SETTINGS.patchMode;
    applySettingsToUI(s);
  });
}

// Reset settings to defaults
function setupReset() {
  const resetBtn = byId('reset');
  if (!resetBtn) return;
  resetBtn.addEventListener('click', () => {
    if (!confirm('Reset all settings to defaults?')) return;
    chrome.storage.sync.set({ settings: DEFAULT_SETTINGS }, () => {
      applySettingsToUI(DEFAULT_SETTINGS);
      showStatus('↩️ Settings reset to defaults.');
    });
  });
}

// Register autosave on input changes
function registerAutosaveListeners() {
  const inputs = Array.from(document.querySelectorAll('input'));
  inputs.forEach(el => {
    const evt = (el.type === 'number' || el.type === 'text') ? 'input' : 'change';
    el.addEventListener(evt, () => {
      saveSettings();
    });
  });
  // Save pending changes before leaving the page
  window.addEventListener('beforeunload', () => saveSettings.flush());
}

document.addEventListener('DOMContentLoaded', () => {
  setupPatchExclusivityFallback();
  setupReset();
  registerAutosaveListeners();
  restoreOptions();
});