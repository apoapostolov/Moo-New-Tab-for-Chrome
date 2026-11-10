import EventBus from 'utils/eventbus';
import { validSubscriptions } from './subscriptionSchema';

export function readSubscriptions() {
  try {
    const items = JSON.parse(localStorage.getItem('subscriptionsData') || '[]');
    return validSubscriptions(items) ? { items, damaged: false } : { items: [], damaged: true };
  } catch {
    return { items: [], damaged: true };
  }
}
export async function updateSubscriptions(change) {
  const revision = localStorage.getItem('profileRevision');
  const { withProfileLock } = await import('utils/settings/profile');
  const result = await withProfileLock(() => {
    try {
      if (revision !== localStorage.getItem('profileRevision')) throw new Error('changed');
      const state = readSubscriptions();
      if (state.damaged) throw new Error('damaged');
      const next = change(state.items);
      if (!validSubscriptions(next)) throw new Error('invalid');
      localStorage.setItem('subscriptionsData', JSON.stringify(next));
      EventBus.emit('subscriptions');
      return { items: next };
    } catch (error) {
      return { error };
    }
  });
  if (result.error) throw result.error;
  return result.items;
}
