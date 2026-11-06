import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import 'fake-indexeddb/auto';

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
const originalFetch = globalThis.fetch;
const server = await createServer({
  server: { middlewareMode: true, hmr: false, open: false },
  logLevel: 'silent',
});
const selection = await server.ssrLoadModule('/src/features/bookmarks/bookmarkSelection.js');
const providers = await server.ssrLoadModule('/src/features/bookmarks/bookmarkProviders.js');
const cache = await server.ssrLoadModule('/src/features/bookmarks/bookmarkCache.js');
const store = await server.ssrLoadModule('/src/features/bookmarks/bookmarkStore.js');
const native = await server.ssrLoadModule('/src/features/bookmarks/browserBookmarks.js');
const opens = await server.ssrLoadModule('/src/features/bookmarks/bookmarkOpens.js');
const { bookmarkAssortment } = await server.ssrLoadModule(
  '/src/features/bookmarks/bookmarkAssortment.js',
);
const backup = await server.ssrLoadModule('/src/utils/settings/backupSchema.js');
const profile = await server.ssrLoadModule('/src/utils/settings/profile.js');
beforeEach(async () => {
  delete globalThis.browser;
  delete globalThis.chrome;
  localStorage.clear();
  globalThis.fetch = originalFetch;
  await cache.clearBookmarkCache();
});
test('Bookmarks title destinations open supported services and validate custom addresses', () => {
  assert.equal(
    store.bookmarkTitleUrl({ titleDestination: 'browser' }, 'Firefox/144.0'),
    'about:bookmarks',
  );
  assert.equal(
    store.bookmarkTitleUrl({ titleDestination: 'browser' }, 'Chrome/140.0'),
    'chrome://bookmarks/',
  );
  assert.equal(
    store.bookmarkTitleUrl({ titleDestination: 'raindrop' }),
    'https://app.raindrop.io/',
  );
  assert.equal(
    store.bookmarkTitleUrl({ titleDestination: 'readwise' }),
    'https://read.readwise.io/',
  );
  assert.equal(store.bookmarkTitleUrl({ titleDestination: 'custom', titleServiceUrl: '' }), '');
  assert.equal(
    store.bookmarkTitleUrl({ titleDestination: 'custom', titleServiceUrl: 'reader.example/' }),
    'https://reader.example/',
  );
  assert.equal(
    store.bookmarkTitleUrl({ titleDestination: 'custom', titleServiceUrl: 'javascript:alert(1)' }),
    '',
  );
});
after(async () => {
  globalThis.fetch = originalFetch;
  await server.close();
});
const save = (values) =>
  Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
