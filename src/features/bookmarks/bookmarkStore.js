import { online, withLock } from 'utils/requests';
import { readBookmarkCache, writeBookmarkCache } from './bookmarkCache';
import { bookmarkError, fetchBookmarkPage, raindropCollections } from './bookmarkProviders';
import { MODES, SOURCES, safeBookmarkUrl } from './bookmarkSelection';
import { readBrowserBookmarks } from './browserBookmarks';

export const BOOKMARK_SETTINGS = /^(bookmarks|surfaceBookmarks$|offlineMode$)/;
const BOOKMARK_TITLE_DESTINATIONS = ['browser', 'raindrop', 'readwise', 'custom'];
const choice = (key, values, fallback) =>
  values.includes(localStorage.getItem(key)) ? localStorage.getItem(key) : fallback;
const number = (key, fallback, max) =>
  Math.max(0, Math.min(max, Number(localStorage.getItem(key) ?? fallback) || 0));
export function bookmarkSettings() {
  return {
    mode: choice('bookmarksMode', MODES, 'mixed'),
    limit: Math.max(3, number('bookmarksLimit', 5, 12)),
    refresh: Math.max(5, number('bookmarksRefresh', 30, 120)),
    rotation: choice('bookmarksRotation', ['daily', 'session', 'manual'], 'daily'),
    age: number('bookmarksMinAge', 30, 3650),
    repeat: number('bookmarksRepeatDays', 30, 365),
    domainLimit: number('bookmarksDomainLimit', 2, 12),
    minMinutes: number('bookmarksMinMinutes', 0, 120),
    hideOpened: localStorage.getItem('bookmarksHideOpened') === 'true',
    balance: localStorage.getItem('bookmarksBalance') !== 'false',
    thumbnails: localStorage.getItem('bookmarksThumbnails') !== 'false',
    openReader: localStorage.getItem('bookmarksOpenReader') !== 'false',
    linkTarget: choice('bookmarksLinkTarget', ['_self', '_blank'], '_self'),
    titleDestination: choice('bookmarksTitleDestination', BOOKMARK_TITLE_DESTINATIONS, 'browser'),
    titleServiceUrl: (localStorage.getItem('bookmarksTitleServiceUrl') || '').trim().slice(0, 2048),
    sources: {
      browser: {
        enabled: localStorage.getItem('bookmarksBrowserEnabled') !== 'false',
        folder: (localStorage.getItem('bookmarksBrowserFolder') || '').slice(0, 200),
        nested: localStorage.getItem('bookmarksBrowserNested') !== 'false',
        query: (localStorage.getItem('bookmarksBrowserQuery') || '').trim().slice(0, 1000),
      },
      raindrop: {
        enabled: localStorage.getItem('bookmarksRaindropEnabled') !== 'false',
        token: (localStorage.getItem('bookmarksRaindropToken') || '').trim(),
        collection: /^-?\d+$/.test(localStorage.getItem('bookmarksRaindropCollection') || '')
          ? Number(localStorage.getItem('bookmarksRaindropCollection'))
          : 0,
        nested: localStorage.getItem('bookmarksRaindropNested') !== 'false',
        query: (localStorage.getItem('bookmarksRaindropQuery') || '').trim().slice(0, 1000),
      },
      readwise: {
        enabled: localStorage.getItem('bookmarksReadwiseEnabled') !== 'false',
        token: (localStorage.getItem('bookmarksReadwiseToken') || '').trim(),
        view: choice('bookmarksReadwiseView', ['reader', 'review'], 'reader'),
        location: choice(
          'bookmarksReadwiseLocation',
          ['queue', 'all', 'new', 'later', 'shortlist', 'archive', 'feed'],
          'queue',
        ),
        category: choice(
          'bookmarksReadwiseCategory',
          ['all', 'article', 'email', 'rss', 'pdf', 'epub', 'tweet', 'video'],
          'all',
        ),
        tag: (localStorage.getItem('bookmarksReadwiseTag') || '').trim().slice(0, 100),
      },
    },
  };
}

export function bookmarkTitleUrl(
  settings = bookmarkSettings(),
  userAgent = globalThis.navigator?.userAgent || '',
) {
  switch (settings.titleDestination) {
    case 'raindrop':
      return 'https://app.raindrop.io/';
    case 'readwise':
      return 'https://read.readwise.io/';
    case 'custom': {
      const address = settings.titleServiceUrl.trim();
      if (!address) return '';
      const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(address) ? address : `https://${address}`;
      return safeBookmarkUrl(withProtocol);
    }
    case 'browser':
    default:
      return /Firefox\//i.test(userAgent) ? 'about:bookmarks' : 'chrome://bookmarks/';
  }
}

export async function bookmarkIdentity(value) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
const validCache = (cache, identity) =>
  cache?.version === 1 &&
  cache.identity === identity &&
  Number.isFinite(cache.updated) &&
  Array.isArray(cache.seen) &&
  Array.isArray(cache.collections) &&
  Array.isArray(cache.items) &&
  cache.items.every(
    (item) =>
      typeof item.key === 'string' &&
      typeof item.title === 'string' &&
      safeBookmarkUrl(item.url) &&
      SOURCES.includes(item.source) &&
      Array.isArray(item.tags),
  );

