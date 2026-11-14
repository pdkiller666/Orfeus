(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.OrfeyUpdates = api;
    api.start(root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const API_URL = "https://api.github.com/repos/pdkiller666/Orfeus/releases/latest";
  const APK_NAME = "orfey-android.apk";
  const CHECK_KEY = "orfey_update_last_success_at_v1";
  const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

  function parseLatestRelease(release) {
    if (!release || release.draft === true || release.prerelease === true) return null;
    const tag = typeof release.tag_name === "string" ? release.tag_name : "";
    const match = /^build-(\d{1,9})$/.exec(tag);
    if (!match) return null;
    const versionCode = Number(match[1]);
    if (!Number.isSafeInteger(versionCode) || versionCode < 1) return null;
    const asset = Array.isArray(release.assets) ? release.assets.find(item => item && item.name === APK_NAME) : null;
    if (!asset || asset.state && asset.state !== "uploaded" || typeof asset.browser_download_url !== "string") return null;
    let url;
    try { url = new URL(asset.browser_download_url); } catch (_) { return null; }
    if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password) return null;
    if (url.pathname !== `/pdkiller666/Orfeus/releases/download/${tag}/${APK_NAME}`) return null;
    const name = typeof release.name === "string" ? release.name : "";
    const versionName = (/Орфей\s+([^\s(]+)/u.exec(name) || [])[1] || "Новая";
    return { versionCode, versionName, downloadUrl: url.href };
  }

  function shouldRecommend(latest, installedVersionCode) {
    return !!latest && Number.isSafeInteger(installedVersionCode) && latest.versionCode > installedVersionCode;
  }

  function formatVersionLabel(versionName) {
    const name = String(versionName || "").trim();
    return `Версия ${name || "—"}`;
  }

  function applyBrandStatus(doc, installedVersionName, latest, win) {
    if (!doc) return;
    const versionLabel = formatVersionLabel(installedVersionName);
    doc.querySelectorAll("[data-app-version]").forEach(node => {
      if (node.textContent !== versionLabel) node.textContent = versionLabel;
    });
    doc.querySelectorAll("[data-app-update]").forEach(button => {
      button.hidden = !latest;
      if (!latest) {
        button.onclick = null;
        button.removeAttribute("aria-label");
        button.removeAttribute("title");
        return;
      }
      const accessibleName = `Обновить приложение до версии ${latest.versionName}`;
      button.setAttribute("aria-label", accessibleName);
      button.setAttribute("title", accessibleName);
      button.onclick = () => { win.location.href = latest.downloadUrl; };
    });
  }

  function start(win) {
    const doc = win.document;
    const bridge = win.OrfeyGitHub;
    if (!doc || !bridge || typeof bridge.appVersionCode !== "function") return;

    let installedCode = NaN;
    let installedName = "";
    try { installedCode = Number(bridge.appVersionCode()); } catch (_) { }
    try { installedName = typeof bridge.appVersionName === "function" ? String(bridge.appVersionName()).trim() : ""; } catch (_) { }

    let latestUpdate = null;
    const refreshBrand = () => applyBrandStatus(doc, installedName, latestUpdate, win);
    refreshBrand();

    const renderRoot = doc.getElementById("v") || doc.body;
    if (renderRoot && typeof win.MutationObserver === "function") {
      const observer = new win.MutationObserver(refreshBrand);
      observer.observe(renderRoot, { childList: true, subtree: true });
    }

    async function check() {
      if (!Number.isSafeInteger(installedCode) || installedCode < 1) return;
      let lastSuccess = 0;
      try { lastSuccess = Number(win.localStorage.getItem(CHECK_KEY) || 0); } catch (_) { }
      if (Date.now() - lastSuccess < CHECK_INTERVAL_MS) return;
      try {
        const response = await win.fetch(API_URL, {
          method: "GET",
          headers: { Accept: "application/vnd.github+json" },
          cache: "no-store",
          credentials: "omit"
        });
        if (!response.ok) return;
        const release = await response.json();
        try { win.localStorage.setItem(CHECK_KEY, String(Date.now())); } catch (_) { }
        const latest = parseLatestRelease(release);
        latestUpdate = shouldRecommend(latest, installedCode) ? latest : null;
        refreshBrand();
      } catch (_) {
        // Network errors are intentionally quiet; the current version stays visible offline.
      }
    }

    const scheduleCheck = () => win.setTimeout(check, 900);
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", scheduleCheck, { once: true });
    else scheduleCheck();
    if (typeof win.setInterval === "function") win.setInterval(check, CHECK_INTERVAL_MS);
    doc.addEventListener("visibilitychange", () => {
      if (doc.visibilityState === "visible") scheduleCheck();
    });
  }

  return { parseLatestRelease, shouldRecommend, formatVersionLabel, applyBrandStatus, start };
});
