import { MdAutorenew, MdUndo, MdEdit } from 'react-icons/md';
import { uiText } from 'lib/translations';
import ServiceLogo from './ServiceLogo';
import { currencyDigits } from './subscriptionSchema';
import { convertedSubscriptionPrice } from './subscriptionRates';
import { cancelBy, dayDistance } from './subscriptionDates';
import { subscriptionLinkProps } from './subscriptionLinks';
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
  preview,
  noteId,
}) {
  const link = subscriptionLinkProps(item.url);
  const description = preview.active?.id === item.id ? noteId : undefined;
  const Identity = link ? 'div' : 'button';
  const identityProps = link
    ? {}
    : {
        type: 'button',
        onClick: () => onEdit(item),
        'aria-label': uiText('subscriptions_edit_name', { name: item.name }),
      };
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
    <article
      className={`subscriptionRow${link ? ' subscriptionLinked' : ''}`}
      onMouseEnter={(event) => {
        if (item.notes.trim()) preview.open(item.id, event.currentTarget);
        else preview.close();
      }}
      onMouseLeave={preview.leave}
      onFocus={(event) => {
        if (item.notes.trim()) preview.open(item.id, event.target);
        else preview.close();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) preview.leave();
      }}
    >
      {link && (
        <a
          className="subscriptionEntryLink"
          {...link}
          aria-label={uiText('subscriptions_manage_name', { name: item.name })}
          aria-describedby={description}
        />
      )}
      <Identity className="subscriptionLogoEdit" {...identityProps} aria-describedby={description}>
        <ServiceLogo service={item.service} name={item.name} />
      </Identity>
      <Identity className="subscriptionEdit" {...identityProps} aria-describedby={description}>
        <strong title={item.name}>{item.name}</strong>
        <span title={originalMoney}>
          {money} · {uiText(`subscriptions_${item.cycle}`)}
        </span>
      </Identity>
      <div className="subscriptionAside">
        <div className="subscriptionRenewalLine">
          <time
            className="subscriptionRenewal"
            dateTime={item.nextDate}
            title={`${renewalLabel}: ${item.nextDate}`}
          >
            {formatDay(item.nextDate)}
          </time>
          <button
            type="button"
            className="gwIconButton subscriptionEditAction"
            title={uiText('subscriptions_edit')}
            aria-label={uiText('subscriptions_edit_name', { name: item.name })}
            onClick={() => onEdit(item)}
          >
            <MdEdit />
          </button>
        </div>
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
