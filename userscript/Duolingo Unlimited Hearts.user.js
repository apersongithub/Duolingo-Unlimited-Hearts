// ==UserScript==
// @name         Duolingo Unlimited Hearts
// @icon         https://d35aaqx5ub95lt.cloudfront.net/images/hearts/fa8debbce8d3e515c3b08cb10271fbee.svg
// @namespace    https://tampermonkey.net/
// @version      2.5
// @description  Intercepts and modifies fetch Duolingo's API responses for user data with caching support.
// @author       apersongithub
// @match        *://www.duolingo.com/*
// @match        *://www.duolingo.cn/*
// @grant        none
// @run-at       document-start
// @license      MPL-2.0
// @downloadURL https://github.com/apersongithub/Duolingo-Unlimited-Hearts/raw/refs/heads/main/userscript/Duolingo%20Unlimited%20Hearts.user.js
// @updateURL https://github.com/apersongithub/Duolingo-Unlimited-Hearts/raw/refs/heads/main/userscript/Duolingo%20Unlimited%20Hearts.user.js
// ==/UserScript==

// WORKS AS OF 2025-09-24

/*
 * Below this is the actual fetch interception and modification logic for Unlimited Hearts
 */

(function() {
   'use strict';

  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(ua);

  if (isMobile) {
    // Mobile patch with multi-request dedupe + short-term caching
    const pageFn = function() {
      function log(...args){ try{ console.log('[Injected][Mobile]', ...args); } catch(_){} }

      // Simple in-memory cache (per page load)
      const CACHE_TTL = 5000; // 5s (Duolingo may refetch rapidly on mobile)
      const cache = new Map(); // key -> { data, ts, status, statusText, headers }
      const inFlight = new Map(); // key -> Promise

      function isUserDataUrl(u){
        return typeof u === 'string' && u.includes('/2017-06-30/users/');
      }

      function cacheKey(u){
        return (u && typeof u === 'string') ? u.split('?')[0] : u;
      }

      function buildResponse(entry){
        return new Response(JSON.stringify(entry.data), {
          status: entry.status,
            statusText: entry.statusText,
            headers: entry.headers
        });
      }

      function storeCache(key, resMeta){
        cache.set(key, { ...resMeta, ts: Date.now() });
      }

      function getValidCache(key){
        const c = cache.get(key);
        if (!c) return null;
        if (Date.now() - c.ts > CACHE_TTL){
          cache.delete(key);
          return null;
        }
        return c;
      }

      function ensureHearts(data){
        if (data && data.health) {
          data.health.unlimitedHeartsAvailable = true;
        }
      }

      function applyPatches() {
        // Patch Response.json (fallback / double assurance)
        try {
          if (!Response.prototype.json.__patched) {
            const origJson = Response.prototype.json;
            Response.prototype.json = async function() {
              try {
                const url = this.url || '';
                if (isUserDataUrl(url)) {
                  const text = await this.clone().text();
                  let data;
                  try { data = JSON.parse(text); } catch(_) { return origJson.apply(this, arguments); }
                  ensureHearts(data);
                  return data;
                }
              } catch(e) { log('json error', e); }
              return origJson.apply(this, arguments);
            };
            Response.prototype.json.__patched = true;
            log('Patched Response.json');
          }
        } catch(e) { log('Failed to patch Response.json', e); }

        // Patch fetch with dedupe + short-term cache
        try {
          if (!window.fetch.__patched) {
            const origFetch = window.fetch;
            window.fetch = async function(url, init) {
              const u = (typeof url === 'string') ? url : (url && url.url) || '';
              if (!isUserDataUrl(u)) {
                return origFetch.apply(this, arguments);
              }

              const key = cacheKey(u);

              // Serve fresh cache if valid
              const cached = getValidCache(key);
              if (cached) {
                log('Serving cached user data', key);
                return buildResponse(cached);
              }

              // Deduplicate concurrent requests
              if (inFlight.has(key)) {
                log('Awaiting in-flight request', key);
                try { await inFlight.get(key); } catch(_) {}
                const after = getValidCache(key);
                if (after) return buildResponse(after);
                // fall through to refetch if something failed
              }

              const p = (async () => {
                const res = await origFetch.apply(this, arguments);
                let data, txt;
                try {
                  txt = await res.clone().text();
                  data = JSON.parse(txt);
                } catch(_) {
                  return res; // Non-JSON; just return original
                }
                ensureHearts(data);
                const headers = {};
                res.headers.forEach((v,k)=> headers[k]=v);
                const entry = {
                  data,
                  status: res.status,
                  statusText: res.statusText,
                  headers
                };
                storeCache(key, entry);
                return buildResponse(entry);
              })();

              inFlight.set(key, p);
              let finalRes;
              try {
                finalRes = await p;
              } finally {
                inFlight.delete(key);
              }
              return finalRes;
            };
            window.fetch.__patched = true;
            log('Patched fetch (dedupe + cache)');
          }
        } catch(e) { log('Failed to patch fetch', e); }
      }

      applyPatches();

      // Reapply periodically (every 2s for ~30s)
      let count = 0;
      const interval = setInterval(() => {
        applyPatches();
        count++;
        if (count > 15) clearInterval(interval);
      }, 2000);

      // Watchdog (light) every 5s
      setInterval(() => {
        if (!Response.prototype.json.__patched || !window.fetch.__patched) {
          log('Re-patching via watchdog');
          applyPatches();
        }
      }, 5000);

      log('Mobile persistent injection (with multi-fetch handling) running');
    };

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

  } else {
    // Desktop (PC) lightweight cached fetch patch only
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        const originalFetch = window.fetch;
        const CACHE_KEY = 'user_data_cache';
        const CACHE_EXPIRATION_TIME = 5 * 60 * 1000; // 5 minutes

        window.fetch = async function(url, config) {
          if (typeof url === 'string' && url.includes('/2017-06-30/users/')) {
            console.log('[Injected][PC] Intercepting fetch:', url);

            try {
              const cachedData = localStorage.getItem(CACHE_KEY);
              if (cachedData) {
                const parsed = JSON.parse(cachedData);
                if (Date.now() - parsed.timestamp < CACHE_EXPIRATION_TIME) {
                  console.log('[Injected][PC] Returning cached data');
                  return new Response(JSON.stringify(parsed.data), {
                    status: 200,
                    statusText: 'OK',
                    headers: { 'Content-Type': 'application/json' }
                  });
                } else {
                  localStorage.removeItem(CACHE_KEY);
                }
              }
            } catch(e){ console.log('[Injected][PC] Cache read error', e); }

            const response = await originalFetch(url, config);
            let data;
            try {
              data = await response.clone().json();
            } catch(e) {
              return response;
            }

            if (data && data.health) {
              data.health.unlimitedHeartsAvailable = true;
            }

            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
            } catch(e){ console.log('[Injected][PC] Cache write error', e); }

            return new Response(JSON.stringify(data), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            });
          }
          return originalFetch(url, config);
        };
        console.log('[Injected][PC] Lightweight fetch interceptor active');
      })();
    `;
    (document.head || document.documentElement).appendChild(script);
  }

  /*
  * UI buttons + attribution (common to both platforms)
  */
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

      if (/Android/i.test(ua)) {
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

      const firstButtonContainer = targetNode.querySelector('._2uJd1');
      if (firstButtonContainer && firstButtonContainer.nextSibling) {
        targetNode.insertBefore(maxContainer, firstButtonContainer.nextSibling);
      } else {
        targetNode.appendChild(maxContainer);
      }
    }

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
    observerCallback();
  };

  setupObservers();
})();
