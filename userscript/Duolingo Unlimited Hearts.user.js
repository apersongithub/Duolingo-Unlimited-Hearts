// ==UserScript==
// @name         Duolingo Unlimited Hearts
// @icon         https://d35aaqx5ub95lt.cloudfront.net/images/hearts/fa8debbce8d3e515c3b08cb10271fbee.svg
// @namespace    https://tampermonkey.net/
// @version      2.4
// @description  Intercepts and modifies fetch Duolingo's API responses for user data with caching support.
// @author       apersongithub
// @match        *://www.duolingo.com/*
// @match        *://www.duolingo.cn/*
// @grant        none
// @run-at       document-start
// @downloadURL https://github.com/apersongithub/Duolingo-Unlimited-Hearts/raw/refs/heads/main/userscript/Duolingo%20Unlimited%20Hearts.user.js
// @updateURL https://github.com/apersongithub/Duolingo-Unlimited-Hearts/raw/refs/heads/main/userscript/Duolingo%20Unlimited%20Hearts.user.js
// ==/UserScript==

// WORKS AS OF 2025-09-24

/*
 * Below this is the actual fetch interception and modification logic for Unlimited Hearts
 */

(function() {
    'use strict';

  const pageFn = function() {
    function log(...args){ try{ console.log('[Injected]', ...args); } catch(_){} }

    function applyPatches() {
      // Patch Response.json
      try {
        if (!Response.prototype.json.__patched) {
          const origJson = Response.prototype.json;
          Response.prototype.json = async function() {
            try {
              const url = this.url || '';
              if (url.includes('/2017-06-30/users/')) {
                const text = await this.clone().text();
                let data;
                try { data = JSON.parse(text); } catch(_) { return origJson.apply(this, arguments); }
                if (data && data.health) {
                  data.health.unlimitedHeartsAvailable = true;
                  log('Modified health in Response.json');
                }
                return data;
              }
            } catch(e) { log('json error', e); }
            return origJson.apply(this, arguments);
          };
          Response.prototype.json.__patched = true;
          log('Patched Response.json');
        }
      } catch(e) { log('Failed to patch Response.json', e); }

      // Patch fetch
      try {
        if (!window.fetch.__patched) {
          const origFetch = window.fetch;
          window.fetch = async function(url, init) {
            const res = await origFetch.apply(this, arguments);
            try {
              const u = (typeof url === 'string') ? url : (url && url.url) || '';
              if (u.includes('/2017-06-30/users/')) {
                const text = await res.clone().text();
                let data = JSON.parse(text);
                if (data && data.health) data.health.unlimitedHeartsAvailable = true;
                const headers = {};
                res.headers.forEach((v,k)=> headers[k] = v);
                return new Response(JSON.stringify(data), { status: res.status, statusText: res.statusText, headers });
              }
            } catch(e) { log('fetch error', e); }
            return res;
          };
          window.fetch.__patched = true;
          log('Patched fetch');
        }
      } catch(e) { log('Failed to patch fetch', e); }
    }

    // Initial patch
    applyPatches();

    // Reapply periodically (every 2s for the first 30s)
    let count = 0;
    const interval = setInterval(() => {
      applyPatches();
      count++;
      if (count > 15) clearInterval(interval); // stop after ~30s
    }, 2000);

    // Also observe changes forever (catch future overwrites)
    const watchdog = setInterval(() => {
      if (!Response.prototype.json.__patched || !window.fetch.__patched) {
        log('Re-patching via watchdog');
        applyPatches();
      }
    }, 5000);

    log('Persistent injection running');
  };

  // Inject via blob to escape sandbox
  try {
    const code = '(' + pageFn.toString() + ')();';
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const s = document.createElement('script');
    s.src = url;
    s.onload = function(){ URL.revokeObjectURL(url); s.remove(); };
    (document.head || document.documentElement).appendChild(s);
  } catch(e) {
    const s = document.createElement('script');
    s.textContent = '(' + pageFn.toString() + ')();';
    (document.head || document.documentElement).appendChild(s);
    s.remove();
  }

    /*
    * Everything below this is only for adding buttons and attribution to the Duolingo Hearts UI
    */

    // Replace elements with class 'vp1gi' with attribution span
    const updateVp1giElements = () => {
        document.querySelectorAll('.vp1gi').forEach(el => {
            const span = document.createElement('span');
            span.className = '_3S2Xa';
            span.innerHTML = 'Created by <a href="https://github.com/apersongithub" target="_blank" style="color:#07b3ec">apersongithub</a>';
            el.replaceWith(span);
        });
    };

    const addCustomButtons = (targetNode) => {
        if (!targetNode) return;

        // Add "Get Duoingo Max Extension" button if not present
        if (!targetNode.querySelector('[data-custom="max-extension"]')) {
            const maxContainer = document.createElement('div');
            maxContainer.className = '_2uJd1';

            const maxButton = document.createElement('button');
            maxButton.className = '_2V6ug _1ursp _7jW2t uapW2';
            maxButton.dataset.custom = 'max-extension';
            maxButton.addEventListener('click', () => {
                window.open('https://github.com/apersongithub/Duolingo-Unlimited-Hearts/tree/main', '_blank');
            });

            const wrapper = document.createElement('div');
            wrapper.className = '_2-M1N';

            const imgWrap = document.createElement('div');
            imgWrap.className = '_3jaRf';
            const img = document.createElement('img');
            img.src = 'https://d35aaqx5ub95lt.cloudfront.net/images/max/9f30dad6d7cc6723deeb2bd9e2f85dd8.svg';
            img.style.height = '36px';
            img.style.width = '36px';
            imgWrap.appendChild(img);

            const textWrap = document.createElement('div');
            textWrap.className = '_2uCBj';
            const titleDiv = document.createElement('div');
            titleDiv.className = '_3Kmn9';
            titleDiv.textContent = 'Duoingo Max Extension';
            textWrap.appendChild(titleDiv);

            const subWrap = document.createElement('div');
            subWrap.className = 'k5zYn';
            const subDiv = document.createElement('div');
            subDiv.className = '_3l5Lz zfGJk';

            const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
            const isAndroid = /Android/i.test(ua);
            const isMobile = /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(ua);

            if (isAndroid) {
                subDiv.textContent = 'get for firefox android or pc';
                subDiv.style.color = '#07b3ec';
            } else if (isMobile) {
                subDiv.textContent = 'PC/ANDROID ONLY';
                subDiv.style.color = 'red';
            } else {
                subDiv.textContent = 'Get IT free';
            }

            subWrap.appendChild(subDiv);

            wrapper.appendChild(imgWrap);
            wrapper.appendChild(textWrap);
            wrapper.appendChild(subWrap);
            maxButton.appendChild(wrapper);
            maxContainer.appendChild(maxButton);

            // Insert right after the Unlimited Hearts button (first button container)
            const firstButtonContainer = targetNode.querySelector('._2uJd1');
            if (firstButtonContainer && firstButtonContainer.nextSibling) {
                targetNode.insertBefore(maxContainer, firstButtonContainer.nextSibling);
            } else {
                targetNode.appendChild(maxContainer);
            }
        }

        // Add Donate button if not present
        if (!targetNode.querySelector('.donate-button-custom')) {
            const buttonContainer = document.createElement('div');
            buttonContainer.className = '_2uJd1';

            const donateButton = document.createElement('button');
            donateButton.className = '_1ursp _2V6ug _2paU5 _3gQUj _7jW2t rdtAy donate-button-custom';
            donateButton.addEventListener('click', () => {
                window.open('https://html-preview.github.io/?url=https://raw.githubusercontent.com/apersongithub/Duolingo-Unlimited-Hearts/refs/heads/main/extras/donations.html', '_blank');
            });

            const buttonText = document.createElement('span');
            buttonText.className = '_9lHjd';
            buttonText.style.color = '#d7d62b';
            buttonText.textContent = '💵 Donate';

            donateButton.appendChild(buttonText);
            buttonContainer.appendChild(donateButton);
            targetNode.appendChild(buttonContainer);
        }
    };

    const setupObservers = () => {
        if (!document.body) {
            setTimeout(setupObservers, 50);
            return;
        }

        const observerCallback = () => {
            const targetElement = document.querySelector('._2wpqL');
            if (targetElement) {
                addCustomButtons(targetElement);
                updateVp1giElements();
            }
        };

        const observer = new MutationObserver(observerCallback);
        observer.observe(document.body, { childList: true, subtree: true });

        // Initial run
        observerCallback();
    };

    setupObservers();
})();
