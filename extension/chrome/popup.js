document.addEventListener("DOMContentLoaded", () => {
  const statusEl = document.getElementById("status");
  const currentVersion = chrome.runtime.getManifest().version;

  async function checkVersion() {
    try {
      const response = await fetch(
        "https://raw.githubusercontent.com/apersongithub/Duolingo-Unlimited-Hearts/refs/heads/main/extension-version.json"
      );
      const data = await response.json();
      const latestVersion = data.version;

      const cmp = compareVersions(currentVersion, latestVersion);

      if (cmp === 0) {
        statusEl.textContent = `Version: ✅ Up to date (v${currentVersion})`;
        statusEl.style.color = "#28df28";
      } else if (cmp < 0) {
        statusEl.textContent = `Version: ⚠️ Update available, check GitHub! Current: v${currentVersion}, Latest: v${latestVersion}`;
        statusEl.style.color = "#df2828ff";
      } else {
        statusEl.textContent = `Version: 🧪 Beta version detected (v${currentVersion}), Latest stable: v${latestVersion}`;
        statusEl.style.color = "#2878df";
      }
    } catch (err) {
      console.error("Version check failed:", err);
      statusEl.textContent = "Version: Error checking";
    }
  }

  checkVersion(); // initial check

  // Refresh every 5 seconds (5000 ms)
  setInterval(checkVersion, 5000);
});

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}
