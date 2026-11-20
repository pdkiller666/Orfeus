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

test('melisma plays a reference tone at every target and minute exercises last a minute', () => {
  assert.match(html, /if\(st\.i!==i\)\{st\.i=i;tone\(fq\(m\)\);st\.mute=t\+\.75\}/);
  assert.match(html, /one:\{[^}]*mk:\(\)=>seqEx\(\[0,4,7,12\],15\)/);
  assert.match(html, /step:\{[^}]*mk:\(\)=>seqEx\(\[0,2,0,0,-1,0,4,2,0\],60\/9\)/);
  assert.match(html, /fal:\{[^}]*mk:\(\)=>seqEx\(\[7,9,12,14,12,9\],10\)/);
  assert.match(html, /dyn:\{[^}]*d:20\},\{n:"Средне"[^}]*d:20\},\{n:"Громко"[^}]*d:20\}/);
  assert.match(html, /pop:\{[^}]*mk:\(\)=>\(\{dur:30,/);
  assert.match(html, /mel:\{[^}]*mk:\(\)=>seqEx\(\[0,2,4,2,0,0,2,4,5,4,2,0\],5\)/);
});

test('range calibration requires robust boundaries and a real downward/upward sweep', () => {
  assert.match(html, /dur:60,f\(fr,t,st\)/);
  assert.match(html, /const up=t>=30/);
  assert.match(html, /OrfeyCore\.summarizePitchRange\(st\.lo,st\.hi,8\)/);
  assert.match(html, /st\.rangeDirection=direction/);
  assert.match(html, /Не слышу устойчивую ноту/);
  assert.match(html, /держите телефон на расстоянии 20–40 см/);
  assert.match(html, /Math\.max\(-58/);
  assert.match(html, /range-direction-legend/);
  assert.match(html, /Первые 30 секунд плавное движение вниз|первые 30 секунд плавное движение вниз/);
  assert.match(html, /if\(run\.id==="range"\)/);
  assert.match(html, /const low=36,high=84,mid=W\/2/);
  assert.match(html, /g\.fillText\("ВНИЗ"/);
  assert.match(html, /g\.fillText\("ВВЕРХ"/);
});

test('range diagnosis exposes a live timer, phase label, and accessible visual progress', () => {
  assert.match(html, /id="rangeTimer" aria-label="Осталось времени">1:00/);
  assert.match(html, /id="rangePhase">Подготовка/);
  assert.match(html, /class="range-timeline" role="progressbar" aria-label="Прогресс диагностики диапазона"/);
  assert.match(html, /id="rangeProgressFill"/);
  assert.match(html, /const remaining=Math\.max\(0,Math\.ceil\(r\.ex\.dur-t\)\)/);
  assert.match(html, /t<30\?"Вниз — ведите голос мягко вниз":"Вверх — ведите голос мягко вверх"/);
  assert.match(html, /rangeProgressFill/);
});
test('range diagnosis cues the lower-to-upper transition once at 30 seconds', () => {
  assert.match(html, /function rangeTransitionCue\(\)\{[^}]*tone\(fq\(72\),\.24\)/);
  assert.match(html, /navigator\.vibrate\(\[35,30,35\]\)/);
  assert.match(html, /const crossedRangeMidpoint=r\.id==="range"&&!r\.rangeCuePlayed&&t>=30/);
  assert.match(html, /if\(crossedRangeMidpoint\)\{r\.rangeCuePlayed=true;rangeTransitionCue\(\)\}/);
});
test('measured range is compared and persisted in the profile without claiming voice identity', () => {
  assert.match(html, /const SINGER_RANGES=\[/);
  assert.match(html, /Фредди Меркьюри/);
  assert.match(html, /Michael Jackson/);
  assert.match(html, /Whitney Houston/);
  assert.match(html, /Céline Dion/);
  assert.match(html, /Mariah Carey/);
  assert.match(html, /Christina Aguilera/);
  assert.match(html, /Lady Gaga/);
  assert.match(html, /Bruno Mars/);
  assert.match(html, /Ed Sheeran/);
  assert.match(html, /Taylor Swift/);
  assert.match(html, /Elton John/);
  assert.equal((html.match(/\{id:"[^"]+",name:/g) || []).length, 13);
  assert.match(html, /function buildRangeComparison\(range\)/);
  assert.match(html, /S\.rangeComparison=buildRangeComparison\(S\.range\)/);
  assert.match(html, /Ближайшие публично описанные диапазоны/);
  assert.match(html, /не утверждение о сходстве голоса, тембра или типа голоса/);
  assert.match(html, /range-compare-card/);
  assert.match(html, /rangeComparison:null/);
  assert.match(html, /function rangeMatchPercent\(distance\)/);
  assert.match(html, /Процент — ориентир по двум крайним нотам/);
  assert.match(html, /onclick="tone\(fq\(\$\{singer\.low\}/);
  assert.match(html, /onclick="tone\(fq\(\$\{singer\.high\}/);
  assert.match(html, /rangeHistory:\[\]/);
  assert.match(html, /rangeHistory\.push\(entry\)/);
  assert.match(html, /range-stats/);
  assert.match(html, /Изменения по дням/);
});

test('range result shows measured notes instead of hiding a usable approximate result behind zero percent', () => {
  assert.match(html, /range:r\.id==="range"&&Array\.isArray\(S\.range\)\?S\.range:null/);
  assert.match(html, /scr\.id==="range"&&scr\.range/);
  assert.match(html, /nn\(scr\.range\[0\]\).*nn\(scr\.range\[1\]\)/);
  assert.match(html, /Ваш примерный диапазон/);
  assert.match(html, /Диапазон сохранён по устойчивым нотам/);
});

test('dynamics reference demo uses three distinct piano velocity levels', () => {
  assert.match(html, /else if\(id==="dyn"\)\{\[\.1,\.2,\.34\]/);
  assert.match(html, /T\+i\*1\.15,\.95,\{velocity:v,br:3800\}/);
  assert.match(html, /dyn:\{c:"mic",t:"Динамика"/);
});

test('musical synthetic references use the shared piano-like voice', () => {
  assert.match(html, /function pianoNote\(ac,f,t0,d,opts=\{\}\)/);
  assert.match(html, /function tone\(f,d=\.6\)\{try\{if\(!cueCtx\)cueCtx=new\(window\.AudioContext\|\|window\.webkitAudioContext\)\(\);.*pianoNote\(cueCtx,f,t,d\)/);
  assert.match(html, /const note=\(f,t0,d,o=\{\}\)=>pianoNote\(ac,f,t0,d/);
  assert.match(html, /pianoNote\(metroCtx,metroBeat%4===0\?523\.25:392[^;]*click:false/);
  assert.match(html, /pianoNote\(ac,fq\(n\),T\+j\*\.6/);
  assert.match(html, /attack=Math\.min\(\.045,Math\.max\(\.018/);
  assert.match(html, /\[\[1,\.92\],\[2,\.43\],\[3,\.19\]/);
  assert.match(html, /if\(opts\.click!==false\)/);
  assert.doesNotMatch(html, /note\(fq\(m\),T,2\.5,\{type:"sawtooth"/);
});

test('hybrid piano voice bundles twelve mapped CC0 samples with a fallback', () => {
  const pianoDir = path.join(assets, 'piano');
  const files = fs.readdirSync(pianoDir).filter(name => name.endsWith('.wav'));
  assert.equal(files.length, 12);
  assert.ok(fs.existsSync(path.join(pianoDir, 'CC0.txt')));
  assert.ok(fs.existsSync(path.join(pianoDir, 'README.md')));
  assert.match(html, /const PIANO_SAMPLES=\[/);
  assert.match(html, /function warmPianoSamples\(ac\)/);
  assert.match(html, /function pianoSampleNote\(ac,f,t0,d,opts=\{\}\)/);
  assert.match(html, /if\(!pianoSampleNote\(ac,f,t0,d,opts\)\)pianoSynthNote/);
  assert.match(html, /fetch\(new URL\("piano\/"\+spec\.file,document\.baseURI\)\)/);
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
