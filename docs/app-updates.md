# Распространение обновлений Orfey для Android

## Как работает

Каждый успешный build на `main` получает возрастающий Android `versionCode`, собирает APK и публикует его как полноценный GitHub Release с тегом `build-<versionCode>`. Только publish-job получает `contents: write`; build-job и проверки остаются с `contents: read`. Release помечается как последний, чтобы он был доступен через публичный endpoint GitHub Releases. GitHub разрешает workflow с `contents: write` создавать releases [1] [2].

В приложении нативный bridge передаёт модулю обновлений `BuildConfig.VERSION_CODE` и `BuildConfig.VERSION_NAME`. Проверка запрашивает публичный endpoint последнего релиза при запуске и затем не чаще раза в 6 часов, валидирует asset `orfey-android.apk`, тег и HTTPS-ссылку и сравнивает `versionCode`. Начиная с версии 1.15 номер установленной версии виден мелким шрифтом под логотипом; если найден более новый APK, справа от логотипа появляется компактная кнопка «Обновить». Текущая версия доступна офлайн; ошибки сети не блокируют интерфейс. В версиях 1.4–1.14 остаётся прежнее необязательное окно-предложение. Скачивание ведёт на APK в GitHub, а установка всегда подтверждается пользователем средствами Android.

APK скачивается через браузер и устанавливается только после явного подтверждения пользователя. Android может потребовать разрешить установку приложений из браузера-источника; это системная защита при распространении APK вне Google Play [3]. Автоматической установки без участия пользователя нет. Данные приложения сохраняются при установке поверх старой версии с тем же ключом подписи.

Разрешение микрофона запрашивается при первом действии, которому нужен микрофон, а не просто при запуске приложения. Если Android больше не показывает системный запрос или доступ отклонён политикой приватности, версия 1.5 показывает причины отказа и кнопку перехода в системные настройки разрешений приложения. Версия 1.6 также нормализует проверку WebView origin: это исправляет ранний отказ аудио-запроса, который мог происходить до показа системного диалога.

В версии 1.7 опубликованный в `main` teacher sample становится источником аудио в demo-кнопке соответствующего упражнения; кнопка переключает воспроизведение и остановку. Пока PR не слит или teacher sample отсутствует/не загружается, синтетический тон остаётся резервным вариантом. Сборка читает manifest из `main`, а не из незлитых веток.

В версии 1.8 редактор также принимает готовые аудиофайлы через системный Android document picker. Импорт ограничен 25 МБ и 120 секундами, выполняется локально без широкого разрешения на чтение хранилища; пользователь может прослушать и выбрать фрагмент до 30 секунд. На GitHub уходит только конвертированный в нормализованный WAV выбранный фрагмент после явного подтверждения публикации.

В версии 1.9 финальное `window.confirm` при отправке образца обрабатывается нативным Android `WebChromeClient`: пользователь получает явные кнопки продолжения/отмены, а отправка не исчезает молча при использовании неподдержанного WebView-диалога. После обработки записи повторно включается кнопка отправки. Экран упражнения поясняет, что данные из открытых веток/PR не входят в каталог до слияния в `main`, и предоставляет ручное обновление каталога.

## Эксплуатационные ограничения

Каждый запуск сборки на `main` создаёт новый публичный Release и отдельный APK. Версии Android из CI используют `1000 + GITHUB_RUN_NUMBER`; локальная сборка по умолчанию остаётся с небольшим versionCode. Если пользователи накапливают слишком много тестовых releases, старые releases можно удалить вручную, оставив последний.

Встроенное напоминание начинает работать только после установки версии Orfey 1.4 или новее. Уже установленное приложение до 1.4 не может получить новый JavaScript/Kotlin-код удалённо, поэтому его нужно обновить вручную один раз. Билд остаётся debug-вариантом для прямого тестирования, а не Google Play-релизом.

## Источники

[1]: https://docs.github.com/en/rest/releases/releases "GitHub REST API Releases"
[2]: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions "GitHub Actions workflow permissions"
[3]: https://developer.android.com/distribute/marketing-tools/alternative-distribution "Android alternative app distribution"


