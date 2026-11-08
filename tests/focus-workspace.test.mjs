import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { createServer } from 'vite';
import 'fake-indexeddb/auto';

class Storage {
  getItem(key) {
    return Object.hasOwn(this, key) ? this[key] : null;
  }
  setItem(key, value) {
    this[key] = String(value);
  }
  removeItem(key) {
    delete this[key];
  }
  clear() {
    for (const key of Object.keys(this)) delete this[key];
  }
}
globalThis.localStorage = new Storage();
globalThis.document = new EventTarget();
const server = await createServer({
  server: { middlewareMode: true, hmr: false, open: false },
  logLevel: 'silent',
});
const widgets = await server.ssrLoadModule('/src/utils/widgets.js');
const workspace = await server.ssrLoadModule('/src/features/focus/workspace.js');
const links = await server.ssrLoadModule(
  '/src/features/quicklinks/options/utils/quicklinksUtils.js',
);
const backup = await server.ssrLoadModule('/src/utils/settings/backupSchema.js');
const notes = await server.ssrLoadModule('/src/features/scratch/noteTypes.js');
const assets = await server.ssrLoadModule('/src/utils/customBackgroundDB.js');
const { overviewRows } = await server.ssrLoadModule(
  '/src/features/misc/sections/overviewLayout.js',
);
after(() => server.close());
beforeEach(() => localStorage.clear());
const put = (values) =>
  Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));

test('Quick Links occupies a protected full-width centre row in both profiles', () => {
  assert.equal(widgets.isFullWidth('quicklinks'), true);
  for (const profile of ['standard', 'focus']) {
    widgets.saveSecondLane(['quicklinks', 'github'], profile);
    assert.deepEqual(widgets.readSecondLane(profile), ['github']);
  }
  const rows = overviewRows(['portfolio', 'quicklinks', 'mail'], ['quicklinks', 'mail'], 'center');
  assert.deepEqual(rows[0], ['quicklinks']);
  assert.ok(rows.filter((row) => row.includes('quicklinks')).every((row) => row.length === 1));
});

test('Focus visibility is independent and retains the minimal default', () => {
  assert.equal(widgets.isWidgetEnabled('time', 'focus'), true);
  assert.equal(widgets.isWidgetEnabled('weather', 'focus'), false);
  widgets.setWidgetEnabled('weather', false);
  widgets.setWidgetEnabled('weather', true, 'focus');
  assert.equal(widgets.isWidgetEnabled('weather'), false);
  assert.equal(widgets.isWidgetEnabled('weather', 'focus'), true);
  widgets.setWidgetEnabled('time', false, 'focus');
  assert.equal(widgets.isWidgetEnabled('time'), true);
  assert.equal(widgets.isWidgetEnabled('time', 'focus'), false);
  put({ focusWidgetVisibility: 'broken' });
  assert.equal(widgets.isWidgetEnabled('time', 'focus'), true);
});

test('Focus order, placement and second lane inherit safely and then stay independent', () => {
  const standard = [...widgets.readOrder()].reverse();
  widgets.saveOrder(standard);
  widgets.savePlacement({ weather: 'right', quicklinks: 'left' });
  widgets.saveSecondLane(['github']);
  assert.deepEqual(widgets.readOrder('focus'), standard);
  assert.equal(widgets.readPlacement('focus').weather, 'right');
  assert.deepEqual(widgets.readSecondLane('focus'), ['github']);
  const focused = [...standard].reverse();
  widgets.saveOrder(focused, 'focus');
  widgets.savePlacement({ weather: 'center' }, 'focus');
  widgets.saveSecondLane([], 'focus');
  assert.deepEqual(widgets.readOrder(), standard);
  assert.deepEqual(widgets.readOrder('focus'), focused);
  assert.equal(widgets.readPlacement().weather, 'right');
  assert.equal(widgets.readPlacement('focus').weather, 'center');
  assert.deepEqual(widgets.readSecondLane(), ['github']);
  assert.deepEqual(widgets.readSecondLane('focus'), []);
});

