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
    
    // Unique element id used to ensure we don't insert duplicate banners.
    const newElementId = 'extension-banner';

    // A minimal hard-coded fallback banner. This is used if the remote JSON is unreachable
    // or invalid. Because this string is authored in this repository it does not require
    // the same sanitization guarantees as untrusted remote content — but we still pass it
    // through the sanitizer before inserting to be consistent.
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

    /**
     * addCustomElement(config, root = document)
     * - Inserts the banner markup into the page next to an existing reference element.
     * - Prevents duplicates by checking for newElementId.
     * - The function expects `config.BANNER` to already be sanitized HTML (string).
     *
     * Parameters:
     * - config: object with BANNER string
     * - root: optional root node to run queries on (useful for testing)
     */
    function addCustomElement(config, root = document) {
        if (document.getElementById(newElementId)) return;

        // Target element chosen to match the site's DOM layout where we want the banner.
        const refElement = root.querySelector('.ky51z._26JAQ.MGk8p');
        if (!refElement) return;

        const ul = document.createElement('ul');
        ul.className = 'Y6o36';

        const newLi = document.createElement('li');
        newLi.id = newElementId;
        newLi.className = '_17J_p';
        // BANNER is trusted after sanitization; we set innerHTML to render the markup.
        newLi.innerHTML = config.BANNER;

        ul.appendChild(newLi);
        refElement.parentNode.insertBefore(ul, refElement.nextSibling);

        console.log('Extension banner successfully added!');
    }

    /**
     * loadConfigAndInject()
     * - Fetches remote JSON (JSON_URL) and injects the sanitized BANNER into the UI,
     *   but only when the user is on /settings/super.
     * - Falls back to FALLBACK_CONFIG if fetch fails.
     * - Because remote content could contain malicious markup, we sanitize it using
     *   a conservative allow-list before inserting into the page.
     */
    async function loadConfigAndInject() {
        // Only inject the banner on the specific settings page to avoid unintended UI changes.
        if (!window.location.pathname.includes('/settings/super')) return;

        /**
         * sanitizeHTML(unsafeHTML)
         * - Simple allow-list sanitizer implemented using a template + tree walker.
         * - Pros: small, deterministic, easy to audit.
         * - Cons: not a full replacement for a dedicated sanitizer library in more complex apps.
         *
         * Rules:
         * - Remove script/iframe/object/embed/style/link/meta elements entirely.
         * - Permit only a small set of tags and attributes (no inline event handlers).
         * - Only allow href/src values that start with http(s):// (no javascript:, data:, or relative URIs).
         * - Remove style attributes containing obviously dangerous patterns.
         */
        function sanitizeHTML(unsafeHTML) {
            const template = document.createElement('template');
            template.innerHTML = unsafeHTML || '';

            // Conservative allow-list of tags we permit in the banner
            const ALLOWED_TAGS = new Set([
                'DIV', 'SECTION',
                'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
                'P', 'SPAN', 'SMALL',
                'A', 'BUTTON',
                'UL', 'OL', 'LI',
                'STRONG', 'EM', 'B', 'I', 'U',
                'BR', 'HR',
                'IMG'
            ]);
            // Attributes that are safe enough for a simple banner UI
            const ALLOWED_ATTRS = new Set([
                'class', 'id',
                'href', 'src', 'target', 'rel',
                'style',
                'alt', 'title',
                'role',
                'aria-label', 'aria-hidden', 'aria-describedby', 'aria-expanded', 'aria-controls',
                'width', 'height',
                'tabindex'
            ]);

            // Remove known dangerous elements completely
            template.content.querySelectorAll('script, iframe, object, embed, style, link, meta').forEach(el => el.remove());

            const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
            let node;
            while ((node = walker.nextNode())) {
                // If the tag is not allowed, unwrap it but keep its children (safer than removing content).
                if (!ALLOWED_TAGS.has(node.tagName)) {
                    const parent = node.parentNode;
                    if (parent) parent.replaceChild(document.createDocumentFragment().append(...node.childNodes), node);
                    continue;
                }

                // Scrub attributes on allowed tags
                [...node.attributes].forEach(attr => {
                    const name = attr.name.toLowerCase();
                    const value = attr.value.trim();

                    // Remove event handlers (onclick etc.) and any attribute not on the allow-list
                    if (name.startsWith('on') || !ALLOWED_ATTRS.has(name)) {
                        node.removeAttribute(attr.name);
                        return;
                    }

                    // For href/src only allow absolute http(s) links
                    if (name === 'href' || name === 'src') {
                        const lower = value.toLowerCase();
                        if (!/^https?:\/\//.test(lower)) {
                            node.removeAttribute(attr.name);
                            return;
                        }
                        // Extra guard against javascript: and data: URIs
                        if (lower.startsWith('javascript:') || lower.startsWith('data:')) {
                            node.removeAttribute(attr.name);
                            return;
                        }
                    }

                    // Very small sanitization for style attribute to avoid obvious injection vectors.
                    if (name === 'style') {
                        if (/expression|javascript:|url\s*\(\s*javascript:/i.test(value)) {
                            node.removeAttribute(attr.name);
                        }
                    }
                });
            }

            // Return sanitized HTML string ready to insert via innerHTML
            return template.innerHTML;
        }

        try {
            const response = await fetch(JSON_URL, { cache: 'no-store' });
            if (!response.ok) throw new Error('Failed to fetch JSON');
            const remote = await response.json();

            // Only use the BANNER property from remote JSON (ignore scripts/other properties).
            // Sanitize it before injecting.
            const sanitized = sanitizeHTML(remote && remote.BANNER ? remote.BANNER : FALLBACK_CONFIG.BANNER);
            addCustomElement({ BANNER: sanitized });
        } catch (err) {
            // If remote fetch fails for any reason, fall back to the bundled banner.
            console.warn('Failed to load external JSON, using fallback:', err);
            const sanitizedFallback = sanitizeHTML(FALLBACK_CONFIG.BANNER);
            addCustomElement({ BANNER: sanitizedFallback });
        }
    }

    /**
     * removeManageSubscriptionSection(root = document)
     * - Removes the specific "Manage subscription" section from the page if present.
     * - This is a UI tweak: we search for section nodes with a specific class and exact heading text.
     * - The method is idempotent and safe to call repeatedly.
     */
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

    // Observe DOM for dynamically added "Manage subscription" sections and remove them as soon as they appear.
    // Using a MutationObserver keeps behavior robust when the page is dynamically updated.
    const manageSubObserver = new MutationObserver(() => removeManageSubscriptionSection());
    manageSubObserver.observe(document.documentElement, { childList: true, subtree: true });

    // Run immediate cleanup on load as well
    removeManageSubscriptionSection();
    // Try to fetch the config and inject banner if appropriate
    loadConfigAndInject();

    // Observe DOM for dynamically added content and attempt to inject banner when relevant nodes appear.
    const observer = new MutationObserver(() => loadConfigAndInject());
    observer.observe(document.documentElement, { childList: true, subtree: true });
})();

})();