const response = (value, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
const rain = (id, extra = {}) => ({
  _id: id,
  title: `Bookmark ${id}`,
  link: `https://example${id}.org/article`,
  created: '2024-01-01T00:00:00Z',
  collection: { $id: 7 },
  ...extra,
});
const reader = (id, extra = {}) => ({
  id,
  title: `Article ${id}`,
  url: `https://read.readwise.io/read/${id}`,
  source_url: `https://reader${id}.org/article`,
  location: 'later',
  category: 'article',
  saved_at: '2024-01-01T00:00:00Z',
  ...extra,
});
const item = (id, extra = {}) => ({ ...providers.raindropBookmark(rain(id)), ...extra });
const config = (extra = {}) => ({
  mode: 'rediscover',
  age: 30,
  repeat: 30,
  limit: 5,
  domainLimit: 0,
  minMinutes: 0,
  hideOpened: false,
  balance: false,
  ...extra,
});
const unthrottle = async (source) => {
  const value = await cache.readBookmarkCache(source);
  value.nextRequest = 0;
  await cache.writeBookmarkCache(source, value);
};

test('provider normalization excludes executable URLs and Reader child records', () => {
  assert.equal(providers.raindropBookmark(rain(1, { link: 'javascript:alert(1)' })), null);
  assert.equal(providers.readerBookmark(reader('1', { parent_id: 'parent' })), null);
  const value = providers.readerBookmark(
    reader('1', {
      word_count: 2501,
      reading_progress: 2,
      image_url: 'http://insecure/image',
      tags: { design: { name: 'design' } },
    }),
  );
  assert.equal(value.minutes, 11);
  assert.equal(value.progress, 1);
  assert.equal(value.cover, '');
  assert.deepEqual(value.tags, ['design']);
  assert.equal(selection.safeBookmarkUrl('https://secret:password@example.org'), '');
});

test('bookmark links default to the same tab and preserve the optional new-tab preference in backups', () => {
  assert.equal(store.bookmarkSettings().linkTarget, '_self');
  save({ bookmarksLinkTarget: '_blank' });
  assert.equal(store.bookmarkSettings().linkTarget, '_blank');
  assert.equal(
    backup.validateSettings({ bookmarksLinkTarget: '_blank' }).settings.bookmarksLinkTarget,
    '_blank',
  );
  save({ bookmarksLinkTarget: 'invalid' });
  assert.equal(store.bookmarkSettings().linkTarget, '_self');
});

test('bookmark note links follow the chosen tab through nested Markdown while other notes keep their default', async () => {
  const { default: Markdown } = await server.ssrLoadModule('/src/features/scratch/Markdown.jsx');
  const text =
    '# [Heading](https://example.org/h)\n\n> **[Quote](https://example.org/q)**\n\n- [List](https://example.org/l)\n\n| Link |\n| --- |\n| [Table](https://example.org/t) |';
  const same = renderToStaticMarkup(React.createElement(Markdown, { text, linkTarget: '_self' }));
  assert.equal((same.match(/target="_self"/g) || []).length, 4);
  assert.ok(!same.includes('target="_blank"'));
  const normal = renderToStaticMarkup(React.createElement(Markdown, { text }));
  assert.equal((normal.match(/target="_blank"/g) || []).length, 4);
});

test('the combined library deduplicates tracking links and retains both sources', () => {
  const pool = selection.bookmarkPool([
    item(1, { url: 'https://example.org/a?utm_source=test' }),
    providers.readerBookmark(reader('2', { source_url: 'https://example.org/a' })),
  ]);
  assert.equal(pool.length, 1);
  assert.equal(pool[0].source, 'readwise');
  assert.deepEqual(pool[0].sources, ['raindrop', 'readwise']);
  assert.equal(
    selection.bookmarkPool([item(1), providers.readerBookmark(reader('2'))], 'raindrop').length,
    1,
  );
});

test('mixed selection combines newest saves with old discoveries and enforces repeat and domain rules', () => {
  const now = Date.now();
  const pool = selection.bookmarkPool(
    Array.from({ length: 20 }, (_, i) =>
      item(i + 1, {
        created: i < 2 ? now - i * 1000 : now - 86400000 * 100,
        url: `https://site${i % 4}.org/${i}`,
      }),
    ),
  );
  const result = selection.selectBookmarks(
    pool,
    config({ mode: 'mixed', domainLimit: 2 }),
    { shown: { [pool[5].selectionKey]: now } },
    now,
    () => 0.7,
  );
  assert.equal(result.items.length, 5);
  assert.equal(result.items[0].key, 'raindrop:1');
  assert.equal(result.items[1].key, 'raindrop:2');
  assert.ok(!result.items.some((row) => row.key === 'raindrop:6'));
  for (const host of new Set(result.items.map((row) => new URL(row.url).hostname)))
    assert.ok(result.items.filter((row) => new URL(row.url).hostname === host).length <= 2);
  assert.equal(
    selection.selectBookmarks(pool, config({ hideOpened: true, minMinutes: 5 }), {}, now).items
      .length,
    0,
  );
});

test('Raindrop indexing advances past its first page and reconciles removed bookmarks on a complete rescan', async () => {
  save({ bookmarksRaindropToken: 'fixture-token' });
  let pages = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer fixture-token');
    if (String(url).includes('/collections'))
      return response({ items: [{ _id: 7, title: 'Design' }] });
    const page = new URL(url).searchParams.get('page');
    pages.push(page);
    return response({
      result: true,
      items: page === '0' ? Array.from({ length: 50 }, (_, i) => rain(i + 1)) : [rain(51)],
    });
  };
  const first = await store.loadBookmarks();
  assert.equal(first.data.items.length, 50);
  assert.equal(first.data.sources.raindrop.complete, false);
  await unthrottle('raindrop');
  const second = await store.loadBookmarks();
  assert.equal(second.data.items.length, 51);
  assert.equal(second.data.sources.raindrop.complete, true);
  assert.deepEqual(pages, ['0', '1']);
  assert.equal(second.data.items[0].collection, 'Design');
  await unthrottle('raindrop');
  globalThis.fetch = async () => response({ result: true, items: [rain(51)] });
  const rescanned = await store.loadBookmarks(true);
  assert.equal(rescanned.data.items.length, 1);
});

