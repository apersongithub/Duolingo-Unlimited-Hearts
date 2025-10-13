// Shared, reusable Super banner + Manage Subscription removal
// Runs once, guarded by __EXT_SUPER_BANNER_INITED__
(function () {
  if (window.__EXT_SUPER_BANNER_INITED__) return;
  window.__EXT_SUPER_BANNER_INITED__ = true;

  'use strict';

  const JSON_URL = 'https://raw.githubusercontent.com/apersongithub/Duolingo-Unlimited-Hearts/refs/heads/main/extension-version.json';
  const newElementId = 'extension-banner';

  const FALLBACK_CONFIG = {
    BANNER: `
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
    `
  };

  function addCustomElement(config, root = document) {
    if (document.getElementById(newElementId)) return;

    // Slightly broader selector per request
    const refElement = root.querySelector('.MGk8p');
    if (!refElement) return;

    const ul = document.createElement('ul');
    ul.className = 'Y6o36';

    const newLi = document.createElement('li');
    newLi.id = newElementId;
    newLi.className = '_17J_p';
    newLi.innerHTML = config.BANNER;

    ul.appendChild(newLi);
    refElement.parentNode.insertBefore(ul, refElement.nextSibling);

    try { console.log('Extension banner successfully added!'); } catch {}
  }

  // Allow-list based sanitizer
  function sanitizeHTML(unsafeHTML) {
    const template = document.createElement('template');
    template.innerHTML = unsafeHTML || '';

    const ALLOWED_TAGS = new Set([
      'DIV','SECTION','H1','H2','H3','H4','H5','H6','P','SPAN','SMALL','A','BUTTON','UL','OL','LI','STRONG','EM','B','I','U','BR','HR','IMG'
    ]);
    const ALLOWED_ATTRS = new Set([
      'class','id','href','src','target','rel','style','alt','title','role',
      'aria-label','aria-hidden','aria-describedby','aria-expanded','aria-controls',
      'width','height','tabindex'
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
      const sanitized = sanitizeHTML(remote && remote.BANNER ? remote.BANNER : FALLBACK_CONFIG.BANNER);
      addCustomElement({ BANNER: sanitized });
    } catch (err) {
      try { console.warn('Failed to load external JSON, using fallback:', err); } catch {}
      const sanitizedFallback = sanitizeHTML(FALLBACK_CONFIG.BANNER);
      addCustomElement({ BANNER: sanitizedFallback });
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

  // Observe DOM for dynamically added "Manage subscription" sections
  const manageSubObserver = new MutationObserver(() => removeManageSubscriptionSection());
  manageSubObserver.observe(document.documentElement, { childList: true, subtree: true });

  // Initial runs
  removeManageSubscriptionSection();
  loadConfigAndInject();

  // Observe DOM for dynamically added content
  const observer = new MutationObserver(() => loadConfigAndInject());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();