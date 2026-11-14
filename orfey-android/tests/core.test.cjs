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


test('game targets stay inside the comfortable scale range and are deterministic with an injected RNG', () => {
  const values = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1, NaN, -1];
  const targets = Core.createGameTargets(60, 72, () => values.shift(), 10);
  assert.deepEqual(targets, [60, 62, 64, 65, 67, 69, 72, 72, 60, 60]);
  assert.ok(targets.every(note => note >= 60 && note <= 72));
  assert.deepEqual(Core.createGameTargets(60, 64, () => 1, 3), [64, 64, 64]);
});

test('game gate accepts only voiced pitches inside the configured cents tolerance', () => {
  assert.equal(Core.gamePitchInGate(60, 60, 50), true);
  assert.equal(Core.gamePitchInGate(60.49, 60, 50), true);
  assert.equal(Core.gamePitchInGate(60.51, 60, 50), false);
  assert.equal(Core.gamePitchInGate(-1, 60, 50), false);
  assert.equal(Core.gamePitchInGate(null, 60, 50), false);
});

test('game score increments hits and combo, resets combo on a missed gate, and preserves best combo', () => {
  let score = { passed: 0, hits: 0, combo: 0, bestCombo: 0 };
  score = Core.recordGameGate(score, true);
  score = Core.recordGameGate(score, true);
  assert.deepEqual(score, { passed: 2, hits: 2, combo: 2, bestCombo: 2 });
  score = Core.recordGameGate(score, false);
  assert.deepEqual(score, { passed: 3, hits: 2, combo: 0, bestCombo: 2 });
  score = Core.recordGameGate(score, true);
  assert.deepEqual(score, { passed: 4, hits: 3, combo: 1, bestCombo: 2 });
});
