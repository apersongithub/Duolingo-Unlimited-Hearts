// ==UserScript==
// @name         Duolingo Max
// @icon         https://d35aaqx5ub95lt.cloudfront.net/images/max/9f30dad6d7cc6723deeb2bd9e2f85dd8.svg
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Intercepts specific user API responses and forces "hasPlus" to true, while injecting custom shopItems and modifying tracking properties.
// @author       apersongithub
// @match        https://www.duolingo.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration ---

    // This regex targets the user endpoint: https://www.example.com/YYYY-MM-DD/users/USER_ID...
    // The trailing .+ ensures it matches the path, including any query parameters like ?fields=...
    const TARGET_URL_REGEX = /https:\/\/www\.duolingo\.com\/\d{4}-\d{2}-\d{2}\/users\/.+/;

    // The custom shopItems data to be injected.
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

    // --- Core Logic ---

    /**
     * Checks if the given URL matches the API endpoint we want to intercept.
     * Includes debug logging to confirm URL matching.
     * @param {string} url The URL of the request.
     * @returns {boolean} True if the URL should be intercepted.
     */
    function shouldIntercept(url) {
        // NOTE: The user's URL had a typo (https://https://...).
        // This regex assumes the correct URL format (https://www.example.com/...)
        const isMatch = TARGET_URL_REGEX.test(url);

        // --- DEBUG LOGGING ---
        if (isMatch) {
            console.log(`[API Intercept DEBUG] MATCH FOUND for URL: ${url}`);
        }
        // ---------------------

        return isMatch;
    }

    /**
     * Parses the JSON text, applies all modifications, and returns the new JSON string.
     * @param {string} jsonText The original response body text.
     * @returns {string} The modified JSON string.
     */
    function modifyJson(jsonText) {
        try {
            const data = JSON.parse(jsonText);
            console.log("[API Intercept] Original Data:", data);

            // --- MERGED MODIFICATION LOGIC ---
            // 1. Force hasPlus to true. (Primary fix target)
            data.hasPlus = true;

            // 2. Set the nested tracking property for gold subscription status.
            if (!data.trackingProperties || typeof data.trackingProperties !== 'object') {
                data.trackingProperties = {};
            }
            data.trackingProperties.has_item_gold_subscription = true;

            // 3. Add/replace the shopItems object with custom subscription data.
            data.shopItems = CUSTOM_SHOP_ITEMS;
            // --------------------------------

            console.log("[API Intercept] Modified Data:", data);
            return JSON.stringify(data);
        } catch (e) {
            console.error("[API Intercept] Failed to parse or modify JSON. Returning original text.", e);
            return jsonText; // Return original text if modification fails
        }
    }

    // =========================================================================
    // 1. Intercepting 'fetch' requests (Modern API)
    // =========================================================================

    const originalFetch = window.fetch;
    window.fetch = function(resource, options) {
        // Determine the URL from the resource argument (can be a string or a Request object)
        const url = resource instanceof Request ? resource.url : resource;

        if (shouldIntercept(url)) {
            console.log(`[API Intercept] Intercepting fetch request to: ${url}`);

            // Call the original fetch, but modify the response promise chain
            return originalFetch.apply(this, arguments).then(async (response) => {
                // Clone the response so we can read the body (text()) without affecting
                // the stream that the original caller might be using.
                const clonedResponse = response.clone();
                const jsonText = await clonedResponse.text();
                const modifiedJsonText = modifyJson(jsonText);

                // Create and return a new Response object with the modified body
                return new Response(modifiedJsonText, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                });
            }).catch(error => {
                console.error(`[API Intercept] Error during fetch interception for ${url}:`, error);
                throw error; // Re-throw the error
            });
        }

        // For non-target URLs, call the original fetch immediately
        return originalFetch.apply(this, arguments);
    };


    // =========================================================================
    // 2. Intercepting 'XMLHttpRequest' requests (Older API)
    // =========================================================================

    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;

    // Override open to mark if this specific XHR object should be intercepted
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this._intercept = shouldIntercept(url);
        this._url = url; // Store URL for debugging
        originalXhrOpen.call(this, method, url, ...args);
    };

    // Override send to hook into the response handling
    XMLHttpRequest.prototype.send = function() {
        if (this._intercept) {
            console.log(`[API Intercept] Intercepting XHR request to: ${this._url}`);

            // Store the original event handler
            const originalOnReadyStateChange = this.onreadystatechange;
            const xhr = this; // Reference to the XHR object

            // Override the ready state change handler
            this.onreadystatechange = function() {
                // readyState 4 means the request is complete
                if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const modifiedText = modifyJson(xhr.responseText);

                        // Use Object.defineProperty to override the responseText and response
                        // properties, which are often read by the application.
                        Object.defineProperty(xhr, 'responseText', { writable: true, value: modifiedText });
                        Object.defineProperty(xhr, 'response', { writable: true, value: modifiedText });
                    } catch (e) {
                        console.error("[API Intercept] XHR Modification Failed:", e);
                    }
                }

                // Call the original handler if it exists
                if (originalOnReadyStateChange) {
                    originalOnReadyStateChange.apply(this, arguments);
                }
            };
        }

        // Send the request
        originalXhrSend.apply(this, arguments);
    };

   var JSON_URL = 'https://raw.githubusercontent.com/apersongithub/Duolingo-Unlimited-Hearts/refs/heads/main/extension-version.json';

    (function () {
      'use strict';

      const newElementId = 'extension-banner';
      const FALLBACK_CONFIG = {
        "BANNER": `
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