test('separate Quick Links replace only the active list and preserve explicit visibility', () => {
  const standard = [{ key: 's', name: 'Standard', url: 'https://example.com' }];
  const focused = [{ key: 'f', name: 'Focus', url: 'https://example.org' }];
  put({ quicklinks: JSON.stringify(standard), focusQuicklinks: JSON.stringify(focused) });
  assert.equal(links.quicklinksStorageKey(true), 'quicklinks');
  put({ quicklinksSeparateFocus: 'true' });
  assert.deepEqual(links.readQuicklinks(links.quicklinksStorageKey(false)), standard);
  assert.deepEqual(links.readQuicklinks(links.quicklinksStorageKey(true)), focused);
  assert.equal(widgets.isWidgetEnabled('quicklinks', 'focus'), true);
  widgets.setWidgetEnabled('quicklinks', false, 'focus');
  assert.equal(widgets.isWidgetEnabled('quicklinks', 'focus'), false);
  put({ quicklinksSeparateFocus: 'false' });
  assert.equal(links.quicklinksStorageKey(true), 'quicklinks');
  assert.deepEqual(links.readQuicklinks('focusQuicklinks'), focused);
});

test('Focus sessions, pause and Pomodoro breaks switch workspace independently of wallpaper', () => {
  const now = new Date('2026-10-29T12:00:00Z');
  const session = { phase: 'focus', started: now.getTime(), end: null };
  put({ focusSession: JSON.stringify(session) });
  assert.equal(workspace.isFocusWorkspace(now), true);
  put({ focusSession: JSON.stringify({ ...session, paused: true }) });
  assert.equal(workspace.isFocusWorkspace(now), false);
  put({ focusSession: JSON.stringify({ ...session, phase: 'break', end: now.getTime() + 60000 }) });
  assert.equal(workspace.isFocusWorkspace(now), false);
  put({ focusSession: JSON.stringify({ ...session, phase: 'work', end: now.getTime() + 60000 }) });
  assert.equal(workspace.isFocusWorkspace(now), true);
});

test('Progress shifts respect timezone, weekday and overnight boundaries', () => {
  put({
    timeType: 'percentageComplete',
    timezone: 'Europe/Sofia',
    percentageStart: '09:00',
    percentageEnd: '17:00',
    percentageDays: '[4]',
    percentageFallback: 'true',
    percentageFallbackBackground: 'false',
  });
  assert.equal(workspace.isFocusWorkspace(new Date('2026-10-29T06:59:00Z')), false);
  assert.equal(workspace.isFocusWorkspace(new Date('2026-10-29T07:00:00Z')), true);
  assert.equal(workspace.isFocusWorkspace(new Date('2026-10-29T15:00:01Z')), false);
  put({ percentageStart: '22:00', percentageEnd: '06:00' });
  assert.equal(workspace.isFocusWorkspace(new Date('2026-10-30T02:00:00Z')), true);
  assert.equal(workspace.isFocusWorkspace(new Date('2026-10-30T04:00:00Z')), false);
  assert.equal(workspace.isFocusWorkspace(new Date('2026-10-31T02:00:00Z')), false);
  put({ timeType: 'digital' });
  assert.equal(workspace.isFocusWorkspace(new Date('2026-10-30T02:00:00Z')), false);
});

test('backups retain workspaces and per-item visibility, rejecting invalid flags', async () => {
  const note = { id: 'n', x: 10, y: 20, text: 'Keep me', showInFocus: true };
  const image = {
    id: 'i',
    x: 20,
    y: 40,
    src: 'data:image/png;base64,AAAA',
    ratio: 1,
    width: 200,
    showInFocus: true,
  };
  const settings = {
    focusWidgetOrder: '["time","quicklinks"]',
    focusWidgetPlacement: '{"quicklinks":"right"}',
    focusWidgetSecondLane: '[]',
    focusWidgetVisibility: '{"quicklinks":true}',
    quicklinksSeparateFocus: 'true',
    focusQuicklinks: '[{"key":"a","name":"Work","url":"https://example.com"}]',
    scratchNotesData: JSON.stringify([note]),
    scratchImagesData: JSON.stringify([image]),
  };
  assert.deepEqual({ ...backup.validateSettings(settings).settings }, settings);
  const restored = backup.prepareBackup(
    JSON.stringify({
      format: backup.BACKUP_FORMAT,
      version: backup.BACKUP_VERSION,
      settings,
      assets: { backgrounds: [], scratchImages: [image] },
    }),
  );
  assert.equal(restored.settings.focusQuicklinks, settings.focusQuicklinks);
  assert.equal(restored.settings.focusWidgetVisibility, settings.focusWidgetVisibility);
  assert.equal(JSON.parse(restored.settings.scratchNotesData)[0].showInFocus, true);
  assert.equal(restored.scratchImages[0].showInFocus, true);
  assert.throws(() => backup.validateSettings({ focusWidgetVisibility: '{"time":"false"}' }));
  assert.throws(() =>
    backup.validateSettings({
      scratchNotesData: JSON.stringify([{ ...note, showInFocus: 'true' }]),
    }),
  );
  assert.throws(() =>
    backup.validateSettings({ scratchImagesData: JSON.stringify([{ ...image, showInFocus: 1 }]) }),
  );
  assert.equal(
    notes.switchNoteType(notes.switchNoteType(note, 'checklist'), 'note').showInFocus,
    true,
  );
  await assets.patchScratchAssets({ upserts: [image] });
  assert.equal(
    (await assets.readScratchAssets()).find((item) => item.id === image.id).showInFocus,
    true,
  );
});

