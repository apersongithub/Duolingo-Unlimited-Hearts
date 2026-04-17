const CHUNK_REGEX = /(^|\/)(app|\d{3,5})[^/]*\.js(\?.*)?$/i;
const processed = new Set();
let selectedPatchMode = 1;
let enableSpeechPatch = true;
let userscriptBootInjected = false;

// Key used by options page to signal a localStorage clear across open Duolingo tabs
const CLEAR_LS_TOKEN_KEY = '__ext_clear_localstorage_token__';

// Mode gating buffer
let modeReady = false;
let resolveModeReady;
const modeReadyPromise = new Promise(res => (resolveModeReady = res));
const pendingUrls = [];

// Injector load promise
let injectorReadyPromise = null;

// Fetch remote default patch (used for initial seeding)
async function fetchRemoteDefaultPatch() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/apersongithub/Duolingo-Unlimited-Hearts/refs/heads/main/extension-version.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('bad status');
    const data = await res.json();
    const m = Number(data?.PATCH);
    if (!Number.isFinite(m)) return 1;
    return Math.min(Math.max(m, 1), 9);
  } catch {
    return 1;
  }
}

async function loadSettings() {
  return new Promise(resolve => {
    try {
      chrome.storage.sync.get('settings', data => resolve(data?.settings || {}));
    } catch {
      resolve({});
    }
  });
}

async function saveSettings(settings) {
  try {
    await chrome.storage.sync.set({ settings });
  } catch { }
}

async function getSettingsPatchMode() {
  let s = await loadSettings();

  // First install: seed from remote (or fallback)
  if (typeof s.selectedPatch !== 'number') {
    const defaultMode = 1;
    s = {
      enableNotifications: true,
      major: { weeks: 0, days: 3, hours: 0, minutes: 0 },
      minor: { weeks: 1, days: 0, hours: 0, minutes: 0 },
      selectedPatch: defaultMode,
      syncDefaultPatch: true,
      userOverridePatch: false
    };
    await saveSettings(s);
    
    // Kick off remote fetch passively
    fetchRemoteDefaultPatch().then(async remote => {
      if (remote !== defaultMode) {
        s.selectedPatch = remote;
        await saveSettings(s);
        showRemoteChangedOverlay();
      }
    }).catch(() => {});
    
    return defaultMode;
  }

  // If sync is enabled and no manual override, follow remote default passively
  if (s.syncDefaultPatch !== false && s.userOverridePatch !== true) {
    const currentMode = s.selectedPatch;
    fetchRemoteDefaultPatch().then(async remote => {
      if (remote !== currentMode) {
        s.selectedPatch = remote;
        await saveSettings(s);
        showRemoteChangedOverlay();
      }
    }).catch(() => {});
    return currentMode;
  }

  // Otherwise return user selection
  const mode = Number(s.selectedPatch) || 1;
  return Math.min(Math.max(mode, 1), 9);
}

function injectUserscriptBootstrapIfNeeded(mode) {
  if (userscriptBootInjected) return;
  // Userscript modes: 4, 5, 8, 9
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
}

function tryBackgroundFetch(url) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'FETCH_AND_PATCH', url }, resp => resolve(resp));
  });
}

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
  window.postMessage({ source: 'ext-injector-enqueue', url, patchMode: selectedPatchMode, enableSpeechPatch }, '*');
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
  
  if (!modeReady) {
    pendingUrls.push(url);
    return;
  }
  
  processed.add(url);
  await injectInjector();
  enqueue(url);

  // We bypass the background MV3 service worker entirely for chunk fetching.
  // We send null patchedCode, which signals injection.js to fetch and patch inline.
  // This completely solves the white-screen timeout issues caused by the MV3 limitation.
  sendPatched(url, null);
}

// NEW: live patch mode update handler
async function onPatchModeChanged(newMode) {
  const prev = selectedPatchMode;
  selectedPatchMode = Math.min(Math.max(Number(newMode) || 1, 1), 9);

  // Tell injector to switch modes immediately
  window.postMessage({ source: 'ext-set-patch-mode', patchMode: selectedPatchMode }, '*');

  // Inject userscript bootstrap if entering a userscript mode
  injectUserscriptBootstrapIfNeeded(selectedPatchMode);

  const prevUserscript = [4, 5, 8, 9].includes(prev);
  const nowUserscript = [4, 5, 8, 9].includes(selectedPatchMode);

  // If the mode family changed, flush caches and reload to avoid lingering code
  if (prev !== selectedPatchMode || prevUserscript !== nowUserscript) {
    chrome.runtime.sendMessage({ type: 'FLUSH_PATCH_CACHE', keepMode: selectedPatchMode }, () => {
      setTimeout(() => {
        try { location.reload(); } catch { }
      }, 75);
    });
  }
}

// Listen for reset signal to clear page localStorage immediately, and for settings changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;

  if (changes[CLEAR_LS_TOKEN_KEY]) {
    try {
      localStorage.clear();
    } catch { }
  }

  if (changes.settings) {
    const newVal = changes.settings.newValue;
    const oldVal = changes.settings.oldValue;
    if (newVal && typeof newVal.selectedPatch === 'number') {
      if (!oldVal || oldVal.selectedPatch !== newVal.selectedPatch) {
        onPatchModeChanged(newVal.selectedPatch);
      }
    }
  }
});

(async () => {
  // Load selected patch mode ASAP and inject userscript bootstrap early if needed
  selectedPatchMode = await getSettingsPatchMode();
  // Read speech patch setting
  try {
    const data = await loadSettings();
    enableSpeechPatch = data?.enableSpeechPatch !== false;
  } catch { enableSpeechPatch = true; }
  
  injectPageHook();
  injectUserscriptBootstrapIfNeeded(selectedPatchMode);
  injectCustomUI(selectedPatchMode);
  
  // Flush queue
  modeReady = true;
  resolveModeReady();
  const backlog = [...pendingUrls];
  pendingUrls.length = 0;
  for (const bkUrl of backlog) await handleUrl(bkUrl);
})();

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