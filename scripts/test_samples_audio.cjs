const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const repo = path.resolve(__dirname, '..');
const app = path.resolve(process.argv[2] || path.join(repo, '.build/orfey-android'));
const catalog = JSON.parse(fs.readFileSync(path.join(repo, 'samples/manifest.json'), 'utf8'));
const core = require(path.join(app, 'app/src/main/assets/core.js'));
const expected = {
  one: [[1.0, 220.0]],
  step: [[0.30, 261.6256], [1.40, 293.6648], [2.60, 261.6256]],
  range: [[0.30, 110.0], [0.90, 146.83], [1.50, 196.0], [2.10, 261.63], [2.70, 329.63], [3.30, 440.0], [3.90, 329.63], [4.50, 261.63], [5.10, 196.0], [5.70, 146.83], [6.30, 110.0]],
};

function readWindow(wavPath, atSeconds, frameCount = 4096) {
  const wav = fs.readFileSync(wavPath);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  const sampleRate = wav.readUInt32LE(24);
  const start = 44 + Math.round(atSeconds * sampleRate) * 2;
  assert.ok(start + frameCount * 2 <= wav.length, `window exceeds ${wavPath}`);
  const samples = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) samples[i] = wav.readInt16LE(start + i * 2) / 32768;
  return { samples, sampleRate };
}

const syntheticByExercise = new Map();
for (const sample of catalog.samples) {
  if (sample.sourceType !== 'synthetic') continue;
  assert.ok(!syntheticByExercise.has(sample.exerciseId), `duplicate synthetic sample for ${sample.exerciseId}`);
  syntheticByExercise.set(sample.exerciseId, sample);
}
assert.deepEqual(
  new Set(syntheticByExercise.keys()),
  new Set(Object.keys(expected)),
  'expected one synthetic test sample for each covered exercise; teacher samples may coexist'
);
for (const [exerciseId, rows] of Object.entries(expected)) {
  const sample = syntheticByExercise.get(exerciseId);
  for (const [at, targetHz] of rows) {
    const { samples, sampleRate } = readWindow(path.join(repo, sample.path), at);
    const detectedHz = core.yinPitch(samples, sampleRate);
    assert.ok(detectedHz > 0, `${exerciseId} at ${at}s: pitch not detected`);
    const error = Math.abs(detectedHz - targetHz) / targetHz;
    assert.ok(error <= 0.025, `${exerciseId} at ${at}s: ${detectedHz.toFixed(1)} Hz, expected ${targetHz.toFixed(1)} Hz`);
  }
}
console.log(`sample pitch regression passed: ${Object.values(expected).reduce((n, rows) => n + rows.length, 0)} YIN checks`);
