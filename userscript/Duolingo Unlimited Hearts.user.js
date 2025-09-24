// ==UserScript==
// @name         Duolingo Unlimited Hearts
// @icon         https://d35aaqx5ub95lt.cloudfront.net/images/hearts/fa8debbce8d3e515c3b08cb10271fbee.svg
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Intercepts and modifies fetch API responses for user data.
// @author       apersongithub
// @match        *://www.duolingo.com/*
// @match        *://www.duolingo.cn/*
// @grant        none
// @run-at       document-start
// @downloadURL https://github.com/apersongithub/Duolingo-Unlimited-Hearts/raw/refs/heads/main/userscript/Duolingo%20Unlimited%20Hearts.user.js
// @updateURL https://github.com/apersongithub/Duolingo-Unlimited-Hearts/raw/refs/heads/main/userscript/Duolingo%20Unlimited%20Hearts.user.js
// ==/UserScript==

// WORKS AS OF 2025-09-23
(function() {
    'use strict';

    // Inject code into the page context
    const script = document.createElement('script');
    script.textContent = `
        (function() {
            const originalFetch = window.fetch;
            window.fetch = async function(url, config) {
                if (typeof url === 'string' && url.includes('/2017-06-30/users/')) {
                    console.log('[Injected] Intercepting fetch request to:', url);
                    const response = await originalFetch(url, config);
                    const clonedResponse = response.clone();
                    let data;
                    try {
                        data = await clonedResponse.json();
                    } catch (e) {
                        return response;
                    }
                    if (data.health) {
                        data.health.unlimitedHeartsAvailable = true;
                    }
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
    document.documentElement.appendChild(script);
    script.remove();
})();