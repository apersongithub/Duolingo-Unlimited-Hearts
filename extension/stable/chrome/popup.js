document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const current = chrome.runtime.getManifest().version;

  function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const x = pa[i] || 0, y = pb[i] || 0;
      if (x > y) return 1;
      if (x < y) return -1;
    }
    return 0;
  }

  async function updateStatus() {
    try {
      const r = await fetch('https://raw.githubusercontent.com/apersongithub/Duolingo-Unlimited-Hearts/refs/heads/main/extension-version.json');
      const data = await r.json();
      const latest = data.version;

      // Gate beta label by chromestupid flag (accept boolean true/false or string "true"/"false")
      const chromestupidRaw = data.chromestupid;
      const chromestupid = (typeof chromestupidRaw === 'boolean')
        ? chromestupidRaw
        : String(chromestupidRaw).toLowerCase() === 'true';

      const cmp = compareVersions(current, latest);
      if (cmp === 0) {
        statusEl.textContent = `Version: ✅ Up to date (v${current})`;
        statusEl.style.color = '#28df28';
      } else if (cmp < 0) {
        statusEl.textContent = `Version: ⚠️ Update available! (v${current}), Latest: v${latest}`;
        statusEl.style.color = '#df2828ff';
      } else {
        // Current ahead of stable
        if (!chromestupid) {
          statusEl.textContent = `Version: 🧪 Beta (v${current}) Stable: v${latest}`;
          statusEl.style.color = '#2878df';
        } else {
          statusEl.textContent = `Version: ✅ Up to date (v${current})`;
          statusEl.style.color = '#28df28';
        }
      }
    } catch {
      statusEl.textContent = 'Version: Error checking';
      statusEl.style.color = '';
    }
  }

  updateStatus();
  setInterval(updateStatus, 5000);

  // Money saved indicator
  const moneySavedEl = document.getElementById('moneySaved');
  chrome.storage.local.get('installDate', data => {
    const installDate = data.installDate || Date.now();
    // If no install date stored yet, store it now as fallback
    if (!data.installDate) {
      chrome.storage.local.set({ installDate });
    }
    const now = Date.now();
    const msPerMonth = 30.44 * 24 * 60 * 60 * 1000;
    const monthsElapsed = Math.floor((now - installDate) / msPerMonth);
    const totalMonths = monthsElapsed + 1; // First month counts on install day
    const saved = (totalMonths * 12.99).toFixed(2);
    moneySavedEl.textContent = `💰 You've saved $${saved}!`;
  });
});