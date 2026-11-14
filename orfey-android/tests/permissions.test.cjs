const test = require('node:test');
const assert = require('node:assert/strict');
const Permissions = require('../app/src/main/assets/permissions.js');

test('denied microphone permission points users to Android app settings and privacy toggle', () => {
  const message = Permissions.errorMessage({name: 'NotAllowedError'});
  assert.match(message, /настройки приложения/i);
  assert.match(message, /Разрешения → Микрофон/);
  assert.match(message, /Доступ к микрофону/);
});

test('missing microphone and hardware-in-use failures have distinct guidance', () => {
  assert.match(Permissions.errorMessage({name: 'NotFoundError'}), /не обнаружил микрофон/);
  assert.match(Permissions.errorMessage({name: 'NotReadableError'}), /занят другим приложением/);
  assert.match(Permissions.errorMessage(null), /Проверьте разрешение/);
});
