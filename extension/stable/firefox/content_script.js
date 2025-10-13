// content_script.js (Firefox MV2)
// - Do NOT block any scripts. Let background.js patch responses at network level
//   for app-*.js and 7220/6150/4370.
// - Remove integrity/crossorigin/nonce early so SRI doesn't block patched responses.
// - Keep observing dynamically added scripts to strip SRI.
// - Reply to injector with selected patch mode via window.postMessage.
// - Inject userscripts for Patch 4 and Patch 5 from local (built-in) only.

const SCRIPT_RE = /(^|\/)(app|7220|6150|4370)[^/]*\.js(\?.*)?$/i;

function stripSriAttrs(node) {
  try {
    if (!node || node.tagName !== 'SCRIPT') return;
    const src = node.src || '';
    if (SCRIPT_RE.test(src)) {
      if (node.hasAttribute('integrity')) node.removeAttribute('integrity');
      if (node.hasAttribute('crossorigin')) node.removeAttribute('crossorigin');
      if (node.hasAttribute('nonce')) node.removeAttribute('nonce');
    }
  } catch {}
}

// Strip SRI from existing scripts ASAP
(function scanAndStrip() {
  const scripts = Array.from(document.getElementsByTagName('script'));
  for (const sc of scripts) stripSriAttrs(sc);
})();

// Observe for dynamically added scripts and strip SRI
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of (m.addedNodes || [])) {
      if (node && node.tagName === 'SCRIPT') {
        stripSriAttrs(node);
      }
    }
  }
});
observer.observe(document.documentElement || document, { childList: true, subtree: true });

// Patch mode
let __extPatchMode = 'patch1';

// Userscript element ids to avoid duplicates
const USERSCRIPT_IDS = {
  patch4: '__ext_userscript_patch4__',
  patch5: '__ext_userscript_patch5__',
};

function injectScriptSrcOnce(id, src) {
  if (document.getElementById(id)) return;
  const s = document.createElement('script');
  s.id = id;
  s.src = src;
  s.async = false;
  (document.documentElement || document.head || document).appendChild(s);
}

function injectUserscriptIfNeeded() {
  // Only inject once per mode switch; ids prevent duplicates
  if (__extPatchMode === 'patch4') {
    const src = chrome.runtime.getURL('userscripts/patch4.js');
    injectScriptSrcOnce(USERSCRIPT_IDS.patch4, src);
  } else if (__extPatchMode === 'patch5') {
    const src = chrome.runtime.getURL('userscripts/patch5.js');
    injectScriptSrcOnce(USERSCRIPT_IDS.patch5, src);
  }
}

// Run the full DOM enhancement block once when in patch2 or patch3
let __extPatch23BlockRan = false;
function runPatch23BlockOnce() {
  if (__extPatch23BlockRan) return;
  __extPatch23BlockRan = true;

  (function () {
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
        titleDiv.textContent = 'You have it!';
        titleDiv.style.color = 'red';
        textWrap.appendChild(titleDiv);

        const subWrap = document.createElement('div');
        subWrap.className = 'k5zYn';
        const subDiv = document.createElement('div');
        subDiv.className = '_3l5Lz zfGJk';
        subDiv.textContent = 'Check Out';
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
}

// Initialize settings and keep updated
try {
  chrome.storage.sync.get('settings', (data = {}) => {
    const s = (data && data.settings) || {};
    __extPatchMode = (['patch1','patch2','patch3','patch4','patch5'].includes(s.patchMode)) ? s.patchMode : 'patch1';
    injectUserscriptIfNeeded();
    if (__extPatchMode === 'patch2' || __extPatchMode === 'patch3' || __extPatchMode === 'patch5') {
      runPatch23BlockOnce();
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.settings) return;
    const s = changes.settings.newValue || {};
    const prevMode = __extPatchMode;
    __extPatchMode = (['patch1','patch2','patch3','patch4','patch5'].includes(s.patchMode)) ? s.patchMode : 'patch1';
    if (__extPatchMode !== prevMode) {
      injectUserscriptIfNeeded();
    }
    if (__extPatchMode === 'patch2' || __extPatchMode === 'patch3' || __extPatchMode === 'patch5') {
      runPatch23BlockOnce();
    }
  });
} catch {}

// Respond to injector asking for mode
window.addEventListener('message', (ev) => {
  const d = ev.data;
  if (!d || ev.source !== window) return;
  if (d.source === 'ext-injector-get-mode') {
    window.postMessage({ source: 'ext-injector-mode', mode: __extPatchMode }, '*');
  }
});

// Optional: inject page_hook.js to strip SRI even if CSP blocks content script early.
(function injectPageHook() {
  if (document.getElementById('__ext_page_hook__')) return;
  const s = document.createElement('script');
  s.id = '__ext_page_hook__';
  s.src = chrome.runtime.getURL('page_hook.js');
  s.async = false;
  (document.documentElement || document.head || document).appendChild(s);
})();