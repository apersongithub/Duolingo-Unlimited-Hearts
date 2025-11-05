const DEFAULT_SETTINGS = {
  enableNotifications: true,
  major: { weeks: 0, days: 3, hours: 0, minutes: 0 },
  minor: { weeks: 1, days: 0, hours: 0, minutes: 0 },
  selectedPatch: null,
  syncDefaultPatch: true,
  userOverridden: false
};

function byId(id) { return document.getElementById(id); }
function clampPatch(n) { const x = Number(n); return Math.min(Math.max(Number.isFinite(x) ? x : 1, 1), 9); }

function setRadioChecked(mode) {
  for (let i = 1; i <= 9; i++) {
    const el = byId('patch' + i);
    if (el) el.checked = (i === mode);
  }
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

function applySettingsToUI(s, effectivePatch, defaultPatch) {
  setRadioChecked(effectivePatch);
  byId('syncDefaultPatch').checked = s.syncDefaultPatch !== false;
  byId('enableNotifications').checked = s.enableNotifications;
  byId('majorWeeks').value = s.major.weeks;
  byId('majorDays').value = s.major.days;
  byId('majorHours').value = s.major.hours;
  byId('majorMinutes').value = s.major.minutes;
  byId('minorWeeks').value = s.minor.weeks;
  byId('minorDays').value = s.minor.days;
  byId('minorHours').value = s.minor.hours;
  byId('minorMinutes').value = s.minor.minutes;
  markDefaultPatchStar(defaultPatch);
}

function readSelectedPatch() {
  for (let i = 9; i >= 1; i--) {
    const el = byId('patch' + i);
    if (el?.checked) return i;
  }
  return null;
}

function showStatus(msg) {
  const el = byId('status');
  el.textContent = msg;
  if (msg) setTimeout(() => (el.textContent = ''), 2000);
}

// Debounce helper
function debounce(fn, delay = 300) { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), delay); }; }

const saveSettings = debounce((settings) => { chrome.storage.sync.set({ settings }); }, 200);

async function computeEffectivePatch(s, injectedDefaultPatch) {
  const defaultPatch = clampPatch(
    injectedDefaultPatch ??
    await (globalThis.fetchDefaultPatch?.() || Promise.resolve(1))
  );
  const sync = s.syncDefaultPatch !== false;
  const overridden = s.userOverridden === true;

  let effective;
  if (sync && !overridden) {
    effective = defaultPatch;
  } else if (Number.isFinite(Number(s.selectedPatch))) {
    effective = clampPatch(s.selectedPatch);
  } else {
    effective = defaultPatch;
  }
  return { effectivePatch: effective, defaultPatch };
}

async function restore() {
  chrome.storage.sync.get('settings', async data => {
    const s = Object.assign({}, DEFAULT_SETTINGS, (data && data.settings) || {});
    const { effectivePatch, defaultPatch } = await computeEffectivePatch(s);
    applySettingsToUI(s, effectivePatch, defaultPatch);
    registerAutosaveListeners(s);
  });
}

