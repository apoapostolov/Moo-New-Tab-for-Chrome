import { assert, test, server, importSettings } from './regression-fixture.mjs';

const dates = await server.ssrLoadModule('/src/features/subscriptions/subscriptionDates.js');
const schema = await server.ssrLoadModule('/src/features/subscriptions/subscriptionSchema.js');
const actions = await server.ssrLoadModule('/src/features/subscriptions/subscriptionActions.js');
const store = await server.ssrLoadModule('/src/features/subscriptions/subscriptionStore.js');
const logos = await server.ssrLoadModule('/src/features/subscriptions/serviceLogos.js');
const { createBackup } = await server.ssrLoadModule('/src/utils/settings/export.js');
const { validateSettings } = await server.ssrLoadModule('/src/utils/settings/backupSchema.js');
const widgets = await server.ssrLoadModule('/src/utils/widgets.js');
const item = (id, patch = {}) => ({
  id,
  name: id,
  amount: 999,
  currency: 'EUR',
  cycle: 'monthly',
  status: 'active',
  nextDate: '2027-01-31',
  anchorDay: 31,
  noticeDays: 3,
  url: '',
  notes: '',
  service: '',
  revision: 0,
  ...patch,
});

test('subscription billing cycles keep original month-end and leap-day anchors', () => {
  const jan = item('month');
  assert.equal(dates.advanceRenewal(jan, '2027-01-31'), '2027-02-28');
  assert.equal(
    dates.advanceRenewal({ ...jan, nextDate: '2027-02-28' }, '2027-02-28'),
    '2027-03-31',
  );
  assert.equal(
    dates.advanceRenewal(
      item('leap', { cycle: 'yearly', nextDate: '2028-02-29', anchorDay: 29 }),
      '2028-02-29',
    ),
    '2029-02-28',
  );
  assert.equal(
    dates.advanceRenewal(
      item('leap', { cycle: 'yearly', nextDate: '2029-02-28', anchorDay: 29 }),
      '2031-04-01',
    ),
    '2032-02-29',
  );
  assert.equal(dates.advanceRenewal(item('q', { cycle: 'quarterly' }), '2027-01-31'), '2027-04-30');
  assert.equal(
    dates.advanceRenewal(item('w', { cycle: 'weekly', nextDate: '2027-01-01' }), '2027-01-22'),
    '2027-01-29',
  );
  assert.equal(dates.advanceRenewal(jan, '2030-03-30'), '2030-03-31');
});

test('subscription dates understand human phrases and reject partial, impossible or competing dates', () => {
  for (const [value, expected] of [
    ['today', '2026-11-10'],
    ['tomorrow', '2026-11-11'],
    ['in 3 days', '2026-11-13'],
    ['2028-02-29', '2028-02-29'],
  ])
    assert.equal(dates.parseSubscriptionDay(value, '2026-11-10'), expected);
  for (const value of ['', 'later', '2027-02-29', 'tomorrow or Friday', 'in 2.5 days'])
    assert.equal(dates.parseSubscriptionDay(value, '2026-11-10'), null);
  assert.equal(dates.cancelBy(item('x')), '2027-01-28');
  assert.equal(dates.dayDistance('2027-03-27', '2027-03-29'), 2);
});

test('prices use currency precision and summaries never mix currencies or include trials/cancelled plans', () => {
  assert.equal(schema.parseAmount('9,99', 'EUR'), 999);
  assert.equal(schema.parseAmount('1500', 'JPY'), 1500);
  assert.equal(schema.parseAmount('1.234', 'KWD'), 1234);
  for (const [price, currency] of [
    ['9.999', 'EUR'],
    ['9.1', 'JPY'],
    ['-1', 'USD'],
    ['1e3', 'USD'],
    ['2', 'BAD'],
  ])
    assert.equal(schema.parseAmount(price, currency), null);
  const totals = actions.subscriptionTotals([
    item('eur'),
    item('usd', { currency: 'USD', amount: 12000, cycle: 'yearly' }),
    item('trial', { status: 'trial', amount: 50000 }),
    item('cancel', { status: 'cancelled' }),
  ]);
  assert.equal(totals.length, 2);
  assert(Math.abs(totals[0][1] - 119.88) < 1e-9);
  assert.deepEqual(totals[1], ['USD', 120]);
});

test('subscription deadlines include overdue entries and archive excludes cancelled services', () => {
  const all = [
    item('future'),
    item('trial', { status: 'trial', nextDate: '2026-11-11', anchorDay: 11 }),
    item('old', { nextDate: '2026-10-01' }),
    item('cancel', { status: 'cancelled' }),
  ];
  assert.deepEqual(
    actions.visibleSubscriptions(all, 'upcoming', '2026-11-10').map((entry) => entry.id),
    ['old', 'trial'],
  );
  assert.equal(actions.visibleSubscriptions(all, 'all', '2026-11-10').length, 3);
  assert.equal(actions.visibleSubscriptions(all, 'cancelled', '2026-11-10')[0].id, 'cancel');
  const renewed = actions.renewSubscription([all[1]], all[1], '2026-11-11')[0];
  assert.equal(renewed.status, 'active');
  assert.equal(renewed.nextDate, '2026-12-11');
  assert.equal(renewed.revision, 1);
});

