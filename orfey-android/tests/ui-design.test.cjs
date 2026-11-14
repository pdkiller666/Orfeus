const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assets = path.join(__dirname, '../app/src/main/assets');
const html = fs.readFileSync(path.join(assets, 'index.html'), 'utf8');
const updates = fs.readFileSync(path.join(assets, 'updates.js'), 'utf8');
const icons = require(path.join(assets, 'icons.js'));

test('local icon library renders accessible, offline SVG with known icons', () => {
  for (const name of ['home', 'music', 'book', 'user', 'mic', 'sparkle', 'game', 'search', 'lock', 'play', 'pause', 'stop', 'record', 'metronome']) {
    assert.ok(icons.names.includes(name), `missing icon: ${name}`);
    const svg = icons.icon(name, 'test-icon', 20);
    assert.match(svg, /^<svg /);
    assert.match(svg, /aria-hidden="true"/);
    assert.match(svg, /focusable="false"/);
    assert.match(svg, /<path|<circle|<rect/);
  }
});

test('training screen opens at compact category choices with search and sticky filters', () => {
  assert.match(html, /function trainingH\(\)[\s\S]*id="trainingResults"/);
  assert.match(html, /if\(!trainingCategory&&!q\)return categoryMarkup\(\)/);
  assert.match(html, /role="group" aria-label="Категории тренировок"/);
  assert.match(html, /\.training-filters\{position:sticky/);
  assert.match(html, /function filterTraining\(value\)/);
});

test('navigation and exercise cards use the shared vector icon system', () => {
  assert.match(html, /icons\.js/);
  assert.match(html, /uiIcon\(t\[1\],22\)/);
  assert.match(html, /function trainingItem\(id\)/);
  assert.match(html, /function lessonCard\(lesson\)/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /exercise-primary-actions[\s\S]*uiIcon\("music",20\)/);
  const nonDataLines = html.split('\n').filter(line => line.length < 10000).join('\n');
  assert.doesNotMatch(nonDataLines, /[\u{1F300}-\u{1FAFF}]/u, 'visible interface code should not use emoji pictographs');
});

test('long lesson tools and reference sections are collapsed by default', () => {
  assert.match(html, /<details class="tool-disclosure"><summary>\$\{uiIcon\("metronome"/);
  assert.match(html, /<details class="tool-disclosure"><summary>\$\{uiIcon\("music"/);
  assert.match(html, /<details class="lesson-section"><summary>\$\{uiIcon\("list"/);
  assert.match(html, /<details class="lesson-section"><summary>\$\{uiIcon\("bulb"/);
  assert.match(html, /<details class="lesson-section"><summary>\$\{uiIcon\("alert"/);
});

test('button system has consistent touch targets and keyboard focus', () => {
  assert.match(html, /\.btn\{min-height:52px/);
  assert.match(html, /\.training-category\{display:flex;min-height:104px/);
  assert.match(html, /\.btn:focus-visible,[^}]*outline:3px solid/);
  assert.match(html, /\.sample-player-toggle:focus-visible,[^}]*outline:3px solid/);
  assert.match(html, /\.sample-public-chevron\{display:grid/);
});

test('installed app version sits below the logo and newer releases reveal a compact button on its right', () => {
  assert.match(html, /\.brand-header\{display:flex;align-items:center;justify-content:space-between/);
  assert.match(html, /\.app-version\{display:block[^}]*font-size:10px/);
  assert.match(html, /const logo=.*<span class="app-version" data-app-version>Версия —<\/span>.*<button type="button" class="btn app-update-btn" data-app-update hidden/u);
  assert.match(html, /\.app-update-btn\.btn\{[^}]*width:auto[^}]*min-height:36px/);
  assert.match(updates, /bridge\.appVersionName/);
  assert.match(updates, /new win\.MutationObserver\(refreshBrand\)/);
  assert.match(updates, /latestUpdate = shouldRecommend\(latest, installedCode\) \? latest : null/);
  assert.doesNotMatch(updates, /orfeyUpdateDialog|orfey-update-shade/, 'update notice should not block the exercise screen');
});


test('Today screen groups its metrics, retains recommendation logic, and places safety notice before the CTA', () => {
  assert.match(html, /class="today-summary-grid"/);
  assert.match(html, /class="today-metric-copy"/);
  assert.match(html, /id="todayStart" class="btn today-start"/);
  assert.match(html, /rec=!S\.range\?"range":\["one","dyn","step","vib","tw","game"\]/);
  assert.match(html, /todayCta=\$\("#todayStart"\);if\(todayCta\)todayCta\.insertAdjacentHTML\("beforebegin"/);
  assert.match(html, /if\(S\.rem&&S\.last!=today\(\)/, 'reminders remain conditional and visible');
});

test('Lessons use shared search and sticky filters while preserving list position and truthful XP messaging', () => {
  assert.match(html, /id="lq" class="training-search" type="search"/);
  assert.match(html, /class="training-filters lesson-filters" role="group" aria-label="Фильтр уроков по уровню"/);
  assert.match(html, /function openLesson\(id\)\{lessonListScroll=/);
  assert.match(html, /if\(S\.seen&&!scr&&tab=="les"\)\{nav\(\);v\.innerHTML=lesH\(\);v\.scrollTop=lessonListScroll;return\}/);
  assert.match(html, /Урок уже зачтён — повторить для закрепления/);
  assert.doesNotMatch(html, /Урок пройден — отметить снова/);
  assert.match(html, /function setLessonFilter\(level\)/);
  assert.match(html, /function setLessonQuery\(value\)/);
});

test('Profile compacts statistics and settings into disclosures without removing data/privacy actions', () => {
  assert.match(html, /function profileH\(\)/);
  assert.match(html, /<details class="tool-disclosure profile-disclosure"><summary>\$\{uiIcon\("waveform"/);
  assert.match(html, /<b>Статистика и достижения<\/b>/);
  assert.match(html, /<b>Настройки<\/b>/);
  assert.match(html, /<b>Данные и конфиденциальность<\/b>/);
  assert.match(html, /role="img" aria-label="Средняя точность за семь дней/);
  assert.match(html, /onclick="openData\('export'\)"/);
  assert.match(html, /onclick="openData\('import'\)"/);
  assert.match(html, /setRecordEnabled\(this\.checked\)/);
  assert.match(html, /schema:2,data:S/);
  assert.match(html, /profile-data-textarea/);
  assert.match(html, /class="back-button" onclick="go\('me'\)"/);
});

test('every statically referenced UI SVG exists in the local icon library', () => {
  const referenced = [...html.matchAll(/uiIcon\("([^"]+)"/g)].map(match => match[1]);
  for (const name of referenced) assert.ok(icons.names.includes(name), `unknown UI icon: ${name}`);
});


test('secondary profile controls fit mobile layout and keep accessible touch/focus targets', () => {
  assert.match(html, /\.profile-booking \.btn\{width:auto/);
  assert.match(html, /\.back-button\{display:inline-flex[^}]*min-height:44px/);
  assert.match(html, /\.profile-action-row\{display:flex;width:100%;min-height:58px/);
  assert.match(html, /\.back-button:focus-visible/);
  assert.match(html, /\.profile-action-row:focus-visible/);
});


test('Popadi v notu is a voice-controlled moving gate game, not a generic pitch sequence', () => {
  assert.match(html, /game:\{c:"game",t:"Попади в ноту",sub:"20 сек · 10 ворот"/);
  assert.match(html, /function createGameState\(exercise\)/);
  assert.match(html, /function updateGameFrame\(r,fr,t\)/);
  assert.match(html, /OrfeyCore\.gamePitchInGate\(game\.ballMidi,gate\.midi,50\)/);
  assert.match(html, /id==="game"\?updateGameFrame\(r,fr,t\)/);
  assert.match(html, /function drawGame\(\)/);
  assert.match(html, /aria-label="Игровое поле: высота голоса управляет шариком; проведите его через нотные ворота"/);
  assert.match(html, /canvas id="c" width="400" height="250"/);
  assert.match(html, /id="gameTarget"/);
  assert.match(html, /id="gamePassed"/);
  assert.match(html, /id="gameCombo"/);
  assert.match(html, /id="pc" aria-label="Точность попаданий в игровые ворота"/);
  assert.match(html, /gameHits:r\.id==="game"\?r\.game\.score\.hits:0/);
  assert.doesNotMatch(html, /game:\{[^}]*seqEx\(rnd\(10\),2\)/);
});

test('game gates advance forward as updateGameFrame advances elapsed time', () => {
  assert.match(html, /const x=ballX\+\(gate\.crossAt-game\.elapsed\)\*speed/);
  const start = html.indexOf('function updateGameFrame(r,fr,t){');
  const end = html.indexOf('\nfunction loop()', start);
  assert.ok(start >= 0 && end > start, 'expected a standalone game frame updater');
  const source = html.slice(start, end);
  const updateGameFrame = new vm.Script(`${source}; updateGameFrame;`).runInNewContext({ nn: midi => String(midi) });
  const game = {
    elapsed: 0, lastPitchAt: -1, ballMidi: null, voiced: false,
    gates: [{ midi: 60, crossAt: 10, result: null }],
    score: { passed: 0, hits: 0, combo: 0, bestCombo: 0 }, lastEvent: null
  };
  const run = { game, good: 0, tot: 0, cb: 0, combo: 0 };
  updateGameFrame(run, { f: -1 }, 1);
  const gateXAt1s = 90 + (game.gates[0].crossAt - game.elapsed) * 100;
  updateGameFrame(run, { f: -1 }, 2);
  const gateXAt2s = 90 + (game.gates[0].crossAt - game.elapsed) * 100;
  assert.equal(game.elapsed, 2);
  assert.ok(gateXAt2s < gateXAt1s, 'the gate should move left toward the ball as time advances');
});

test('all inline JavaScript blocks in the WebView entry point parse', () => {
  const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attributes]) => !/\bsrc\s*=/.test(attributes));
  assert.ok(blocks.length > 0, 'expected inline app scripts');
  blocks.forEach(([, , source], index) => {
    assert.doesNotThrow(() => new vm.Script(source, { filename: `index.html#inline-${index + 1}` }));
  });
});
