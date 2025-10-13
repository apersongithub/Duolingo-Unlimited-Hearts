const DEFAULT_SETTINGS = {
  enableNotifications: true,
  major: { weeks: 0, days: 3, hours: 0, minutes: 0 },
  minor: { weeks: 1, days: 0, hours: 0, minutes: 0 },
  selectedPatch: 1
};

function byId(id) { return document.getElementById(id); }

function applySettings(s) {
  // Patch selection
  const mode = Number(s.selectedPatch) || 1;
  byId('patch1').checked = mode === 1;
  byId('patch2').checked = mode === 2;
  byId('patch3').checked = mode === 3;
  byId('patch4').checked = mode === 4;
  byId('patch5').checked = mode === 5;

  // Other settings
  byId('enableNotifications').checked = s.enableNotifications;
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
  return 1;
}

function readSettings() {
  return {
    selectedPatch: readSelectedPatch(),
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

// Debounce helper to avoid hitting storage.sync write quotas
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
  // Silent autosave (no status message)
  chrome.storage.sync.set({ settings: readSettings() });
}, 400);

function restore() {
  chrome.storage.sync.get('settings', data => {
    applySettings((data && data.settings) || DEFAULT_SETTINGS);
  });
}

byId('reset').addEventListener('click', () => {
  if (!confirm('Reset all settings to defaults?')) return;
  chrome.storage.sync.set({ settings: DEFAULT_SETTINGS }, () => {
    applySettings(DEFAULT_SETTINGS);
    showStatus('↩️ Reset to defaults');
  });
});

function registerAutosaveListeners() {
  // Autosave for radios/checkboxes on change, numbers on input
  const inputs = Array.from(document.querySelectorAll('input'));
  inputs.forEach(el => {
    const evt = (el.type === 'number' || el.type === 'text') ? 'input' : 'change';
    el.addEventListener(evt, () => {
      saveSettings();
    });
  });
  // Ensure pending changes save before closing the page
  window.addEventListener('beforeunload', () => saveSettings.flush());
}

document.addEventListener('DOMContentLoaded', () => {
  registerAutosaveListeners();
  restore();
});