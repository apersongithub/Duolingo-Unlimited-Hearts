// ==UserScript==
// @name         Duolingo Unlimited Hearts
// @icon         https://d35aaqx5ub95lt.cloudfront.net/images/hearts/fa8debbce8d3e515c3b08cb10271fbee.svg
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  Intercepts and modifies fetch Duolingo's API responses for user data with caching support.
// @author       apersongithub
// @match        *://www.duolingo.com/*
// @match        *://www.duolingo.cn/*
// @grant        none
// @run-at       document-start
// @downloadURL https://github.com/apersongithub/Duolingo-Unlimited-Hearts/raw/refs/heads/main/userscript/Duolingo%20Unlimited%20Hearts.user.js
// @updateURL https://github.com/apersongithub/Duolingo-Unlimited-Hearts/raw/refs/heads/main/userscript/Duolingo%20Unlimited%20Hearts.user.js
// ==/UserScript==

// WORKS AS OF 2025-09-23
    (function () {
        'use strict';

        // Inject code into the page context
        const script = document.createElement('script');
        script.textContent = `
(function() {
            const originalFetch = window.fetch;
            const CACHE_KEY = 'user_data_cache';
            const CACHE_EXPIRATION_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

            // The Regular Expression to match the dynamic URL pattern: /YYYY-MM-DD/users/
            const USER_DATA_REGEX = /\\/\\d{4}-\\d{2}-\\d{2}\\/users\\//;

            window.fetch = async function(url, config) {
                // Use .test() with the Regex to check the URL structure
                if (typeof url === 'string' && USER_DATA_REGEX.test(url)) {
                    console.log('[Injected] Intercepting fetch request to:', url);

                    // Check for a valid, unexpired cached response
                    const cachedData = localStorage.getItem(CACHE_KEY);
                    if (cachedData) {
                        const parsedCache = JSON.parse(cachedData);
                        if (Date.now() - parsedCache.timestamp < CACHE_EXPIRATION_TIME) {
                            console.log('[Injected] Returning cached data.');
                            return new Response(JSON.stringify(parsedCache.data), {
                                status: 200,
                                statusText: 'OK',
                                headers: { 'Content-Type': 'application/json' }
                            });
                        } else {
                            console.log('[Injected] Cache expired, fetching new data.');
                            localStorage.removeItem(CACHE_KEY); // Clear expired cache
                        }
                    }

                    // Proceed with the original fetch if no valid cache exists
                    const response = await originalFetch(url, config);
                    const clonedResponse = response.clone();
                    let data;
                    try {
                        data = await clonedResponse.json();
                    } catch (e) {
                        return response;
                    }

                    // Modify the data as before
                    if (data.health) {
                        data.health.unlimitedHeartsAvailable = true;
                    }

                    // Cache the modified data with a timestamp before returning
                    const cachePayload = {
                        data: data,
                        timestamp: Date.now()
                    };
                    localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));

                    return new Response(JSON.stringify(data), {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
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