(function (root) {
  "use strict";
  const OWNER = "pdkiller666";
  const REPO = "Orfeus";
  const MANIFEST = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/samples/manifest.json`;
  const ids = new Set(["range", "one", "step", "fal", "dyn", "pop", "vib", "belt", "tw", "grit", "mel", "sub", "game", "vib2", "fal2", "tw2", "belt2", "mel2", "sub2"]);
  const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
  const MAX_SOURCE_SECONDS = 120;
  const AUDIO_EXTENSIONS = new Set(["wav","mp3","m4a","aac","ogg","oga","opus","webm","flac"]);
  const labels = {range:"Диагностика диапазона",one:"Одна нота",step:"Ступенька «до-ре-до»",fal:"Фальцет",dyn:"Динамика",pop:"Поп-фильтр",vib:"Вибрато",belt:"Белтинг",tw:"Твенг",grit:"Расщепление",mel:"Мелизматика",sub:"Субтон",game:"Попади в ноту",vib2:"Вибрато II",fal2:"Фальцет II",tw2:"Твенг II",belt2:"Белтинг II",mel2:"Мелизматика II",sub2:"Субтон II"};
  let modal = null;
  let session = null;
  let sampleAudioUrl = null;
  let teacherAudio = null;
  let teacherButton = null;
  let publicAudio = null;
  let catalogRequestId = 0;
  let timer = null;
  const $ = (sel, parent = document) => parent.querySelector(sel);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  function setTeacherButton(button, playing) {
    const icon = root.OrfeyIcons ? root.OrfeyIcons.icon(playing ? "stop" : "play", "ui-icon", 18) : "";
    button.innerHTML = `${icon}<span>${playing ? "Стоп" : "Образец"}</span>`;
    button.setAttribute("aria-label", playing ? "Остановить образец преподавателя" : "Прослушать образец преподавателя");
    button.setAttribute("aria-pressed", String(playing));
  }

  function validEntry(item) {
    return !!item && typeof item.id === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(item.id) &&
      item.status === "approved" && ["teacher","synthetic"].includes(item.sourceType) && ids.has(item.exerciseId) &&
      typeof item.title === "string" && item.title.length >= 3 && item.title.length <= 80 &&
      typeof item.description === "string" && item.description.length <= 500 &&
      typeof item.recordedBy === "string" && item.recordedBy.length >= 2 && item.recordedBy.length <= 60 &&
      item.path === `samples/audio/${item.id}.wav` &&
      typeof item.sha256 === "string" && /^[a-f0-9]{64}$/.test(item.sha256) &&
      Number.isInteger(item.sizeBytes) && item.sizeBytes >= 44 && item.sizeBytes <= 5 * 1024 * 1024 &&
      item.mimeType === "audio/wav" && Number.isFinite(item.durationMs) && item.durationMs >= 500 && item.durationMs <= 30000 && item.license === "CC BY 4.0";
  }
  function validManifest(data) {
    return !!data && data.schema === 1 && Array.isArray(data.samples) && data.samples.length <= 100 && data.samples.every(validEntry);
  }
  function isSupportedAudioFile(file) {
    if (!file || typeof file.name !== "string" || !Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_SOURCE_BYTES) return false;
    const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() || "";
    return String(file.type || "").toLowerCase().startsWith("audio/") || AUDIO_EXTENSIONS.has(ext);
  }
  function rootPath(path) { return `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${path.split("/").map(encodeURIComponent).join("/")}`; }
  function preferredSample(samples, exerciseId) {
    const candidates = (Array.isArray(samples) ? samples : []).filter(item => item && item.exerciseId === exerciseId && validEntry(item))
      .sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return candidates.find(item => item.sourceType === "teacher") || candidates[0] || null;
  }
  function stopTeacherSample() {
    const audio = teacherAudio, button = teacherButton;
    teacherAudio = null; teacherButton = null;
    if (audio) { audio.pause(); try { audio.currentTime = 0; } catch (_) {} }
    if (button && button.isConnected) setTeacherButton(button, false);
  }
  function bindTeacherSample(button, audio) {
    button.removeAttribute("onclick");
    setTeacherButton(button, false);
    button.addEventListener("click", () => {
      if (teacherAudio === audio && !audio.paused) { stopTeacherSample(); return; }
      stopTeacherSample();
      if (typeof root.stopPreview === "function") root.stopPreview();
      teacherAudio = audio; teacherButton = button;
      setTeacherButton(button, true);
      audio.play().catch(() => { if (teacherAudio === audio) stopTeacherSample(); });
    });
    audio.addEventListener("play", () => {
      if (teacherAudio && teacherAudio !== audio) stopTeacherSample();
      teacherAudio = audio; teacherButton = button;
      setTeacherButton(button, true);
    });
    audio.addEventListener("pause", () => {
      if (teacherAudio === audio && !audio.ended) {
        teacherAudio = null; teacherButton = null;
        setTeacherButton(button, false);
      }
    });
    audio.addEventListener("ended", () => { if (teacherAudio === audio) stopTeacherSample(); });
  }

  function formatAudioTime(value) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  }

  function buildPublicAudioPlayer(audio, sample) {
    const teacher = sample.sourceType === "teacher";
    const source = teacher ? "образец преподавателя" : "синтетический ориентир";
    const player = document.createElement("div");
    player.className = "sample-player";
    player.setAttribute("role", "group");
    player.setAttribute("aria-label", `Плеер: ${teacher ? "образец преподавателя" : "синтетический ориентир"}`);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "sample-player-toggle";
    const main = document.createElement("div");
    main.className = "sample-player-main";
    const top = document.createElement("div");
    top.className = "sample-player-top";
    const label = document.createElement("span");
    label.className = "sample-player-label";
    label.textContent = teacher ? "Запись преподавателя" : "Тестовый ориентир";
    const time = document.createElement("span");
    time.className = "sample-player-time";
    time.textContent = "0:00 / --:--";
    top.append(label, time);
    const seek = document.createElement("input");
    seek.type = "range";
    seek.className = "sample-player-seek";
    seek.min = "0"; seek.max = "1000"; seek.step = "1"; seek.value = "0"; seek.disabled = true;
    seek.setAttribute("aria-label", `Позиция воспроизведения: ${sample.title || source}`);
    const status = document.createElement("span");
    status.className = "sample-player-status";
    status.setAttribute("role", "status");
    status.textContent = "Готов к прослушиванию";
    main.append(top, seek, status);
    audio.controls = false;
    audio.preload = "metadata";
    audio.hidden = true;
    audio.tabIndex = -1;
    audio.setAttribute("aria-hidden", "true");

    const setPlaying = playing => {
      toggle.innerHTML = root.OrfeyIcons ? root.OrfeyIcons.icon(playing ? "pause" : "play", "ui-icon", 20) : "";
      toggle.setAttribute("aria-label", playing ? `Приостановить ${source}` : `Воспроизвести ${source}`);
      player.classList.toggle("is-playing", playing);
    };
    const updatePosition = () => {
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      const current = Number.isFinite(audio.currentTime) && audio.currentTime >= 0 ? audio.currentTime : 0;
      time.textContent = `${formatAudioTime(current)} / ${duration ? formatAudioTime(duration) : "--:--"}`;
      seek.disabled = !duration;
      seek.value = String(duration ? Math.round(Math.min(1, current / duration) * 1000) : 0);
      seek.setAttribute("aria-valuetext", `${formatAudioTime(current)} из ${duration ? formatAudioTime(duration) : "неизвестной длительности"}`);
    };
    toggle.addEventListener("click", () => {
      if (audio.paused) {
        status.textContent = "Запускаю воспроизведение…";
        const attempt = audio.play();
        if (attempt && typeof attempt.catch === "function") attempt.catch(() => {
          status.textContent = "Не удалось воспроизвести запись. Проверьте подключение и повторите.";
          setPlaying(false);
        });
      } else audio.pause();
    });
    seek.addEventListener("input", () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      audio.currentTime = Number(seek.value) / 1000 * audio.duration;
      updatePosition();
    });
    audio.addEventListener("loadedmetadata", updatePosition);
    audio.addEventListener("durationchange", updatePosition);
    audio.addEventListener("timeupdate", updatePosition);
    audio.addEventListener("play", () => {
      setPlaying(true);
      status.dataset.state = "playing";
      status.textContent = "Воспроизведение";
    });
    audio.addEventListener("pause", () => {
      setPlaying(false);
      status.dataset.state = "";
      status.textContent = audio.ended ? "Прослушивание завершено" : audio.currentTime > 0 ? "Пауза" : "Готов к прослушиванию";
    });
    audio.addEventListener("ended", () => {
      setPlaying(false);
      status.dataset.state = "";
      status.textContent = "Прослушивание завершено";
      updatePosition();
    });
    audio.addEventListener("error", () => {
      setPlaying(false);
      seek.disabled = true;
      status.textContent = "Не удалось загрузить аудиозапись. Обновите каталог и попробуйте снова.";
    });
    setPlaying(false);
    updatePosition();
    player.append(toggle, main, audio);
    return player;
  }

  function openModal(exerciseId, html) {
    closeModal(false);
    modal = document.createElement("section");
    modal.className = "sample-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Загрузка аудиообразца");
    modal.innerHTML = `<div class="sample-sheet"><button class="sample-close" type="button" aria-label="Закрыть">×</button>${html}</div>`;
    modal.dataset.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.appendChild(modal);
    modal.dataset.exerciseId = exerciseId;
    $(".sample-close", modal).addEventListener("click", () => closeModal(true));
    modal.addEventListener("click", event => { if (event.target === modal) closeModal(true); });
    modal.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(true); });
    return modal;
  }
  function closeModal(cleanup = true) {
    if (cleanup && session) {
      if (session.pendingMicRequest) session.pendingMicRequest.cancelled = true;
      try { if (session.recorder && session.recorder.state !== "inactive") session.recorder.stop(); } catch (_) {}
      if (session.stream) session.stream.getTracks().forEach(track => track.stop());
      if (session.objectUrl) URL.revokeObjectURL(session.objectUrl);
      if (session.previewUrl) URL.revokeObjectURL(session.previewUrl);
      session = null;
    }
    if (timer) { clearTimeout(timer); timer = null; }
    if (modal) { document.body.style.overflow = modal.dataset.previousBodyOverflow || ""; modal.remove(); }
    modal = null;
  }

  function renderTokenGate(exerciseId, message = "") {
    openModal(exerciseId, `<p class="mu sm">Упражнение</p><h1>Доступ преподавателя</h1><p class="mu">Для отправки записи напрямую в GitHub подключите токен с ограниченным доступом только к репозиторию Orfeus. Четырёхзначный код не выдаёт право записи.</p>
      <div class="sample-warning"><b>Нужен fine-grained token</b><br>Repository access: только <code>pdkiller666/Orfeus</code>.<br>Permissions: <b>Contents — Read and write</b>; <b>Pull requests — Read and write</b>. Срок действия задайте минимальный. У аккаунта также должно быть право Write в репозитории.</div>
      <p><a class="sample-external" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Создать fine-grained token на GitHub</a></p>
      <label class="sample-field">GitHub token<input id="sampleToken" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_…"></label>
      <p id="sampleAuthStatus" class="mu sm" role="status">${esc(message)}</p>
      <button id="sampleConnect" class="btn" type="button">Проверить и сохранить на устройстве</button>
      <p class="mu sm">Токен хранится зашифрованным Android Keystore на этом устройстве и не отправляется никуда кроме api.github.com. Его можно удалить в этом окне.</p>`);
    $("#sampleConnect", modal).addEventListener("click", () => {
      const input = $("#sampleToken", modal);
      const value = input.value.trim(); input.value = "";
      if (!value) { $("#sampleAuthStatus", modal).textContent = "Вставьте fine-grained token."; return; }
      $("#sampleAuthStatus", modal).textContent = "Проверяю токен и доступ к репозиторию…";
      $("#sampleConnect", modal).disabled = true;
      if (!root.OrfeyGitHub) { $("#sampleAuthStatus", modal).textContent = "Эта версия приложения не поддерживает GitHub-загрузку."; return; }
      root.OrfeyGitHub.saveToken(value);
    });
  }

  function renderEditor(exerciseId, login = "") {
    const label = labels[exerciseId] || exerciseId;
    session = {exerciseId, recorder:null, stream:null, chunks:[], blob:null, decodedBuffer:null, objectUrl:null, previewUrl:null, duration:0, start:0, end:0, busy:false};
    openModal(exerciseId, `<p class="mu sm">Образец для упражнения</p><h1>${esc(label)}</h1>
      <p class="mu">Можно записать звук с микрофона или выбрать готовый аудиофайл. Затем выберите фрагмент до 30 секунд, прослушайте его и при необходимости замените или обрежьте. Поддерживаются распространённые аудиоформаты; исходный файл — до 25 МБ и 2 минут.</p>
      <div class="sample-warning"><b>Важно: отправка делает аудио публичным немедленно.</b> Репозиторий открыт, поэтому WAV станет доступен любому пользователю GitHub сразу после отправки в ветку — ещё до проверки или слияния Pull Request. Удаление файла не гарантирует удаления скопированных копий. Отправляйте только запись, которую вы готовы опубликовать открыто.</div>
      ${["belt","belt2","tw","tw2","grit"].includes(exerciseId) ? `<div class="sample-warning"><b>Нужна педагогическая проверка.</b> Pull Request нужен для включения образца в каталог приложения; он не скрывает уже отправленный публичный файл. Не используйте запись как инструкцию форсировать голос.</div>` : ""}
      <div class="sample-rec-controls"><button id="sampleRecord" class="btn sample-record-start" type="button" aria-pressed="false">${root.OrfeyIcons.icon("record","ui-icon",18)}<span>Начать запись</span></button><button id="sampleStop" class="btn s sample-record-stop" type="button" disabled>${root.OrfeyIcons.icon("stop","ui-icon",18)}<span>Остановить</span></button></div>
      <button id="sampleChooseFile" class="btn s" type="button">Выбрать готовый аудиофайл</button><input id="sampleFile" type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.oga,.opus,.webm,.flac" hidden>
      <p id="sampleRecordStatus" class="mu sm" role="status">Запишите звук или выберите файл. Отправится только подтверждённый и обрезанный фрагмент в WAV.</p>
      <audio id="sampleAudio" controls preload="none" hidden></audio>
      <div id="sampleTrim" hidden><h2>Выберите фрагмент</h2><label class="sample-field">Начало · <span id="sampleStartLabel">0,00</span> с<input id="sampleStart" type="range" min="0" max="1" step="0.01" value="0"></label><label class="sample-field">Конец · <span id="sampleEndLabel">0,00</span> с<input id="sampleEnd" type="range" min="0" max="1" step="0.01" value="1"></label><p id="sampleTrimStatus" class="mu sm">Длительность: —</p><button id="samplePreviewTrim" class="btn s" type="button">${root.OrfeyIcons.icon("play","ui-icon",18)}<span>Прослушать выбранный фрагмент</span></button><button id="sampleRedo" class="sample-link" type="button">Сбросить выбранный вариант</button></div>
      <label class="sample-field">Название образца<input id="sampleTitle" maxlength="80" placeholder="Например: мягкий переход в головной регистр"></label>
      <label class="sample-field">Короткое описание<textarea id="sampleDescription" maxlength="500" rows="3" placeholder="Что именно демонстрирует образец"></textarea></label>
      <label class="sample-field">Автор / преподаватель<input id="sampleRecordedBy" maxlength="60" value="${esc(login)}" placeholder="Имя для публичной атрибуции"></label>
      <label class="sample-consent"><input id="sampleConsent" type="checkbox"><span>Я подтверждаю право на публикацию и согласие исполнителя. Я понимаю, что аудио и указанные авторские сведения станут общедоступными немедленно после отправки в публичную ветку GitHub — до проверки и слияния PR — и разрешаю распространение записи по <a class="sample-external" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>.</span></label>
      <p class="mu sm">Отправка создаст публичную ветку и Pull Request. WAV доступен сразу после отправки; проверка нужна только для включения записи в каталог приложения.</p>
      <p id="sampleUploadStatus" class="mu sm" role="status"></p>
      <button id="sampleSubmit" class="btn" type="button" disabled>Отправить на проверку в GitHub</button>
      <button id="sampleDisconnect" class="sample-link" type="button">Отключить GitHub на этом устройстве</button>`);
    const rec = $("#sampleRecord", modal), stop = $("#sampleStop", modal), status = $("#sampleRecordStatus", modal);
    rec.addEventListener("click", startRecording);
    stop.addEventListener("click", stopRecording);
    $("#sampleChooseFile", modal).addEventListener("click", () => $("#sampleFile", modal).click());
    $("#sampleFile", modal).addEventListener("change", event => {
      const file = event.currentTarget.files && event.currentTarget.files[0];
      event.currentTarget.value = "";
      if (file) importAudioFile(file);
    });
    $("#sampleRedo", modal).addEventListener("click", () => { resetTake(); status.textContent = "Готово к новой записи или выбору файла."; });
    $("#sampleStart", modal).addEventListener("input", updateTrim);
    $("#sampleEnd", modal).addEventListener("input", updateTrim);
    $("#samplePreviewTrim", modal).addEventListener("click", previewTrim);
    $("#sampleDisconnect", modal).addEventListener("click", () => { root.OrfeyGitHub.forgetToken(); closeModal(true); });
    $("#sampleSubmit", modal).addEventListener("click", submitSample);
  }

  async function startRecording() {
    const take = session, activeModal = modal;
    if (!take || take.recorder || take.pendingMicRequest || take.busy) return;
    const pending = {cancelled:false}; take.pendingMicRequest = pending;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
      if (session !== take || modal !== activeModal || pending.cancelled) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      take.pendingMicRequest = null;
      resetTake();
      $("#sampleChooseFile", activeModal).disabled = true;
      take.stream = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      take.recorder = new MediaRecorder(stream, {mimeType:mime, audioBitsPerSecond:96000});
      take.chunks = [];
      take.recorder.ondataavailable = event => { if (event.data && event.data.size && session === take) take.chunks.push(event.data); };
      take.recorder.onstop = () => {
        if (session !== take || modal !== activeModal) return;
        if (take.stream) take.stream.getTracks().forEach(track => track.stop());
        take.stream = null;
        take.blob = new Blob(take.chunks, {type:take.recorder.mimeType || "audio/webm"});
        take.recorder = null;
        take.busy = true;
        $("#sampleRecord", activeModal).disabled = true;
        if (take.blob.size > 5 * 1024 * 1024) {
          take.busy = false;
          $("#sampleRecordStatus", activeModal).textContent = "Запись больше 5 МБ. Запишите короче.";
          $("#sampleRecord", activeModal).disabled = false;
          $("#sampleChooseFile", activeModal).disabled = false;
          return;
        }
        take.objectUrl = URL.createObjectURL(take.blob);
        const audio = $("#sampleAudio", activeModal); audio.src = take.objectUrl; audio.hidden = false;
        decodeTake(take.blob).then(decoded => {
          if (session !== take || modal !== activeModal) return;
          take.decodedBuffer = decoded; take.duration = decoded.duration; take.start = 0; take.end = decoded.duration;
          $("#sampleTrim", activeModal).hidden = false;
          for (const id of ["sampleStart","sampleEnd"]) { const slider = $("#" + id, activeModal); slider.max = decoded.duration.toFixed(2); }
          $("#sampleEnd", activeModal).value = decoded.duration.toFixed(2);
          $("#sampleRecordStatus", activeModal).textContent = `Запись готова · ${decoded.duration.toFixed(1)} с. Прослушайте и выберите границы.`;
          updateTrim();
        }).catch(() => { if(session===take&&modal===activeModal)$("#sampleRecordStatus", activeModal).textContent = "Не удалось обработать эту запись. Попробуйте другой браузер или запишите короче."; }).finally(() => { if(session===take&&modal===activeModal) { take.busy = false; $("#sampleRecord", activeModal).disabled = false; $("#sampleChooseFile", activeModal).disabled = false; if (take.duration) updateTrim(); } });
      };
      take.recorder.start(250);
      $("#sampleRecord", activeModal).disabled = true; $("#sampleStop", activeModal).disabled = false;
      $("#sampleRecordStatus", activeModal).textContent = "Идёт запись… максимум 30 секунд.";
      timer = setTimeout(() => { if(session===take)stopRecording(); }, 30000);
    } catch (error) {
      if (session === take && modal === activeModal) {
        take.pendingMicRequest = null;
        if (take.stream) { take.stream.getTracks().forEach(track => track.stop()); take.stream = null; }
        take.recorder = null; take.busy = false;
        $("#sampleRecord", activeModal).disabled = false; $("#sampleStop", activeModal).disabled = true; $("#sampleChooseFile", activeModal).disabled = false;
        $("#sampleRecordStatus", activeModal).textContent = "Не удалось подключить микрофон. Откройте настройки доступа и повторите запись.";
          if (window.orfeyShowMicPermissionHelp) window.orfeyShowMicPermissionHelp(error);
      }
    }
  }
  function stopRecording() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!session || !session.recorder) return;
    if (session.recorder.state !== "inactive") session.recorder.stop();
    $("#sampleRecord", modal).disabled = false; $("#sampleStop", modal).disabled = true;
    if (session.stream) session.stream.getTracks().forEach(track => track.stop());
    $("#sampleRecordStatus", modal).textContent = "Обрабатываю запись…";
  }
  async function importAudioFile(file) {
    const take = session, activeModal = modal;
    if (!take || !activeModal) return;
    const status = $("#sampleRecordStatus", activeModal);
    if (take.recorder || take.pendingMicRequest || take.busy) { status.textContent = "Сначала остановите текущую запись или дождитесь её обработки."; return; }
    if (!isSupportedAudioFile(file)) { status.textContent = "Выберите аудиофайл до 25 МБ: WAV, MP3, M4A, AAC, OGG, OPUS, WEBM или FLAC."; return; }
    take.busy = true;
    $("#sampleAudio", activeModal).pause();
    $("#sampleRecord", activeModal).disabled = true;
    $("#sampleChooseFile", activeModal).disabled = true;
    $("#samplePreviewTrim", activeModal).disabled = true;
    $("#sampleRedo", activeModal).disabled = true;
    $("#sampleSubmit", activeModal).disabled = true;
    status.textContent = `Открываю аудиофайл «${file.name.slice(0,80)}»…`;
    try {
      const decoded = await decodeTake(file);
      if (session !== take || modal !== activeModal) return;
      if (decoded.duration < 0.5) throw new Error("Файл короче 0,5 секунды.");
      if (decoded.duration > MAX_SOURCE_SECONDS) throw new Error("Файл длиннее 2 минут. Обрежьте его до выбора, чтобы снизить нагрузку на телефон.");
      resetTake();
      take.blob = file; take.decodedBuffer = decoded; take.duration = decoded.duration; take.start = 0; take.end = decoded.duration;
      take.objectUrl = URL.createObjectURL(file);
      const audio = $("#sampleAudio", activeModal); audio.src = take.objectUrl; audio.hidden = false;
      $("#sampleTrim", activeModal).hidden = false;
      for (const id of ["sampleStart","sampleEnd"]) { const slider = $("#" + id, activeModal); slider.max = decoded.duration.toFixed(2); }
      $("#sampleStart", activeModal).value = "0";
      $("#sampleEnd", activeModal).value = decoded.duration.toFixed(2);
      status.textContent = `Файл готов · ${decoded.duration.toFixed(1)} с. Выберите фрагмент не длиннее 30 секунд; оригинал не отправляется.`;
      updateTrim();
    } catch (error) {
      if (session === take && modal === activeModal) status.textContent = error.message || "Не удалось открыть аудио. Попробуйте WAV, MP3 или M4A.";
    } finally {
      if (session === take && modal === activeModal) {
        take.busy = false;
        $("#sampleRecord", activeModal).disabled = false;
        $("#sampleChooseFile", activeModal).disabled = false;
        $("#samplePreviewTrim", activeModal).disabled = false;
        $("#sampleRedo", activeModal).disabled = false;
        if (take.duration) updateTrim();
      }
    }
  }
  function resetTake() {
    if (!session) return;
    if (session.objectUrl) URL.revokeObjectURL(session.objectUrl);
    if (session.previewUrl) URL.revokeObjectURL(session.previewUrl);
    session.blob = null; session.decodedBuffer = null; session.objectUrl = null; session.previewUrl = null; session.duration = 0; session.start = 0; session.end = 0;
    const audio = $("#sampleAudio", modal); audio.pause(); audio.hidden = true; audio.removeAttribute("src");
    $("#sampleTrim", modal).hidden = true; $("#sampleSubmit", modal).disabled = true;
  }
  function updateTrim() {
    if (!session || !session.duration) return;
    let start = Number($("#sampleStart", modal).value), end = Number($("#sampleEnd", modal).value);
    if (start > end - 0.25) { if (document.activeElement === $("#sampleStart", modal)) start = Math.max(0, end - 0.25); else end = Math.min(session.duration, start + 0.25); }
    session.start = start; session.end = end;
    $("#sampleStart", modal).value = start; $("#sampleEnd", modal).value = end;
    $("#sampleStartLabel", modal).textContent = start.toFixed(2).replace(".", ",");
    $("#sampleEndLabel", modal).textContent = end.toFixed(2).replace(".", ",");
    const duration = end - start;
    $("#sampleTrimStatus", modal).textContent = `Выбранный фрагмент: ${duration.toFixed(2).replace(".", ",")} с`;
    $("#sampleSubmit", modal).disabled = session.busy || duration < 0.5 || duration > 30;
  }
  async function decodeTake(blob = session && session.blob) {
    const context = new AudioContext();
    try { return await context.decodeAudioData(await blob.arrayBuffer()); }
    finally { context.close(); }
  }
  function encodeWav(buffer, start, end) {
    const inputRate = buffer.sampleRate, rate = Math.min(44100, inputRate);
    const first = Math.max(0, Math.floor(start * inputRate));
    const count = Math.max(0, Math.floor((end - start) * rate));
    const bytes = new ArrayBuffer(44 + count * 2), view = new DataView(bytes);
    const ascii = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
    ascii(0,"RIFF"); view.setUint32(4,36+count*2,true); ascii(8,"WAVE"); ascii(12,"fmt "); view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,rate,true); view.setUint32(28,rate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true); ascii(36,"data"); view.setUint32(40,count*2,true);
    const channels = Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
    for (let i=0;i<count;i++) {
      const position = first + i * inputRate / rate, index = Math.min(buffer.length - 1, Math.floor(position));
      const fraction = position - index; let sample = 0;
      for (const channel of channels) sample += (channel[index] || 0) * (1 - fraction) + (channel[Math.min(index + 1, buffer.length - 1)] || 0) * fraction;
      sample = Math.max(-1,Math.min(1,sample/channels.length));
      view.setInt16(44+i*2,sample<0?sample*0x8000:sample*0x7fff,true);
    }
    return new Blob([bytes],{type:"audio/wav"});
  }
  async function makeEditedWav(take = session) { if (!take || !take.blob) throw new Error("Сначала запишите образец или выберите аудиофайл."); const decoded=take.decodedBuffer||await decodeTake(take.blob); return encodeWav(decoded,take.start,take.end); }
  async function previewTrim() {
    const take=session, activeModal=modal;
    if (!take || take.busy) return;
    try {
      const blob=await makeEditedWav(take);
      if(session!==take||modal!==activeModal)return;
      if(take.previewUrl)URL.revokeObjectURL(take.previewUrl);
      take.previewUrl=URL.createObjectURL(blob);
      const audio=$("#sampleAudio",activeModal);audio.src=take.previewUrl;audio.hidden=false;await audio.play();
    } catch (_) { if(session===take&&modal===activeModal)$("#sampleRecordStatus",activeModal).textContent="Не удалось подготовить фрагмент для прослушивания."; }
  }
  async function submitSample() {
    const button=$("#sampleSubmit",modal), status=$("#sampleUploadStatus",modal);
    const title=$("#sampleTitle",modal).value.trim(),description=$("#sampleDescription",modal).value.trim(),recordedBy=$("#sampleRecordedBy",modal).value.trim();
    if(session && session.busy){status.textContent="Дождитесь окончания обработки аудио.";return;}
    if(!root.OrfeyGitHub || typeof root.OrfeyGitHub.submitSample !== "function"){status.textContent="Эта версия приложения не поддерживает отправку. Установите последнюю версию.";return;}
    if(!session || !session.blob){status.textContent="Сначала запишите образец или выберите аудиофайл.";return;}
    if(title.length<3||recordedBy.length<2){status.textContent="Заполните название и имя преподавателя.";return;}
    if(!$("#sampleConsent",modal).checked){status.textContent="Подтвердите публичную публикацию до проверки PR, права и согласие исполнителя.";return;}
    if(!window.confirm("Последнее предупреждение: после отправки аудиозапись будет публично доступна в GitHub немедленно, даже если Pull Request ещё не проверен или не будет принят. Продолжить?"))return;
    button.disabled=true;status.textContent="Подготавливаю и отправляю WAV в публичную ветку GitHub…";
    try {
      const take=session;
      const blob=await makeEditedWav(take); if(session!==take||!modal)return; if(blob.size>5*1024*1024)throw new Error("WAV превышает 5 МБ. Уменьшите длительность фрагмента.");
      const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
      const payload={id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}-sample-${Math.random().toString(16).slice(2)}`,exerciseId:session.exerciseId,title,description,recordedBy,durationMs:Math.round((take.end-take.start)*1000),consent:true,wavBase64:base64};
      if(session!==take||!modal)return;
      root.OrfeyGitHub.submitSample(JSON.stringify(payload));
    } catch (error) { if(modal&&button.isConnected){button.disabled=false;status.textContent=error.message||"Не удалось подготовить аудио.";} }
  }

  root.onGitHubTokenResult = (ok, login, message) => {
    if (!modal) return;
    if (ok) renderEditor(modal.dataset.exerciseId,login);
    else {
      const status=$("#sampleAuthStatus",modal); if(status) status.textContent=message;
      const button=$("#sampleConnect",modal); if(button) button.disabled=false;
    }
  };
  root.onSampleUploadResult = (ok, url, message) => {
    if (!modal) return;
    const status=$("#sampleUploadStatus",modal), button=$("#sampleSubmit",modal);
    if(status) status.textContent=message;
    if(button) button.disabled=!!ok;
    if(ok && url && /^https:\/\/github\.com\/pdkiller666\/Orfeus\/pull\/\d+/.test(url)) {
      const link=document.createElement("a"); link.href=url; link.target="_blank"; link.rel="noopener"; link.className="sample-external"; link.textContent="Открыть Pull Request"; status?.after(link);
      if(button) button.textContent="Отправлено на проверку";
    }
  };

  function openUploader(exerciseId) {
    if (!ids.has(exerciseId)) return;
    if (typeof root.stopPreview === "function") root.stopPreview();
    stopTeacherSample();
    document.querySelectorAll("#publishedSample audio").forEach(audio => audio.pause());
    if (!root.OrfeyGitHub) { renderTokenGate(exerciseId,"Для загрузки установите актуальную версию приложения."); return; }
    if (root.OrfeyGitHub.hasToken()) renderEditor(exerciseId);
    else renderTokenGate(exerciseId);
  }
  root.openSampleUploader = openUploader;
  root.loadExerciseSample = async exerciseId => {
    const mount=$("#publishedSample"); if(!mount||!ids.has(exerciseId))return;
    stopTeacherSample();
    if(publicAudio){publicAudio.pause();publicAudio=null;}
    const requestId=++catalogRequestId;
    if(sampleAudioUrl){URL.revokeObjectURL(sampleAudioUrl);sampleAudioUrl=null;}
    mount.replaceChildren();
    let manifest;
    try {
      const response=await fetch(`${MANIFEST}?v=${Date.now()}`,{cache:"no-store"});
      if(!response.ok)throw new Error("network");
      manifest=await response.json(); if(!validManifest(manifest))throw new Error("manifest");
      try{localStorage.setItem("orfey_sample_manifest_v1",JSON.stringify(manifest));}catch(_){}
    } catch (_) {
      try { const saved=JSON.parse(localStorage.getItem("orfey_sample_manifest_v1")||"null"); if(validManifest(saved))manifest=saved; } catch(__){}
    }
    if(requestId!==catalogRequestId||!mount.isConnected)return;
    if(!manifest){
      const info=document.createElement("p");info.className="mu sm";info.textContent="Не удалось загрузить каталог образцов. Проверьте интернет и нажмите «Обновить каталог».";mount.appendChild(info);addCatalogRefresh(mount,exerciseId);return;
    }
    const sample=preferredSample(manifest.samples,exerciseId);
    if(!sample){
      const info=document.createElement("p");info.className="mu sm";info.textContent="Для этого упражнения пока нет образца в основной ветке. Записи из PR появятся после слияния в main.";mount.appendChild(info);addCatalogRefresh(mount,exerciseId);return;
    }
    const synthetic=sample.sourceType==="synthetic";
    const card=document.createElement("details");card.className="sample-public card";
    const summary=document.createElement("summary");summary.className="sample-public-summary";
    const summaryIcon=document.createElement("span");summaryIcon.className="icon-badge";summaryIcon.innerHTML=root.OrfeyIcons?root.OrfeyIcons.icon(synthetic?"music":"waveform","ui-icon",18):"";
    const summaryCopy=document.createElement("span");summaryCopy.className="sample-public-summary-copy";
    const summaryKind=document.createElement("strong");summaryKind.textContent=synthetic?"Синтетический ориентир":"Запись преподавателя";
    const summaryTitle=document.createElement("small");summaryTitle.textContent=sample.title;
    summaryCopy.append(summaryKind,summaryTitle);
    const summaryChevron=document.createElement("span");summaryChevron.className="sample-public-chevron";summaryChevron.innerHTML=root.OrfeyIcons?root.OrfeyIcons.icon("chevron","ui-icon",16):"";
    summary.append(summaryIcon,summaryCopy,summaryChevron);card.appendChild(summary);
    const content=document.createElement("div");content.className="sample-public-content";card.appendChild(content);
    if(synthetic){const notice=document.createElement("p");notice.className="mu sm";notice.textContent="Синтетический сигнал — не голос и не педагогический эталон. Образцы преподавателей из открытых PR не меняют кнопку до слияния в main.";content.appendChild(notice);}
    const normalizeCopy=value=>String(value||"").trim().replace(/\s+/g," ").toLowerCase();
    const titleKey=normalizeCopy(sample.title),descriptionText=String(sample.description||"").trim(),descriptionKey=normalizeCopy(descriptionText);
    if(descriptionText&&descriptionKey!==titleKey){const description=document.createElement("p");description.className="sample-public-description";description.textContent=descriptionText;content.appendChild(description);}
    const recordedBy=String(sample.recordedBy||"Преподаватель").trim(),recordedByKey=normalizeCopy(recordedBy),attribution=[];
    if(recordedBy&&recordedByKey!==titleKey&&recordedByKey!==descriptionKey)attribution.push(recordedBy);
    if(sample.license)attribution.push(`Лицензия ${sample.license}`);
    if(attribution.length){const meta=document.createElement("p");meta.className="sample-public-meta";meta.textContent=attribution.join(" · ");content.appendChild(meta);}
    const status=document.createElement("p");status.className="mu sm";status.textContent="Загружаю и проверяю образец…";content.appendChild(status);mount.appendChild(card);
    try {
      const blob=await getCachedAudio(sample.sha256)||await downloadAndVerify(sample);
      if(requestId!==catalogRequestId||!mount.isConnected)return;
      await cacheAudio(sample.sha256,blob);
      const audio=document.createElement("audio");sampleAudioUrl=URL.createObjectURL(blob);audio.src=sampleAudioUrl;publicAudio=audio;
      const player=buildPublicAudioPlayer(audio,sample);content.insertBefore(player,status);status.remove();
      if(sample.sourceType==="teacher"){
        const demoButton=document.querySelector(`[data-exercise-demo="${exerciseId}"]`);
        if(demoButton)bindTeacherSample(demoButton,audio);
      }
      card.addEventListener("toggle",()=>{if(!card.open){if(teacherAudio===audio)stopTeacherSample();else audio.pause();}});
      addCatalogRefresh(mount,exerciseId);
    } catch (_) { status.textContent="Не удалось загрузить образец. Проверьте интернет и нажмите «Обновить каталог».";summaryKind.textContent="Не удалось загрузить запись";summaryTitle.textContent="Проверьте подключение и обновите каталог";addCatalogRefresh(mount,exerciseId); }
  };
  function addCatalogRefresh(mount,exerciseId){
    const button=document.createElement("button");button.type="button";button.className="sample-link";button.textContent="Обновить каталог";button.addEventListener("click",()=>root.loadExerciseSample(exerciseId));mount.appendChild(button);
  }
  root.refreshExerciseSample = id => root.loadExerciseSample(id);
  root.orfeySamplesPause = () => {
    stopTeacherSample();
    if(publicAudio){publicAudio.pause();try{publicAudio.currentTime=0;}catch(_){}publicAudio=null;}
    if (!session) return;
    if (session.pendingMicRequest) session.pendingMicRequest.cancelled = true;
    if (session.recorder) stopRecording();
    else if (session.stream) { session.stream.getTracks().forEach(track=>track.stop()); session.stream=null; }
  };

  async function downloadAndVerify(sample) {
    const response=await fetch(rootPath(sample.path),{cache:"no-store"}); if(!response.ok)throw new Error("download");
    const bytes=await response.arrayBuffer(); if(bytes.byteLength!==sample.sizeBytes)throw new Error("size");
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(x=>x.toString(16).padStart(2,"0")).join("");
    if(digest!==sample.sha256)throw new Error("hash"); return new Blob([bytes],{type:"audio/wav"});
  }
  function openDb() {
    return new Promise((resolve,reject)=>{const request=indexedDB.open("orfey_samples_cache",1);request.onupgradeneeded=()=>request.result.createObjectStore("audio");request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  }
  async function getCachedAudio(hash) {
    try { const db=await openDb(); return await new Promise((resolve,reject)=>{const request=db.transaction("audio","readonly").objectStore("audio").get(hash);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error);}); }
    catch (_) { return null; }
  }
  async function cacheAudio(hash, blob) {
    try { const db=await openDb(); await new Promise((resolve,reject)=>{const tx=db.transaction("audio","readwrite");tx.objectStore("audio").put(blob,hash);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);}); }
    catch (_) { /* Offline cache is a best-effort enhancement. */ }
  }

  if (typeof module === "object" && module.exports) module.exports={validEntry,validManifest,rootPath,preferredSample,isSupportedAudioFile,formatAudioTime};
})(typeof window !== "undefined" ? window : globalThis);
