export const localDay = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const validDay = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
export const dayDistance = (from, to) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
export const shiftDays = (day, days) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export const cancelBy = (item) => shiftDays(item.nextDate, -item.noticeDays);

/** Clamp each cycle against the original billing day, so January 31 returns to March 31. */
export function advanceRenewal(item, today = localDay()) {
  const start = new Date(`${item.nextDate}T12:00:00Z`);
  const target = today > item.nextDate ? today : item.nextDate;
  if (item.cycle === 'weekly')
    return shiftDays(item.nextDate, (Math.floor(dayDistance(item.nextDate, target) / 7) + 1) * 7);
  const months = { monthly: 1, quarterly: 3, yearly: 12 }[item.cycle];
  const end = new Date(`${target}T12:00:00Z`);
  const elapsed =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  let cycles = Math.max(1, Math.floor(elapsed / months));
  const at = (count) => {
    const year = start.getUTCFullYear();
    const month = start.getUTCMonth() + count * months;
    const last = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(item.anchorDay, last), 12))
      .toISOString()
      .slice(0, 10);
  };
  while (at(cycles) <= target) cycles++;
  return at(cycles);
}
