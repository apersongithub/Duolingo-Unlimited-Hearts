; (() => {
    if (window.__DL_PATCH5_INSTALLED__) return;
    window.__DL_PATCH5_INSTALLED__ = true;

    (function () {
        'use strict';

        // Inject code into the page context
                const script = document.createElement('script');
        script.textContent = `
        (function() {
            const originalFetch = window.fetch;
            const CACHE_KEY = 'user_data_cache';
            const CACHE_EXPIRATION_TIME = 5 * 60 * 1000; 
            const USER_DATA_REGEX = /\\/\\d{4}-\\d{2}-\\d{2}\\/users\\//;

            window.fetch = async function(url, config) {
                
                // Method check
                let method = 'GET';
                if (config && config.method) {
                    method = config.method.toUpperCase();
                } else if (url instanceof Request && url.method) {
                    method = url.method.toUpperCase();
                }

                if (method !== 'GET') return originalFetch(url, config);

                const urlString = (typeof url === 'string') ? url : (url.url || '');
                if (urlString.includes('/shop-items')) return originalFetch(url, config);

                if (USER_DATA_REGEX.test(urlString)) {
                    
                    const cachedData = localStorage.getItem(CACHE_KEY);
                    if (cachedData) {
                        const parsedCache = JSON.parse(cachedData);
                        if (Date.now() - parsedCache.timestamp < CACHE_EXPIRATION_TIME) {
                            return new Response(JSON.stringify(parsedCache.data), {
                                status: 200, statusText: 'OK', headers: { 'Content-Type': 'application/json' }
                            });
                        } else {
                            localStorage.removeItem(CACHE_KEY);
                        }
                    }

                    const response = await originalFetch(url, config);
                    const clonedResponse = response.clone();
                    let data;
                    try { data = await clonedResponse.json(); } catch (e) { return response; }

                    if (data.health) data.health.unlimitedHeartsAvailable = true;

                    // Integrity Check
                    const hasCurrency = (data.gems !== undefined || data.lingots !== undefined || data.rupees !== undefined);
                    
                    if (hasCurrency) {
                        const cachePayload = { data: data, timestamp: Date.now() };
                        localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
                    }

                    return new Response(JSON.stringify(data), {
                        status: response.status, statusText: response.statusText, headers: response.headers
                    });
                }
                return originalFetch(url, config);
            };
        })();
    `;

        /*
         * Above this code is the actual fetch interception and modification logic for Unlimited Hearts
         * Below this code adds buttons and attribution to the Duolingo Hearts UI
         */

        document.documentElement.appendChild(script);
        script.remove();
})();
})();