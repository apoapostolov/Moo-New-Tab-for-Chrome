import {
  assert,
  test,
  server,
  importSettings,
  React,
  renderToStaticMarkup,
} from './regression-fixture.mjs';
const columns = await server.ssrLoadModule('/src/utils/widgetColumns.js');
const { createBackup } = await server.ssrLoadModule('/src/utils/settings/export.js');
const { validateSettings } = await server.ssrLoadModule('/src/utils/settings/backupSchema.js');
const { default: Switch } = await server.ssrLoadModule(
  '/src/features/misc/sections/OverviewColumns.jsx',
);

test('automatic two-column layout balances eligible cards and keeps full-width lines out', () => {
  const all = ['time', 'planning', 'date', 'subscriptions', 'habits', 'aiask', 'knowledge'];
  assert.deepEqual(columns.centerSecondLane(all, [], '2'), ['subscriptions', 'knowledge']);
  assert.deepEqual(columns.centerSecondLane(['planning', 'knowledge'], [], '2'), ['knowledge']);
  assert.deepEqual(columns.centerSecondLane(['planning'], [], '2'), []);
  assert.deepEqual(columns.centerSecondLane(all, ['habits'], '1'), []);
  assert.deepEqual(columns.centerSecondLane(all, ['habits', 'time', 'mail'], 'auto'), ['habits']);
});

test('column preferences retain legacy layouts and separate Standard and Focus choices', () => {
  assert.equal(columns.readCenterColumns(), 'auto');
  columns.saveCenterColumns('2');
  assert.equal(columns.readCenterColumns('focus'), '2');
  columns.saveCenterColumns('1', 'focus');
  assert.equal(columns.readCenterColumns(), '2');
  assert.equal(columns.readCenterColumns('focus'), '1');
  localStorage.setItem('widgetCenterColumns', 'broken');
  assert.equal(columns.readCenterColumns(), 'auto');
});

test('column preferences survive Backups and reject unknown layout modes', async () => {
  columns.saveCenterColumns('2');
  columns.saveCenterColumns('1', 'focus');
  const backup = await createBackup();
  localStorage.clear();
  await importSettings(JSON.stringify(backup));
  assert.equal(columns.readCenterColumns(), '2');
  assert.equal(columns.readCenterColumns('focus'), '1');
  assert.throws(() => validateSettings({ widgetCenterColumns: '3' }), /column layout/);
  assert.throws(() => validateSettings({ focusWidgetCenterColumns: 'grid' }), /column layout/);
});

test('Overview column control exposes clear labels and the selected state', () => {
  const markup = renderToStaticMarkup(
    React.createElement(Switch, { count: '2', onSelect: () => {} }),
  );
  assert.match(markup, /aria-label="One column"/);
  assert.match(markup, /aria-label="Two columns"[^>]+aria-pressed="true"/);
  assert.match(markup, /aria-label="Center widget columns"/);
});
