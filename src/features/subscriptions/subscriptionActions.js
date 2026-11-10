import { SUBSCRIPTION_LIMIT, currencyDigits } from './subscriptionSchema';
import { advanceRenewal, cancelBy, dayDistance } from './subscriptionDates';

export function saveSubscription(items, draft, original) {
  const clean = {
    ...draft,
    name: draft.name.trim(),
    notes: draft.notes.trim(),
    url: draft.url.trim(),
  };
  if (!original) {
    if (items.length >= SUBSCRIPTION_LIMIT) throw new Error('limit');
    return [...items, { ...clean, id: crypto.randomUUID(), revision: 0 }];
  }
  const current = items.find((item) => item.id === original.id);
  if (!current || current.revision !== original.revision) throw new Error('changed');
  return items.map((item) =>
    item.id === original.id ? { ...clean, id: item.id, revision: item.revision + 1 } : item,
  );
}
export function removeSubscription(items, original) {
  const item = items.find((entry) => entry.id === original.id);
  if (!item || item.revision !== original.revision) throw new Error('changed');
  return items.filter((entry) => entry.id !== item.id);
}
export const renewSubscription = (items, item, today) =>
  saveSubscription(
    items,
    { ...item, status: 'active', nextDate: advanceRenewal(item, today) },
    item,
  );

export function subscriptionTotals(items) {
  const totals = new Map();
  for (const item of items.filter((entry) => entry.status === 'active')) {
    const yearly =
      (item.amount / 10 ** currencyDigits(item.currency)) *
      { monthly: 12, yearly: 1, quarterly: 4, weekly: 52 }[item.cycle];
    totals.set(item.currency, (totals.get(item.currency) || 0) + yearly);
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b));
}
export function visibleSubscriptions(items, view, today) {
  return items
    .filter((item) =>
      view === 'cancelled'
        ? item.status === 'cancelled'
        : item.status !== 'cancelled' &&
          (view === 'all' || dayDistance(today, cancelBy(item)) <= 30),
    )
    .sort((a, b) => cancelBy(a).localeCompare(cancelBy(b)) || a.name.localeCompare(b.name));
}
