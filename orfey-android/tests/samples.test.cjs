const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Samples = require('../app/src/main/assets/samples.js');
const samplesSource = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/samples.js'), 'utf8');

const good = {
  id: '12345678-1234-1234-1234-123456789abc', exerciseId: 'fal', title: 'Мягкий фальцет',
  description: 'Плавный переход без нажима', recordedBy: 'Преподаватель',
  path: 'samples/audio/12345678-1234-1234-1234-123456789abc.wav',
  mimeType: 'audio/wav', sha256: 'a'.repeat(64), sizeBytes: 1000, durationMs: 2400, license: 'CC BY 4.0', sourceType: 'teacher', status: 'approved'
};

test('public sample entries require approved WAV and a content hash', () => {
  assert.equal(Samples.validEntry(good), true);
  assert.equal(Samples.validEntry({...good, status: 'pending'}), false);
  assert.equal(Samples.validEntry({...good, path: '../../token.txt'}), false);
  assert.equal(Samples.validEntry({...good, id: 'bad-id'}), false);
  assert.equal(Samples.validEntry({...good, sha256: 'short'}), false);
  assert.equal(Samples.validEntry({...good, exerciseId: 'unknown'}), false);
  assert.equal(Samples.validEntry({...good, sourceType: 'synthetic'}), true);
  assert.equal(Samples.validEntry({...good, sourceType: 'synthetic', license: 'CC0 1.0'}), false);
});

test('sample manifest rejects unsupported schema and malformed entries', () => {
  assert.equal(Samples.validManifest({schema: 1, samples: []}), true);
  assert.equal(Samples.validManifest({schema: 2, samples: []}), false);
  assert.equal(Samples.validManifest({schema: 1, samples: [good]}), true);
  assert.equal(Samples.validManifest({schema: 1, samples: [{...good, status: 'pending'}]}), false);
});

test('published teacher sample replaces synthetic fallback for its exercise', () => {
  const synthetic = {...good, id: '22345678-1234-1234-1234-123456789abc', path: 'samples/audio/22345678-1234-1234-1234-123456789abc.wav', sourceType: 'synthetic', title: 'Synthetic', createdAt: '2026-01-01T00:00:00Z'};
  const teacher = {...good, createdAt: '2025-01-01T00:00:00Z'};
  assert.equal(Samples.preferredSample([synthetic], 'fal'), synthetic);
  assert.equal(Samples.preferredSample([synthetic, teacher], 'fal'), teacher);
  assert.equal(Samples.preferredSample([good], 'range'), null);
  assert.equal(Samples.preferredSample([], 'fal'), null);
});

test('audio paths resolve only under the public repository sample tree', () => {
  assert.equal(Samples.rootPath('samples/audio/x.wav'), 'https://raw.githubusercontent.com/pdkiller666/Orfeus/main/samples/audio/x.wav');
  assert.equal(Samples.rootPath('samples/audio/a b.wav').includes('a%20b.wav'), true);
});

test('ready audio file import accepts supported audio formats and enforces source limits', () => {
  assert.equal(Samples.isSupportedAudioFile({name: 'lesson.wav', type: 'audio/wav', size: 1024}), true);
  assert.equal(Samples.isSupportedAudioFile({name: 'Lesson.M4A', type: '', size: 1024}), true);
  assert.equal(Samples.isSupportedAudioFile({name: 'voice.ogg', type: 'application/octet-stream', size: 1024}), true);
  assert.equal(Samples.isSupportedAudioFile({name: 'image.png', type: 'image/png', size: 1024}), false);
  assert.equal(Samples.isSupportedAudioFile({name: 'video.mp4', type: 'video/mp4', size: 1024}), false);
  assert.equal(Samples.isSupportedAudioFile({name: 'large.wav', type: 'audio/wav', size: 25 * 1024 * 1024 + 1}), false);
  assert.equal(Samples.isSupportedAudioFile({name: 'empty.wav', type: 'audio/wav', size: 0}), false);
});


test('manifest request avoids custom headers that would trigger a GitHub raw CORS preflight', () => {
  assert.match(samplesSource, /fetch\(`\$\{MANIFEST\}\?v=\$\{Date\.now\(\)\}`,\{cache:"no-store"\}\)/);
  assert.doesNotMatch(samplesSource, /headers\s*:\s*\{\s*["']Cache-Control["']/i);
});
