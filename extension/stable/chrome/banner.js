// Lightweight, non-intrusive update notifier overlay for the extension.
// Note: The settings page banner is handled by userscripts/super_banner.js (injected for all modes).

(function () {
  'use strict';

  const JSON_URL = 'https://raw.githubusercontent.com/apersongithub/Duolingo-Unlimited-Hearts/refs/heads/main/extension-version.json';

  window.addEventListener('load', () => {
    let EXTENSION_NAME = 'Duolingo Max Extension';
    let EXTENSION_URL = 'https://github.com/apersongithub/Duolingo-Unlimited-Hearts/';
    const CURRENT_VERSION = chrome.runtime.getManifest().version;

    const DEFAULT_SETTINGS = {
      enableNotifications: true,
      major: { weeks: 0, days: 3, hours: 0, minutes: 0 },
      minor: { weeks: 1, days: 0, hours: 0, minutes: 0 }
    };

    const ignoreKeyMajor = 'duo_extension_update_ignore_until_major';
    const ignoreKeyMinor = 'duo_extension_update_ignore_until_minor';

    function getIgnoreMs(duration) {
      return (
        ((duration.weeks * 7 * 24 * 60 * 60) +
          (duration.days * 24 * 60 * 60) +
          (duration.hours * 60 * 60) +
          (duration.minutes * 60)) * 1000
      );
    }

    const getSettings = () => new Promise(resolve => {
      try {
        if (chrome?.storage?.sync) {
          chrome.storage.sync.get('settings', data => {
            resolve((data && data.settings) || DEFAULT_SETTINGS);
          });
        } else {
          resolve(DEFAULT_SETTINGS);
        }
      } catch (_) {
        resolve(DEFAULT_SETTINGS);
      }
    });

    function compareVersions(a, b) {
      const pa = String(a).split('.').map(Number);
      const pb = String(b).split('.').map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const x = pa[i] || 0, y = pb[i] || 0;
        if (x > y) return 1;
        if (x < y) return -1;
      }
      return 0;
    }

    function formatDuration(d) {
      let minutes = Math.max(0, Number(d.minutes) || 0);
      let hours = Math.max(0, Number(d.hours) || 0);
      let days = Math.max(0, Number(d.days) || 0);
      let weeks = Math.max(0, Number(d.weeks) || 0);

      hours += Math.floor(minutes / 60);
      minutes %= 60;

      days += Math.floor(hours / 24);
      hours %= 24;

      weeks += Math.floor(days / 7);
      days %= 7;

      const parts = [];
      if (weeks) parts.push(`${weeks} ${weeks === 1 ? 'week' : 'weeks'}`);
      if (days) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
      if (hours) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
      if (minutes) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);

      if (parts.length === 0) return 'the configured period';
      if (parts.length === 1) return parts[0];
      return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
    }

  function createOverlay({ title, message, primaryText, onPrimary, secondaryText, onSecondary }) {
    if (document.getElementById('__duo_ext_update_overlay__')) return;

    const wrapper = document.createElement('div');
    wrapper.id = '__duo_ext_update_overlay__';
    wrapper.style.position = 'fixed';
    wrapper.style.bottom = '16px';
    wrapper.style.right = '16px';
    wrapper.style.zIndex = '2147483647';
    wrapper.style.maxWidth = '360px';
    wrapper.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
    wrapper.style.borderRadius = '10px';
    wrapper.style.background = 'var(--ext-bg, #1e1e1e)';
    wrapper.style.color = 'var(--ext-fg, #fff)';
    wrapper.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
    wrapper.style.border = 'none';

    const content = document.createElement('div');
    content.style.padding = '16px';

    const h = document.createElement('div');
    h.style.fontWeight = '600';
    h.style.marginBottom = '6px';
    h.textContent = title || 'Update available';

    const p = document.createElement('div');
    p.style.fontSize = '13px';
    p.style.lineHeight = '1.5';
    p.style.marginBottom = '12px';
    p.textContent = message || '';

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    btnRow.style.justifyContent = 'flex-end';

    const primary = document.createElement('button');
    primary.textContent = primaryText || 'Update';
    primary.style.background = '#3b82f6';
    primary.style.border = 'none';
    primary.style.color = '#fff';
    primary.style.padding = '8px 12px';
    primary.style.borderRadius = '6px';
    primary.style.cursor = 'pointer';
    primary.style.fontWeight = '600';

    const secondary = document.createElement('button');
    secondary.textContent = secondaryText || 'Later';
    secondary.style.background = 'transparent';
    secondary.style.border = '1px solid currentColor';
    secondary.style.color = 'inherit';
    secondary.style.padding = '8px 12px';
    secondary.style.borderRadius = '6px';
    secondary.style.cursor = 'pointer';
    secondary.style.fontWeight = '600';

    // Theme handling: respects device theme and updates live when it changes
    const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
    function applyTheme(isLight) {
      if (isLight) {
        wrapper.style.background = '#ffffff';
        wrapper.style.color = '#111827';
        wrapper.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
        wrapper.style.border = '1px solid rgba(17,24,39,0.06)';
        primary.style.background = '#2563eb';
        primary.style.color = '#fff';
        secondary.style.border = '1px solid rgba(17,24,39,0.12)';
        secondary.style.color = '#111827';
      } else {
        wrapper.style.background = '#1e1e1e';
        wrapper.style.color = '#ffffff';
        wrapper.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
        wrapper.style.border = 'none';
        primary.style.background = '#3b82f6';
        primary.style.color = '#fff';
        secondary.style.border = '1px solid currentColor';
        secondary.style.color = 'inherit';
      }
    }

    const initialIsLight = mq ? !!mq.matches : false;
    applyTheme(initialIsLight);

    function mqListener(e) {
      try { applyTheme(!!e.matches); } catch { /* ignore */ }
    }
    if (mq) {
      try {
        if (typeof mq.addEventListener === 'function') mq.addEventListener('change', mqListener);
        else if (typeof mq.addListener === 'function') mq.addListener(mqListener);
      } catch (_) { /* ignore */ }
    }

    function cleanup() {
      try {
        if (mq) {
          if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', mqListener);
          else if (typeof mq.removeListener === 'function') mq.removeListener(mqListener);
        }
      } catch (_) { /* ignore */ }
      try { wrapper.remove(); } catch (_) { /* ignore */ }
    }

    primary.addEventListener('click', () => {
      try { if (typeof onPrimary === 'function') onPrimary(); } finally { cleanup(); }
    });
    secondary.addEventListener('click', () => {
      try { if (typeof onSecondary === 'function') onSecondary(); } finally { cleanup(); }
    });

    btnRow.appendChild(secondary);
    btnRow.appendChild(primary);

    content.appendChild(h);
    content.appendChild(p);
    content.appendChild(btnRow);
    wrapper.appendChild(content);
    document.documentElement.appendChild(wrapper);
  }

    getSettings().then(settings => {
      if (!settings.enableNotifications) return;

      const now = Date.now();
      const ignoreUntilMajor = localStorage.getItem(ignoreKeyMajor);
      const ignoreUntilMinor = localStorage.getItem(ignoreKeyMinor);

      fetch(JSON_URL)
        .then(r => r.json())
        .then(data => {
          const latestVersion = data.version;
          const releaseDate = data.releaseDate;
          const releaseNotes = data.releaseNotes || '';
          EXTENSION_NAME = data.EXTENSION_NAME || EXTENSION_NAME;
          EXTENSION_URL = data.EXTENSION_URL || EXTENSION_URL;

          // Parse chromestupid flag: accept boolean true/false or string "true"/"false"
          const chromestupidRaw = data.chromestupid;
          const CHROME_STUPID = (typeof chromestupidRaw === 'boolean')
            ? chromestupidRaw
            : String(chromestupidRaw).toLowerCase() === 'true';

          const cmp = compareVersions(CURRENT_VERSION, latestVersion);

          // Newer version available
          if (cmp < 0) {
            const currentParts = CURRENT_VERSION.split('.').map(Number);
            const latestParts = latestVersion.split('.').map(Number);

            // Major update
            if (currentParts[0] < latestParts[0]) {
              if (!ignoreUntilMajor || now > parseInt(ignoreUntilMajor, 10)) {
                const ignoreMsMajor = getIgnoreMs(settings.major);
                const note = 'You can adjust or disable notifications in the extension options.';
                const daysSince = releaseDate ? Math.floor(Math.abs(now - new Date(releaseDate)) / (1000*60*60*24)) : null;
                const info = daysSince != null ? `Released ${daysSince} day(s) ago.` : '';
                createOverlay({
                  title: `${EXTENSION_NAME} update available`,
                  message: `A new major version (${latestVersion}) is available. ${info}\n${releaseNotes}\n${note}`,
                  primaryText: 'Update',
                  onPrimary: () => { window.location.href = EXTENSION_URL; },
                  secondaryText: `Remind me in ${formatDuration(settings.major)}`,
                  onSecondary: () => {
                    localStorage.setItem(ignoreKeyMajor, String(now + ignoreMsMajor));
                  }
                });
              }
            }
            // Minor update
            else if (currentParts[0] === latestParts[0] && currentParts[1] < latestParts[1]) {
              if (!ignoreUntilMinor || now > parseInt(ignoreUntilMinor, 10)) {
                const ignoreMsMinor = getIgnoreMs(settings.minor);
                const note = 'You can adjust or disable notifications in the extension options.';
                createOverlay({
                  title: `${EXTENSION_NAME} update available`,
                  message: `A new minor version (${latestVersion}) is available.\n${releaseNotes}\n${note}`,
                  primaryText: 'Update',
                  onPrimary: () => { window.location.href = EXTENSION_URL; },
                  secondaryText: `Remind me in ${formatDuration(settings.minor)}`,
                  onSecondary: () => {
                    localStorage.setItem(ignoreKeyMinor, String(now + ignoreMsMinor));
                  }
                });
              }
            }
          } else if (cmp > 0) {
            // Beta version notice (subtle; no storage interaction)
            // Only show if chromestupid is explicitly false (or absent/falsey)
            if (!CHROME_STUPID) {
              createOverlay({
                title: 'You are on a beta build',
                message: `You’re running v${CURRENT_VERSION} (latest stable is v${latestVersion}). If this was intentional, you can ignore this message.`,
                primaryText: 'OK',
                onPrimary: () => {},
                secondaryText: 'View repo',
                onSecondary: () => { window.open(EXTENSION_URL, '_blank'); }
              });
            }
          }
        })
        .catch(() => {
          // Fail silently
        });
    });
  });
})();