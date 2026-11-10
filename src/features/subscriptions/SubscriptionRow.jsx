import { MdArchive, MdOpenInNew } from 'react-icons/md';
import { uiText } from 'lib/translations';
import ServiceLogo from './ServiceLogo';
import { currencyDigits } from './subscriptionSchema';
import { cancelBy, dayDistance } from './subscriptionDates';
import { renewSubscription, saveSubscription } from './subscriptionActions';

export default function SubscriptionRow({ item, today, locale, onEdit, change, pending }) {
  const days = dayDistance(today, item.nextDate);
  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: item.currency,
  }).format(item.amount / 10 ** currencyDigits(item.currency));
  const formatDay = (date) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(locale, { dateStyle: 'medium' });
  return (
    <article
      className={`subscriptionRow ${days < 0 && item.status !== 'cancelled' ? 'subscriptionOverdue' : ''}`}
    >
      <button
        type="button"
        className="subscriptionEdit"
        onClick={() => onEdit(item)}
        aria-label={uiText('subscriptions_edit_name', { name: item.name })}
      >
        <ServiceLogo service={item.service} name={item.name} />
        <span className="subscriptionText">
          <strong>{item.name}</strong>
          <span>
            {money} · {uiText(`subscriptions_${item.cycle}`)}
            {item.status === 'trial' ? ` · ${uiText('subscriptions_after_trial')}` : ''}
          </span>
        </span>
      </button>
      <div className="subscriptionDates">
        <span>
          {uiText(item.status === 'trial' ? 'subscriptions_trial_end' : 'subscriptions_next_date')}:{' '}
          <time dateTime={item.nextDate}>{formatDay(item.nextDate)}</time>
        </span>
        {item.status !== 'cancelled' && (
          <span className={cancelBy(item) <= today ? 'subscriptionDue' : ''}>
            {uiText('subscriptions_cancel_by')}:{' '}
            <time dateTime={cancelBy(item)}>{formatDay(cancelBy(item))}</time>
          </span>
        )}
        {days < 0 && item.status !== 'cancelled' && (
          <span>
            {uiText(
              item.status === 'trial' ? 'subscriptions_trial_ended' : 'subscriptions_check_renewal',
            )}
          </span>
        )}
      </div>
      <div className="subscriptionActions">
        {item.status !== 'cancelled' && (
          <>
            <button
              type="button"
              className="gwButton"
              disabled={pending || days > 0}
              onClick={() => change((items) => renewSubscription(items, item, today))}
            >
              {uiText(
                item.status === 'trial' ? 'subscriptions_converted' : 'subscriptions_renewed',
              )}
            </button>
            <button
              type="button"
              className="gwIconButton"
              title={uiText('subscriptions_mark_cancelled')}
              aria-label={uiText('subscriptions_cancel_name', { name: item.name })}
              disabled={pending}
              onClick={() =>
                change((items) => saveSubscription(items, { ...item, status: 'cancelled' }, item))
              }
            >
              <MdArchive />
            </button>
          </>
        )}
        {item.url && (
          <a
            className="subscriptionManage"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={uiText('subscriptions_manage_name', { name: item.name })}
          >
            {uiText('subscriptions_manage')}
            <MdOpenInNew aria-hidden="true" />
          </a>
        )}
      </div>
    </article>
  );
}
