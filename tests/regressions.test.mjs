import {
  assert,
  test,
  EventBus,
  server,
  moveSettings,
  importSettings,
} from './regression-fixture.mjs';

test('event subscriptions release the registered wrapper and retained callback', () => {
  const seen = [];
  const callback = (value) => seen.push(value);
  EventBus.on('refresh', callback);
  EventBus.emit('refresh', 'first');
  EventBus.off('refresh', callback);
  EventBus.emit('refresh', 'second');
  assert.deepEqual(seen, ['first']);
  assert.deepEqual(EventBus.eventNames(), []);
});

test('once unsubscribes before a recursive emit and can be cancelled by its callback', () => {
  let calls = 0;
  EventBus.once('once', () => {
    calls++;
    EventBus.emit('once');
  });
  EventBus.emit('once');
  const cancelled = () => calls++;
  EventBus.once('cancel', cancelled);
  EventBus.off('cancel', cancelled);
  EventBus.emit('cancel');
  assert.equal(calls, 1);
});

test('capture subscriptions and removeAllListeners release every listener', () => {
  let calls = 0;
  const callback = () => calls++;
  EventBus.prepend('capture', callback);
  EventBus.prependOnce('capture-once', callback);
  EventBus.removeAllListeners();
  EventBus.emit('capture');
  EventBus.emit('capture-once');
  assert.equal(calls, 0);
});

test('repeated subscribe/unsubscribe cycles stay bounded', () => {
  for (let i = 0; i < 500; i++) {
    const callback = () => {};
    EventBus.on('refresh', callback);
    EventBus.off('refresh', callback);
  }
  assert.deepEqual(EventBus.getListeners('refresh'), []);
});

test('first-run migration works with empty storage and preserves existing choices', () => {
  moveSettings();
  assert.equal(localStorage.getItem('firstRun'), 'true');
  localStorage.setItem('theme', 'dark');
  moveSettings();
  assert.equal(localStorage.getItem('theme'), 'dark');
});

test('fresh profiles open with English, time, search and basic weather in the bottom-right', async () => {
  const widgets = await server.ssrLoadModule('/src/utils/widgets.js');
  moveSettings();
  assert.equal(localStorage.getItem('language'), 'en_GB');
  assert.equal(localStorage.getItem('timeType'), 'digital');
  assert.equal(localStorage.getItem('aiAskService'), 'googleSearch');
  assert.equal(localStorage.getItem('weatherType'), '1');
  assert.equal(widgets.readPlacement().weather, 'right');
  assert.deepEqual(
    widgets.WIDGETS.filter(({ id }) => widgets.isWidgetEnabled(id)).map(({ id }) => id),
    ['time', 'weather', 'aiask'],
  );
  assert.equal(localStorage.getItem('backgroundType'), 'api_unsplash');
  assert.equal(localStorage.getItem('backgroundAPI'), 'unsplash');
  assert.equal(localStorage.getItem('location'), '');
  assert.equal(localStorage.getItem('currentWeather'), null);
  assert.equal(localStorage.getItem('currentBackground'), null);
  assert.equal(localStorage.getItem('statsData'), '{}');
});

test('startup retires wizard flags without changing an existing profile', () => {
  const saved = {
    language: 'bg',
    theme: 'dark',
    time: 'false',
    backgroundType: 'api_live',
    location: 'Rome',
    widgetPlacement: '{"weather":"left"}',
    scratchNotesData: '[{"id":"saved","text":"Keep this","x":1,"y":1}]',
  };
  for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, value);
  for (const key of ['showWelcome', 'welcomePreview', 'welcomeTab', 'welcomeImage'])
    localStorage.setItem(key, 'true');
  moveSettings();
  for (const [key, value] of Object.entries(saved)) assert.equal(localStorage.getItem(key), value);
  for (const key of ['showWelcome', 'welcomePreview', 'welcomeTab', 'welcomeImage'])
    assert.equal(localStorage.getItem(key), null);
});

test('both reset scopes restore the ready-to-use preset without a setup screen', async () => {
  const { resetProfile } = await server.ssrLoadModule('/src/utils/settings/profile.js');
  const widgets = await server.ssrLoadModule('/src/utils/widgets.js');
  for (const erase of [false, true]) {
    localStorage.setItem('language', 'bg');
    localStorage.setItem('weatherType', '4');
    localStorage.setItem('widgetPlacement', '{"weather":"left"}');
    localStorage.setItem('showWelcome', 'true');
    localStorage.setItem('welcomePreview', 'true');
    await resetProfile(erase);
    assert.equal(localStorage.getItem('language'), 'en_GB');
    assert.equal(localStorage.getItem('weatherType'), '1');
    assert.equal(widgets.readPlacement().weather, 'right');
    assert.equal(localStorage.getItem('backgroundAPI'), 'unsplash');
    assert.equal(localStorage.getItem('showWelcome'), null);
    assert.equal(localStorage.getItem('welcomePreview'), null);
    assert.deepEqual(
      widgets.WIDGETS.filter(({ id }) => widgets.isWidgetEnabled(id)).map(({ id }) => id),
      ['time', 'weather', 'aiask'],
    );
  }
});

test('settings import rejects arrays, null and nested objects before writing', async () => {
  localStorage.setItem('theme', 'dark');
  for (const input of ['[]', 'null', '{"theme":"light","quicklinks":{}}']) {
    await assert.rejects(() => importSettings(input));
    assert.equal(localStorage.getItem('theme'), 'dark');
  }
});
