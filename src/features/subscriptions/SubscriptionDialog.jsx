import { useId, useState } from 'react';
import { uiText } from 'lib/translations';
import Dialog from '../google/components/Dialog';
import { currencyDigits, parseAmount, safeManageUrl, validCurrency } from './subscriptionSchema';
import { localDay, validDay } from './subscriptionDates';
import { saveSubscription, removeSubscription } from './subscriptionActions';
import SubscriptionFields from './SubscriptionFields';
import { subscriptionLinkProps } from './subscriptionLinks';

export default function SubscriptionDialog({ item, change, pending, error, onClose }) {
  const id = useId();
  const [draft, setDraft] = useState(() => ({
    name: '',
    price: '',
    currency: localStorage.getItem('subscriptionsCurrency') || 'EUR',
    cycle: 'monthly',
    status: 'active',
    noticeDays: '3',
    url: '',
    notes: '',
    service: '',
    ...item,
    ...(item ? { price: String(item.amount / 10 ** currencyDigits(item.currency)) } : {}),
  }));
  const [when, setWhen] = useState(item?.nextDate || localDay());
  const [invalid, setInvalid] = useState(false);
  const [armed, setArmed] = useState(false);
  const set = (key, value) => {
    setDraft((old) => ({ ...old, [key]: value }));
    setInvalid(false);
  };
  const date = validDay(when) ? when : null;
  const manageLink = subscriptionLinkProps(item?.url);
  const save = async (event) => {
    event.preventDefault();
    const amount = parseAmount(draft.price, draft.currency);
    if (
      !date ||
      amount === null ||
      !validCurrency(draft.currency) ||
      (draft.url && !safeManageUrl(draft.url))
    ) {
      setInvalid(true);
      return;
    }
    const next = {
      ...draft,
      amount,
      nextDate: date,
      noticeDays: Number(draft.noticeDays),
      anchorDay: item && date === item.nextDate ? item.anchorDay : Number(date.slice(-2)),
    };
    delete next.price;
    if (await change((items) => saveSubscription(items, next, item))) onClose();
  };
  return (
    <Dialog
      title={uiText(item ? 'subscriptions_edit' : 'subscriptions_add')}
      onClose={onClose}
      footer={
        <>
          {item && (
            <button
              type="button"
              className="gwButton danger"
              disabled={pending}
              onClick={async () => {
                if (!armed) setArmed(true);
                else if (await change((items) => removeSubscription(items, item))) onClose();
              }}
            >
              {uiText(armed ? 'subscriptions_confirm_delete' : 'subscriptions_delete')}
            </button>
          )}
          {manageLink && (
            <a className="gwButton" {...manageLink}>
              {uiText('subscriptions_manage')}
            </a>
          )}
          <span className="gwSpacer" />
          <button type="button" className="gwButton" onClick={onClose}>
            {uiText('portfolio_cancel')}
          </button>
          <button type="submit" form={id} className="gwButton primary" disabled={pending}>
            {uiText('subscriptions_save')}
          </button>
        </>
      }
    >
      <form id={id} className="gwForm subscriptionForm" onSubmit={save}>
        <SubscriptionFields {...{ draft, set, when, setWhen, date, invalid }} />
        <p className="subscriptionHint">{uiText('subscriptions_manual_hint')}</p>
        {(invalid || error) && (
          <p className="gwError" role="alert">
            {invalid ? uiText('subscriptions_invalid') : error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
