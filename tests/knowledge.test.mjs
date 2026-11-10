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

test('Knowledge defaults to an eight-hour page and normalizes subject filters without interpreting search operators', () => {
  assert.deepEqual(settings.readKnowledgeSettings(), {
    source: 'wikipedia',
    language: 'en',
    mode: 'hours',
    hours: 8,
    subjects: [],
  });
  assert.deepEqual(
    settings.knowledgeSubjects(' astronomy , ancient   history, astronomy, , botany '),
    ['astronomy', 'ancient history', 'botany'],
  );
  assert.equal(
    api.knowledgeQuery('commons', 'art " OR astronomy').gsrsearch,
    '"art   OR astronomy"',
  );
  assert.equal(api.knowledgeQuery('commons', '').grnnamespace, '6');
  assert.equal(api.knowledgeQuery('wikipedia', '').grnnamespace, '0');
  assert.equal(settings.validKnowledgePreference('knowledgeHours', '0'), false);
  assert.equal(settings.validKnowledgePreference('knowledgeHours', '8.5'), false);
  assert.equal(
    settings.validKnowledgePreference('knowledgeSubjects', Array(21).fill('art').join(',')),
    false,
  );
});

test('Knowledge expiry uses a local day boundary and elapsed hours without expiring reload-mode memory', () => {
  const base = new Date(2026, 10, 10, 23, 59, 0).getTime();
  const options = settings.readKnowledgeSettings();
  const day = settings.knowledgeExpiry({ ...options, mode: 'daily' }, base);
  assert.equal(new Date(day).getDate(), 11);
  assert.equal(new Date(day).getHours(), 0);
  assert.equal(settings.knowledgeExpiry(options, base), base + 8 * 3600000);
  assert.equal(settings.knowledgeExpiry({ ...options, mode: 'reload' }, base), Infinity);
  const cache = { key: settings.knowledgeKey(options), createdAt: base };
  assert.equal(store.currentKnowledgeCache(cache, options, base + 8 * 3600000 - 1), true);
  assert.equal(store.currentKnowledgeCache(cache, options, base + 8 * 3600000), false);
  assert.equal(
    store.currentKnowledgeCache(cache, { ...options, subjects: ['history'] }, base),
    false,
  );
});

test('Knowledge accepts only Wikimedia thumbnails and canonical source links while metadata stays plain text', () => {
  assert(data.validKnowledgeArticle(article()));
  for (const patch of [
    { url: 'javascript:alert(1)' },
    { url: 'https://evil.example/wiki/Astronomy' },
    { image: 'https://evil.example/track.png' },
    { imagePage: 'https://evil.example/wiki/File:Image' },
    { language: 'en.evil' },
  ])
    assert.equal(data.validKnowledgeArticle(article(patch)), false);
  assert.equal(
    data.knowledgeImage('https://upload.wikimedia.org/wikipedia/commons/test.jpg?utm_source=test'),
    'https://upload.wikimedia.org/wikipedia/commons/test.jpg',
  );
  assert.equal(data.knowledgeImage('https://user:secret@upload.wikimedia.org/image.jpg'), '');
  assert.equal(data.wikiText('<script>alert(1)</script><b>Ada &amp; Ben</b>'), 'Ada & Ben');
  assert.equal(data.wikiText('&#x41; &#66; &quot;sky&quot;'), 'A B "sky"');
});

test('Wikipedia discovery uses a bounded random/search pool, skips disambiguation and avoids the previous page', async () => {
  const original = globalThis.fetch,
    calls = [];
  globalThis.fetch = mockWiki(calls);
  try {
    const result = await provider.fetchKnowledgeArticle(settings.readKnowledgeSettings(), {
      previous: 'wikipedia:en:1',
      random: () => 0.99,
    });
    assert.equal(result.title, 'Botany');
    assert.equal(result.summary, 'An article summary.');
    assert.equal(calls[0].url.searchParams.get('generator'), 'random');
    assert.equal(calls[0].url.searchParams.get('pilicense'), 'free');
    assert.equal(calls[0].options.credentials, 'omit');
    assert.equal(calls[0].options.referrerPolicy, 'no-referrer');
    calls.length = 0;
    await provider.fetchKnowledgeArticle({
      ...settings.readKnowledgeSettings(),
      subjects: ['ancient history'],
    });
    assert.equal(calls[0].url.searchParams.get('gsrsearch'), '"ancient history"');
    assert(calls.every((call) => !call.url.searchParams.has('grnnamespace')));
  } finally {
    globalThis.fetch = original;
  }
});

test('Commons discovery includes image credits and never falls back to unrelated pages when filters have no matches', async () => {
  const original = globalThis.fetch,
    calls = [];
  globalThis.fetch = mockWiki(
    calls,
    () =>
      new Response(
        JSON.stringify({
          query: {
            pages: [
              {
                pageid: 9,
                title: 'File:Night sky.jpg',
                imageinfo: [
                  {
                    mime: 'image/jpeg',
                    thumburl: 'https://thumb.wikimedia.org/sky.jpg',
                    extmetadata: {
                      Artist: { value: '<a>Ada</a>' },
                      LicenseShortName: { value: 'CC BY-SA 4.0' },
                      ImageDescription: { value: '<p>The Milky Way</p>' },
                    },
                  },
                ],
              },
            ],
          },
        }),
      ),
  );
  try {
    const result = await provider.fetchKnowledgeArticle({
      ...settings.readKnowledgeSettings(),
      source: 'commons',
      subjects: ['astronomy'],
    });
    assert.equal(result.credit, 'Ada');
    assert.equal(result.license, 'CC BY-SA 4.0');
    assert.equal(result.summary, 'The Milky Way');
    assert.equal(result.subject, 'astronomy');
    assert(result.url.startsWith('https://commons.wikimedia.org/wiki/File'));
    globalThis.fetch = mockWiki(
      calls,
      () => new Response(JSON.stringify({ query: { pages: [] } })),
    );
    await assert.rejects(
      provider.fetchKnowledgeArticle({
        ...settings.readKnowledgeSettings(),
        subjects: ['nonexistent subject'],
      }),
      /empty/,
    );
    assert(calls.every((call) => call.url.searchParams.get('generator') === 'search'));
  } finally {
    globalThis.fetch = original;
  }
});

test('Mixed Knowledge sources can still return a page when one source is unavailable', async () => {
  const original = globalThis.fetch,
    calls = [];
  globalThis.fetch = mockWiki(calls, (url) =>
    url.hostname === 'en.wikipedia.org'
      ? new Response('{}', { status: 503 })
      : new Response(
          JSON.stringify({
            query: {
              pages: [
                {
                  pageid: 8,
                  title: 'File:Stars.jpg',
                  imageinfo: [
                    {
                      mime: 'image/jpeg',
                      thumburl: 'https://upload.wikimedia.org/stars.jpg',
                      extmetadata: {},
                    },
                  ],
                },
              ],
            },
          }),
        ),
  );
  try {
    const result = await provider.fetchKnowledgeArticle(
      { ...settings.readKnowledgeSettings(), source: 'both' },
      { random: () => 0.99 },
    );
    assert.equal(result.source, 'commons');
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = original;
  }
});
