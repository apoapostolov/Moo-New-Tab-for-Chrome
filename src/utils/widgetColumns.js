import { isFullWidth } from './widgets';
const key = (profile) => (profile === 'focus' ? 'focusWidgetCenterColumns' : 'widgetCenterColumns');
export function readCenterColumns(profile = 'standard') {
  const value = localStorage.getItem(key(profile));
  if (profile === 'focus' && value === null) return readCenterColumns();
  return ['1', '2'].includes(value) ? value : 'auto';
}
export function saveCenterColumns(value, profile = 'standard') {
  localStorage.setItem(key(profile), value);
}
export function centerSecondLane(ids, manual, mode) {
  const cards = ids.filter((id) => !isFullWidth(id));
  if (mode === '1') return [];
  if (mode === '2') return cards.filter((id, index) => index % 2 === 1);
  return manual.filter((id) => cards.includes(id));
}
