const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const assets = path.join(__dirname, '../app/src/main/assets');
const html = fs.readFileSync(path.join(assets, 'index.html'), 'utf8');
const samples = fs.readFileSync(path.join(assets, 'samples.js'), 'utf8');

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

test('sample and start are grouped as primary actions; sample metadata and upload are separate', () => {
  assert.match(html, /<div class="exercise-primary-actions" role="group"[^>]*><button class="btn" data-exercise-demo="\$\{scr\.id\}"[^>]*>\$\{uiIcon\("music",20\)\}<span>Эталон<\/span><\/button><button class="btn" onclick="begin\('\$\{scr\.id\}'\)">\$\{uiIcon\("mic",20\)\}<span>Старт<\/span><\/button><\/div>/);
  assert.match(html, /<section class="sample-tools card" aria-label="Образец и аудиозаписи"><div class="sample-tools-head"><b>Образец и аудиозаписи<\/b><button type="button" class="sample-upload-link" aria-label="Загрузить или записать аудиообразец"/);
  assert.match(samples, /const card=document\.createElement\("details"\);card\.className="sample-public card"/);
  assert.match(samples, /summary\.textContent=synthetic\?"Информация о синтетическом ориентире":"Информация и плеер записи"/);
  assert.match(samples, /content\.insertBefore\(audio,status\)/);
  assert.match(samples, /card\.addEventListener\("toggle",\(\)=>\{if\(!card\.open&&teacherAudio===audio\)stopTeacherSample\(\);\}\)/);
  assert.match(html, /\.sample-tools \.sample-public\{[^}]*background:var\(--bg\)/);
  assert.doesNotMatch(samples, /card\.open\s*=\s*true/);
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
