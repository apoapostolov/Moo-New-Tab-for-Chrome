export function planningDay(now = new Date()) {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export const validPlanDay = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;

export const nextPlanDay = (day) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);

export const planDate = (tab, today) =>
  tab === 'later' ? null : tab === 'tomorrow' ? nextPlanDay(today) : tab === 'today' ? today : tab;