test('Reader follows opaque cursors, excludes children and respects queue location', async () => {
  save({ bookmarksReadwiseToken: 'reader-token' });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    assert.equal(options.headers.Authorization, 'Token reader-token');
    return response(
      new URL(url).searchParams.has('pageCursor')
        ? { results: [reader('old')], nextPageCursor: null }
        : {
            results: [
              reader('first'),
              reader('archived', { location: 'archive' }),
              reader('child', { parent_id: 'first' }),
            ],
            nextPageCursor: 'opaque&cursor',
          },
    );
  };
  const first = await store.loadBookmarks();
  assert.equal(first.data.items.length, 1);
  await unthrottle('readwise');
  const second = await store.loadBookmarks();
  assert.equal(second.data.items.length, 2);
  assert.equal(new URL(calls[1]).searchParams.get('pageCursor'), 'opaque&cursor');
  assert.equal(new URL(calls[0]).searchParams.has('withHtmlContent'), false);
});

test('Daily Review handles an absent review and keeps full highlight text when available', async () => {
  save({ bookmarksReadwiseToken: 'reader-token', bookmarksReadwiseView: 'review' });
  globalThis.fetch = async () => response({}, 404);
  assert.equal((await store.loadBookmarks()).data.items.length, 0);
  await unthrottle('readwise');
  const passage = 'A complete passage. '.repeat(100);
  globalThis.fetch = async () =>
    response({
      review_id: 42,
      review_url: 'https://readwise.io/reviews/42',
      highlights: [
        { title: 'A book', text: passage, note: 'Remember', highlighted_at: '2024-01-01' },
      ],
    });
  const result = await store.loadBookmarks(true);
  assert.equal(result.data.items[0].description, passage);
  assert.equal(result.data.items[0].type, 'highlight');
});

test('offline data is account-scoped and revoked credentials remove private cached content', async () => {
  save({ bookmarksReadwiseToken: 'first' });
  globalThis.fetch = async () => response({ results: [reader('secret')], nextPageCursor: null });
  await store.loadBookmarks();
  save({ offlineMode: 'true' });
  globalThis.fetch = () => {
    throw new Error('Unexpected network');
  };
  assert.equal((await store.loadBookmarks()).data.items.length, 1);
  save({ bookmarksReadwiseToken: 'second' });
  assert.equal((await store.loadBookmarks()).data.items.length, 0);
  save({ offlineMode: 'false', bookmarksReadwiseToken: 'first' });
  await unthrottle('readwise');
  globalThis.fetch = async () => response({}, 401);
  const result = await store.loadBookmarks(true);
  assert.equal(result.data.items.length, 0);
  assert.equal((await cache.readBookmarkCache('readwise')).items.length, 0);
});

test('rate-limit backoff survives reloads and manual refresh cannot bypass it', async () => {
  save({ bookmarksReadwiseToken: 'reader-token' });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return response({}, 429, { 'Retry-After': '120' });
  };
  const result = await store.loadBookmarks();
  assert.equal(result.data.sources.readwise.error, 'rate');
  await store.loadBookmarks(true);
  assert.equal(calls, 1);
  assert.ok((await cache.readBookmarkCache('readwise')).retryAt > Date.now() + 100000);
});

test('one failed service does not hide the other and credentials never enter backups', async () => {
  save({ bookmarksRaindropToken: 'rain', bookmarksReadwiseToken: 'reader' });
  globalThis.fetch = async (url) =>
    String(url).startsWith('https://readwise.io')
      ? response({}, 401)
      : String(url).includes('/collections')
        ? response({ items: [] })
        : response({ items: [rain(1)] });
  const result = await store.loadBookmarks();
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.sources.readwise.error, 'auth');
  const validated = backup.validateSettings({
    bookmarksRaindropToken: 'secret',
    bookmarksReadwiseToken: 'secret',
    bookmarksMode: 'shuffle',
    bookmarksEnabled: true,
  });
  assert.equal(validated.settings.bookmarksMode, 'shuffle');
  assert.equal(validated.settings.bookmarksRaindropToken, undefined);
  assert.throws(() => backup.validateSettings({ bookmarksLimit: 99 }));
});

