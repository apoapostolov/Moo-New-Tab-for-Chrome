import { validDay } from './subscriptionDates';

export const SUBSCRIPTION_LIMIT = 200;
export const CYCLES = ['monthly', 'yearly', 'quarterly', 'weekly'];
export const STATUSES = ['active', 'trial', 'cancelled'];
const text = (value, max) => typeof value === 'string' && value.length <= max;
export function safeManageUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : '';
  } catch {
    return '';
  }
}
export const currencyDigits = (currency) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits;
const currencies = new Set(Intl.supportedValuesOf('currency'));
export const validCurrency = (value) => currencies.has(value);
export function validSubscription(item) {
  return Boolean(
    item &&
    text(item.id, 100) &&
    item.id &&
    text(item.name, 120) &&
    item.name.trim() &&
    Number.isSafeInteger(item.amount) &&
    item.amount >= 0 &&
    item.amount <= 1e12 &&
    validCurrency(item.currency) &&
    CYCLES.includes(item.cycle) &&
    STATUSES.includes(item.status) &&
    validDay(item.nextDate) &&
    Number.isInteger(item.anchorDay) &&
    item.anchorDay >= 1 &&
    item.anchorDay <= 31 &&
    Number.isInteger(item.noticeDays) &&
    item.noticeDays >= 0 &&
    item.noticeDays <= 365 &&
    text(item.url, 2000) &&
    (!item.url || safeManageUrl(item.url)) &&
    text(item.notes, 2000) &&
    text(item.service, 100) &&
    (!item.service || /^[a-z0-9-]+$/.test(item.service)) &&
    Number.isSafeInteger(item.revision) &&
    item.revision >= 0,
  );
}
export function validSubscriptions(items) {
  return (
    Array.isArray(items) &&
    items.length <= SUBSCRIPTION_LIMIT &&
    items.every(validSubscription) &&
    new Set(items.map((item) => item.id)).size === items.length
  );
}
export function parseAmount(value, currency) {
  if (!validCurrency(currency) || !/^\d+(?:[.,]\d+)?$/.test(String(value).trim())) return null;
  const digits = currencyDigits(currency);
  const [whole, fraction = ''] = String(value).trim().replace(',', '.').split('.');
  if (fraction.length > digits) return null;
  const amount = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0'));
  return Number.isSafeInteger(amount) && amount <= 1e12 ? amount : null;
}
