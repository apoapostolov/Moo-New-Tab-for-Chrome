import { fetchWithTimeout, withLock } from 'utils/requests';
import { currencyDigits, validCurrency } from './subscriptionSchema';
import { localDay, validDay } from './subscriptionDates';

export const displayCurrency = () => {
  const currency = localStorage.getItem('subscriptionsCurrency');
  return validCurrency(currency) ? currency : 'EUR';
};
export function readSubscriptionRates() {
  try {
    const cache = JSON.parse(localStorage.getItem('subscriptionsRatesCache') || 'null');
    if (
      !validCurrency(cache?.base) ||
      !Number.isFinite(cache.updated) ||
      !Array.isArray(cache.requested) ||
      !cache.requested.every(validCurrency) ||
      !cache.rates ||
      !cache.dates
    )
      return null;
    return Object.entries(cache.rates).every(
      ([code, rate]) =>
        validCurrency(code) && Number.isFinite(rate) && rate > 0 && validDay(cache.dates[code]),
    )
      ? cache
      : null;
  } catch {
    return null;
  }
}
export function subscriptionRateResult(cache, base, needed, stale = false) {
  const matching = cache?.base === base ? cache : null;
  return {
    base,
    rates: { [base]: 1, ...(matching?.rates || {}) },
    dates: matching?.dates || {},
    stale,
    missing: needed.filter((currency) => currency !== base && !matching?.rates[currency]),
  };
}
export async function loadSubscriptionRates(base, currencies, signal) {
  const needed = [...new Set(currencies)].filter((currency) => currency !== base).sort();
  if (!needed.length) return subscriptionRateResult(null, base, []);
  return withLock('moo-subscription-rates', async () => {
    signal?.throwIfAborted();
    const cache = readSubscriptionRates();
    const matching =
      cache?.base === base && needed.every((currency) => cache.requested.includes(currency));
    const fresh =
      matching &&
      cache.updated <= Date.now() &&
      localDay(new Date(cache.updated)) === localDay() &&
      Date.now() - cache.updated < 3600000;
    if (fresh) return subscriptionRateResult(cache, base, needed);
    if (localStorage.getItem('offlineMode') === 'true')
      return subscriptionRateResult(cache, base, needed, true);
    const profile = localStorage.getItem('profileRevision');
    try {
      const params = new URLSearchParams({ base, quotes: needed.join(',') });
      const response = await fetchWithTimeout(`https://api.frankfurter.dev/v2/rates?${params}`, {
        signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      if (!response.ok) throw new Error('rates');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('rates');
      const next = { base, updated: Date.now(), requested: needed, rates: {}, dates: {} };
      for (const row of rows) {
        if (
          row.base !== base ||
          !needed.includes(row.quote) ||
          !Number.isFinite(row.rate) ||
          row.rate <= 0 ||
          !validDay(row.date)
        )
          continue;
        next.rates[row.quote] = row.rate;
        next.dates[row.quote] = row.date;
      }
      signal?.throwIfAborted();
      if (profile !== localStorage.getItem('profileRevision') || base !== displayCurrency())
        throw new DOMException('Settings changed', 'AbortError');
      try {
        localStorage.setItem('subscriptionsRatesCache', JSON.stringify(next));
      } catch {
        /* Conversion can still be displayed without a disk cache. */
      }
      return subscriptionRateResult(next, base, needed);
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      signal?.throwIfAborted();
      return subscriptionRateResult(cache, base, needed, true);
    }
  });
}
export function convertedSubscriptionPrice(item, fx) {
  const original = item.amount / 10 ** currencyDigits(item.currency);
  if (item.currency === fx.base) return original;
  const rate = fx.rates[item.currency];
  return Number.isFinite(rate) && rate > 0 ? original / rate : null;
}
export function convertedSubscriptionTotal(items, fx) {
  let total = 0;
  for (const item of items.filter((entry) => entry.status === 'active')) {
    const price = convertedSubscriptionPrice(item, fx);
    if (price === null) return null;
    total += price * { monthly: 12, yearly: 1, quarterly: 4, weekly: 52 }[item.cycle];
  }
  return Number.isFinite(total) ? total : null;
}
