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
  /**
   * Settings
   *
   * Top-level configuration object populated from the options page DOM.
   * Values are read from form controls (checkboxes and number/text inputs) and coerced
   * into predictable primitives so the rest of the extension can consume them.
   *
   * @typedef {Object} Settings
   *
   * @property {boolean} enableNotifications
   *   Whether the extension should show browser notifications. This is sourced from
   *   the checkbox with id "enableNotifications". Expected boolean; falsy values
   *   mean notifications are disabled.
   *
   * @property {Object} major
   *   Time components for the "major" threshold. Each component is parsed with
   *   parseInt(...) and falls back to 0 on invalid input. These represent whole
   *   units (non-negative integers). They are useful for expressing larger timeouts
   *   or reminders.
   *
   * @property {number} major.weeks
   *   Number of weeks (>= 0). Typically multiplied by 7 days when converting to a
   *   single duration value.
   *
   * @property {number} major.days
   *   Number of days (>= 0).
   *
   * @property {number} major.hours
   *   Number of hours (>= 0).
   *
   * @property {number} major.minutes
   *   Number of minutes (>= 0).
   *
   * @property {Object} minor
   *   Time components for the "minor" threshold. Same parsing and expectations as
   *   the `major` object. Intended for shorter or secondary reminders.
   *
   * @property {number} minor.weeks
   *   Number of weeks (>= 0).
   *
   * @property {number} minor.days
   *   Number of days (>= 0).
   *
   * @property {number} minor.hours
   *   Number of hours (>= 0).
   *
   * @property {number} minor.minutes
   *   Number of minutes (>= 0).
   *
   * @example
   * // Convert a component object to milliseconds:
   * // totalMs = (((weeks * 7 + days) * 24 + hours) * 60 + minutes) * 60 * 1000
   *
   * @remarks
   * - The code that builds this object currently reads values directly from elements
   *   by id (e.g. "majorWeeks", "minorMinutes"). If you change element ids or the
   *   form structure, update the selector code accordingly.
   * - Inputs are coerced with parseInt(...). Consider adding explicit validation
   *   (e.g. clamp to 0, enforce integer values, show validation UI) to avoid NaN or
   *   negative values being accepted by mistake.
   * - When persisting this object (e.g. chrome.storage.local), keep schema versioning
   *   in mind. Add a migration path for future fields to avoid breaking existing users.
   * - If you add new timing units or nested configuration, update serialization,
   *   the options UI, and any conversion helpers that compute durations.
   *
   * Contributing notes
   * - Add unit tests for parsing and conversion utilities (edge cases: empty input,
   *   non-numeric characters, very large values).
   * - Keep UI and logic decoupled: prefer small helper functions (parseDurationFromDom,
   *   durationToMilliseconds) so tests can run without DOM.
   * - Accessibility: ensure inputs have associated labels and sensible aria attributes.
   * - i18n: strings displayed in the options UI should use the extension's localization
   *   system rather than hard-coded English.
   * - Performance: these objects are small, but avoid frequent unnecessary storage writes;
   *   only persist when the user explicitly saves or when debounced changes occur.
   */
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
