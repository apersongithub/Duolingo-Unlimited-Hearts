// Default values (your hard-coded ones)
const DEFAULT_SETTINGS = {
  enableNotifications: true,
  major: { weeks: 0, days: 3, hours: 0, minutes: 0 },
  minor: { weeks: 1, days: 0, hours: 0, minutes: 0 }
};

// Helper to apply settings to UI fields
function applySettingsToUI(s) {
  document.getElementById('enableNotifications').checked = s.enableNotifications;
  document.getElementById('majorWeeks').value = s.major.weeks;
  document.getElementById('majorDays').value = s.major.days;
  document.getElementById('majorHours').value = s.major.hours;
  document.getElementById('majorMinutes').value = s.major.minutes;
  document.getElementById('minorWeeks').value = s.minor.weeks;
  document.getElementById('minorDays').value = s.minor.days;
  document.getElementById('minorHours').value = s.minor.hours;
  document.getElementById('minorMinutes').value = s.minor.minutes;
}

// Save settings
document.getElementById('save').addEventListener('click', () => {
  const settings = {
    enableNotifications: document.getElementById('enableNotifications').checked,
    major: {
      weeks: parseInt(document.getElementById('majorWeeks').value) || 0,
      days: parseInt(document.getElementById('majorDays').value) || 0,
      hours: parseInt(document.getElementById('majorHours').value) || 0,
      minutes: parseInt(document.getElementById('majorMinutes').value) || 0,
    },
    minor: {
      weeks: parseInt(document.getElementById('minorWeeks').value) || 0,
      days: parseInt(document.getElementById('minorDays').value) || 0,
      hours: parseInt(document.getElementById('minorHours').value) || 0,
      minutes: parseInt(document.getElementById('minorMinutes').value) || 0,
    }
  };

  chrome.storage.sync.set({ settings }, () => {
    const status = document.getElementById('status');
    status.textContent = '✅ Options saved!';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });
});

// Restore settings (or defaults)
function restoreOptions() {
  chrome.storage.sync.get('settings', (data = {}) => {
    const s = (data && data.settings) ? data.settings : DEFAULT_SETTINGS;
    applySettingsToUI(s);
  });
}

// Reset settings to defaults
document.getElementById('reset').addEventListener('click', () => {
  if (!confirm('Reset all settings to defaults?')) return;
  chrome.storage.sync.set({ settings: DEFAULT_SETTINGS }, () => {
    applySettingsToUI(DEFAULT_SETTINGS);
    const status = document.getElementById('status');
    status.textContent = '↩️ Settings reset to defaults.';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });
});

document.addEventListener('DOMContentLoaded', restoreOptions);
