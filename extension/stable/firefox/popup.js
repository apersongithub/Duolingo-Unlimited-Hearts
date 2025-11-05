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
      const cmp = compareVersions(current, latest);
      const chromeStupid = (typeof data.chromestupid === 'string')
        ? data.chromestupid.toLowerCase() === 'true'
        : !!data.chromestupid;

      if (cmp === 0) {
        statusEl.textContent = `Version: ✅ Up to date (v${current})`;
        statusEl.style.color = '#28df28';
      } else if (cmp < 0) {
        statusEl.textContent = `Version: ⚠️ Update available! (v${current}), Latest: v${latest}`;
        statusEl.style.color = '#df2828ff';
      } else {
        // Current > latest: only show Beta if remote allows (chromestupid === false)
        if (!chromeStupid) {
          statusEl.textContent = `Version: 🧪 Beta (v${current}) Stable: v${latest}`;
          statusEl.style.color = '#2878df';
        } else {
          // Suppress beta message; treat as up-to-date to avoid confusion
          statusEl.textContent = `Version: ✅ Up to date (v${current})`;
          statusEl.style.color = '#28df28';
        }
      }
    } catch {
      statusEl.textContent = 'Version: Error checking';
    }
  }

  updateStatus();
  setInterval(updateStatus, 5000);
});