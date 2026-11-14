const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const assets = path.join(__dirname, '../app/src/main/assets');
const html = fs.readFileSync(path.join(assets, 'index.html'), 'utf8');
const icons = require(path.join(assets, 'icons.js'));

test('local icon library renders accessible, offline SVG with known icons', () => {
  for (const name of ['home', 'music', 'book', 'user', 'mic', 'sparkle', 'game', 'search', 'lock', 'play', 'stop', 'metronome']) {
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
});
