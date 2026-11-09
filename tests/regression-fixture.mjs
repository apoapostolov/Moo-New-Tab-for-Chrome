import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, beforeEach, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import 'fake-indexeddb/auto';
import { createServer } from 'vite';
import EventBus from '../src/utils/eventbus.js';
import videoCheck from '../src/features/background/api/videoCheck.js';
import { calendarDate } from '../src/utils/date/index.js';
import { parseNatural } from '../src/features/google/natural.js';
import { isValidUrl } from '../src/utils/links/isValidUrl.js';
import * as backgrounds from '../src/utils/customBackgroundDB.js';

class Storage {
  getItem(key) {
    return Object.hasOwn(this, key) ? this[key] : null;
  }
  setItem(key, value) {
    this[key] = String(value);
  }
  removeItem(key) {
    delete this[key];
  }
  clear() {
    for (const key of Object.keys(this)) delete this[key];
  }
}
globalThis.localStorage = new Storage();
globalThis.document = new EventTarget();
const server = await createServer({
  server: { middlewareMode: true, hmr: false, open: false },
  logLevel: 'silent',
});
const translations = await server.ssrLoadModule('/src/lib/translations.js');
await translations.selectLanguage('en_GB');
const calendar = await server.ssrLoadModule('/src/features/google/services/calendar.js');
const { moveSettings } = await server.ssrLoadModule('/src/utils/settings/move.js');
const { importSettings } = await server.ssrLoadModule('/src/utils/settings/import.js');
const { normaliseUrl, mergeItems, loadItems } = await server.ssrLoadModule(
  '/src/features/rss/feedStore.js',
);
const { resolveFeedUrl } = await server.ssrLoadModule('/src/features/rss/parseFeed.js');
const { getWeather } = await server.ssrLoadModule('/src/features/weather/api/getWeather.js');
const { getAccessToken } = await server.ssrLoadModule('/src/features/google/auth.js');
after(async () => {
  await server.close();
});
beforeEach(() => {
  EventBus.removeAllListeners();
  localStorage.clear();
});

export {
  assert,
  readFileSync,
  test,
  React,
  renderToStaticMarkup,
  EventBus,
  videoCheck,
  calendarDate,
  parseNatural,
  isValidUrl,
  backgrounds,
  server,
  translations,
  calendar,
  moveSettings,
  importSettings,
  normaliseUrl,
  mergeItems,
  loadItems,
  resolveFeedUrl,
  getWeather,
  getAccessToken,
};