## Проверенный релиз 1.9

Коммит `3f2cd26` собран и опубликован workflow [43469722647](https://github.com/pdkiller666/Orfeus/actions/runs/43469722647). Результат — [Release `build-1023`](https://github.com/pdkiller666/Orfeus/releases/tag/build-1023) с APK `orfey-android.apk` (Android versionCode 1023). CI прошёл 24 Node-теста, каталог с 4 записями, 15 YIN-проверок и Gradle assembleDebug.


## Проверенный релиз 1.10

В каталоге samples manifest загружается простым cross-origin GET: приложение использует `cache: "no-store"` и cache-buster в URL, не выставляя собственный `Cache-Control`. Ручной заголовок запускал CORS preflight, который `raw.githubusercontent.com` отклоняет кодом 403, поэтому клиент без кэшированного manifest показывал ошибку каталога. Добавлены отдельные статусы упражнений уроков, общий прогресс и включение новых данных в текущий JSON export/import. Отметки упражнений не начисляют XP: сохранено существующее правило начисления за явную отметку урока целиком.


Release 1.10 опубликован как [build-1024](https://github.com/pdkiller666/Orfeus/releases/tag/build-1024), Android `versionCode` 1024; workflow [43471802009](https://github.com/pdkiller666/Orfeus/actions/runs/43471802009) завершился успешно. APK: [orfey-android.apk](https://github.com/pdkiller666/Orfeus/releases/download/build-1024/orfey-android.apk). В GitHub Actions прошли валидация каталога, логические тесты, YIN regression, Android assemble и публикация.


## Проверенный релиз 1.11

Для опубликованной teacher-записи сохранена одна основная кнопка Play/Stop. Дополнительный `<audio controls>` вместе с названием, описанием и данными автора перемещён в нативный `<details>` под кнопкой, закрытый по умолчанию. Сворачивание панели во время воспроизведения останавливает запись. Проверено 33 Node-теста, синтаксис JS и inline script, каталог образцов (4 записи) и 15 проверок YIN. GitHub Actions [43543959489](https://github.com/pdkiller666/Orfeus/actions/runs/43543959489) завершился успешно. [Release `build-1025`](https://github.com/pdkiller666/Orfeus/releases/tag/build-1025), APK: [orfey-android.apk](https://github.com/pdkiller666/Orfeus/releases/download/build-1025/orfey-android.apk), versionCode 1025.


## Проверенный релиз 1.12

Экран упражнения получил компактную группу из кнопок «Образец» и «Старт». Карточка материалов отдельно содержит раскрываемые сведения/плеер и вторичную кнопку добавления записи. Форма записи и загрузки представлена как прокручиваемая нижняя панель поверх текущего упражнения; закрытие по кнопке, Escape или нажатию вне панели очищает запись/микрофон, восстанавливает прокрутку и не вызывает перерисовку экрана упражнения. GitHub Actions [43547702446](https://github.com/pdkiller666/Orfeus/actions/runs/43547702446) завершился успешно; 34 Node-теста, каталог и YIN-регрессии прошли. [Release build-1026](https://github.com/pdkiller666/Orfeus/releases/tag/build-1026), APK [orfey-android.apk](https://github.com/pdkiller666/Orfeus/releases/download/build-1026/orfey-android.apk), versionCode 1026.


## Проверенный релиз 1.13

Экран тренировок начинается с выбора четырёх категорий, включает поиск и закреплённые чип-фильтры; упражнения представлены компактными доступными карточками. Длинные разделы уроков и вспомогательные инструменты сворачиваются. Создан локальный SVG icon set, подключённый без сетевых зависимостей; он используется в навигации, категориях, упражнениях, кнопках образца/старта и элементах записи. Акцентные кнопки имеют единый стиль, минимум 52 px высоты и видимый клавиатурный фокус. Локальный UI preview проверен в мобильном viewport без обращения к микрофону.

GitHub Actions [43550719700](https://github.com/pdkiller666/Orfeus/actions/runs/43550719700) завершился успешно: 39 Node-тестов, валидация 4 образцов, 15 YIN pitch regressions, Gradle assemble и publish job. Опубликован [Release build-1027](https://github.com/pdkiller666/Orfeus/releases/tag/build-1027), versionCode 1027; APK [orfey-android.apk](https://github.com/pdkiller666/Orfeus/releases/download/build-1027/orfey-android.apk) (5,856,319 bytes, HTTP 200). Подпись сохранена. Физическое тестирование на целевых Android-устройствах, TalkBack, крупный шрифт, поворот экрана и реальная читаемость на малых дисплеях не подтверждены.


## Переход на прямую структуру исходников

Android project теперь полностью хранится в репозитории в [`orfey-android/`](../orfey-android/), а не в `orfey-android.zip`. Корневой workflow проверяет и собирает исходники непосредственно в этой папке; шаг распаковки удалён. Существующий keystore перенесён без изменения, asset APK и механизм публикации Releases сохранены. Устаревший вложенный workflow из Android-проекта исключён, чтобы не запускать вторую конкурирующую сборку.

Переход подтверждён GitHub Actions run [43551446019](https://github.com/pdkiller666/Orfeus/actions/runs/43551446019): layout/signing-key check, каталог, Node tests, YIN и Gradle assemble прошли; build и publish jobs успешны. Создан [Release build-1028](https://github.com/pdkiller666/Orfeus/releases/tag/build-1028) с [APK](https://github.com/pdkiller666/Orfeus/releases/download/build-1028/orfey-android.apk) (5,856,315 bytes, HTTP 200), без функциональных изменений приложения.


## Проверенный релиз 1.14

Кнопки «Образец» и «Старт» сгруппированы и различаются по приоритету; при воспроизведении опубликованного teacher sample основная кнопка получает активное золотое состояние. Стандартные системные controls заменены на доступный custom player с Play/Pause, полосой перемотки, временем и статусом. Сведения записи показывают только отличающиеся description/author и лицензию; форма записи и выбора файла остаётся отдельной и не перерисовывает экран упражнения. В мобильном browser preview проверены реальная teacher-запись для exerciseId `one`, компоновка кнопок и custom player. Физическая проверка Android/WebView, системных крупных шрифтов и TalkBack всё ещё необходима.

GitHub Actions [43554959796](https://github.com/pdkiller666/Orfeus/actions/runs/43554959796) завершился успешно: 41 Node-тест, каталог (4 одобренных записи), 15 YIN-проверок, Gradle assemble и publish. Опубликован [Release build-1029](https://github.com/pdkiller666/Orfeus/releases/tag/build-1029), versionName 1.14, Android versionCode 1029; APK 5,859,075 bytes, прямая ссылка ответила HTTP 200: [orfey-android.apk](https://github.com/pdkiller666/Orfeus/releases/download/build-1029/orfey-android.apk). Файл существующего ключа подписи и его конфигурация в этом изменении не менялись.


## Проверенный релиз 1.15

Под брендингом приложения отображается `BuildConfig.VERSION_NAME`, переданный через нативный JavaScript bridge. Только при наличии валидного APK с более высоким `versionCode` справа от логотипа отображается компактная кнопка «Обновить»; приложение не использует блокирующий диалог. MutationObserver сохраняет версию и CTA после рендера экранов. Существующие версии 1.4–1.14 сохраняют прежнее предложение обновиться.

GitHub Actions [43561631422](https://github.com/pdkiller666/Orfeus/actions/runs/43561631422) завершился успешно: build и publish jobs прошли; проверены Node regressions, manifest/catalog, 15 YIN-проверок и Android assemble. Опубликован [Release build-1030](https://github.com/pdkiller666/Orfeus/releases/tag/build-1030), versionName 1.15, Android versionCode 1030. APK размером 5,858,663 bytes доступен по прямой ссылке: [orfey-android.apk](https://github.com/pdkiller666/Orfeus/releases/download/build-1030/orfey-android.apk), HTTP 200.

Локальная среда не содержала Gradle CLI; фактическая Android-сборка подтверждена успешным workflow с `gradle/actions/setup-gradle@v4` и Gradle 8.9. Физическая проверка новой компоновки и перехода к установке на целевом телефоне остаётся необходимой.
