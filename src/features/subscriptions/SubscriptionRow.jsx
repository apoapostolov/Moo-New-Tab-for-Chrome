import { MdAutorenew, MdUndo } from 'react-icons/md';
import { uiText } from 'lib/translations';
import ServiceLogo from './ServiceLogo';
import { currencyDigits } from './subscriptionSchema';
import { convertedSubscriptionPrice } from './subscriptionRates';
import { cancelBy, dayDistance } from './subscriptionDates';
import { renewSubscription } from './subscriptionActions';

export default function SubscriptionRow({
  item,
  today,
  locale,
  onEdit,
  change,
  pending,
  onStatus,
  fx,
}) {
  const original = item.amount / 10 ** currencyDigits(item.currency);
  const converted = convertedSubscriptionPrice(item, fx);
  const currency = converted === null ? item.currency : fx.base;
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
    converted === null ? original : converted,
  );
  const originalMoney = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: item.currency,
  }).format(original);
  const formatDay = (date) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const renewalLabel = uiText(
    item.status === 'trial'
      ? 'subscriptions_trial_end'
      : item.status === 'cancelled'
        ? 'subscriptions_ends'
        : 'subscriptions_next_date',
  );
  return (
    <article className="subscriptionRow">
      <button
        type="button"
        className="subscriptionLogoEdit"
        onClick={() => onEdit(item)}
        aria-label={uiText('subscriptions_edit_name', { name: item.name })}
      >
        <ServiceLogo service={item.service} name={item.name} />
      </button>
      <button
        type="button"
        className="subscriptionEdit"
        onClick={() => onEdit(item)}
        aria-label={uiText('subscriptions_edit_name', { name: item.name })}
      >
        <strong title={item.name}>{item.name}</strong>
        <span title={originalMoney}>
          {money} · {uiText(`subscriptions_${item.cycle}`)}
        </span>
      </button>
      <div className="subscriptionAside">
        <time
          className="subscriptionRenewal"
          dateTime={item.nextDate}
          title={`${renewalLabel}: ${item.nextDate}`}
        >
          {formatDay(item.nextDate)}
        </time>
        <div className="subscriptionStatusLine">
          {item.status === 'cancelled' ? (
            <>
              <time dateTime={cancelBy(item)} title={cancelBy(item)}>
                {uiText('subscriptions_cancel_by')}: {formatDay(cancelBy(item))}
              </time>
              <button
                type="button"
                className="gwIconButton"
                disabled={pending}
                onClick={() => onStatus(item, 'active')}
                title={uiText('subscriptions_undo_cancel')}
                aria-label={uiText('subscriptions_undo_cancel_name', { name: item.name })}
              >
                <MdUndo />
              </button>
            </>
          ) : (
            <>
              <select
                value={item.status}
                disabled={pending}
                onChange={(event) => onStatus(item, event.target.value)}
                aria-label={uiText('subscriptions_status_name', { name: item.name })}
              >
                {item.status === 'trial' && (
                  <option value="trial">{uiText('subscriptions_trial')}</option>
                )}
                <option value="active">{uiText('subscriptions_active')}</option>
                <option value="cancelled">{uiText('subscriptions_cancelled')}</option>
              </select>
              <button
                type="button"
                className="gwIconButton"
                disabled={pending || dayDistance(today, item.nextDate) > 0}
                onClick={() => change((items) => renewSubscription(items, item, today))}
                title={uiText('subscriptions_record_renewal')}
                aria-label={uiText('subscriptions_record_renewal_name', { name: item.name })}
              >
                <MdAutorenew />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
