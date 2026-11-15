const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const assets = path.join(__dirname, '../app/src/main/assets');
const html = fs.readFileSync(path.join(assets, 'index.html'), 'utf8');
const samples = fs.readFileSync(path.join(assets, 'samples.js'), 'utf8');
const samplesApi = require(path.join(assets, 'samples.js'));

test('exercise demo button is addressable for replacement by a published teacher recording', () => {
  assert.match(html, /data-exercise-demo="\$\{scr\.id\}"/);
  assert.match(samples, /preferredSample\(manifest\.samples,exerciseId\)/);
  assert.match(samples, /candidates\.find\(item => item\.sourceType === "teacher"\)/);
  assert.match(samples, /if\(sample\.sourceType==="teacher"\)/);
  assert.match(samples, /bindTeacherSample\(demoButton,audio\)/);
});

test('teacher sample button can stop playback; unmerged branch content is not used', () => {
  assert.match(samples, /setTeacherButton\(button, true\)/);
  assert.match(samples, /if \(teacherAudio === audio && !audio\.paused\) \{ stopTeacherSample\(\); return; \}/);
  assert.match(samples, /raw\.githubusercontent\.com\/\$\{OWNER\}\/\$\{REPO\}\/main\/samples\/manifest\.json/);
});

test('sample and start are grouped, visually differentiated, and upload is separate', () => {
  assert.match(html, /data-exercise-demo="\$\{scr\.id\}"[^>]*title="\$\{referenceTitle\(scr\.id\)\}"[^>]*>\$\{uiIcon\("music",20\)\}<span>\$\{referenceLabel\(scr\.id\)\}<\/span>/);
  assert.match(html, /<p class="mu sm reference-note">\$\{referenceHint\(scr\.id\)\}<\/p><section class="sample-tools card" aria-label="Дополнительные аудиоматериалы"><div class="sample-tools-head"><b>Дополнительные аудиоматериалы<\/b><button type="button" class="sample-upload-link" aria-label="Загрузить или записать аудиообразец"/);
  assert.match(html, /\.exercise-primary-actions \.btn-sample\{[^}]*background:var\(--gold-soft\)/);
  assert.match(html, /\.exercise-primary-actions \.btn-start\{[^}]*linear-gradient/);
  assert.match(samples, /const card=document\.createElement\("details"\);card\.className="sample-public card"/);
  assert.match(samples, /summaryTitle\.textContent=sample\.title/);
  assert.match(html, /\.sample-tools \.sample-public\{[^}]*background:var\(--bg\)/);
  assert.doesNotMatch(samples, /card\.open\s*=\s*true/);
});

test('reference labels distinguish piano cues from additional technical audio', () => {
  assert.match(html, /function referenceLabel\(id\)/);
  assert.match(html, /return"Пиано-эталон"/);
  assert.match(html, /return"Ориентир громкости"/);
  assert.match(html, /return"Пиано-ориентир диапазона"/);
  assert.match(html, /function referenceHint\(id\)/);
  assert.match(html, /if\(id==="range"\)\{const notes=\[base\(\)-12/);
  assert.match(html, /else if\(id==="dyn"\)\{\[\.1,\.2,\.34\]/);
  assert.match(samples, /Технический тестовый сигнал/);
  assert.match(samples, /не голос, не piano-эталон и не педагогическая модель упражнения/);
});

test('published sample uses an accessible custom player with play/pause, seek and synchronized audio state', () => {
  assert.match(samples, /function buildPublicAudioPlayer\(audio, sample\)/);
  assert.match(samples, /player\.setAttribute\("role", "group"\)/);
  assert.match(samples, /seek\.setAttribute\("aria-label"/);
  assert.match(samples, /seek\.addEventListener\("input"/);
  assert.match(samples, /toggle\.addEventListener\("click"/);
  assert.match(samples, /audio\.addEventListener\("play"/);
  assert.match(samples, /audio\.addEventListener\("pause"/);
  assert.match(samples, /buildPublicAudioPlayer\(audio,sample\);content\.insertBefore\(player,status\)/);
  assert.match(samples, /if\(teacherAudio===audio\)stopTeacherSample\(\);else audio\.pause\(\)/);
  assert.match(samples, /descriptionKey!==titleKey/);
  assert.match(samples, /recordedByKey!==descriptionKey/);
  assert.match(html, /\.sample-player-seek\{[^}]*accent-color:var\(--gold\)/);
  assert.match(html, /\.exercise-primary-actions \.btn-sample\[aria-pressed="true"\]/);
  assert.match(html, /\.sample-public-description\{/);
  assert.doesNotMatch(samples, /audio\.controls=true/, 'the default browser audio controls should not be shown');
});

test('player time formatting is stable for valid and unavailable durations', () => {
  assert.equal(samplesApi.formatAudioTime(0), '0:00');
  assert.equal(samplesApi.formatAudioTime(65.9), '1:05');
  assert.equal(samplesApi.formatAudioTime(Number.NaN), '--:--');
});

test('sample uploader opens over the current exercise in a closable bottom sheet, without re-rendering the app', () => {
  assert.match(html, /\.sample-modal\{[^}]*display:flex[^}]*align-items:flex-end/);
  assert.match(html, /\.sample-sheet\{[^}]*max-height:84vh[^}]*overflow-y:auto/);
  assert.match(samples, /document\.body\.appendChild\(modal\)/);
  assert.match(samples, /modal\.addEventListener\("click", event => \{ if \(event\.target === modal\) closeModal\(true\); \}\)/);
  assert.match(samples, /document\.body\.style\.overflow = "hidden"/);
  assert.match(samples, /function openUploader\(exerciseId\)[\s\S]*renderEditor\(exerciseId\)|function openUploader\(exerciseId\)[\s\S]*renderTokenGate\(exerciseId/);
  assert.doesNotMatch(samples, /location\.reload\(/);
});
