import { assert, test, server } from './regression-fixture.mjs';
const fx = await server.ssrLoadModule('/src/features/subscriptions/subscriptionRates.js');
const { createBackup } = await server.ssrLoadModule('/src/utils/settings/export.js');
const subscription = (currency, amount, status = 'active') => ({
  currency,
  amount,
  cycle: 'monthly',
  status,
});

test('subscription conversion divides quote-per-display rates and keeps original price records intact', () => {
  const item = subscription('USD', 1100);
  const rates = { base: 'EUR', rates: { EUR: 1, USD: 1.1, GBP: 0.8 } };
  assert.equal(fx.convertedSubscriptionPrice(item, rates), 10);
  assert.deepEqual(item, subscription('USD', 1100));
  assert.equal(fx.convertedSubscriptionPrice(subscription('EUR', 1000), rates), 10);
  assert.equal(fx.convertedSubscriptionPrice(subscription('JPY', 1000), rates), null);
  assert.equal(
    fx.convertedSubscriptionTotal(
      [
        item,
        subscription('GBP', 800),
        subscription('USD', 9000, 'trial'),
        subscription('USD', 5000, 'cancelled'),
      ],
      rates,
    ),
    240,
  );
  assert.equal(fx.convertedSubscriptionTotal([subscription('JPY', 1000)], rates), null);
});

test('subscription rates are requested without service names or prices and shared from a daily cache', async () => {
  const original = globalThis.fetch;
  let count = 0;
  globalThis.fetch = async (url, options) => {
    count++;
    const request = new URL(url);
    assert.equal(request.origin, 'https://api.frankfurter.dev');
    assert.equal(request.pathname, '/v2/rates');
    assert.equal(request.searchParams.get('base'), 'EUR');
    assert.equal(request.searchParams.get('quotes'), 'GBP,USD');
    assert.equal(options.credentials, 'omit');
    return new Response(
      JSON.stringify([
        { base: 'EUR', quote: 'USD', rate: 1.1, date: '2026-11-10' },
        { base: 'EUR', quote: 'GBP', rate: 0.8, date: '2026-11-10' },
      ]),
    );
  };
  try {
    const results = await Promise.all([
      fx.loadSubscriptionRates('EUR', ['USD', 'GBP']),
      fx.loadSubscriptionRates('EUR', ['GBP', 'USD']),
    ]);
    assert.equal(count, 1);
    assert.equal(results[0].rates.USD, 1.1);
    assert.equal(results[1].missing.length, 0);
    assert.equal(results[0].dates.USD, '2026-11-10');
    localStorage.setItem('offlineMode', 'true');
    const cached = await fx.loadSubscriptionRates('EUR', ['USD']);
    assert.equal(cached.rates.USD, 1.1);
    assert.equal(count, 1);
    const backup = await createBackup();
    assert.equal(backup.settings.subscriptionsRatesCache, undefined);
  } finally {
    globalThis.fetch = original;
  }
});

test('unsupported currencies remain visibly unconverted and missing rates do not trigger repeated requests', async () => {
  const original = globalThis.fetch;
  let count = 0;
  globalThis.fetch = async () => {
    count++;
    return new Response(
      JSON.stringify([
        { base: 'EUR', quote: 'USD', rate: 1.1, date: '2026-11-10' },
        { base: 'EUR', quote: 'GBP', rate: -1, date: '2026-11-10' },
      ]),
    );
  };
  try {
    const result = await fx.loadSubscriptionRates('EUR', ['GBP', 'USD']);
    assert.deepEqual(result.missing, ['GBP']);
    assert.equal(fx.convertedSubscriptionPrice(subscription('GBP', 1000), result), null);
    await fx.loadSubscriptionRates('EUR', ['GBP', 'USD']);
    assert.equal(count, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test('subscription rate failures keep matching cached rates with their actual date and isolate changed display currencies', async () => {
  const original = globalThis.fetch;
  localStorage.setItem(
    'subscriptionsRatesCache',
    JSON.stringify({
      base: 'EUR',
      updated: Date.now() - 2 * 3600000,
      requested: ['USD'],
      rates: { USD: 1.1 },
      dates: { USD: '2026-11-09' },
    }),
  );
  globalThis.fetch = async () => {
    throw new Error('network');
  };
  try {
    const stale = await fx.loadSubscriptionRates('EUR', ['USD']);
    assert.equal(stale.stale, true);
    assert.equal(stale.rates.USD, 1.1);
    assert.equal(stale.dates.USD, '2026-11-09');
    localStorage.setItem('subscriptionsCurrency', 'GBP');
    const changed = await fx.loadSubscriptionRates('GBP', ['USD']);
    assert.equal(changed.rates.USD, undefined);
    assert.deepEqual(changed.missing, ['USD']);
  } finally {
    globalThis.fetch = original;
  }
});

test('a profile change or aborted request cannot commit a subscription exchange-rate response', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    localStorage.setItem('profileRevision', 'changed');
    return new Response(
      JSON.stringify([{ base: 'EUR', quote: 'USD', rate: 1.1, date: '2026-11-10' }]),
    );
  };
  try {
    await assert.rejects(fx.loadSubscriptionRates('EUR', ['USD']), /Settings changed/);
    assert.equal(localStorage.getItem('subscriptionsRatesCache'), null);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(fx.loadSubscriptionRates('EUR', ['USD'], controller.signal), /abort/i);
  } finally {
    globalThis.fetch = original;
  }
});