async function loadSource(source, config, refresh, force, signal) {
  const identity = await bookmarkIdentity(config);
  return withLock(`moo-bookmarks-${source}`, async () => {
    signal?.throwIfAborted();
    let cache = await readBookmarkCache(source);
    if (!validCache(cache, identity))
      cache = {
        version: 1,
        identity,
        items: [],
        updated: 0,
        complete: false,
        page: 0,
        cursor: null,
        seen: [],
        collections: [],
      };
    if (!online()) return { ...cache, error: 'offline' };
    if (cache.retryAt > Date.now()) return { ...cache, error: 'rate' };
    if (
      cache.nextRequest > Date.now() ||
      (!force && cache.complete && Date.now() - cache.updated < refresh * 60000)
    )
      return cache;
    if (cache.complete) cache = { ...cache, complete: false, page: 0, cursor: null, seen: [] };
    const start = Date.now();
    cache.nextRequest = start + (source === 'readwise' ? 3500 : 1000);
    await writeBookmarkCache(source, cache);
    try {
      if (
        source === 'raindrop' &&
        (!cache.collectionsAt || start - cache.collectionsAt > 86400000)
      ) {
        try {
          cache.collections = await raindropCollections(config.token, signal);
          cache.collectionsAt = start;
        } catch (error) {
          if (['auth', 'rate'].includes(error.message) || signal?.aborted) throw error;
        }
      }
      const page = await fetchBookmarkPage(source, config, cache, signal);
      signal?.throwIfAborted();
      if (identity !== (await bookmarkIdentity(bookmarkSettings().sources[source])))
        throw new DOMException('Settings changed', 'AbortError');
      const seen = [...new Set([...cache.seen, ...page.items.map((item) => item.key)])];
      const merged = new Map(cache.items.map((item) => [item.key, item]));
      for (const item of page.items) merged.set(item.key, item);
      const seenSet = new Set(seen);
      cache = {
        ...cache,
        ...page,
        items: [...merged.values()].filter((item) => !page.complete || seenSet.has(item.key)),
        seen: page.complete ? [] : seen,
        updated: Date.now(),
        error: null,
        retryAt: 0,
      };
      await writeBookmarkCache(source, cache);
      return cache;
    } catch (error) {
      if (error.name === 'AbortError' || signal?.aborted) throw error;
      if (error.message === 'cursor')
        cache = { ...cache, cursor: null, page: 0, seen: [], complete: false };
      if (error.message === 'auth') {
        await writeBookmarkCache('selection', null);
        cache = {
          version: 1,
          identity,
          items: [],
          updated: 0,
          complete: false,
          page: 0,
          cursor: null,
          seen: [],
          collections: [],
        };
      }
      cache = {
        ...cache,
        error: ['auth', 'rate', 'storage'].includes(error.message) ? error.message : 'network',
        retryAt: error.retryAt || 0,
        nextRequest: Math.max(cache.nextRequest || 0, Date.now() + 15000),
      };
      await writeBookmarkCache(source, cache);
      return cache;
    }
  });
}

export async function loadBookmarks(force = false, signal) {
  const settings = bookmarkSettings();
  const connected = SOURCES.filter(
    (source) =>
      settings.sources[source].enabled && (source === 'browser' || settings.sources[source].token),
  );
  if (!connected.length) throw bookmarkError('setup');
  const sources = Object.fromEntries(
    await Promise.all(
      connected.map(async (source) => {
        try {
          return [
            source,
            source === 'browser'
              ? await (async () => {
                  const identity = await bookmarkIdentity(settings.sources.browser);
                  const local = await readBrowserBookmarks(settings.sources.browser, signal);
                  if (identity !== (await bookmarkIdentity(bookmarkSettings().sources.browser)))
                    throw new DOMException('Settings changed', 'AbortError');
                  return { ...local, identity };
                })()
              : await loadSource(source, settings.sources[source], settings.refresh, force, signal),
          ];
        } catch (error) {
          if (error.name === 'AbortError') throw error;
          return [
            source,
            {
              items: [],
              identity: await bookmarkIdentity(settings.sources[source]),
              error: 'storage',
              complete: false,
            },
          ];
        }
      }),
    ),
  );
  return {
    data: {
      sources,
      historyIdentity: await bookmarkIdentity({
        browser: 'local',
        raindrop: settings.sources.raindrop.token,
        readwise: settings.sources.readwise.token,
      }),
      identity: connected.map((source) => sources[source].identity).join(':'),
      items: connected
        .flatMap((source) => sources[source].items)
        .filter(
          (item) =>
            item.source !== 'readwise' ||
            settings.sources.readwise.view !== 'reader' ||
            settings.sources.readwise.location !== 'queue' ||
            ['new', 'later', 'shortlist'].includes(item.collection),
        ),
      updated: Math.max(0, ...connected.map((source) => sources[source].updated || 0)),
    },
  };
}
