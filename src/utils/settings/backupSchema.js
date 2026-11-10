import { record, validators, list, media, text } from './backupValidators';
import { validCurrency } from '../../features/subscriptions/subscriptionSchema';
import defaults from '../data/default_settings.json';
import supportedKeys from '../data/settings_keys.json';

export const BACKUP_FORMAT = 'moo-backup';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 150 * 1024 * 1024;
export const isCredential = (key) =>
  /(?:secret|token|auth|clientid|apikey)$|^(?:pixabay|pexels)key$/i.test(key);
export const TRANSIENT_KEYS = new Set([
  'bookmarksOpenCache',
  'githubCache',
  'githubRetry',
  'airQualityCache',
  'focusSession',
  'firstRun',
  'showWelcome',
  'welcomePreview',
  'welcomeTab',
  'welcomeImage',
  'showReminder',
  'currentBackground',
  'currentWeather',
  'portfolioQuoteCache',
  'portfolioHistory',
  'portfolioRatesCache',
  'imageQueue',
  'videoQueue',
  'rssItems',
  'rssArticles',
  'updateCheck',
  'backgroundStartTime',
  'nextImage',
  'customBackground',
  'customBackgroundCount',
  'customBackgroundMigrated',
  'profileRevision',
  'statsData',
  'googleAuthRevision',
  'imageQueueConfig',
  'videoQueueConfig',
  'rssCenteredDefaultOff',
]);
const allowed = new Set(supportedKeys);
const defaultValues = Object.fromEntries(defaults.map(({ name, value }) => [name, String(value)]));
const numbers = {
  planningBudget: [0, 1440],
  googleDriveMax: [5, 30],
  googleDriveRefresh: [5, 1440],
  habitsLimit: [1, 30],
  habitsWeekStart: [0, 1],
  bookmarksLimit: [3, 12],
  bookmarksRefresh: [5, 120],
  bookmarksMinAge: [0, 3650],
  bookmarksRepeatDays: [0, 365],
  bookmarksDomainLimit: [0, 12],
  bookmarksMinMinutes: [0, 120],
  githubLimit: [3, 20],
  githubRefresh: [5, 60],
  airQualityRefresh: [10, 120],
  pomodoroWork: [1, 240],
  pomodoroBreak: [1, 240],
  pomodoroLongBreak: [1, 240],
  pomodoroRounds: [1, 12],
  backgroundAutoChangeInterval: [1, 10080],
  rssItemCount: [1, 12],
  rssRefreshMinutes: [1, 10080],
  rssArticleTtl: [1, 8760],
  blur: [0, 100],
  brightness: [0, 100],
  backgroundFilterAmount: [0, 100],
  googleCalendarRange: [1, 365],
  googleCalendarMax: [1, 250],
  googleTasksMax: [1, 1000],
  googleMailMax: [1, 100],
  googleCalendarRefresh: [1, 1440],
  googleTasksRefresh: [1, 1440],
  googleMailRefresh: [1, 1440],
};

