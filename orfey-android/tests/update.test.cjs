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

function fakeElement() {
  const attributes = new Map();
  return {
    textContent: '',
    hidden: true,
    onclick: null,
    setAttribute(name, value) { attributes.set(name, value); },
    removeAttribute(name) { attributes.delete(name); },
    getAttribute(name) { return attributes.get(name) || null; }
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

test('brand status displays installed version and reveals a working update button only for a newer APK', () => {
  const version = fakeElement();
  const button = fakeElement();
  const doc = {
    querySelectorAll(selector) {
      return selector === '[data-app-version]' ? [version] : [button];
    }
  };
  const win = { location: { href: '' } };
  const latest = Updates.parseLatestRelease(release(1051));

  assert.equal(Updates.formatVersionLabel(' 1.14 '), 'Версия 1.14');
  Updates.applyBrandStatus(doc, '1.14', latest, win);
  assert.equal(version.textContent, 'Версия 1.14');
  assert.equal(button.hidden, false);
  assert.equal(button.getAttribute('aria-label'), 'Обновить приложение до версии 1.4');
  button.onclick();
  assert.equal(win.location.href, latest.downloadUrl);

  Updates.applyBrandStatus(doc, '1.15', null, win);
  assert.equal(version.textContent, 'Версия 1.15');
  assert.equal(button.hidden, true);
  assert.equal(button.onclick, null);
  assert.equal(button.getAttribute('aria-label'), null);
});

test('start reads Android version and keeps the update button through app rerenders', async () => {
  let versionNodes = [fakeElement()];
  let updateButtons = [fakeElement()];
  let observerCallback;
  let scheduledCheck;
  const storage = new Map();
  const renderRoot = {};
  const doc = {
    readyState: 'complete',
    body: {},
    visibilityState: 'visible',
    getElementById(id) { return id === 'v' ? renderRoot : null; },
    querySelectorAll(selector) {
      return selector === '[data-app-version]' ? versionNodes : updateButtons;
    },
    addEventListener() {}
  };
  const win = {
    document: doc,
    OrfeyGitHub: { appVersionCode: () => 1029, appVersionName: () => '1.14' },
    MutationObserver: class {
      constructor(callback) { observerCallback = callback; }
      observe() {}
    },
    setTimeout(callback) { scheduledCheck = callback; return 1; },
    setInterval() { return 2; },
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); }
    },
    fetch: async () => ({
      ok: true,
      json: async () => release(1030, { name: 'Орфей 1.15 (сборка 1030)' })
    }),
    location: { href: '' }
  };

  Updates.start(win);
  assert.equal(versionNodes[0].textContent, 'Версия 1.14');
  assert.equal(updateButtons[0].hidden, true);
  await scheduledCheck();
  assert.equal(updateButtons[0].hidden, false);

  versionNodes = [fakeElement()];
  updateButtons = [fakeElement()];
  observerCallback();
  assert.equal(versionNodes[0].textContent, 'Версия 1.14');
  assert.equal(updateButtons[0].hidden, false);
  updateButtons[0].onclick();
  assert.equal(win.location.href, 'https://github.com/pdkiller666/Orfeus/releases/download/build-1030/orfey-android.apk');
});
