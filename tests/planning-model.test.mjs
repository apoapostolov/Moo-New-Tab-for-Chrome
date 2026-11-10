import { assert, test, server, parseNatural } from './regression-fixture.mjs';

const dates = await server.ssrLoadModule('/src/features/planning/planningDates.js');
const natural = await server.ssrLoadModule('/src/features/planning/planningNatural.js');
const schema = await server.ssrLoadModule('/src/features/planning/planningSchema.js');
const actions = await server.ssrLoadModule('/src/features/planning/planningActions.js');
const { planningGroups } = await server.ssrLoadModule('/src/features/planning/planningView.js');
const today = '2026-11-10';
const task = (id, extra = {}) => ({
  id,
  title: id,
  notes: '',
  date: today,
  minutes: 0,
  priority: false,
  done: false,
  revision: 0,
  ...extra,
});

test('Planning and Tasks share relative dates, title extraction and local-calendar days', () => {
  for (const [phrase, expected] of [
    ['today', today],
    ['tomorrow', '2026-11-11'],
    ['in 3 days', '2026-11-13'],
    ['in three days', '2026-11-13'],
    ['day after tomorrow', '2026-11-12'],
    ['Monday', '2026-11-16'],
  ]) {
    const value = natural.parsePlanInput(`Call Mum ${phrase}`, null, today);
    assert.equal(value.title, 'Call Mum');
    assert.equal(value.date, expected);
    assert.equal(value.ambiguous, false);
    const google = parseNatural(`Call Mum ${phrase}`, {
      now: new Date(2026, 10, 10, 23, 55),
      kind: 'task',
    });
    assert.equal(dates.planningDay(google.date), expected);
    assert.equal(google.title, 'Call Mum');
  }
});

test('Planning preserves literal text and refuses ambiguous or invalid dates', () => {
  assert.deepEqual(natural.parsePlanInput('"Read Tomorrow"', null, today), {
    title: 'Read Tomorrow',
    date: null,
    explicit: false,
    ambiguous: false,
  });
  assert.equal(natural.parsePlanInput('Buy 3 apples', today, today).title, 'Buy 3 apples');
  assert.equal(natural.parsePlanInput('Compare today and tomorrow', today, today).ambiguous, true);
  assert.equal(natural.parsePlanInput('Pay rent 2026-02-30', today, today).invalid, true);
  assert.equal(natural.parsePlanInput('Pay rent in 1.5 days', today, today).invalid, true);
  assert.equal(natural.parsePlanInput('Plan in 10001 days', today, today).invalid, true);
  assert.equal(natural.parsePlanWhen('in 3 days', today).date, '2026-11-13');
  assert.equal(natural.parsePlanWhen('in 3 days please', today).valid, false);
  assert.deepEqual(natural.parsePlanWhen('', today), { valid: true, date: null });
});

test('Planning crosses month/year, leap days and DST without adding UTC offsets to dates', () => {
  for (const [day, next] of [
    ['2026-12-31', '2027-01-01'],
    ['2028-02-28', '2028-02-29'],
    ['2028-02-29', '2028-03-01'],
    ['2026-03-29', '2026-03-30'],
    ['2026-10-25', '2026-10-26'],
  ]) {
    assert.equal(dates.nextPlanDay(day), next);
    assert.equal(natural.parsePlanInput('Call tomorrow', null, day).date, next);
  }
  assert.equal(dates.planningDay(new Date(2026, 10, 10, 0, 1)), today);
  assert.equal(dates.validPlanDay('2026-02-29'), false);
  assert.equal(dates.planDate('today', '2026-11-11'), '2026-11-11');
  assert.equal(dates.planDate('tomorrow', '2026-11-11'), '2026-11-12');
});

test('Planning validates task contents, bounded estimates, unique identities and daily priorities', () => {
  assert.equal(schema.validPlanning([task('a')]), true);
  assert.equal(schema.validPlanning([task('a'), task('a')]), false);
  for (const extra of [
    { title: ' ' },
    { title: 'a'.repeat(201) },
    { notes: 'a'.repeat(2001) },
    { minutes: -1 },
    { minutes: 1441 },
    { minutes: 0.5 },
    { date: '2026-02-30' },
    { date: null, priority: true },
    { revision: -1 },
  ]) {
    assert.equal(schema.validPlanning([task('a', extra)]), false, JSON.stringify(extra));
  }
  assert.equal(schema.validPlanning(Array.from({ length: 501 }, (_, i) => task(String(i)))), false);
});

test('three priorities belong to a day and carrying a task invites a new priority decision', () => {
  const items = ['a', 'b', 'c', 'd'].map((id) => task(id, { priority: id !== 'd' }));
  assert.throws(() => actions.changePlanTask(items, 'd', 0, { priority: true }), /priority/);
  const moved = actions.changePlanTask(items, 'a', 0, { date: '2026-11-11' });
  assert.equal(moved[0].priority, false);
  assert.equal(actions.changePlanTask(moved, 'd', 0, { priority: true })[3].priority, true);
  assert.equal(items[0].date, today);
  assert.equal(schema.validPlanning(moved), true);
});

test('reordering is confined to a day/group and delete undo restores the original task position', () => {
  const items = [task('a'), task('other', { date: null }), task('b')];
  const next = actions.reorderPlanTask(items, 'a', 0, 1);
  assert.deepEqual(
    next.map((item) => item.id),
    ['b', 'other', 'a'],
  );
  assert.equal(next[2].revision, 1);
  assert.throws(() => actions.changePlanTask(next, 'a', 0, { title: 'Stale' }), /changed/);
  const removed = actions.removePlanTask(items, 'a', 0);
  assert.deepEqual(actions.restorePlanTask(removed, items[0], 0), items);
  assert.throws(() => actions.restorePlanTask(items, items[0], 0), /changed/);
});

test('a new day keeps unfinished tasks in review rather than silently filling today', () => {
  const items = [
    task('Yesterday', { date: '2026-11-09', priority: true }),
    task('Tomorrow', { date: '2026-11-11' }),
    task('Done today', { done: true }),
  ];
  const view = planningGroups(items, today, today);
  assert.deepEqual(view.active, []);
  assert.deepEqual(
    view.earlier.map((item) => item.title),
    ['Yesterday'],
  );
  assert.deepEqual(
    view.done.map((item) => item.title),
    ['Done today'],
  );
  assert.deepEqual(planningGroups(items, null, today).earlier, []);
  assert.equal(items[0].date, '2026-11-09');
});
