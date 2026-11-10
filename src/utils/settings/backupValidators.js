import { validCountdown } from '../../features/countdown/countdownStore';
import { validHabits } from '../../features/habits/habitStore';
import { validNoteMemories } from '../../features/scratch/noteTypes';
import { validTimezone } from '../../features/time/worldClockStore';
import { validPlanning } from '../../features/planning';
export const record = (value) => value && typeof value === 'object' && !Array.isArray(value);
export const text = (value) => typeof value === 'string';
const http = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
export const media = (value) =>
  text(value) &&
  (http(value) || /^data:(?:image|video)\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(value));
export const list = (test) => (value) =>
  Array.isArray(value) && value.length <= 5000 && value.every(test);
const point = (value) =>
  record(value) && text(value.id) && Number.isFinite(value.x) && Number.isFinite(value.y);
export const validators = {
  planningData: validPlanning,
  habitsData: (value) => validHabits(value),
  countdowns: (value) =>
    Array.isArray(value) &&
    value.length <= 100 &&
    value.every((item) => validCountdown(item) && text(item.id) && text(item.text)) &&
    new Set(value.map((item) => item.id)).size === value.length,
  worldClocks: (value) =>
    Array.isArray(value) &&
    value.length <= 6 &&
    value.every(
      (item) => record(item) && text(item.id) && text(item.label) && validTimezone(item.zone),
    ),
  portfolioHoldings: (value) =>
    Array.isArray(value) &&
    value.every(
      (item) =>
        record(item) &&
        text(item.symbol) &&
        /^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(item.symbol) &&
        (item.exchange == null || (text(item.exchange) && /^[A-Z0-9]{0,4}$/.test(item.exchange))) &&
        Number.isFinite(item.shares) &&
        item.shares > 0 &&
        (item.cost == null || (Number.isFinite(item.cost) && item.cost >= 0)),
    ) &&
    new Set(value.map((item) => `${item.symbol}|${item.exchange || ''}`)).size === value.length,
  focusWidgetOrder: list(text),
  focusWidgetSecondLane: list(text),
  focusWidgetVisibility: (value) =>
    record(value) && Object.values(value).every((shown) => typeof shown === 'boolean'),
  focusWidgetPlacement: (value) =>
    record(value) &&
    Object.values(value).every((zone) =>
      ['left', 'center', 'right', 'top-left', 'top-right'].includes(zone),
    ),
  focusQuicklinks: list(
    (value) =>
      record(value) &&
      text(value.name) &&
      http(value.url) &&
      text(value.key) &&
      (!value.icon || media(value.icon)),
  ),
  order: list(text),
  widgetSecondLane: list(text),
  widgetPlacement: (value) =>
    record(value) &&
    Object.values(value).every((zone) =>
      ['left', 'center', 'right', 'top-left', 'top-right'].includes(zone),
    ),
  quicklinks: list(
    (value) =>
      record(value) &&
      text(value.name) &&
      http(value.url) &&
      text(value.key) &&
      (!value.icon || media(value.icon)),
  ),
  applinks: list(
    (value) =>
      record(value) &&
      text(value.name) &&
      http(value.url) &&
      text(value.key) &&
      (!value.icon || media(value.icon)),
  ),
  todo: list((value) => record(value) && text(value.value) && typeof value.done === 'boolean'),
  rssFeeds: list(
    (value) => record(value) && http(value.url) && (!value.title || text(value.title)),
  ),
  percentageDays: list((value) => Number.isInteger(value) && value >= 0 && value <= 6),
  googleCalendarIds: list(text),
  googleMailCategories: list(text),
  googleMailFolders: list(
    (value) => text(value) || (record(value) && text(value.id) && text(value.name)),
  ),
  scratchNotesData: list(
    (value) =>
      point(value) &&
      (value.showInFocus === undefined || typeof value.showInFocus === 'boolean') &&
      text(value.text) &&
      (value.locked === undefined || typeof value.locked === 'boolean') &&
      (value.transparent === undefined || typeof value.transparent === 'boolean') &&
      validNoteMemories(value),
  ),
  scratchImagesData: list(
    (value) =>
      point(value) &&
      (value.showInFocus === undefined || typeof value.showInFocus === 'boolean') &&
      media(value.src) &&
      (value.locked === undefined || typeof value.locked === 'boolean') &&
      Number.isFinite(value.width) &&
      value.width > 0 &&
      Number.isFinite(value.ratio) &&
      value.ratio > 0,
  ),
  liveChannels: list(
    (value) => record(value) && text(value.id) && text(value.name) && http(value.url),
  ),
  favourite: (value) =>
    value === null ||
    (record(value) &&
      text(value.url) &&
      (media(value.url) || ['random_colour', 'random_gradient'].includes(value.type))),
};
