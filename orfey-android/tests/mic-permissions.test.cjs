const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const activity = fs.readFileSync(path.join(__dirname, '../app/src/main/java/ru/orfey/voice/MainActivity.kt'), 'utf8');
const manifest = fs.readFileSync(path.join(__dirname, '../app/src/main/AndroidManifest.xml'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/index.html'), 'utf8');

test('microphone permission is limited by normalized trusted HTTPS origin, not URI string formatting', () => {
  assert.match(activity, /isTrustedMicOrigin\(request\.origin\)/);
  assert.match(activity, /private fun isTrustedMicOrigin\(origin: Uri\)/);
  assert.match(activity, /origin\.scheme\?\.equals\("https", ignoreCase = true\) == true/);
  assert.match(activity, /origin\.host\?\.equals\(ASSET_HOST, ignoreCase = true\) == true/);
  assert.match(activity, /origin\.port == -1 \|\| origin\.port == 443/);
  assert.doesNotMatch(activity, /request\.origin\.toString\(\)\s*==\s*ASSET_ORIGIN/);
});

test('WebView still grants audio-only capture and Android declares RECORD_AUDIO', () => {
  assert.match(activity, /request\.resources\.contains\(PermissionRequest\.RESOURCE_AUDIO_CAPTURE\)/);
  assert.match(activity, /request\.grant\(arrayOf\(PermissionRequest\.RESOURCE_AUDIO_CAPTURE\)\)/);
  assert.match(manifest, /android\.permission\.RECORD_AUDIO/);
  assert.match(html, /navigator\.mediaDevices\.getUserMedia\(/);
});
