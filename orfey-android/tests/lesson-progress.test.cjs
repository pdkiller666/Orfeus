const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../app/src/main/assets/core.js');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');

function bundledLessons() {
  const match = index.match(/const D=\((\{[\s\S]*?\})\),LESSONS=D\.LS/);
  assert.ok(match, 'lesson data block should be available for deterministic ID validation');
  return JSON.parse(match[1]).LS;
}

test('every bundled lesson has unique stable exercise keys', () => {
  for (const lesson of bundledLessons()) {
    const keys = Core.lessonExerciseKeys(lesson.id, lesson.ex.map(exercise => exercise.n));
    assert.equal(keys.length, lesson.ex.length, `${lesson.id} key count`);
    assert.equal(new Set(keys).size, keys.length, `${lesson.id} key uniqueness`);
    assert.ok(keys.every(Boolean), `${lesson.id} keys are non-empty`);
  }
});

test('lesson UI exposes an accessible checklist and updates its progress meter', () => {
  assert.match(index, /lessonExercises:\{\}/);
  assert.match(index, /onchange="toggleLessonExercise\(/);
  assert.match(index, /aria-label="Отметить упражнение/);
  assert.match(index, /id="lessonProgressText" aria-live="polite"/);
  assert.match(index, /id="lessonProgressMeter" class="bar" role="progressbar"/);
  assert.match(index, /function allLessonExerciseProgress\(/);
  assert.match(index, /Упражнения \$\{p\.completed\}\/\$\{p\.total\}/);
});

test('exercise checklist persists through existing backup import/export and does not award XP', () => {
  assert.match(index, /JSON\.stringify\(\{schema:2,data:S\}/);
  assert.match(index, /S=OrfeyCore\.normalizeState\(payload\.data,DEF\)/);
  const start = index.indexOf('function toggleLessonExercise(');
  const end = index.indexOf('function completeL(', start);
  assert.ok(start >= 0 && end > start, 'exercise toggle should be a separate operation from lesson completion');
  assert.doesNotMatch(index.slice(start, end), /S\.pts/);
  assert.match(index, /XP начисляется только кнопкой завершения урока ниже/);
});
