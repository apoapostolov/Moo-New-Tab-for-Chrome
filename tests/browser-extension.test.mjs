import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { extensionManifest } from '../scripts/extension-build.mjs';
import { oauthRedirect } from '../src/features/google/oauthRedirect.js';

test('Chrome and Firefox keep identical capabilities with browser-specific background hosts', () => {
  const firefox = extensionManifest('firefox');
  const chrome = extensionManifest('chrome');
  for (const key of [
    'version',
    'permissions',
    'optional_permissions',
    'host_permissions',
    'optional_host_permissions',
    'chrome_url_overrides',
    'icons',
  ])
    assert.deepEqual(chrome[key], firefox[key], key);
  assert.equal(chrome.background.service_worker, 'service-worker.js');
  assert.equal(chrome.browser_specific_settings, undefined);
  assert.deepEqual(firefox.background.scripts, ['calendar-alerts.js', 'background.js']);
  assert.equal(firefox.browser_specific_settings.gecko.id, 'moo@apoapostolov');
  assert.throws(() => extensionManifest('unknown'));
});

test('OAuth uses Chrome HTTPS and Firefox loopback redirects without mixing client types', () => {
  assert.equal(
    oauthRedirect('https://abcdefgh.chromiumapp.org/'),
    'https://abcdefgh.chromiumapp.org/',
  );
  assert.equal(
    oauthRedirect('https://uuid.extensions.allizom.org/'),
    'http://127.0.0.1/mozoauth2/uuid',
  );
  assert.throws(() => oauthRedirect('https://chromiumapp.org.evil.example/'));
  assert.throws(() => oauthRedirect('http://abcdefgh.chromiumapp.org/'));
});

test('Chrome namespace is initialized before feature code and native Firefox API is preserved', () => {
  const source = readFileSync(new URL('../src/lib/extensionApi.js', import.meta.url), 'utf8');
  const chrome = { runtime: { id: 'test' } };
  const context = vm.createContext({ chrome });
  vm.runInContext(source, context);
  assert.equal(context.browser, chrome);
  const browser = { runtime: { id: 'firefox' } };
  const firefox = vm.createContext({ browser, chrome });
  vm.runInContext(source, firefox);
  assert.equal(firefox.browser, browser);
  const preview = vm.createContext({ chrome: {} });
  vm.runInContext(source, preview);
  assert.equal(preview.browser, undefined);
});

test('Chrome service worker loads the shared background handlers in order', () => {
  const calls = [];
  vm.runInNewContext(
    readFileSync(new URL('../manifest/service-worker.js', import.meta.url), 'utf8'),
    {
      importScripts: (...scripts) => calls.push(...scripts),
    },
  );
  assert.deepEqual(calls, ['calendar-alerts.js', 'background.js']);
});
