import { assert, test, server, importSettings } from './regression-fixture.mjs';

const store = await server.ssrLoadModule('/src/features/planning/planningStore.js');
const actions = await server.ssrLoadModule('/src/features/planning/planningActions.js');
const { createBackup } = await server.ssrLoadModule('/src/utils/settings/export.js');
const { validateSettings } = await server.ssrLoadModule('/src/utils/settings/backupSchema.js');
const widgets = await server.ssrLoadModule('/src/utils/widgets.js');
const task = (id) => ({
  id,
  title: id,
  date: '2026-11-10',
  notes: '',
  minutes: 30,
  priority: false,
  done: false,
  revision: 0,
});

test('concurrent local task capture merges against the latest saved plan', async () => {
  await Promise.all(
    Array.from({ length: 12 }, (_, n) =>
      store.updatePlanning((items) => actions.addPlanTask(items, { title: String(n), date: null })),
    ),
  );
  const state = store.readPlanning();
  assert.equal(state.items.length, 12);
  assert.equal(new Set(state.items.map((item) => item.title)).size, 12);
  assert.equal(state.damaged, false);
});

test('stale task edits cannot overwrite newer work from another tab', async () => {
  localStorage.setItem('planningData', JSON.stringify([task('a')]));
  await store.updatePlanning((items) =>
    actions.changePlanTask(items, 'a', 0, { title: 'Newer title' }),
  );
  await assert.rejects(
    store.updatePlanning((items) => actions.changePlanTask(items, 'a', 0, { done: true })),
    /changed/,
  );
  assert.equal(store.readPlanning().items[0].title, 'Newer title');
  assert.equal(store.readPlanning().items[0].done, false);
});

test('damaged plans and failed writes preserve the original saved bytes', async () => {
  localStorage.setItem('planningData', '[damaged');
  assert.equal(store.readPlanning().damaged, true);
  await assert.rejects(
    store.updatePlanning(() => []),
    /damaged/,
  );
  assert.equal(localStorage.getItem('planningData'), '[damaged');
  localStorage.setItem('planningData', JSON.stringify([task('a')]));
  const original = localStorage.getItem('planningData');
  const set = localStorage.setItem;
  localStorage.setItem = () => {
    throw new Error('quota');
  };
  try {
    await assert.rejects(
      store.updatePlanning(() => []),
      /quota/,
    );
    assert.equal(localStorage.getItem('planningData'), original);
  } finally {
    localStorage.setItem = set;
    delete localStorage.setItem;
  }
});

test('Planning survives backup export/import and rejects damaged records before import', async () => {
  const value = JSON.stringify([task('a')]);
  for (const [key, entry] of Object.entries({
    planningEnabled: 'true',
    planningBudget: '60',
    surfacePlanning: 'glass',
    planningData: value,
  }))
    localStorage.setItem(key, entry);
  const backup = await createBackup();
  assert.equal(backup.settings.planningData, value);
  localStorage.clear();
  await importSettings(JSON.stringify(backup));
  assert.equal(store.readPlanning().items[0].title, 'a');
  assert.equal(localStorage.getItem('planningBudget'), '60');
  assert.equal(localStorage.getItem('surfacePlanning'), 'glass');
  assert.throws(
    () => validateSettings({ planningData: '[{"title":"missing fields"}]' }),
    /not valid/,
  );
  assert.throws(() => validateSettings({ planningBudget: '1441' }), /range/);
});

test('Planning is optional, has independent Focus visibility and accepts all side placements', () => {
  assert.equal(widgets.isWidgetEnabled('planning'), false);
  assert.equal(widgets.readPlacement().planning, 'center');
  widgets.setWidgetEnabled('planning', true);
  assert.equal(widgets.isWidgetEnabled('planning'), true);
  assert.equal(widgets.isWidgetEnabled('planning', 'focus'), false);
  widgets.setWidgetEnabled('planning', true, 'focus');
  widgets.savePlacement({ planning: 'top-right' }, 'focus');
  assert.equal(widgets.readPlacement('focus').planning, 'top-right');
  assert.equal(widgets.readPlacement().planning, 'center');
});

test('a full plan with long notes still fits the backup format', () => {
  const items = Array.from({ length: 500 }, (_, index) => ({
    ...task(String(index)),
    title: 't'.repeat(200),
    notes: 'n'.repeat(2000),
  }));
  const data = JSON.stringify(items);
  assert(data.length > 1024 * 1024);
  assert.equal(validateSettings({ planningData: data }).settings.planningData, data);
});

test('history cleanup keeps unfinished/new tasks and rejects changed records', () => {
  const done = { ...task('done'), done: true };
  const current = [done, task('unfinished'), { ...task('newly done'), done: true }];
  assert.deepEqual(
    actions.clearCompletedPlanning(current, [done]).map((item) => item.id),
    ['unfinished', 'newly done'],
  );
  assert.throws(
    () => actions.clearCompletedPlanning([{ ...done, revision: 1 }], [done]),
    /changed/,
  );
  assert.equal(current.length, 3);
});
