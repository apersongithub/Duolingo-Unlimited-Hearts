const DEFAULT_SETTINGS = {
  enableNotifications: true,
  major: { weeks: 0, days: 3, hours: 0, minutes: 0 },
  minor: { weeks: 1, days: 0, hours: 0, minutes: 0 }
};

function byId(id) { return document.getElementById(id); }

function applySettings(s) {
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

function readSettings() {
  return {
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
  setTimeout(() => (el.textContent = ''), 2000);
}

byId('save').addEventListener('click', () => {
  chrome.storage.sync.set({ settings: readSettings() }, () => showStatus('✅ Saved'));
});

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

document.addEventListener('DOMContentLoaded', restore);