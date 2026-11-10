import { useState } from 'react';
import { MdAdd } from 'react-icons/md';
import { WidgetShell, IconButton } from 'features/widgetKit/WidgetKit';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { uiText } from 'lib/translations';
import useSubscriptions from './useSubscriptions';
import { saveSubscription, visibleSubscriptions } from './subscriptionActions';
import SubscriptionRow from './SubscriptionRow';
import SubscriptionDialog from './SubscriptionDialog';
import useSubscriptionRates from './useSubscriptionRates';
import SubscriptionTotals from './SubscriptionTotals';
import { cancelBy } from './subscriptionDates';
import './subscriptions.scss';

export default function Subscriptions() {
  const { language } = useTranslationVersion();
  const locale = language.replaceAll('_', '-');
  const state = useSubscriptions();
  const fx = useSubscriptionRates(state.items, state.today);
  const [retained, setRetained] = useState([]);
  const [view, setView] = useState('upcoming');
  const [editing, setEditing] = useState(null);
  const visible = visibleSubscriptions(state.items, view, state.today);
  const rows = [
    ...visible,
    ...state.items.filter(
      (item) => retained.includes(item.id) && !visible.some((entry) => entry.id === item.id),
    ),
  ].sort((a, b) => cancelBy(a).localeCompare(cancelBy(b)) || a.name.localeCompare(b.name));
  const missing = fx.missing.filter(
    (currency) =>
      state.items.some((item) => item.status === 'active' && item.currency === currency) ||
      rows.some((item) => item.currency === currency),
  );
  const onStatus = async (item, status) => {
    setRetained((old) => [...new Set([...old, item.id])]);
    await state.change((items) => saveSubscription(items, { ...item, status }, item));
  };
  return (
    <WidgetShell
      widget="subscriptions"
      showSettings={false}
      title={uiText('subscriptions_title')}
      error={
        state.error ||
        (!fx.loading && missing.length
          ? uiText('subscriptions_rates_missing', { currencies: missing.join(', ') })
          : null)
      }
      className="subscriptionsWidget"
      actions={
        <IconButton
          label={uiText('subscriptions_add')}
          disabled={state.damaged}
          onClick={() => setEditing({ item: null })}
        >
          <MdAdd />
        </IconButton>
      }
    >
      {state.damaged ? (
        <p role="alert" className="wkEmpty">
          {uiText('subscriptions_error_damaged')}
        </p>
      ) : (
        <>
          <SubscriptionTotals items={state.items} fx={fx} locale={locale} />
          <div className="subscriptionTabs" role="group" aria-label={uiText('subscriptions_view')}>
            {['upcoming', 'all', 'cancelled'].map((id) => (
              <button
                type="button"
                key={id}
                aria-pressed={view === id}
                onClick={() => {
                  if (view !== id) setRetained([]);
                  setView(id);
                }}
              >
                {uiText(`subscriptions_${id}`)}
              </button>
            ))}
          </div>
          <div className="subscriptionList">
            {rows.map((item) => (
              <SubscriptionRow
                key={item.id}
                item={item}
                today={state.today}
                locale={locale}
                onEdit={(entry) => setEditing({ item: entry })}
                change={state.change}
                pending={state.pending}
                onStatus={onStatus}
                fx={fx}
              />
            ))}
          </div>
          {!rows.length && (
            <p className="wkEmpty">
              {uiText(state.items.length ? 'subscriptions_empty_view' : 'subscriptions_empty')}
            </p>
          )}
        </>
      )}
      {editing && (
        <SubscriptionDialog
          key={editing.item?.id || 'new'}
          item={editing.item}
          change={state.change}
          pending={state.pending}
          error={state.error}
          onClose={() => setEditing(null)}
        />
      )}
    </WidgetShell>
  );
}
