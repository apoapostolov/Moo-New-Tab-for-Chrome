import EventBus from 'utils/eventbus';
import { validPlanning } from './planningSchema';

export function readPlanning() {
  try {
    const items = JSON.parse(localStorage.getItem('planningData') || '[]');
    return validPlanning(items) ? { items, damaged: false } : { items: [], damaged: true };
  } catch {
    return { items: [], damaged: true };
  }
}

export async function updatePlanning(change) {
  const revision = localStorage.getItem('profileRevision');
  const { withProfileLock } = await import('utils/settings/profile');
  const result = await withProfileLock(() => {
    try {
      if (revision !== localStorage.getItem('profileRevision')) throw new Error('changed');
      const state = readPlanning();
      if (state.damaged) throw new Error('damaged');
      const next = change(state.items);
      if (!validPlanning(next)) throw new Error('invalid');
      localStorage.setItem('planningData', JSON.stringify(next));
      EventBus.emit('planning');
      return { items: next };
    } catch (error) {
      return { error };
    }
  });
  if (result.error) throw result.error;
  return result.items;
}

export function planningBudget() {
  const value = Number(localStorage.getItem('planningBudget') || 0);
  return Number.isInteger(value) && value >= 0 && value <= 1440 ? value : 0;
}
