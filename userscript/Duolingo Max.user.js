// ==UserScript==
// @name         Duolingo Max
// @icon         https://d35aaqx5ub95lt.cloudfront.net/images/max/9f30dad6d7cc6723deeb2bd9e2f85dd8.svg
// @namespace    https://tampermonkey.net/
// @version      1.2
// @description  Intercepts Duolingo's API Responses
// @author       apersongithub
// @match        *://www.duolingo.com/*
// @match        *://www.duolingo.cn/*
// @grant        none
// @run-at       document-start
// @license      MPL-2.0
// @downloadURL https://github.com/apersongithub/Duolingo-Unlimited-Hearts/raw/refs/heads/main/userscript/Duolingo%20Max.user.js
// @updateURL https://github.com/apersongithub/Duolingo-Unlimited-Hearts/raw/refs/heads/main/userscript/Duolingo%20Max.user.js
// ==/UserScript==

// WORKS AS OF 2025-10-13

/*
 * Below this is the actual fetch interception and modification logic for Unlimited Hearts
 */

(function() {
    'use strict';

    // --- Configuration ---
    const TARGET_URL_REGEX = /https:\/\/www\.duolingo\.com\/\d{4}-\d{2}-\d{2}\/users\/.+/;

    const CUSTOM_SHOP_ITEMS = {
      gold_subscription: {
        itemName: "gold_subscription",
        subscriptionInfo: {
          vendor: "STRIPE",
          renewing: true,
          isFamilyPlan: true,
          expectedExpiration: 9999999999000
        }
      }
    };

    function shouldIntercept(url) {
      const isMatch = TARGET_URL_REGEX.test(url);
      if (isMatch) { try { console.log(`[API Intercept DEBUG] MATCH FOUND for URL: ${url}`); } catch {} }
      return isMatch;
    }

    function modifyJson(jsonText) {
      try {
        const data = JSON.parse(jsonText);
        try { console.log("[API Intercept] Original Data:", data); } catch {}
        data.hasPlus = true;
        if (!data.trackingProperties || typeof data.trackingProperties !== 'object') data.trackingProperties = {};
        data.trackingProperties.has_item_gold_subscription = true;
        data.shopItems = CUSTOM_SHOP_ITEMS;
        try { console.log("[API Intercept] Modified Data:", data); } catch {}
        return JSON.stringify(data);
      } catch (e) {
        try { console.error("[API Intercept] Failed to parse or modify JSON. Returning original text.", e); } catch {}
        return jsonText;
      }
    }

    // fetch
    const originalFetch = window.fetch;
    window.fetch = function(resource, options) {
      const url = resource instanceof Request ? resource.url : resource;
      if (shouldIntercept(url)) {
        try { console.log(`[API Intercept] Intercepting fetch request to: ${url}`); } catch {}
        return originalFetch.apply(this, arguments).then(async (response) => {
          const cloned = response.clone();
          const jsonText = await cloned.text();
          const modified = modifyJson(jsonText);
          let hdrs = response.headers;
          try { const obj = {}; response.headers.forEach((v,k)=>obj[k]=v); hdrs = obj; } catch {}
          return new Response(modified, { status: response.status, statusText: response.statusText, headers: hdrs });
        }).catch(err => { try { console.error('[API Intercept] fetch error', err); } catch {}; throw err; });
      }
      return originalFetch.apply(this, arguments);
    };

    // XHR
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      this._intercept = shouldIntercept(url);
      this._url = url;
      originalXhrOpen.call(this, method, url, ...args);
    };
    XMLHttpRequest.prototype.send = function() {
      if (this._intercept) {
        try { console.log(`[API Intercept] Intercepting XHR request to: ${this._url}`); } catch {}
        const originalOnReadyStateChange = this.onreadystatechange;
        const xhr = this;
        this.onreadystatechange = function() {
          if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
            try {
              const modifiedText = modifyJson(xhr.responseText);
              Object.defineProperty(xhr, 'responseText', { writable: true, value: modifiedText });
              Object.defineProperty(xhr, 'response', { writable: true, value: modifiedText });
            } catch (e) { try { console.error("[API Intercept] XHR Modification Failed:", e); } catch {} }
          }
          if (originalOnReadyStateChange) originalOnReadyStateChange.apply(this, arguments);
        };
      }
      originalXhrSend.apply(this, arguments);
    };

    // =============================
    // UI banner + sanitization logic
    // =============================
    var JSON_URL = 'https://raw.githubusercontent.com/apersongithub/Duolingo-Unlimited-Hearts/refs/heads/main/userscript-version.json';

    (function () {
      'use strict';

      const newElementId = 'extension-banner';
      const FALLBACK_CONFIG = {
        "BANNER": `
    <div class='thPiC'><img class='_1xOxM'
    src='https://raw.githubusercontent.com/apersongithub/Duolingo-Unlimited-Hearts/refs/heads/main/extras/icon.svg'
    style='border-radius:100px'></div>
<div class='_3jiBp'>
  <h4 class='qyEhl'>Duolingo Max Userscript</h4><span class='_3S2Xa'>Created by <a
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

      async function loadConfigAndInject() {
        if (!window.location.pathname.includes('/settings/super')) return;

        function sanitizeHTML(unsafeHTML) {
          const template = document.createElement('template');
          template.innerHTML = unsafeHTML || '';

          const ALLOWED_TAGS = new Set(['DIV','SECTION','H1','H2','H3','H4','H5','H6','P','SPAN','SMALL','A','BUTTON','UL','OL','LI','STRONG','EM','B','I','U','BR','HR','IMG']);
          const ALLOWED_ATTRS = new Set(['class','id','href','src','target','rel','style','alt','title','role','aria-label','aria-hidden','aria-describedby','aria-expanded','aria-controls','width','height','tabindex']);

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

              if (name.startsWith('on') || !ALLOWED_ATTRS.has(name)) { node.removeAttribute(attr.name); return; }
              if (name === 'href' || name === 'src') {
                const lower = value.toLowerCase();
                if (!/^https?:\/\//.test(lower)) { node.removeAttribute(attr.name); return; }
                if (lower.startsWith('javascript:') || lower.startsWith('data:')) { node.removeAttribute(attr.name); return; }
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

        try {
          // JSON_URL may not be defined; fallback is used if fetch fails.
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

      const manageSubObserver = new MutationObserver(() => removeManageSubscriptionSection());
      manageSubObserver.observe(document.documentElement, { childList: true, subtree: true });

      removeManageSubscriptionSection();
      loadConfigAndInject();

      const observer = new MutationObserver(() => loadConfigAndInject());
      observer.observe(document.documentElement, { childList: true, subtree: true });
    })();
})();
