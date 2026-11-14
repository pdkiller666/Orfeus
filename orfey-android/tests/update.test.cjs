const test = require('node:test');
const assert = require('node:assert/strict');
const Updates = require('../app/src/main/assets/updates.js');

function release(code, overrides = {}) {
  const tag = `build-${code}`;
  return {
    tag_name: tag,
    name: `Орфей 1.4 (сборка ${code})`,
    draft: false,
    prerelease: false,
    assets: [{
      name: 'orfey-android.apk',
      browser_download_url: `https://github.com/pdkiller666/Orfeus/releases/download/${tag}/orfey-android.apk`
    }],
    ...overrides
  };
}

test('latest release yields a validated APK version and link', () => {
  assert.deepEqual(Updates.parseLatestRelease(release(1051)), {
    versionCode: 1051,
    versionName: '1.4',
    downloadUrl: 'https://github.com/pdkiller666/Orfeus/releases/download/build-1051/orfey-android.apk'
  });
});

test('drafts, prereleases, unexpected tags and assets are rejected', () => {
  assert.equal(Updates.parseLatestRelease(release(1051, {draft: true})), null);
  assert.equal(Updates.parseLatestRelease(release(1051, {prerelease: true})), null);
  assert.equal(Updates.parseLatestRelease(release(1051, {tag_name: 'v1.4'})), null);
  assert.equal(Updates.parseLatestRelease(release(1051, {assets: []})), null);
});

test('APK URL must be the exact public asset for the release tag', () => {
  assert.equal(Updates.parseLatestRelease(release(1051, {assets: [{name: 'orfey-android.apk', browser_download_url: 'https://attacker.example/app.apk'}]})), null);
  assert.equal(Updates.parseLatestRelease(release(1051, {assets: [{name: 'orfey-android.apk', browser_download_url: 'https://github.com/other/repo/releases/download/build-1051/orfey-android.apk'}]})), null);
});

test('only a strictly higher versionCode recommends updating', () => {
  const latest = Updates.parseLatestRelease(release(1051));
  assert.equal(Updates.shouldRecommend(latest, 1050), true);
  assert.equal(Updates.shouldRecommend(latest, 1051), false);
  assert.equal(Updates.shouldRecommend(latest, 1100), false);
  assert.equal(Updates.shouldRecommend(null, 1), false);
});
