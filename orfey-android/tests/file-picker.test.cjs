const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const activity = fs.readFileSync(path.join(root, 'app/src/main/java/ru/orfey/voice/MainActivity.kt'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'app/src/main/AndroidManifest.xml'), 'utf8');
const samples = fs.readFileSync(path.join(root, 'app/src/main/assets/samples.js'), 'utf8');

test('Android app exposes a system audio document picker only to the trusted local WebView', () => {
  assert.match(activity, /ActivityResultContracts\.OpenDocument\(\)/);
  assert.match(activity, /override fun onShowFileChooser\(/);
  assert.match(activity, /isAssetUrl\(Uri\.parse\(view\.url \?: ""\)\)/);
  assert.match(activity, /audioFilePicker\.launch\(arrayOf\("audio\/\*"\)\)/);
  assert.match(activity, /callback\?\.onReceiveValue\(uri\?\.let \{ arrayOf\(it\) \}\)/);
  assert.match(activity, /pendingFileChooser\?\.onReceiveValue\(null\)/);
  assert.doesNotMatch(manifest, /READ_MEDIA_AUDIO|READ_EXTERNAL_STORAGE/);
});

test('sample upload confirmation is handled by a trusted native Android dialog', () => {
  assert.match(activity, /override fun onJsConfirm\(/);
  assert.match(activity, /AlertDialog\.Builder/);
  assert.match(activity, /if \(!isAssetUrl\(Uri\.parse\(url\)\)\)/);
  assert.match(activity, /result\.confirm\(\)/);
  assert.match(activity, /result\.cancel\(\)/);
  assert.match(samples, /window\.confirm\(/);
  assert.match(samples, /if \(take\.duration\) updateTrim\(\)/);
});

test('teacher sample in an unmerged pull request is explained; catalogue can be refreshed', () => {
  assert.match(samples, /открытых PR не меняют кнопку до слияния в main/);
  assert.match(samples, /Обновить каталог/);
});

test('sample editor imports audio locally, supports common formats and submits normalized WAV', () => {
  assert.match(samples, /id="sampleFile" type="file" accept="audio\/\*/);
  assert.match(samples, /MAX_SOURCE_BYTES = 25 \* 1024 \* 1024/);
  assert.match(samples, /MAX_SOURCE_SECONDS = 120/);
  assert.match(samples, /return encodeWav\(decoded,take\.start,take\.end\)/);
  assert.match(samples, /оригинал не отправляется/);
});