test('a settings reset keeps both personal link lists and per-note Focus choices', async () => {
  const profile = await server.ssrLoadModule('/src/utils/settings/profile.js');
  put({
    quicklinks: '[{"key":"s","name":"Standard","url":"https://example.com"}]',
    focusQuicklinks: '[{"key":"f","name":"Focus","url":"https://example.org"}]',
    scratchNotesData: '[{"id":"n","x":10,"y":20,"text":"Keep","showInFocus":true}]',
    quicklinksSeparateFocus: 'true',
    focusWidgetVisibility: '{"weather":true}',
  });
  await profile.resetProfile(false);
  assert.equal(links.readQuicklinks()[0].key, 's');
  assert.equal(links.readQuicklinks('focusQuicklinks')[0].key, 'f');
  assert.equal(JSON.parse(localStorage.getItem('scratchNotesData'))[0].showInFocus, true);
  assert.equal(localStorage.getItem('quicklinksSeparateFocus'), 'false');
  assert.equal(localStorage.getItem('focusWidgetVisibility'), '{}');
});

test('all corner placements persist independently and survive backup validation', () => {
  widgets.savePlacement({ airquality: 'top-right', weather: 'top-left', mail: 'right' });
  assert.equal(widgets.readPlacement().airquality, 'top-right');
  assert.equal(widgets.readPlacement('focus').weather, 'top-left');
  widgets.savePlacement({ airquality: 'left' }, 'focus');
  assert.equal(widgets.readPlacement('focus').airquality, 'left');
  assert.equal(widgets.readPlacement().airquality, 'top-right');
  const groups = widgets.groupByZone(widgets.readOrder(), widgets.readPlacement());
  assert.deepEqual(groups['top-right'], ['airquality']);
  assert.equal(widgets.placementFromGroups(groups).weather, 'top-left');
  const settings = {
    widgetPlacement: JSON.stringify(widgets.readPlacement()),
    focusWidgetPlacement: JSON.stringify(widgets.readPlacement('focus')),
  };
  const validated = backup.validateSettings(settings);
  assert.deepEqual({ ...validated.settings }, settings);
  assert.deepEqual(validated.skipped, []);
});

test('drop targets distinguish upper and lower corners sharing the same horizontal range', async () => {
  const { readTarget } = await server.ssrLoadModule(
    '/src/features/misc/sections/overviewGeometry.js',
  );
  const box = (left, top, bottom) => ({
    left,
    right: left + 100,
    top,
    bottom,
    cards: [],
    gaps: [],
  });
  const geometry = {
    'top-left': box(0, 0, 50),
    left: box(0, 100, 200),
    center: box(120, 100, 200),
    right: box(240, 100, 200),
    'top-right': box(240, 0, 50),
  };
  assert.equal(readTarget(geometry, { x: 280, y: 25 }).zone, 'top-right');
  assert.equal(readTarget(geometry, { x: 280, y: 150 }).zone, 'right');
  assert.equal(readTarget(geometry, { x: 30, y: 25 }).zone, 'top-left');
  assert.equal(readTarget(geometry, { x: 30, y: 150 }).zone, 'left');
});
