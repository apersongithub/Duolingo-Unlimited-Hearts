// Centralized banner and update overlay for settings page.
// Replaces exploit_banner.js and deduplicates banner logic across userscripts.
// Guards to ensure it runs once.
(function () {
  if (window.__EXT_SETTINGS_BANNER_INITED__) return;
  window.__EXT_SETTINGS_BANNER_INITED__ = true;

  'use strict';

  const JSON_URL = 'https://raw.githubusercontent.com/apersongithub/Duolingo-Unlimited-Hearts/refs/heads/main/extension-version.json';
  const newElementId = 'extension-banner';

  const FALLBACK_BANNER_HTML = `
    <div class='thPiC'><img class='_1xOxM'
      src='https://raw.githubusercontent.com/apersongithub/Duolingo-Unlimited-Hearts/refs/heads/main/extras/icon.svg'
      style='border-radius:100px'></div>
    <div class='_3jiBp'>
      <h4 class='qyEhl'>Duolingo Max</h4><span class='_3S2Xa'>Created by <a
          href='https://github.com/apersongithub' target='_blank' style='color:#07b3ec'>apersongithub</a></span>
    </div>
    <div class='_36kJA'>
      <div><a href='https://html-preview.github.io/?url=https://raw.githubusercontent.com/apersongithub/Duolingo-Unlimited-Hearts/refs/heads/main/extras/donations.html'
          target='_blank'><button class='_1ursp _2V6ug _2paU5 _3gQUj _7jW2t rdtAy'><span class='_9lHjd'
              style='color:#d7d62b'>💵 Donate</span></button></a></div>
    </div>
  `;

  function addCustomElement(bannerHTML, root = document) {
    if (document.getElementById(newElementId)) return;

    // Slightly broader selector used historically
    const refElement = root.querySelector('.MGk8p') || root.querySelector('.ky51z._26JAQ.MGk8p');
    if (!refElement) return;

    const ul = document.createElement('ul');
    ul.className = 'Y6o36';

    const newLi = document.createElement('li');
    newLi.id = newElementId;
    newLi.className = '_17J_p';
    newLi.innerHTML = bannerHTML;

    ul.appendChild(newLi);
    refElement.parentNode.insertBefore(ul, refElement.nextSibling);

    try { console.log('Extension banner successfully added!'); } catch { }
  }

  // Allow-list based sanitizer
  function sanitizeHTML(unsafeHTML) {
    const template = document.createElement('template');
    template.innerHTML = unsafeHTML || '';

    const ALLOWED_TAGS = new Set([
      'DIV', 'SECTION', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'SMALL', 'A', 'BUTTON', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'B', 'I', 'U', 'BR', 'HR', 'IMG'
    ]);
    const ALLOWED_ATTRS = new Set([
      'class', 'id', 'href', 'src', 'target', 'rel', 'style', 'alt', 'title', 'role',
      'aria-label', 'aria-hidden', 'aria-describedby', 'aria-expanded', 'aria-controls',
      'width', 'height', 'tabindex'
    ]);

    template.content.querySelectorAll('script, iframe, object, embed, style, link, meta').forEach(el => el.remove());

    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      if (!ALLOWED_TAGS.has(node.tagName)) {
        const parent = node.parentNode;
        if (parent) parent.replaceChild(document.createDocumentFragment().append(...node.childNodes), node);
        continue;
      }

      [...node.attributes].forEach(attr => {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim();

        if (name.startsWith('on') || !ALLOWED_ATTRS.has(name)) {
          node.removeAttribute(attr.name);
          return;
        }

        if (name === 'href' || name === 'src') {
          const lower = value.toLowerCase();
          if (!/^https?:\/\//.test(lower)) {
            node.removeAttribute(attr.name);
            return;
          }
          if (lower.startsWith('javascript:') || lower.startsWith('data:')) {
            node.removeAttribute(attr.name);
            return;
          }
        }

        if (name === 'style') {
          if (/expression|javascript:|url\s*\(\s*javascript:/i.test(value)) {
            node.removeAttribute(attr.name);
          }
        }
      });
    }

    return template.innerHTML;
  }

  async function loadConfigAndInject() {
    if (!window.location.pathname.includes('/settings/super')) return;

    try {
      const response = await fetch(JSON_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch JSON');
      const remote = await response.json();
      const sanitized = sanitizeHTML(remote?.BANNER || FALLBACK_BANNER_HTML);
      addCustomElement(sanitized);
    } catch (err) {
      try { console.warn('Failed to load external JSON for banner, using fallback:', err); } catch { }
      const sanitizedFallback = sanitizeHTML(FALLBACK_BANNER_HTML);
      addCustomElement(sanitizedFallback);
    }
  }

  function removeManageSubscriptionSection(root = document) {
    const sections = root.querySelectorAll('section._3f-te');
    for (const section of sections) {
      const h2 = section.querySelector('h2._203-l');
      if (h2 && h2.textContent.trim() === 'Manage subscription') {
        section.remove();
        break;
      }
    }
  }

  // Lightweight overlay for update notifications (no alert/confirm)
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

  // Update check logic with overlay
  window.addEventListener('load', () => {
    const DEFAULT_SETTINGS = {
      enableNotifications: true,
      major: { weeks: 0, days: 3, hours: 0, minutes: 0 },
      minor: { weeks: 1, days: 0, hours: 0, minutes: 0 }
    };

    const getSettings = () => new Promise(resolve => {
      try {
        chrome.storage.sync.get('settings', data => {
          resolve((data && data.settings) || DEFAULT_SETTINGS);
        });
      } catch (_) {
        resolve(DEFAULT_SETTINGS);
      }
    });

    function getIgnoreMs(duration) {
      return (
        ((duration.weeks * 7 * 24 * 60 * 60) +
          (duration.days * 24 * 60 * 60) +
          (duration.hours * 60 * 60) +
          (duration.minutes * 60)) * 1000
      );
    }

    getSettings().then(settings => {
      if (!settings.enableNotifications) return;

      const ignoreKeyMajor = 'duo_extension_update_ignore_until_major';
      const ignoreKeyMinor = 'duo_extension_update_ignore_until_minor';
      const ignoreUntilMajor = parseInt(localStorage.getItem(ignoreKeyMajor) || '0', 10);
      const ignoreUntilMinor = parseInt(localStorage.getItem(ignoreKeyMinor) || '0', 10);
      const now = Date.now();

      fetch(JSON_URL)
        .then(resp => resp.ok ? resp.json() : Promise.reject(new Error('bad status')))
        .then(data => {
          const latestVersion = String(data.version || '').trim();
          const releaseDate = data.releaseDate ? new Date(data.releaseDate) : null;
          const releaseNotes = data.releaseNotes || '';
          const EXTENSION_NAME = data.EXTENSION_NAME || 'Duolingo Max Extension';
          const EXTENSION_URL = data.EXTENSION_URL || 'https://github.com/apersongithub/Duolingo-Unlimited-Hearts/';
          const chromeStupid = (typeof data.chromestupid === 'string')
            ? data.chromestupid.toLowerCase() === 'true'
            : !!data.chromestupid;

          const current = chrome.runtime.getManifest().version;
          const currentParts = current.split('.').map(Number);
          const latestParts = latestVersion.split('.').map(Number);

          function compareVersions(a, b) {
            for (let i = 0; i < Math.max(a.length, b.length); i++) {
              const numA = a[i] || 0;
              const numB = b[i] || 0;
              if (numA < numB) return -1;
              if (numA > numB) return 1;
            }
            return 0;
          }

          const cmp = compareVersions(currentParts, latestParts);
          const diffDays = releaseDate ? Math.floor(Math.abs(now - +releaseDate) / (1000 * 60 * 60 * 24)) : 0;

          // Only notify if an update is available
          if (cmp < 0) {
            // Major update?
            if (currentParts[0] < (latestParts[0] || 0)) {
              if (now <= ignoreUntilMajor) return;
              const ignoreMsMajor = getIgnoreMs(settings.major);
              createOverlay({
                title: `Update available for ${EXTENSION_NAME}`,
                message: `It's been ${diffDays} day(s) since a major update was released.\n\nRelease notes:\n${releaseNotes}`,
                primaryText: 'Get Update',
                onPrimary: () => { window.location.href = EXTENSION_URL; },
                secondaryText: 'Remind me later',
                onSecondary: () => {
                  localStorage.setItem(ignoreKeyMajor, String(Date.now() + ignoreMsMajor));
                }
              });
            }
            // Minor update?
            else if (currentParts[0] === (latestParts[0] || 0) && currentParts[1] < (latestParts[1] || 0)) {
              if (now <= ignoreUntilMinor) return;
              const ignoreMsMinor = getIgnoreMs(settings.minor);
              createOverlay({
                title: `Minor update available (${latestVersion})`,
                message: `Release notes:\n${releaseNotes}`,
                primaryText: 'Get Update',
                onPrimary: () => { window.location.href = EXTENSION_URL; },
                secondaryText: 'Remind me later',
                onSecondary: () => {
                  localStorage.setItem(ignoreKeyMinor, String(Date.now() + ignoreMsMinor));
                }
              });
            }
          } else if (cmp > 0) {
            // Only show beta notice if remote config allows it
            if (!chromeStupid) {
              createOverlay({
                title: 'You are on a beta build',
                message: `You’re running v${current} (latest stable is v${latestVersion}). If this was intentional, you can ignore this message.`,
                primaryText: 'OK',
                onPrimary: () => { },
                secondaryText: 'View repo',
                onSecondary: () => { window.open(EXTENSION_URL, '_blank'); }
              });
            }
          }
        })
        .catch(() => {
          // Silent failure
        });
    });
  });

  // Observe DOM for dynamically added "Manage subscription" and banner area
  const manageSubObserver = new MutationObserver(() => removeManageSubscriptionSection());
  manageSubObserver.observe(document.documentElement, { childList: true, subtree: true });

  // Initial runs
  removeManageSubscriptionSection();
  loadConfigAndInject();

  const observer = new MutationObserver(() => loadConfigAndInject());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();