function registerAutosaveListeners(initialSettings) {
  // Radios: choosing a patch may toggle sync based on default patch selection rules
  Array.from(document.querySelectorAll('input.patchChoice')).forEach(r => {
    r.addEventListener('change', async () => {
      const prev = await new Promise(res => chrome.storage.sync.get('settings', d => res(d?.settings || DEFAULT_SETTINGS)));
      const sel = readSelectedPatch();
      const clicked = clampPatch(sel ?? prev.selectedPatch ?? 1);
      const def = clampPatch(await (globalThis.fetchDefaultPatch?.() || Promise.resolve(1)));
      const isDefault = clicked === def;

      let s = Object.assign({}, prev);
      s.selectedPatch = clicked;

      if (!isDefault) {
        // If the user picks a non-default patch, turn off sync and mark as overridden.
        s.syncDefaultPatch = false;
        s.userOverridden = true;
      } else {
        // User clicked the default patch.
        if (prev.syncDefaultPatch === true) {
          // If sync was already on, keep following remote (do not mark overridden).
          s.syncDefaultPatch = true;
          s.userOverridden = false;
        } else {
          // If sync was off, DO NOT auto-enable it. Keep manual control.
          s.syncDefaultPatch = false;
          s.userOverridden = true;
        }
      }

      saveSettings(s);
      const { effectivePatch, defaultPatch } = await computeEffectivePatch(s, def);
      applySettingsToUI(s, effectivePatch, defaultPatch);
    });
  });

  // Sync toggle
  byId('syncDefaultPatch').addEventListener('change', async () => {
    const prev = await new Promise(res => chrome.storage.sync.get('settings', d => res(d?.settings || DEFAULT_SETTINGS)));
    const sync = byId('syncDefaultPatch').checked;

    if (sync) {
      // Turning sync ON: snap to default patch now and stop overriding.
      const def = clampPatch(await (globalThis.fetchDefaultPatch?.() || Promise.resolve(1)));
      const s = Object.assign({}, prev, {
        syncDefaultPatch: true,
        userOverridden: false,
        selectedPatch: def
      });
      saveSettings(s);
      const { effectivePatch, defaultPatch } = await computeEffectivePatch(s, def);
      applySettingsToUI(s, effectivePatch, defaultPatch);
    } else {
      // Turning sync OFF: keep current selected patch and mark as overridden.
      const s = Object.assign({}, prev, {
        syncDefaultPatch: false,
        userOverridden: true
      });
      saveSettings(s);
      const { effectivePatch, defaultPatch } = await computeEffectivePatch(s);
      applySettingsToUI(s, effectivePatch, defaultPatch);
    }
  });

  // Notifications and durations
  const inputs = Array.from(document.querySelectorAll('input'))
    .filter(el => !el.classList.contains('patchChoice') && el.id !== 'syncDefaultPatch');
  inputs.forEach(el => {
    const evt = (el.type === 'number' || el.type === 'text') ? 'input' : 'change';
    el.addEventListener(evt, async () => {
      const prev = await new Promise(res => chrome.storage.sync.get('settings', d => res(d?.settings || DEFAULT_SETTINGS)));
      const s = Object.assign({}, prev, {
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
      });
      saveSettings(s);
    });
  });

  // Reset -> remote default (or fallback), clear override,
  // and trigger localStorage cleanup in open tabs (via storage event – no extra permissions)
  byId('reset').addEventListener('click', async () => {
    if (!confirm('Reset all settings to defaults?')) return;
    const defaultPatch = clampPatch(await (globalThis.fetchDefaultPatch?.() || Promise.resolve(1)));
    const s = Object.assign({}, DEFAULT_SETTINGS, { selectedPatch: defaultPatch, userOverridden: false });

    chrome.storage.sync.set({ settings: s }, async () => {
      const { effectivePatch, defaultPatch: dp } = await computeEffectivePatch(s, defaultPatch);
      applySettingsToUI(s, effectivePatch, dp);
      showStatus('✅ Settings reset, localStorage cleared.');

      // Broadcast a one-time nonce through storage.local. Content scripts will clear localStorage on change.
      try {
        chrome.storage.local.set({ '__ext_clear_ls__': Date.now() });
      } catch {}
    });
  });

  // Live-update when background detects remote default change
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local' || !changes.remoteDefaultPatch) return;
    const newDefault = clampPatch(changes.remoteDefaultPatch.newValue);
    const s = await new Promise(res => chrome.storage.sync.get('settings', d => res(Object.assign({}, DEFAULT_SETTINGS, d?.settings || {}))));
    const { effectivePatch, defaultPatch } = await computeEffectivePatch(s, newDefault);
    applySettingsToUI(s, effectivePatch, defaultPatch);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  restore();
});