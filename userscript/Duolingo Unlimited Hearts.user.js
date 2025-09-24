// ==UserScript==
// @name         Duolingo Unlimited Hearts
// @icon         https://d35aaqx5ub95lt.cloudfront.net/images/hearts/fa8debbce8d3e515c3b08cb10271fbee.svg
// @namespace    http://tampermonkey.net/
// @version      1.2
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
(function() {
    'use strict';

    // Inject code into the page context
    const script = document.createElement('script');
    script.textContent = `
        (function() {
            const originalFetch = window.fetch;
            const CACHE_KEY = 'user_data_cache';
            const CACHE_EXPIRATION_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

            window.fetch = async function(url, config) {
                if (typeof url === 'string' && url.includes('/2017-06-30/users/')) {
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
    document.documentElement.appendChild(script);
    script.remove();

    // This function creates and adds the "Donate" button
    const addDonateButton = (targetNode) => {
        // First, check if our button already exists to avoid adding it multiple times
        if (targetNode.querySelector('.donate-button-custom')) {
            return;
        }

        // 1. Create the parent div for the button
        const buttonContainer = document.createElement('div');
        buttonContainer.className = '_2uJd1';

        // 2. Create the button element itself
        const donateButton = document.createElement('button');
        // Add a custom class 'donate-button-custom' to easily identify our button
        donateButton.className = '_1ursp _2V6ug _2paU5 _3gQUj _7jW2t rdtAy donate-button-custom';

        // 3. Create the span with the text
        const buttonText = document.createElement('span');
        buttonText.className = '_9lHjd';
        buttonText.style.color = '#d7d62b';
        buttonText.textContent = '💵 Donate to apersongithub';

        // 4. Assemble the elements
        donateButton.appendChild(buttonText);
        buttonContainer.appendChild(donateButton);

        // 5. Add the new button to the target element
        targetNode.appendChild(buttonContainer);
        // console.log('Donate button added!');
    };

    // This is the callback function that runs when the observer detects changes
    const observerCallback = (mutationsList, observer) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                // Look for the specific container we want to modify
                const targetElement = document.querySelector('._2wpqL');
                if (targetElement) {
                    addDonateButton(targetElement);
                    // Optional: Once we've found and modified it, we can stop observing
                    // observer.disconnect();
                }
            }
        }
    };

    // --- Observer Setup ---

    // 1. Select the node that will be observed for mutations (the whole document body is a safe choice)
    const targetNode = document.body;

    // 2. Options for the observer (we want to watch for child elements being added or removed)
    const config = { childList: true, subtree: true };

    // 3. Create an observer instance linked to the callback function
    const observer = new MutationObserver(observerCallback);

    // 4. Start observing the target node for configured mutations
    observer.observe(targetNode, config);

    // console.log('Observer started. Waiting for the target element to appear...');
})();