test('erasing a profile removes the bookmark index and local discovery history', async () => {
  await cache.writeBookmarkCache('readwise', { items: ['private'] });
  await cache.writeBookmarkCache('selection', { shown: { private: 1 } });
  await profile.resetProfile(true);
  assert.equal(await cache.readBookmarkCache('readwise'), undefined);
  assert.equal(await cache.readBookmarkCache('selection'), undefined);
});

test('a request from an old account cannot write content after credentials change', async () => {
  save({ bookmarksReadwiseToken: 'old-account' });
  let release;
  let started;
  const called = new Promise((resolve) => {
    started = resolve;
  });
  globalThis.fetch = () =>
    new Promise((resolve) => {
      release = resolve;
      started();
    });
  const pending = store.loadBookmarks();
  await called;
  save({ bookmarksReadwiseToken: 'new-account' });
  release(response({ results: [reader('private-old')], nextPageCursor: null }));
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal((await cache.readBookmarkCache('readwise')).items.length, 0);
});

test('an expired Reader cursor can recover from the beginning of a scan', async () => {
  save({ bookmarksReadwiseToken: 'reader-token' });
  globalThis.fetch = async () =>
    response({ results: [reader('first')], nextPageCursor: 'expired' });
  await store.loadBookmarks();
  await unthrottle('readwise');
  globalThis.fetch = async () => response({}, 400);
  await store.loadBookmarks();
  assert.equal((await cache.readBookmarkCache('readwise')).cursor, null);
  await unthrottle('readwise');
  globalThis.fetch = async (url) => {
    assert.equal(new URL(url).searchParams.has('pageCursor'), false);
    return response({ results: [reader('fresh')], nextPageCursor: null });
  };
  assert.equal((await store.loadBookmarks()).data.items[0].key, 'readwise:fresh');
});

test('source combinations keep independent assortments, including a manually shuffled selection after reload', async () => {
  const pool = selection.bookmarkPool(Array.from({ length: 20 }, (_, i) => item(i + 1)));
  const base = {
    identity: 'account',
    period: 'today',
    pool,
    shuffle: 0,
    settings: config({ limit: 3 }),
  };
  const original = await bookmarkAssortment({ ...base, scope: 'all' });
  await bookmarkAssortment({ ...base, scope: 'raindrop' });
  const returned = await bookmarkAssortment({ ...base, scope: 'all' });
  assert.deepEqual(
    returned.map((row) => row.key),
    original.map((row) => row.key),
  );
  const shuffled = await bookmarkAssortment({ ...base, scope: 'all', shuffle: 42 });
  assert.notDeepEqual(
    shuffled.map((row) => row.key),
    original.map((row) => row.key),
  );
  const reloaded = await bookmarkAssortment({ ...base, scope: 'all' });
  assert.deepEqual(
    reloaded.map((row) => row.key),
    shuffled.map((row) => row.key),
  );
});

const nativeTree = () => [
  {
    id: 'root',
    children: [
      {
        id: 'toolbar',
        parentId: 'root',
        title: 'Toolbar',
        children: [
          { id: 'a', title: 'Design guide', url: 'https://design.example/guide', dateAdded: 100 },
          {
            id: 'nested',
            parentId: 'toolbar',
            title: 'Reading',
            children: [
              {
                id: 'b',
                title: 'Web design',
                url: 'https://reading.example/design',
                dateAdded: 200,
              },
              { id: 'bad', title: 'Execute', url: 'javascript:alert(1)' },
              { id: 'internal', title: 'Settings', url: 'about:preferences' },
              { id: 'private', title: 'File', url: 'file:///private.txt' },
            ],
          },
          { id: 'separator', type: 'separator' },
        ],
      },
    ],
  },
];
const nativeEvent = () => {
  const listeners = new Set();
  return {
    addListener: (fn) => listeners.add(fn),
    removeListener: (fn) => listeners.delete(fn),
    emit: (...args) => [...listeners].forEach((fn) => fn(...args)),
    listeners,
  };
};
const mockNative = (initial = true) => {
  let granted = initial;
  const api = {
    permissions: {
      contains: async () => granted,
      request: async (value) => {
        assert.deepEqual(value, { permissions: ['bookmarks'] });
        return granted;
      },
      onAdded: nativeEvent(),
      onRemoved: nativeEvent(),
    },
    bookmarks: {
      getTree: async () => nativeTree(),
      ...Object.fromEntries(
        [
          'onCreated',
          'onRemoved',
          'onChanged',
          'onMoved',
          'onChildrenReordered',
          'onImportBegan',
          'onImportEnded',
        ].map((name) => [name, nativeEvent()]),
      ),
    },
  };
  globalThis.browser = api;
  return {
    api,
    setGranted: (value) => {
      granted = value;
    },
  };
};