export function validateSettings(input) {
  if (!record(input)) throw new Error('This file does not contain Moo settings.');
  const settings = Object.create(null);
  const skipped = [];
  for (const [key, raw] of Object.entries(input)) {
    if (
      isCredential(key) ||
      TRANSIENT_KEYS.has(key) ||
      !allowed.has(key) ||
      ['__proto__', 'constructor', 'prototype'].includes(key)
    ) {
      skipped.push(key);
      continue;
    }
    if (!['string', 'boolean', 'number'].includes(typeof raw))
      throw new Error(`The saved value for ${key} is not valid.`);
    const value = String(raw);
    if (
      value.length >
      (['scratchImagesData', 'habitsData', 'planningData'].includes(key)
        ? MAX_BACKUP_BYTES
        : 1024 * 1024)
    )
      throw new Error(`The saved value for ${key} is too large.`);
    if (key === 'subscriptionsCurrency' && !validCurrency(value))
      throw new Error('The saved subscription currency is not valid.');
    if (['googleDriveMax', 'googleDriveRefresh'].includes(key) && !Number.isInteger(Number(value)))
      throw new Error(`The saved value for ${key} must be a whole number.`);
    if (key === 'googleDriveView' && !['recent', 'starred', 'shared'].includes(value))
      throw new Error('The saved Drive view is not valid.');
    const original = defaultValues[key];
    if ((original === 'true' || original === 'false') && !['true', 'false'].includes(value))
      throw new Error(`The saved value for ${key} must be on or off.`);
    const range = numbers[key] || (key.startsWith('zoom') ? [10, 400] : null);
    if (
      range &&
      (!Number.isFinite(Number(value)) || Number(value) < range[0] || Number(value) > range[1])
    )
      throw new Error(`The saved value for ${key} is outside its allowed range.`);
    const validate = validators[key];
    if (validate || /^[{[]/.test(original || '')) {
      let parsed;
      try {
        parsed = JSON.parse(value);
      } catch {
        throw new Error(`The saved list for ${key} is damaged.`);
      }
      if (
        validate
          ? !validate(parsed)
          : Array.isArray(JSON.parse(original))
            ? !Array.isArray(parsed)
            : !record(parsed)
      )
        throw new Error(`The saved list for ${key} is not valid.`);
    }
    settings[key] = value;
  }
  return { settings, skipped };
}

export function prepareBackup(source) {
  if (typeof source === 'string' && new TextEncoder().encode(source).length > MAX_BACKUP_BYTES)
    throw new Error('This backup is too large to open.');
  let input;
  try {
    input = typeof source === 'string' ? JSON.parse(source) : source;
  } catch {
    throw new Error('This file is not a readable JSON backup.');
  }
  if (!record(input)) throw new Error('Choose a Moo settings backup.');
  const versioned = input.format === BACKUP_FORMAT;
  if (input.format !== undefined && !versioned) throw new Error('Choose a Moo settings backup.');
  if (versioned && input.version !== BACKUP_VERSION)
    throw new Error('This backup needs a newer version of Moo.');
  const { settings, skipped } = validateSettings(versioned ? input.settings : input);
  if (!versioned && !Object.keys(settings).length && !input.customBackground)
    throw new Error('This file does not contain any recognised Moo settings.');
  let backgrounds;
  if (versioned && input.assets !== undefined) {
    if (!record(input.assets) || !Array.isArray(input.assets.backgrounds))
      throw new Error('The picture collection in this backup is not valid.');
    backgrounds = input.assets.backgrounds;
  } else if (!versioned && typeof input.customBackground === 'string') {
    try {
      backgrounds = JSON.parse(input.customBackground);
    } catch {
      backgrounds = [input.customBackground];
    }
    if (!Array.isArray(backgrounds)) backgrounds = [backgrounds];
    backgrounds = backgrounds.map((url) => ({ url, name: 'Imported picture', uploadDate: 0 }));
  }
  if (
    backgrounds &&
    !list((value) => record(value) && media(value.url) && (!value.name || text(value.name)))(
      backgrounds,
    )
  )
    throw new Error('One of the pictures in this backup is not valid.');
  const scratchImages = versioned
    ? input.assets?.scratchImages
    : settings.scratchImagesData
      ? JSON.parse(settings.scratchImagesData)
      : undefined;
  if (scratchImages !== undefined && !validators.scratchImagesData(scratchImages))
    throw new Error('The Floating Images in this backup are not valid.');
  delete settings.scratchImagesData;
  return {
    scratchImages,
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    legacy: !versioned,
    settings,
    backgrounds,
    skipped,
    summary: {
      settings: Object.keys(settings).length,
      backgrounds: backgrounds?.length ?? null,
      scratchImages: scratchImages?.length ?? null,
      notes: settings.scratchNotesData ? JSON.parse(settings.scratchNotesData).length : null,
    },
  };
}
