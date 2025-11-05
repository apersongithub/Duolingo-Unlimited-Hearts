;(() => {
  if (window.__DL_PATCH4_INSTALLED__) return;
  window.__DL_PATCH4_INSTALLED__ = true;

  (function() {
    'use strict';

    // --- Configuration ---
    const TARGET_URL_REGEX = /https?:\/\/(?:[a-zA-Z0-9-]+\.)?duolingo\.[a-zA-Z]{2,6}(?:\.[a-zA-Z]{2})?\/\d{4}-\d{2}-\d{2}\/users\/.+/;

    const CUSTOM_SHOP_ITEMS = {
      immersive_subscription: {
        itemName: "immersive_subscription",
        subscriptionInfo: {
          vendor: "STRIPE",
          renewing: true,
          isFamilyPlan: true,
          expectedExpiration: 9999999999000
        }
      }
    };

    function shouldIntercept(url) {
      return TARGET_URL_REGEX.test(url);
    }

    function modifyJson(jsonText) {
      try {
        const data = JSON.parse(jsonText);
        data.hasPlus = true;
        if (!data.trackingProperties || typeof data.trackingProperties !== 'object') data.trackingProperties = {};
        data.trackingProperties.has_item_gold_subscription = true;
        data.shopItems = CUSTOM_SHOP_ITEMS;
        return JSON.stringify(data);
      } catch {
        return jsonText;
      }
    }

    // fetch
    const originalFetch = window.fetch;
    window.fetch = function(resource, options) {
      const url = resource instanceof Request ? resource.url : resource;
      if (shouldIntercept(url)) {
        return originalFetch.apply(this, arguments).then(async (response) => {
          const cloned = response.clone();
          const jsonText = await cloned.text();
          const modified = modifyJson(jsonText);
          let hdrs = response.headers;
          try { const obj = {}; response.headers.forEach((v,k)=>obj[k]=v); hdrs = obj; } catch {}
          return new Response(modified, { status: response.status, statusText: response.statusText, headers: hdrs });
        });
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
        const originalOnReadyStateChange = this.onreadystatechange;
        const xhr = this;
        this.onreadystatechange = function() {
          if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
            try {
              const modifiedText = modifyJson(xhr.responseText);
              Object.defineProperty(xhr, 'responseText', { writable: true, value: modifiedText });
              Object.defineProperty(xhr, 'response', { writable: true, value: modifiedText });
            } catch {}
          }
          if (originalOnReadyStateChange) originalOnReadyStateChange.apply(this, arguments);
        };
      }
      originalXhrSend.apply(this, arguments);
    };
  })();
})();