test('Browser comes first, is independently switchable and needs optional explicit permission', async () => {
  assert.deepEqual(selection.SOURCES, ['browser', 'raindrop', 'readwise']);
  assert.equal(await native.browserBookmarkAccess(), 'unavailable');
  const { api, setGranted } = mockNative(false);
  let requested = 0;
  api.permissions.request = async () => {
    requested++;
    return false;
  };
  assert.equal((await store.loadBookmarks()).data.sources.browser.error, 'permission');
  assert.equal(requested, 0);
  assert.equal(await native.requestBrowserBookmarkAccess(), false);
  assert.equal(requested, 1);
  setGranted(true);
  assert.equal(await native.browserBookmarkAccess(), 'granted');
  save({ bookmarksBrowserEnabled: false });
  await assert.rejects(store.loadBookmarks(), { message: 'setup' });
  const { readFile } = await import('node:fs/promises');
  const manifest = JSON.parse(await readFile(new URL('../manifest/firefox.json', import.meta.url)));
  assert.ok(manifest.optional_permissions.includes('bookmarks'));
  assert.ok(!manifest.permissions.includes('bookmarks'));
});

test('native folders and text filters work offline without indexing or sending library URLs', async () => {
  mockNative();
  save({ offlineMode: true, bookmarksBrowserFolder: 'toolbar', bookmarksBrowserNested: false });
  globalThis.fetch = () => {
    throw new Error('No network expected');
  };
  let result = await store.loadBookmarks();
  assert.deepEqual(
    result.data.items.map((row) => row.key),
    ['browser:a'],
  );
  save({ bookmarksBrowserNested: true, bookmarksBrowserQuery: 'reading design' });
  result = await store.loadBookmarks();
  assert.deepEqual(
    result.data.items.map((row) => row.key),
    ['browser:b'],
  );
  assert.equal(result.data.items[0].collection, 'Toolbar / Reading');
  assert.equal(await cache.readBookmarkCache('browser'), undefined);
  save({ bookmarksBrowserFolder: 'removed' });
  result = await store.loadBookmarks();
  assert.equal(result.data.sources.browser.error, 'folder');
  assert.equal(result.data.items.length, 0);
  const imported = backup.validateSettings({
    bookmarksBrowserEnabled: true,
    bookmarksBrowserFolder: 'toolbar',
    bookmarksBrowserNested: false,
    bookmarksBrowserQuery: 'design',
    bookmarksOpenCache: 'private',
  });
  assert.equal(imported.settings.bookmarksBrowserFolder, 'toolbar');
  assert.equal(imported.settings.bookmarksOpenCache, undefined);
});

test('all enabled sources mix before shared selection, and turning one off removes only its items', async () => {
  mockNative();
  save({
    bookmarksRaindropToken: 'rain',
    bookmarksReadwiseToken: 'reader',
    bookmarksDomainLimit: 0,
  });
  globalThis.fetch = async (url) =>
    String(url).includes('readwise.io')
      ? response({ results: [reader('rw')], nextPageCursor: null })
      : String(url).includes('/collections')
        ? response({ items: [] })
        : response({ items: [rain('rd')] });
  let result = await store.loadBookmarks();
  assert.deepEqual(Object.keys(result.data.sources), selection.SOURCES);
  const historyIdentity = result.data.historyIdentity;
  const mixed = selection.selectBookmarks(
    selection.bookmarkPool(result.data.items),
    config({ mode: 'latest', limit: 12 }),
  ).items;
  assert.deepEqual(new Set(mixed.map((row) => row.source)), new Set(selection.SOURCES));
  save({ bookmarksRaindropEnabled: false });
  result = await store.loadBookmarks();
  assert.deepEqual(Object.keys(result.data.sources), ['browser', 'readwise']);
  assert.equal(result.data.historyIdentity, historyIdentity);
  assert.ok(!result.data.items.some((row) => row.source === 'raindrop'));
  save({
    bookmarksBrowserEnabled: false,
    bookmarksReadwiseEnabled: false,
    bookmarksRaindropEnabled: true,
  });
  result = await store.loadBookmarks();
  assert.deepEqual(Object.keys(result.data.sources), ['raindrop']);
});

