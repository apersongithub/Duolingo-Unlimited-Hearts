/* 
 * Small helper for the extension popup that shows runtime version status.
 * Contributors:
 *  - To change where the latest-version is fetched from, update `VERSION_URL`.
 *  - To change how often the popup refreshes, update the interval passed to setInterval().
 *  - To change the displayed element, update the element id used for `statusEl`.
 *  - If fetch fails in some environments, check CORS/raw file hosting for the VERSION_URL.
 */

const VERSION_URL =
  "https://raw.githubusercontent.com/apersongithub/Duolingo-Unlimited-Hearts/refs/heads/main/extension-version.json";

// Wait until popup DOM is ready (safe place to query elements)
document.addEventListener("DOMContentLoaded", () => {
  // The element in popup.html where we show the version / status text.
  const statusEl = document.getElementById("status");

  // The version field from the extension's manifest (current installed version).
  const currentVersion = chrome.runtime.getManifest().version;

  // Core: fetch the latest version file and compare with installed version.
  async function checkVersion() {
    try {
      // Fetch a small JSON file from the repo that contains { "version": "x.y.z" }
      const response = await fetch(VERSION_URL);
      const data = await response.json();
      const latestVersion = data.version;

      // compareVersions returns -1 if current < latest, 0 if equal, 1 if current > latest
      const cmp = compareVersions(currentVersion, latestVersion);

      if (cmp === 0) {
        // Up to date
        statusEl.textContent = `Version: ✅ Up to date (v${currentVersion})`;
        statusEl.style.color = "#28df28";
      } else if (cmp < 0) {
        // Installed is older than remote
        statusEl.textContent = `Version: ⚠️ Update available, check GitHub! Current: v${currentVersion}, Latest: v${latestVersion}`;
        statusEl.style.color = "#df2828ff";
      } else {
        // Installed is newer than remote — commonly a local/beta/dev build
        statusEl.textContent = `Version: 🧪 Beta version detected (v${currentVersion}), Latest stable: v${latestVersion}`;
        statusEl.style.color = "#2878df";
      }
    } catch (err) {
      // Network or JSON parsing errors surface here.
      // Contributors: if you see this often, confirm VERSION_URL is reachable and CORS/hosting is correct.
      console.error("Version check failed:", err);
      statusEl.textContent = "Version: Error checking";
    }
  }

  // Initial check on popup open
  checkVersion();

  // Periodically refresh the status in case the repo changes while popup is open.
  // NOTE: For a popup UI it may be unnecessary to poll so frequently. Adjust ms as desired.
  setInterval(checkVersion, 5000);
});

/*
 * compareVersions(a, b)
 * - a, b are semantic-version-like strings ("1.2.3" etc.)
 * - Splits on '.' and compares numeric components left-to-right.
 * - Missing components are treated as 0 (e.g., "1.2" == "1.2.0").
 * Returns:
 *   1  if a > b
 *   0  if a == b
 *  -1  if a < b
 *
 * Contributors: This is a simple numeric comparator. If you need to support
 * pre-release tags (alpha/beta/rc) or more complex semver rules, consider
 * replacing with a semver library or enhancing the parser.
 */
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