test('subscription records reject executable URLs, duplicate ids and invalid prices before saving or importing', () => {
  assert(schema.validSubscriptions([item('x')]));
  for (const patch of [
    { url: 'javascript:alert(1)' },
    { url: 'https://user:secret@example.com' },
    { service: '../bad' },
    { amount: 1.5 },
    { nextDate: '2026-02-30' },
    { noticeDays: 366 },
    { currency: 'BAD' },
  ])
    assert.equal(schema.validSubscriptions([item('x', patch)]), false);
  assert.equal(schema.validSubscriptions([item('x'), item('x')]), false);
  assert.throws(
    () => validateSettings({ subscriptionsData: JSON.stringify([item('x', { amount: -1 })]) }),
    /not valid/,
  );
});

test('subscription writes merge concurrent additions, reject stale edits and preserve damaged data', async () => {
  await Promise.all(
    Array.from({ length: 10 }, (_, n) =>
      store.updateSubscriptions((items) => actions.saveSubscription(items, item(String(n)), null)),
    ),
  );
  assert.equal(store.readSubscriptions().items.length, 10);
  const original = store.readSubscriptions().items[0];
  await store.updateSubscriptions((items) =>
    actions.saveSubscription(items, { ...original, name: 'Newer' }, original),
  );
  await assert.rejects(
    store.updateSubscriptions((items) => actions.removeSubscription(items, original)),
    /changed/,
  );
  assert.equal(store.readSubscriptions().items[0].name, 'Newer');
  localStorage.setItem('subscriptionsData', '[damaged');
  await assert.rejects(
    store.updateSubscriptions(() => []),
    /damaged/,
  );
  assert.equal(localStorage.getItem('subscriptionsData'), '[damaged');
});

test('failed subscription writes preserve the original data and currency preferences are validated', async () => {
  localStorage.setItem('subscriptionsData', JSON.stringify([item('x')]));
  const original = localStorage.getItem('subscriptionsData');
  const set = localStorage.setItem;
  localStorage.setItem = () => {
    throw new Error('quota');
  };
  try {
    await assert.rejects(
      store.updateSubscriptions(() => []),
      /quota/,
    );
    assert.equal(localStorage.getItem('subscriptionsData'), original);
  } finally {
    localStorage.setItem = set;
    delete localStorage.setItem;
  }
  assert.throws(() => validateSettings({ subscriptionsCurrency: 'BAD' }), /currency/);
  assert.throws(() => validateSettings({ googleDriveMax: '5.5' }), /whole number/);
});

test('subscription records, artwork choice, Google Drive settings and Focus placement survive backups', async () => {
  const data = JSON.stringify([
    item('x', { service: 'netflix', url: 'https://netflix.com/account' }),
  ]);
  Object.entries({
    subscriptionsData: data,
    subscriptionsEnabled: 'true',
    surfaceSubscriptions: 'glass',
    subscriptionsRemoteIcons: 'false',
    googleDriveEnabled: 'true',
    surfaceDrive: 'glass',
    googleDriveMax: '20',
  }).forEach(([key, value]) => localStorage.setItem(key, value));
  widgets.setWidgetEnabled('subscriptions', true, 'focus');
  widgets.savePlacement({ subscriptions: 'top-right', drive: 'top-left' }, 'focus');
  const backup = await createBackup();
  localStorage.clear();
  await importSettings(JSON.stringify(backup));
  assert.equal(localStorage.getItem('subscriptionsData'), data);
  assert.equal(localStorage.getItem('googleDriveMax'), '20');
  assert.equal(widgets.isWidgetEnabled('subscriptions', 'focus'), true);
  assert.equal(widgets.readPlacement('focus').drive, 'top-left');
});

test('service logo library finds brands, uses bundled artwork offline and never invents remote URLs', () => {
  assert.equal(logos.findService('Netflix'), 'netflix');
  assert(logos.searchServices('spotify').includes('spotify'));
  assert(logos.serviceLogo('netflix', false).endsWith('/subscription-icons/netflix.svg'));
  const nonBundled = logos.searchServices('8311')[0];
  assert.equal(logos.serviceLogo(nonBundled, false), '');
  assert(
    logos
      .serviceLogo(nonBundled, true)
      .startsWith('https://raw.githubusercontent.com/homarr-labs/dashboard-icons/'),
  );
  assert.equal(logos.serviceLogo('../unknown', true), '');
});