test('three-source duplicate links keep all source names and richer Reader content', () => {
  const local = native.flattenBrowserBookmarks(nativeTree()).items[0];
  const pool = selection.bookmarkPool([
    local,
    item(1, { url: local.url + '?utm_source=rain' }),
    providers.readerBookmark(reader('same', { source_url: local.url, summary: 'Full summary' })),
  ]);
  assert.equal(pool.length, 1);
  assert.deepEqual(pool[0].sources, selection.SOURCES);
  assert.equal(pool[0].source, 'readwise');
});

test('Most opened persists synchronously, survives source switches, and obeys shared filters', async () => {
  const pool = selection.bookmarkPool([item(1), item(2), item(3)]);
  opens.recordBookmarkOpen('same-account', pool[1].selectionKey);
  opens.recordBookmarkOpen('same-account', pool[1].selectionKey);
  opens.recordBookmarkOpen('same-account', pool[0].selectionKey);
  assert.equal(opens.readBookmarkOpens('same-account').counts[pool[1].selectionKey], 2);
  const base = {
    identity: 'both',
    historyIdentity: 'same-account',
    scope: 'both',
    period: 'day',
    shuffle: 0,
    pool,
    settings: config({ mode: 'most_opened', limit: 3 }),
  };
  assert.equal((await bookmarkAssortment(base))[0].key, pool[1].key);
  assert.equal(
    (await bookmarkAssortment({ ...base, identity: 'single', scope: 'single' }))[0].widgetOpenCount,
    2,
  );
  assert.deepEqual(opens.readBookmarkOpens('different-account').counts, {});
  assert.deepEqual(
    (await bookmarkAssortment({ ...base, settings: { ...base.settings, hideOpened: true } })).map(
      (row) => row.key,
    ),
    [pool[2].key],
  );
  assert.equal(
    selection.selectBookmarks(pool, config({ mode: 'most_opened', minMinutes: 5 })).items.length,
    0,
  );
  await cache.clearBookmarkCache('selection');
  assert.equal(localStorage.getItem('bookmarksOpenCache'), null);
});

test('native changes coalesce, imports wait, revocation clears history and stale reads abort', async () => {
  const { api, setGranted } = mockNative();
  let changes = 0;
  const unsubscribe = native.subscribeBrowserBookmarks(() => {
    changes++;
  });
  const pause = () => new Promise((resolve) => setTimeout(resolve, 180));
  api.bookmarks.onCreated.emit();
  api.bookmarks.onMoved.emit();
  await pause();
  assert.equal(changes, 1);
  api.bookmarks.onImportBegan.emit();
  api.bookmarks.onCreated.emit();
  await pause();
  assert.equal(changes, 1);
  api.bookmarks.onImportEnded.emit();
  await pause();
  assert.equal(changes, 2);
  let release, started;
  const waiting = new Promise((resolve) => {
    started = resolve;
  });
  api.bookmarks.getTree = () =>
    new Promise((resolve) => {
      release = resolve;
      started();
    });
  const pending = native.readBrowserBookmarks();
  await waiting;
  api.bookmarks.onRemoved.emit();
  release(nativeTree());
  await assert.rejects(pending, { name: 'AbortError' });
  await cache.writeBookmarkCache('selection', { private: true });
  opens.recordBookmarkOpen('local', 'https://private.example');
  setGranted(false);
  api.permissions.onRemoved.emit({ permissions: ['bookmarks'] });
  await pause();
  assert.equal(await cache.readBookmarkCache('selection'), undefined);
  assert.equal(localStorage.getItem('bookmarksOpenCache'), null);
  assert.equal((await native.readBrowserBookmarks()).error, 'permission');
  unsubscribe();
  assert.equal(api.bookmarks.onCreated.listeners.size, 0);
  assert.equal(api.permissions.onRemoved.listeners.size, 0);
});
