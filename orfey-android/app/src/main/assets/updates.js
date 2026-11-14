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
  const DISMISS_KEY = "orfey_update_dismissed_code_v1";
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

  function start(win) {
    const doc = win.document;
    const bridge = win.OrfeyGitHub;
    if (!doc || !bridge || typeof bridge.appVersionCode !== "function") return;

    async function check() {
      const installedCode = Number(bridge.appVersionCode());
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
        let successTime = Date.now();
        try { win.localStorage.setItem(CHECK_KEY, String(successTime)); } catch (_) { }
        const latest = parseLatestRelease(release);
        if (!shouldRecommend(latest, installedCode)) return;
        let dismissed = "";
        try { dismissed = win.localStorage.getItem(DISMISS_KEY) || ""; } catch (_) { }
        if (dismissed === String(latest.versionCode)) return;
        showDialog(win, latest);
      } catch (_) {
        // Network errors are intentionally quiet; the app remains usable offline.
      }
    }

    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", () => win.setTimeout(check, 900), { once: true });
    else win.setTimeout(check, 900);
  }

  function showDialog(win, latest) {
    const doc = win.document;
    if (doc.getElementById("orfeyUpdateDialog")) return;
    const style = doc.createElement("style");
    style.textContent = `
      .orfey-update-shade{position:fixed;inset:0;z-index:10030;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:22px;box-sizing:border-box}
      .orfey-update-card{box-sizing:border-box;width:min(100%,460px);background:#242322;color:#f5f0e3;border:1px solid rgba(240,190,70,.35);border-radius:24px;padding:24px;box-shadow:0 18px 60px rgba(0,0,0,.48);font:inherit}
      .orfey-update-card h2{margin:0 0 12px;font-size:1.35rem;color:#f5c94b}
      .orfey-update-card p{margin:0 0 16px;line-height:1.5;color:#e7e2d8}
      .orfey-update-actions{display:flex;gap:10px;flex-wrap:wrap}
      .orfey-update-actions button{font:inherit;font-weight:700;border:0;border-radius:14px;padding:13px 18px;min-height:48px;cursor:pointer}
      .orfey-update-download{background:#e8bd43;color:#171717;flex:1}
      .orfey-update-later{background:#3d3a35;color:#f5f0e3}
      @media(prefers-reduced-motion:reduce){.orfey-update-card{scroll-behavior:auto}}
    `;
    doc.head.appendChild(style);
    const shade = doc.createElement("div");
    shade.className = "orfey-update-shade";
    shade.id = "orfeyUpdateDialog";
    shade.setAttribute("role", "dialog");
    shade.setAttribute("aria-modal", "true");
    shade.setAttribute("aria-labelledby", "orfeyUpdateTitle");
    const card = doc.createElement("section");
    card.className = "orfey-update-card";
    const title = doc.createElement("h2");
    title.id = "orfeyUpdateTitle";
    title.textContent = "Доступно обновление Орфея";
    const message = doc.createElement("p");
    message.textContent = `Версия ${latest.versionName}, сборка ${latest.versionCode}. Обновление исправляет ошибки и содержит актуальные материалы.`;
    const hint = doc.createElement("p");
    hint.textContent = "Нажмите «Скачать APK». После загрузки Android откроет установщик и может запросить разрешение устанавливать приложения из браузера. Ваши локальные данные сохраняются при установке поверх текущей версии.";
    const actions = doc.createElement("div");
    actions.className = "orfey-update-actions";
    const download = doc.createElement("button");
    download.type = "button";
    download.className = "orfey-update-download";
    download.textContent = "Скачать APK";
    const later = doc.createElement("button");
    later.type = "button";
    later.className = "orfey-update-later";
    later.textContent = "Позже";
    function close(dismiss) {
      if (dismiss) {
        try { win.localStorage.setItem(DISMISS_KEY, String(latest.versionCode)); } catch (_) { }
      }
      shade.remove();
      style.remove();
    }
    download.addEventListener("click", () => {
      close(true);
      win.location.href = latest.downloadUrl;
    });
    later.addEventListener("click", () => close(true));
    shade.addEventListener("click", event => { if (event.target === shade) close(true); });
    actions.append(download, later);
    card.append(title, message, hint, actions);
    shade.appendChild(card);
    doc.body.appendChild(shade);
    download.focus();
  }

  return { parseLatestRelease, shouldRecommend, start };
});
