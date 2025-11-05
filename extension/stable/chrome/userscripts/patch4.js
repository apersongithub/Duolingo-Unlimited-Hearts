;(() => {
  if (window.__DL_PATCH4_INSTALLED__) return;
  window.__DL_PATCH4_INSTALLED__ = true;

(function() {
    'use strict';

    // --- Configuration ---

    // This regex targets the user endpoint.
    const TARGET_URL_REGEX = /https?:\/\/(?:[a-zA-Z0-9-]+\.)?duolingo\.[a-zA-Z]{2,6}(?:\.[a-zA-Z]{2})?\/\d{4}-\d{2}-\d{2}\/users\/.+/;

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

    function shouldIntercept(url) {
        const isMatch = TARGET_URL_REGEX.test(url);
        if (isMatch) {
            try { console.log(`[API Intercept DEBUG] MATCH FOUND for URL: ${url}`); } catch {}
        }
        return isMatch;
    }

    function modifyJson(jsonText) {
        try {
            const data = JSON.parse(jsonText);
            try { console.log("[API Intercept] Original Data:", data); } catch {}
            data.hasPlus = true;
            if (!data.trackingProperties || typeof data.trackingProperties !== 'object') {
                data.trackingProperties = {};
            }
            data.trackingProperties.has_item_gold_subscription = true;
            data.shopItems = CUSTOM_SHOP_ITEMS;
            try { console.log("[API Intercept] Modified Data:", data); } catch {}
            return JSON.stringify(data);
        } catch (e) {
            try { console.error("[API Intercept] Failed to parse or modify JSON. Returning original text.", e); } catch {}
            return jsonText; // Return original text if modification fails
        }
    }

    // Intercept fetch
    const originalFetch = window.fetch;
    window.fetch = function(resource, options) {
        const url = resource instanceof Request ? resource.url : resource;

        if (shouldIntercept(url)) {
            try { console.log(`[API Intercept] Intercepting fetch request to: ${url}`); } catch {}
            return originalFetch.apply(this, arguments).then(async (response) => {
                const clonedResponse = response.clone();
                const jsonText = await clonedResponse.text();
                const modifiedJsonText = modifyJson(jsonText);
                return new Response(modifiedJsonText, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                });
            }).catch(error => {
                try { console.error(`[API Intercept] Error during fetch interception for ${url}:`, error); } catch {}
                throw error;
            });
        }

        return originalFetch.apply(this, arguments);
    };

    // Intercept XHR
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
                    } catch (e) {
                        try { console.error("[API Intercept] XHR Modification Failed:", e); } catch {}
                    }
                }

                if (originalOnReadyStateChange) {
                    originalOnReadyStateChange.apply(this, arguments);
                }
            };
        }

        originalXhrSend.apply(this, arguments);
    };

    // Note: Banner/UI injection is centralized in banner.js to avoid duplication.
})();
})();