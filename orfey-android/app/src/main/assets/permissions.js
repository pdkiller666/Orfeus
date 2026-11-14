(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.OrfeyPermissions = api;
    root.orfeyShowMicPermissionHelp = error => api.show(root, error);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function errorMessage(error) {
    const name = error && typeof error.name === "string" ? error.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      return "Android не выдал доступ к микрофону. Откройте настройки приложения → Разрешения → Микрофон и включите доступ. Если разрешение уже включено, проверьте системный переключатель «Доступ к микрофону» в быстрых настройках.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "Android не обнаружил микрофон. Проверьте, что микрофон подключён и доступен устройству.";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "Микрофон занят другим приложением или временно недоступен. Закройте приложения, использующие микрофон, и попробуйте снова.";
    }
    return "Не удалось подключить микрофон. Проверьте разрешение приложения и системный переключатель доступа к микрофону.";
  }

  function show(win, error) {
    const doc = win.document;
    if (!doc || !doc.body || doc.getElementById("orfeyMicHelp")) return;
    const style = doc.createElement("style");
    style.textContent = `
      .orfey-mic-shade{position:fixed;inset:0;z-index:10040;background:rgba(0,0,0,.76);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box}
      .orfey-mic-card{box-sizing:border-box;width:min(100%,440px);padding:24px;background:#242322;color:#f5f0e3;border:1px solid rgba(240,190,70,.35);border-radius:24px;box-shadow:0 18px 60px rgba(0,0,0,.5);font:inherit}
      .orfey-mic-card h2{margin:0 0 12px;color:#f5c94b;font-size:1.3rem}
      .orfey-mic-card p{margin:0 0 16px;line-height:1.5;color:#e7e2d8}
      .orfey-mic-actions{display:flex;gap:10px;flex-wrap:wrap}
      .orfey-mic-actions button{font:inherit;font-weight:700;border:0;border-radius:14px;padding:13px 16px;min-height:48px;cursor:pointer}
      .orfey-mic-settings{background:#e8bd43;color:#171717;flex:1}
      .orfey-mic-close{background:#3d3a35;color:#f5f0e3}
    `;
    doc.head.appendChild(style);
    const shade = doc.createElement("div");
    shade.id = "orfeyMicHelp";
    shade.className = "orfey-mic-shade";
    shade.setAttribute("role", "alertdialog");
    shade.setAttribute("aria-modal", "true");
    shade.setAttribute("aria-labelledby", "orfeyMicTitle");
    const card = doc.createElement("section");
    card.className = "orfey-mic-card";
    const title = doc.createElement("h2");
    title.id = "orfeyMicTitle";
    title.textContent = "Не удалось получить доступ к микрофону";
    const message = doc.createElement("p");
    message.textContent = errorMessage(error);
    const help = doc.createElement("p");
    help.textContent = "Если системное окно разрешения больше не появляется, измените разрешение вручную в настройках Android, затем вернитесь и повторите упражнение.";
    const actions = doc.createElement("div");
    actions.className = "orfey-mic-actions";
    const settings = doc.createElement("button");
    settings.type = "button";
    settings.className = "orfey-mic-settings";
    settings.textContent = "Открыть настройки";
    const closeButton = doc.createElement("button");
    closeButton.type = "button";
    closeButton.className = "orfey-mic-close";
    closeButton.textContent = "Понятно";
    function close() { shade.remove(); style.remove(); }
    settings.addEventListener("click", () => {
      const opened = !!(win.OrfeyGitHub && typeof win.OrfeyGitHub.openMicrophoneSettings === "function" && win.OrfeyGitHub.openMicrophoneSettings());
      if (opened) close();
      else message.textContent = "Не удалось открыть настройки автоматически. Откройте на Android: Настройки → Приложения → Орфей → Разрешения → Микрофон.";
    });
    closeButton.addEventListener("click", close);
    shade.addEventListener("click", event => { if (event.target === shade) close(); });
    actions.append(settings, closeButton);
    card.append(title, message, help, actions);
    shade.appendChild(card);
    doc.body.appendChild(shade);
    settings.focus();
  }

  return { errorMessage, show };
});
