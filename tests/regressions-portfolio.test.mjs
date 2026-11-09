import { assert, test, server } from './regression-fixture.mjs';

test('portfolio totals convert currencies, distinguish daily movement and reject incomplete valuations', async () => {
  const { portfolioTotals, validHolding, readHoldingsState } = await server.ssrLoadModule(
    '/src/features/portfolio/portfolioStore.js',
  );
  const holdings = [
    { symbol: 'AAA', shares: 2, cost: 8 },
    { symbol: 'BBB', shares: 1, cost: 20 },
  ];
  const quotes = {
    AAA: { price: 10, previous: 9, currency: 'USD' },
    BBB: { price: 24, previous: 25, currency: 'EUR' },
  };
  const result = portfolioTotals(holdings, quotes, 'EUR', { USD: 1, EUR: 0.8 });
  assert.equal(result.complete, true);
  assert.ok(Math.abs(result.value - 40) < 0.001);
  assert.ok(Math.abs(result.day - 0.6) < 0.001);
  assert.ok(Math.abs(result.profit - 7.2) < 0.001);
  assert.equal(portfolioTotals(holdings, quotes, 'EUR', { USD: 1 }).complete, false);
  assert.equal(portfolioTotals(holdings, { AAA: quotes.AAA }, 'USD').complete, false);
  const pence = portfolioTotals(
    [{ symbol: 'UK', shares: 1, cost: null }],
    { UK: { price: 250, previous: 200, currency: 'GBX' } },
    'GBP',
    { USD: 1, GBP: 0.8 },
  );
  assert.equal(pence.value, 2.5);
  assert.equal(validHolding({ symbol: 'AAPL', shares: 0, cost: null }), false);
  localStorage.setItem('portfolioHoldings', '[{"symbol":"AAA","shares":-5}]');
  assert.deepEqual(readHoldingsState(), { holdings: [], damaged: true });
  assert.equal(localStorage.getItem('portfolioHoldings'), '[{"symbol":"AAA","shares":-5}]');
  const { isCredential, validateSettings } = await server.ssrLoadModule(
    '/src/utils/settings/backupSchema.js',
  );
  assert.equal(isCredential('portfolioFinnhubApiKey'), true);
  assert.throws(() => validateSettings({ portfolioHoldings: '[{"symbol":"AAA","shares":-5}]' }));
});

test('Finnhub AAPL quotes and currency use browser-compatible authentication without caching credentials', async () => {
  const { loadPortfolio } = await server.ssrLoadModule('/src/features/portfolio/portfolioStore.js');
  const originalFetch = globalThis.fetch;
  const holding = [{ symbol: 'AAPL', shares: 2, cost: null }];
  localStorage.setItem('portfolioHoldings', JSON.stringify(holding));
  localStorage.setItem('portfolioProvider', 'finnhub');
  localStorage.setItem('portfolioFinnhubApiKey', 'fixture-secret');
  const paths = [];
  try {
    globalThis.fetch = async (url, options) => {
      const request = new URL(url);
      assert.equal(request.searchParams.get('symbol'), 'AAPL');
      assert.equal(request.searchParams.get('token'), 'fixture-secret');
      assert.ok(!options.headers || !Object.keys(options.headers).length);
      paths.push(request.pathname);
      return {
        ok: true,
        json: async () =>
          request.pathname.endsWith('/quote')
            ? { c: 250, pc: 245, t: 1793188800 }
            : { currency: 'USD', ticker: 'AAPL' },
      };
    };
    const result = await loadPortfolio(holding, 'finnhub', true);
    assert.deepEqual(result.failed, []);
    assert.equal(result.quotes['AAPL|'].price, 250);
    assert.equal(result.quotes['AAPL|'].currency, 'USD');
    assert.deepEqual(paths, ['/api/v1/quote', '/api/v1/stock/profile2']);
    assert.ok(!localStorage.getItem('portfolioQuoteCache').includes('fixture-secret'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('portfolio quote cache respects the selected listing and does not expose API keys', async () => {
  const { loadPortfolio } = await server.ssrLoadModule('/src/features/portfolio/portfolioStore.js');
  const originalFetch = globalThis.fetch;
  const holding = [{ symbol: 'ABC', exchange: 'XNAS', shares: 2, cost: null }];
  localStorage.setItem('portfolioHoldings', JSON.stringify(holding));
  localStorage.setItem('portfolioProvider', 'twelvedata');
  localStorage.setItem('portfolioTwelveDataApiKey', 'fixture-secret');
  let count = 0;
  try {
    globalThis.fetch = async (url, options) => {
      count += 1;
      assert.equal(new URL(url).searchParams.get('mic_code'), 'XNAS');
      assert.equal(options.headers.Authorization, 'apikey fixture-secret');
      return {
        ok: true,
        json: async () => ({ close: '10', previous_close: '9', currency: 'USD', mic_code: 'XNAS' }),
      };
    };
    const first = await loadPortfolio(holding, 'twelvedata');
    assert.equal(first.quotes['ABC|XNAS'].price, 10);
    assert.equal((await loadPortfolio(holding, 'twelvedata')).quotes['ABC|XNAS'].price, 10);
    assert.equal(count, 1);
    assert.ok(!localStorage.getItem('portfolioQuoteCache').includes('fixture-secret'));
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ close: '10', currency: 'USD', mic_code: 'XLON' }),
    });
    assert.deepEqual((await loadPortfolio(holding, 'twelvedata', true)).failed, ['ABC (XNAS)']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('portfolio exchange rates are cached locally and derive lev from the fixed euro rate', async () => {
  const { loadRates } = await server.ssrLoadModule('/src/features/portfolio/portfolioStore.js');
  const originalFetch = globalThis.fetch;
  let requests = 0;
  try {
    globalThis.fetch = async () => {
      requests += 1;
      return {
        ok: true,
        json: async () => ({ base: 'USD', date: '2026-10-26', rates: { EUR: 0.8, GBP: 0.7 } }),
      };
    };
    const rates = await loadRates();
    assert.ok(Math.abs(rates.rates.BGN - 0.8 * 1.95583) < 0.000001);
    assert.equal((await loadRates()).date, '2026-10-26');
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
