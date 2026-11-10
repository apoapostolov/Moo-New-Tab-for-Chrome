import { useState } from 'react';
import { MdAdd } from 'react-icons/md';
import { WidgetShell, IconButton } from 'features/widgetKit/WidgetKit';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { uiText } from 'lib/translations';
import useSubscriptions from './useSubscriptions';
import { subscriptionTotals, visibleSubscriptions } from './subscriptionActions';
import SubscriptionRow from './SubscriptionRow';
import SubscriptionDialog from './SubscriptionDialog';
import './subscriptions.scss';

export default function Subscriptions() {
  const { language } = useTranslationVersion();
  const locale = language.replaceAll('_', '-');
  const state = useSubscriptions();
  const [view, setView] = useState('upcoming');
  const [editing, setEditing] = useState(null);
  const rows = visibleSubscriptions(state.items, view, state.today);
  return (
    <WidgetShell
      widget="subscriptions"
      title={uiText('subscriptions_title')}
      error={state.error}
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
          <div className="subscriptionTotals">
            {subscriptionTotals(state.items).map(([currency, yearly]) => {
              const money = (value) =>
                new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
              return (
                <p key={currency}>
                  {money(yearly / 12)} {uiText('subscriptions_per_month')} · {money(yearly)}{' '}
                  {uiText('subscriptions_per_year')}
                </p>
              );
            })}
            {state.items.some((item) => item.status === 'active') && (
              <small>{uiText('subscriptions_totals_hint')}</small>
            )}
          </div>
          <div className="subscriptionTabs" role="group" aria-label={uiText('subscriptions_view')}>
            {['upcoming', 'all', 'cancelled'].map((id) => (
              <button type="button" key={id} aria-pressed={view === id} onClick={() => setView(id)}>
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
              />
            ))}
          </div>
          {!rows.length && (
            <p className="wkEmpty">
              {uiText(state.items.length ? 'subscriptions_empty_view' : 'subscriptions_empty')}
            </p>
          )}
          <p className="subscriptionHint">{uiText('subscriptions_tracking_only')}</p>
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
