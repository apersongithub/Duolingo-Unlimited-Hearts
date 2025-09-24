// ==UserScript==
// @name         Duolingo Unlimited Hearts
// @icon         https://d35aaqx5ub95lt.cloudfront.net/images/hearts/fa8debbce8d3e515c3b08cb10271fbee.svg
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Intercepts and modifies fetch API responses for user data.
// @author       apersongithub
// @match        *://www.duolingo.*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Store the original, native fetch function
    const originalFetch = window.fetch;

    // Create a new, overriding fetch function
    window.fetch = async (url, config) => {
        // Check if this is the request we want to modify
        if (typeof url === 'string' && url.includes('/2017-06-30/users/')) {
            console.log(`[Tampermonkey] Intercepting fetch request to: ${url}`);

            // Call the original fetch to get the real response
            const response = await originalFetch(url, config);

            // Clone the response so we can read the JSON
            const clonedResponse = response.clone();
            const data = await clonedResponse.json();

            // --- Modify the data ---

            // Safely set unlimited hearts
            if (data.health) {
                data.health.unlimitedHeartsAvailable = true;
            }

            // Create a new, modified Response to return
            const modifiedResponse = new Response(JSON.stringify(data), {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });

            // Return our fake response instead of the real one
            return modifiedResponse;
        }

        // If it's not the request we care about, just call the original fetch
        return originalFetch(url, config);
    };
})();
