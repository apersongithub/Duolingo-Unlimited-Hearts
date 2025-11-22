;(() => {
  if (window.__DL_PATCH6_INSTALLED__) return;
  window.__DL_PATCH6_INSTALLED__ = true;

  (function () {
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

  function shouldIntercept(url, method = 'GET') {
    // FILTER 1: Do not intercept POST/PUT/DELETE. Only GET requests load profile data.
    if (method.toUpperCase() !== 'GET') return false;

    const isMatch = TARGET_URL_REGEX.test(url);
    // FILTER 2: Explicitly exclude the shop-items endpoint to prevent the 400 error loop
    if (url.includes('/shop-items')) return false;

    if (isMatch) { try { console.log(`[API Intercept DEBUG] MATCH FOUND for URL: ${url}`); } catch { } }
    return isMatch;
  }

  function modifyJson(jsonText) {
    try {
      const data = JSON.parse(jsonText);
      data.hasPlus = true;
      if (!data.trackingProperties || typeof data.trackingProperties !== 'object') data.trackingProperties = {};
      data.trackingProperties.has_item_immersive_subscription = true;

      // FIX: Merge existing shop items with your custom subscription
      // (Previous code deleted all real items, breaking the shop UI)
      data.shopItems = { ...data.shopItems, ...CUSTOM_SHOP_ITEMS };

      return JSON.stringify(data);
    } catch (e) {
      return jsonText;
    }
  }

  // fetch Override
  const originalFetch = window.fetch;
  window.fetch = function (resource, options) {
    const url = resource instanceof Request ? resource.url : resource;
    // Detect method to ensure we only intercept GET
    const method = (resource instanceof Request) ? resource.method : (options?.method || 'GET');

    if (shouldIntercept(url, method)) {
      return originalFetch.apply(this, arguments).then(async (response) => {
        const cloned = response.clone();
        const jsonText = await cloned.text();
        const modified = modifyJson(jsonText);
        let hdrs = response.headers;
        try { const obj = {}; response.headers.forEach((v, k) => obj[k] = v); hdrs = obj; } catch { }
        return new Response(modified, { status: response.status, statusText: response.statusText, headers: hdrs });
      }).catch(err => { throw err; });
    }
    return originalFetch.apply(this, arguments);
  };

  // XHR Override
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    this._method = method; // Store method for the check in .send()
    this._url = url;
    originalXhrOpen.call(this, method, url, ...args);
  };
  XMLHttpRequest.prototype.send = function () {
    // Check method here as well
    if (shouldIntercept(this._url, this._method)) {
      const originalOnReadyStateChange = this.onreadystatechange;
      const xhr = this;
      this.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
          try {
            const modifiedText = modifyJson(xhr.responseText);
            Object.defineProperty(xhr, 'responseText', { writable: true, value: modifiedText });
            Object.defineProperty(xhr, 'response', { writable: true, value: modifiedText });
          } catch (e) { }
        }
        if (originalOnReadyStateChange) originalOnReadyStateChange.apply(this, arguments);
      };
    }
    originalXhrSend.apply(this, arguments);
  };
  
      // Note: Banner/UI injection is centralized in banner.js to avoid duplication.
})();
})();