import { uiText } from 'lib/translations';
import { convertedSubscriptionTotal } from './subscriptionRates';

export default function SubscriptionTotals({ items, fx, locale }) {
  if (!items.some((item) => item.status === 'active')) return null;
  const yearly = convertedSubscriptionTotal(items, fx);
  const money = (value) =>
    value === null
      ? '—'
      : new Intl.NumberFormat(locale, { style: 'currency', currency: fx.base }).format(value);
  const dates = [...new Set(Object.values(fx.dates))].sort().join(', ');
  const title = fx.loading
    ? uiText('subscriptions_rates_loading')
    : yearly === null
      ? uiText('subscriptions_rates_missing', { currencies: fx.missing.join(', ') })
      : dates
        ? uiText(fx.stale ? 'subscriptions_rates_saved' : 'subscriptions_rates_date', {
            date: dates,
          })
        : '';
  return (
    <div className="subscriptionTotals" aria-busy={fx.loading || undefined} title={title}>
      <p>
        {money(yearly === null ? null : yearly / 12)} {uiText('subscriptions_per_month')} ·{' '}
        {money(yearly)} {uiText('subscriptions_per_year')}
      </p>
    </div>
  );
}
