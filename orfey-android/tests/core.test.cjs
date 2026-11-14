const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../app/src/main/assets/core.js');

test('pitch cue direction agrees with cents sign', () => {
  assert.equal(Core.pitchCue(45), 'чуть выше');
  assert.equal(Core.pitchCue(-45), 'чуть ниже');
  assert.equal(Core.pitchCue(30), 'В зоне');
});

test('YIN estimates common singing pitches and rejects silence', () => {
  const sampleRate = 48000;
  for (const expected of [55, 82.41, 110, 220, 440, 659.25]) {
    const samples = new Float32Array(2048);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = 0.5 * Math.sin((2 * Math.PI * expected * i) / sampleRate);
    }
    const actual = Core.yinPitch(samples, sampleRate);
    assert.ok(actual > 0, `expected a pitch near ${expected} Hz`);
    assert.ok(Math.abs(1200 * Math.log2(actual / expected)) < 15, `${expected} Hz estimated as ${actual} Hz`);
  }
  assert.equal(Core.yinPitch(new Float32Array(2048), sampleRate), -1);
});

test('local date key uses the device local calendar date', () => {
  const date = new Date(2026, 10, 13, 23, 59, 0);
  assert.equal(Core.localDateKey(date), '2026-11-13');
});

test('XP is awarded for a first practice and only for an improved best afterwards', () => {
  assert.equal(Core.computeGain(80, 0, false), 50);
  assert.equal(Core.computeGain(84, 80, true), 4);
  assert.equal(Core.computeGain(79, 80, true), 0);
  assert.equal(Core.computeGain(80, 80, true), 0);
});

test('progress normalization rejects invalid values and bounds stored history', () => {
  const defaults = { streak: 0, pts: 0, best: {}, hist: [], badges: [], dn: [], range: null, seen: 0, theme: '', record: false };
  const raw = {
    pts: -100,
    streak: 3.7,
    best: { valid: 120, bad: 'x' },
    hist: [null, { d: '2026-11-13', id: 'one', s: 70, g: 5 }, { d: 2, id: 'bad', s: 1 }],
    badges: ['a', 'a', 2],
    range: [80, 40],
    theme: 'unknown',
    record: 'yes'
  };
  const normalized = Core.normalizeState(raw, defaults, 1);
  assert.equal(normalized.pts, 0);
  assert.equal(normalized.streak, 3);
  assert.deepEqual(normalized.best, { valid: 100 });
  assert.deepEqual(normalized.hist, [{ d: '2026-11-13', id: 'one', s: 70, g: 5 }]);
  assert.deepEqual(normalized.badges, ['a']);
  assert.equal(normalized.range, null);
  assert.equal(normalized.theme, '');
  assert.equal(normalized.record, false);
});


test('lesson exercise progress normalizes imported values and counts only valid completed ids', () => {
  const normalized = Core.normalizeState({
    lessonExercises: {
      pitch: { 'унисон-со-звуком': true, 'лишнее': false, broken: 'yes' },
      'bad id': { item: true },
      mic: ['not-an-object']
    }
  }, { lessonExercises: {} });
  assert.deepEqual(normalized.lessonExercises, { pitch: { 'унисон-со-звуком': true } });
  assert.deepEqual(
    Core.getLessonExerciseProgress(normalized.lessonExercises, 'pitch', ['унисон-со-звуком', 'скользящий-слайд']),
    { completed: 1, total: 2, percent: 50 }
  );
});

test('lesson exercise keys are stable normalized slugs for Russian titles', () => {
  assert.equal(Core.lessonExerciseKey('pitch', '  Унисон со звуком  '), 'унисон-со-звуком');
  assert.equal(Core.lessonExerciseKey('pitch', '***'), '');
  assert.equal(Core.lessonExerciseKey('bad id', 'Упражнение'), '');
});

test('exercise completion toggles are immutable and removing the last item clears the lesson entry', () => {
  const original = { pitch: { 'унисон-со-звуком': true } };
  const added = Core.setLessonExerciseDone(original, 'pitch', 'скользящий-слайд', true);
  assert.deepEqual(original, { pitch: { 'унисон-со-звуком': true } });
  assert.deepEqual(added, { pitch: { 'унисон-со-звуком': true, 'скользящий-слайд': true } });
  assert.deepEqual(Core.setLessonExerciseDone(added, 'pitch', 'унисон-со-звуком', false), { pitch: { 'скользящий-слайд': true } });
  assert.deepEqual(Core.setLessonExerciseDone({ pitch: { item: true } }, 'pitch', 'item', false), {});
});


test('lesson exercise key builder disambiguates duplicate titles without collisions', () => {
  const keys = Core.lessonExerciseKeys('pitch', ['Унисон', 'Унисон', 'Скользящий слайд']);
  assert.equal(new Set(keys).size, 3);
  assert.deepEqual(keys, ['унисон', 'унисон-2-2', 'скользящий-слайд']);
});
