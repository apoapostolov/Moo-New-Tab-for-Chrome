import {
  assert,
  test,
  server,
  importSettings,
  settings,
  data,
  api,
  provider,
  store,
  createBackup,
  validateSettings,
  widgets,
  article,
  mockWiki,
} from './knowledge-fixture.mjs';

test('Knowledge shares an hourly selection across concurrent tabs and uses a new selection when forced or expired', async () => {
  const original = globalThis.fetch,
    calls = [];
  globalThis.fetch = mockWiki(calls);
  try {
    const selections = await Promise.all([
      store.loadKnowledge(),
      store.loadKnowledge(),
      store.loadKnowledge(),
    ]);
    assert.equal(calls.length, 2);
    assert(
      selections.every((selection) => selection.data.article.id === selections[0].data.article.id),
    );
    await store.loadKnowledge(true);
    assert.equal(calls.length, 4);
    const cache = store.readKnowledgeCache();
    cache.createdAt = Date.now() - 9 * 3600000;
    localStorage.setItem('knowledgeCache', JSON.stringify(cache));
    await store.loadKnowledge();
    assert.equal(calls.length, 6);
  } finally {
    globalThis.fetch = original;
  }
});

test('Reload mode stays fixed within a document but a fresh document chooses again; reset cannot reuse old memory', async () => {
  const original = globalThis.fetch,
    calls = [];
  globalThis.fetch = mockWiki(calls);
  localStorage.setItem('knowledgeMode', 'reload');
  try {
    await store.loadKnowledge();
    await store.loadKnowledge();
    assert.equal(calls.length, 2);
    const fresh = await server.ssrLoadModule(
      '/src/features/knowledge/knowledgeStore.js?another-document',
    );
    await fresh.loadKnowledge();
    assert.equal(calls.length, 4);
    await store.loadKnowledge();
    assert.equal(calls.length, 4);
    localStorage.setItem('profileRevision', 'reset');
    localStorage.removeItem('knowledgeCache');
    await store.loadKnowledge();
    assert.equal(calls.length, 6);
  } finally {
    globalThis.fetch = original;
  }
});

test('Knowledge preserves matching cached text offline and on errors, but changed subjects cannot reveal an unrelated cached pick', async () => {
  const original = globalThis.fetch,
    calls = [];
  globalThis.fetch = mockWiki(calls);
  try {
    await store.loadKnowledge();
    localStorage.setItem('offlineMode', 'true');
    const offline = await store.loadKnowledge();
    assert.equal(offline.data.stale, true);
    assert.equal(calls.length, 2);
    localStorage.setItem('knowledgeSubjects', 'new topic');
    await assert.rejects(store.loadKnowledge(), /offline/);
    localStorage.setItem('knowledgeSubjects', '');
    localStorage.setItem('offlineMode', 'false');
    globalThis.fetch = async () => {
      throw new Error('network');
    };
    const stale = await store.loadKnowledge(true);
    assert.equal(stale.data.stale, true);
    assert.equal(stale.error.message, 'network');
  } finally {
    globalThis.fetch = original;
  }
});

test('Knowledge respects rate-limit backoff and obsolete requests cannot repopulate a changed profile', async () => {
  const original = globalThis.fetch,
    calls = [];
  globalThis.fetch = mockWiki(
    calls,
    () => new Response('{}', { status: 429, headers: { 'Retry-After': '3600' } }),
  );
  try {
    await assert.rejects(store.loadKnowledge(), /rate/);
    await assert.rejects(store.loadKnowledge(true), /rate/);
    assert.equal(calls.length, 1);
    assert(JSON.parse(localStorage.getItem('knowledgeRetry')).until > Date.now() + 3500000);
    localStorage.removeItem('knowledgeRetry');
    globalThis.fetch = mockWiki(calls, () => {
      localStorage.setItem('profileRevision', 'changed');
      return new Response(
        JSON.stringify({ query: { pages: [{ pageid: 1, title: 'Astronomy' }] } }),
      );
    });
    await assert.rejects(store.loadKnowledge(), /Settings changed/);
    assert.equal(localStorage.getItem('knowledgeCache'), null);
  } finally {
    globalThis.fetch = original;
  }
});

test('Knowledge preferences and Focus placement survive Backups while picks and rate limits remain transient', async () => {
  for (const [key, value] of Object.entries({
    knowledgeEnabled: 'true',
    knowledgeSubjects: 'art, physics',
    knowledgeSource: 'both',
    knowledgeMode: 'daily',
    knowledgeHours: '8',
    surfaceKnowledge: 'glass',
    knowledgeCache: 'private cached title',
    knowledgeRetry: '{}',
  }))
    localStorage.setItem(key, value);
  widgets.setWidgetEnabled('knowledge', true, 'focus');
  widgets.savePlacement({ knowledge: 'top-right' }, 'focus');
  const backup = await createBackup();
  assert.equal(backup.settings.knowledgeCache, undefined);
  assert.equal(backup.settings.knowledgeRetry, undefined);
  localStorage.clear();
  await importSettings(JSON.stringify(backup));
  assert.equal(localStorage.getItem('knowledgeSubjects'), 'art, physics');
  assert.equal(widgets.readPlacement('focus').knowledge, 'top-right');
  assert.equal(widgets.isWidgetEnabled('knowledge', 'focus'), true);
  assert.throws(() => validateSettings({ knowledgeSource: 'other' }), /Knowledge/);
  assert.throws(() => validateSettings({ knowledgeHours: '0' }), /Knowledge/);
});
