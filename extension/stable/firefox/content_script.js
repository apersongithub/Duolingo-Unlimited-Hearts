// Coordinates patch pipeline: hook early, enqueue targets, ask background for patched code.
const CHUNK_REGEX = /(^|\/)(app|7220|6150|4370)[^/]*\.js(\?.*)?$/i;
const processed = new Set();
let selectedPatchMode = 1;
let userscriptBootInjected = false;
let superBannerInjected = false; // NEW: ensure banner userscript only loaded once

// NEW: Promise to ensure injector is loaded before we post messages to it
let injectorReadyPromise = null;

function getSettingsPatchMode() {
  return new Promise(resolve => {
    try {
      chrome.storage.sync.get('settings', data => {
        const mode = Number(data?.settings?.selectedPatch) || 1;
        resolve(Math.min(Math.max(mode, 1), 9));
      });
    } catch {
      resolve(1);
    }
  });
}

function injectUserscriptBootstrapIfNeeded(mode) {
  if (userscriptBootInjected) return;
  if (mode !== 4 && mode !== 5 && mode !== 8 && mode !== 9) return;

  try {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL(
      mode === 4
        ? 'userscripts/patch4.js'
        : mode === 5
          ? 'userscripts/patch5.js'
          : mode === 8
            ? 'userscripts/patch6.js'
            : 'userscripts/patch7.js'
    );
    s.async = false;
    (document.documentElement || document.head || document.body).appendChild(s);
    userscriptBootInjected = true;
  } catch (e) {
    // Silent failure; userscripts are optional
  }
}

// NEW: Inject reusable Super banner script for all Super modes (6,7,8,9)
function injectSuperBannerIfNeeded(mode) {
  if (superBannerInjected) return;
  if (mode !== 6 && mode !== 7 && mode !== 8 && mode !== 9) return;

  try {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('userscripts/super_banner.js');
    s.async = false;
    (document.documentElement || document.head || document.body).appendChild(s);
    superBannerInjected = true;
  } catch (e) {
    // Silent failure
  }
}

function injectCustomUI(mode) {
    if (mode !== 2 && mode !== 3 && mode !== 5) return;

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
            titleDiv.textContent = 'Get Duoingo Max Extension';
            textWrap.appendChild(titleDiv);

            const subWrap = document.createElement('div');
            subWrap.className = 'k5zYn';
            const subDiv = document.createElement('div');
            subDiv.className = '_3l5Lz zfGJk';
            subDiv.textContent = 'You have it!';
            subDiv.style.color = 'red';

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
}

function tryBackgroundFetch(url) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'FETCH_AND_PATCH', url, patchMode: selectedPatchMode }, resp => resolve(resp));
  });
}

// Updated: return a promise that resolves when injection.js is loaded
function injectInjector() {
  if (document.getElementById('__ext_injector_script__')) {
    return injectorReadyPromise || Promise.resolve();
  }
  if (injectorReadyPromise) return injectorReadyPromise;

  injectorReadyPromise = new Promise(resolve => {
    const s = document.createElement('script');
    s.id = '__ext_injector_script__';
    s.type = 'module';
    s.src = chrome.runtime.getURL('injection.js');
    s.async = false;
    s.onload = () => resolve();
    (document.head || document.documentElement).appendChild(s);
  });

  return injectorReadyPromise;
}

function injectPageHook() {
  if (document.getElementById('__ext_page_hook__')) return;
  const s = document.createElement('script');
  s.id = '__ext_page_hook__';
  s.src = chrome.runtime.getURL('page_hook.js');
  s.async = false;
  (document.documentElement || document.head).appendChild(s);
}

function enqueue(url) {
  window.postMessage({ source: 'ext-injector-enqueue', url, patchMode: selectedPatchMode }, '*');
}

function sendPatched(url, patchedCode) {
  window.postMessage(
    patchedCode
      ? { source: 'ext-injector', url, patchedCode }
      : { source: 'ext-injector', url },
    '*'
  );
}

async function handleUrl(url) {
  if (!url || processed.has(url) || !CHUNK_REGEX.test(url)) return;
  processed.add(url);

  // Ensure injector is fully loaded before enqueuing (prevents default Patch 1 fallback)
  await injectInjector();
  enqueue(url);

  try {
    const resp = await tryBackgroundFetch(url);
    if (resp && resp.ok && resp.patched) sendPatched(url, resp.patched);
    else sendPatched(url, null);
  } catch {
    sendPatched(url, null);
  }
}

(async () => {
  // Load selected patch mode ASAP and inject userscript bootstrap early if needed
  selectedPatchMode = await getSettingsPatchMode();
  injectUserscriptBootstrapIfNeeded(selectedPatchMode);
  injectSuperBannerIfNeeded(selectedPatchMode); // NEW: banner for all Super modes
  injectCustomUI(selectedPatchMode);
})();

injectPageHook();

window.addEventListener('ext-script-blocked', ev => {
  handleUrl(ev?.detail?.url);
});

function scan() {
  for (const sc of document.getElementsByTagName('script')) {
    if (sc.src && CHUNK_REGEX.test(sc.src)) {
      sc.remove();
      handleUrl(sc.src);
    }
  }
}

if (document.readyState === 'loading') {
  scan();
  document.addEventListener('DOMContentLoaded', scan, { once: true });
} else {
  scan();
}

const mo = new MutationObserver(muts => {
  for (const m of muts) {
    for (const n of (m.addedNodes || [])) {
      if (n && n.tagName === 'SCRIPT' && n.src && CHUNK_REGEX.test(n.src)) {
        n.remove();
        handleUrl(n.src);
      }
    }
  }
});
mo.observe(document.documentElement, { childList: true, subtree: true });