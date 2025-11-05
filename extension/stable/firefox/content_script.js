// Coordinates patch pipeline: hook early, enqueue targets, ask background for patched code.
// Avoid "mixed" modes by finalizing patch mode before handling any script URLs.
const CHUNK_REGEX = /(^|\/)(app|7220|6150|4370)[^/]*\.js(\?.*)?$/i;
const processed = new Set();
let selectedPatchMode = 1;
let userscriptBootInjected = false;

// Injector load promise
let injectorReadyPromise = null;

// Mode gating
let modeReady = false;
let resolveModeReady;
const modeReadyPromise = new Promise(res => (resolveModeReady = res));
const pendingUrls = [];

// Helpers
function clampPatch(n) {
  const x = Number(n);
  return Math.min(Math.max(Number.isFinite(x) ? x : 1, 1), 9);
}

function getSettingsPatchMode() {
  return new Promise(resolve => {
    try {
      chrome.storage.sync.get('settings', async data => {
        const s = data?.settings || {};
        const sync = s.syncDefaultPatch !== false;
        const overridden = s.userOverridden === true;
        const stored = Number(s.selectedPatch);
        try {
          if (sync && !overridden) {
            const remote = await (globalThis.fetchDefaultPatch?.() || Promise.resolve(1));
            resolve(clampPatch(remote));
            return;
          }
          if (Number.isFinite(stored)) {
            resolve(clampPatch(stored));
            return;
          }
          const remote = await (globalThis.fetchDefaultPatch?.() || Promise.resolve(1));
          resolve(clampPatch(remote));
        } catch {
          resolve(1);
        }
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

// Keep any extra UI logic separate; banner.js handles settings page visuals
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

  // If patch mode isn't ready yet, queue and return. The page_hook has already prevented script execution.
  if (!modeReady) {
    pendingUrls.push(url);
    return;
  }

  processed.add(url);

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

async function finalizeModeAndFlush() {
  try {
    selectedPatchMode = await getSettingsPatchMode();
  } catch {
    selectedPatchMode = 1;
  } finally {
    injectUserscriptBootstrapIfNeeded(selectedPatchMode);
    injectCustomUI(selectedPatchMode);
    modeReady = true;
    resolveModeReady?.();

    const urls = pendingUrls.splice(0, pendingUrls.length);
    for (const u of urls) {
      await handleUrl(u);
    }

    scan();
  }
}

injectPageHook();

// Blocked script notifications from page_hook
window.addEventListener('ext-script-blocked', ev => {
  const url = ev?.detail?.url;
  handleUrl(url);
});

function scan() {
  for (const sc of document.getElementsByTagName('script')) {
    if (sc.src && CHUNK_REGEX.test(sc.src)) {
      sc.remove();
      handleUrl(sc.src);
    }
  }
}

// Make a small, non-intrusive overlay to suggest reload when remote default changes
function showRemoteChangedOverlay() {
  if (document.getElementById('__duo_ext_default_changed__')) return;

  const wrap = document.createElement('div');
  wrap.id = '__duo_ext_default_changed__';
  wrap.style.cssText = 'position:fixed;bottom:16px;left:16px;z-index:2147483647;';

  const card = document.createElement('div');
  card.style.cssText = 'max-width:360px;background:#1e1e1e;color:#fff;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.2);padding:14px 16px;font:600 14px system-ui,-apple-system,Segoe UI,Roboto,Arial';
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  if (prefersLight) {
    card.style.background = '#fff';
    card.style.color = '#111827';
    card.style.boxShadow = '0 8px 24px rgba(0,0,0,.15)';
  }

  const title = document.createElement('div');
  title.textContent = 'Default patch changed';
  title.style.marginBottom = '6px';

  const msg = document.createElement('div');
  msg.textContent = 'Reload this page to apply the new default patch.';
  msg.style.fontWeight = '400';
  msg.style.fontSize = '13px';
  msg.style.marginBottom = '10px';

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';

  const later = document.createElement('button');
  later.textContent = 'Later';
  later.style.cssText = 'background:transparent;border:1px solid currentColor;color:inherit;padding:6px 10px;border-radius:6px;cursor:pointer;font-weight:600';

  const reload = document.createElement('button');
  reload.textContent = 'Reload';
  reload.style.cssText = 'background:#3b82f6;border:none;color:#fff;padding:6px 10px;border-radius:6px;cursor:pointer;font-weight:600';

  later.onclick = () => wrap.remove();
  reload.onclick = () => { location.reload(); };

  row.appendChild(later);
  row.appendChild(reload);
  card.appendChild(title);
  card.appendChild(msg);
  card.appendChild(row);
  wrap.appendChild(card);
  document.documentElement.appendChild(wrap);
}

// React to background’s remote default change broadcasts via storage.local
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  // React to default patch change for overlay
  if (changes.remoteDefaultPatch) {
    chrome.storage.sync.get('settings', data => {
      const s = data?.settings || {};
      const sync = s.syncDefaultPatch !== false;
      const overridden = s.userOverridden === true;
      if (sync && !overridden) {
        showRemoteChangedOverlay();
      }
    });
  }

  // React to "clear localStorage" broadcast (no extra permissions)
  if (changes.__ext_clear_ls__) {
    const nv = Number(changes.__ext_clear_ls__.newValue);
    maybeClearLocalStorageWithNonce(nv);
  }
});

// Delay scanning until mode is ready to avoid mixed-mode patching.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => modeReadyPromise.then(() => scan()), { once: true });
} else {
  modeReadyPromise.then(() => scan());
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

// Kick off mode selection immediately
finalizeModeAndFlush();

/* ---------------------------
   LocalStorage cleanup (no extra permissions)
   --------------------------- */
const CLEAR_FLAG_KEY = '__ext_clear_ls__';
let lastClearSeen = 0;

function clearExtensionLocalStorageKeys() {
  try {
    // Keys known to be set by this extension on Duolingo origins
    localStorage.removeItem('duo_extension_update_ignore_until_major');
    localStorage.removeItem('duo_extension_update_ignore_until_minor');
    localStorage.removeItem('user_data_cache'); // from userscript patch5 cache
  } catch {}
}

function maybeClearLocalStorageWithNonce(nonce) {
  if (!Number.isFinite(nonce)) return;
  if (nonce <= lastClearSeen) return;
  clearExtensionLocalStorageKeys();
  lastClearSeen = nonce;
}

// One-time check on load (use existing flag if already set)
try {
  chrome.storage.local.get(CLEAR_FLAG_KEY, data => {
    const nonce = Number(data?.[CLEAR_FLAG_KEY]);
    maybeClearLocalStorageWithNonce(nonce);
  });
} catch {}