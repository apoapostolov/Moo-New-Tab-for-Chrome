import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { createServer } from 'vite';

/**
 * The OPML reader and writer, and the Feedly entry mapping, are pure functions: they run
 * here without a browser, which is the only way to check an import shape before a feed
 * list is on screen.
 */

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

const server = await createServer({
  server: { middlewareMode: true, hmr: false, open: false },
  logLevel: 'silent',
});

const { buildOpml, opmlFilename, parseOpml } = await server.ssrLoadModule(
  '/src/features/rss/opml.js',
);
const { mergeFeeds, readFeeds, readRssServiceUrl, saveFeeds } = await server.ssrLoadModule(
  '/src/features/rss/feedStore.js',
);
const { mapEntry, budgetState } = await server.ssrLoadModule('/src/features/rss/feedly.js');

after(async () => {
  await server.close();
});

beforeEach(() => {
  localStorage.clear();
});

test('the RSS title service defaults to Feedly and rejects unsafe addresses', () => {
  assert.equal(readRssServiceUrl(), 'https://www.feedly.com/');

  localStorage.setItem('rssServiceUrl', 'reader.example/inbox');
  assert.equal(readRssServiceUrl(), 'https://reader.example/inbox');

  localStorage.setItem('rssServiceUrl', 'javascript:alert(1)');
  assert.equal(readRssServiceUrl(), 'https://www.feedly.com/');
});

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Subscriptions</title></head>
  <body>
    <outline text="Tech" title="Tech">
      <outline type="rss" text="The Verge" title="The Verge" xmlUrl="https://www.theverge.com/rss/index.xml" htmlUrl="https://www.theverge.com"/>
      <outline text="Nested" title="Nested">
        <outline type="rss" text="LWN" xmlUrl="https://lwn.net/headlines/rss"/>
      </outline>
    </outline>
    <outline type="rss" text="Bare feed" xmlUrl="https://example.com/feed.xml"/>
    <outline type="rss" text="Dupe" xmlUrl="https://example.com/feed.xml"/>
    <outline text="Empty folder"/>
    <outline type="rss" text="No address"/>
  </body>
</opml>`;

test('a nested export is read with its folders and without its duplicates', () => {
  const { feeds, skipped, error } = parseOpml(SAMPLE);

  assert.equal(error, '');
  assert.equal(skipped, 1, 'the repeated address is counted, not kept');
  assert.deepEqual(
    feeds.map((feed) => [feed.title, feed.folder]),
    [
      ['The Verge', 'Tech'],
      ['LWN', 'Tech / Nested'],
      ['Bare feed', ''],
    ],
  );
});

test('attribute case, single quotes and entities are all read', () => {
  const text = `<opml><body><outline XMLURL='https://example.com/a?x=1&amp;y=2' TEXT='B&amp;B News'/></body></opml>`;
  const { feeds } = parseOpml(text);

  assert.equal(feeds.length, 1);
  assert.equal(feeds[0].url, 'https://example.com/a?x=1&y=2');
  assert.equal(feeds[0].title, 'B&B News');
});

test('a file that is not OPML, or holds no feeds, is reported rather than guessed', () => {
  assert.equal(parseOpml('<html><body/></html>').error, 'not_opml');
  assert.equal(
    parseOpml('<opml><body><outline text="Only a folder"/></body></opml>').error,
    'no_feeds',
  );
});

test('an export groups folders, escapes what it writes and reads back unchanged', () => {
  const feeds = [
    { url: 'https://a.example/feed', title: 'A & B', folder: 'Tech' },
    { url: 'https://b.example/rss', title: 'Deep', folder: 'Tech / Nested' },
    { url: 'https://c.example/rss', title: 'Loose' },
  ];

  const opml = buildOpml(feeds);

  assert.match(opml, /<opml version="2.0">/);
  assert.match(opml, /text="A &amp; B"/);
  assert.match(opml, /<outline text="Nested" title="Nested">/);

  const { feeds: round } = parseOpml(opml);

  // Folders are written before loose feeds, so the order is not the import order: what
  // has to survive is the address, the label and the path.
  assert.deepEqual(Object.fromEntries(round.map((feed) => [feed.url, [feed.title, feed.folder]])), {
    'https://a.example/feed': ['A & B', 'Tech'],
    'https://b.example/rss': ['Deep', 'Tech / Nested'],
    'https://c.example/rss': ['Loose', ''],
  });
});

test('a folder with nothing under it is still written, and a feed keeps its path', () => {
  const { feeds } = parseOpml(buildOpml([{ url: 'https://a.example/feed', folder: 'Later' }]));
  const exported = buildOpml([
    { url: 'https://a.example/feed', title: 'A', folder: 'Later / Deeper' },
  ]);

  assert.equal(feeds.length, 1);
  assert.match(exported, /<outline text="Deeper" title="Deeper">/);
});

test('the export file name is dated', () => {
  assert.equal(opmlFilename(new Date('2026-10-29T10:00:00Z')), 'moo-feeds-2026-10-29.opml');
});

test('an import joins the list, keeps titles already there and counts the rest', () => {
  saveFeeds([{ url: 'https://a.example/feed', title: 'Mine' }]);

  const merged = mergeFeeds(readFeeds(), [
    { url: 'https://a.example/feed', title: 'Theirs' },
    { url: 'https://b.example/feed', title: 'New', folder: 'Tech' },
    { url: 'not an address' },
  ]);

  assert.equal(merged.added, 1);
  assert.equal(merged.duplicates, 1);
  assert.equal(merged.invalid, 1);
  assert.deepEqual(merged.feeds, [
    { url: 'https://a.example/feed', title: 'Mine' },
    { url: 'https://b.example/feed', title: 'New', folder: 'Tech' },
  ]);
});

test('a Feedly entry becomes the card item shape', () => {
  const item = mapEntry({
    id: 'entry-1',
    title: 'Wind &amp; rain',
    published: 1700000000000,
    unread: true,
    alternate: [{ href: 'https://example.com/story' }],
    origin: {
      title: 'Example',
      htmlUrl: 'https://example.com',
      visualUrl: 'https://example.com/i.png',
    },
    summary: { content: '<p>A short summary.</p>' },
    content: {
      content:
        '<p>First para.</p><p>Second <b>para</b>.</p><img src="https://example.com/pic.jpg"/>',
    },
    categories: [{ id: 'user/x/category/tech', label: 'tech' }],
    enclosure: [{ href: 'https://example.com/audio.mp3', type: 'audio/mpeg' }],
  });

  assert.equal(item.title, 'Wind & rain');
  assert.equal(item.link, 'https://example.com/story');
  assert.equal(item.source.title, 'Example');
  assert.equal(item.folder, 'tech');
  assert.equal(item.date, 1700000000000);
  assert.equal(item.image, 'https://example.com/i.png', 'the feed image beats an audio enclosure');
  assert.equal(item.excerpt, 'A short summary.');
  assert.match(item.content, /First para/);
  assert.equal(item.entryId, 'entry-1');
  assert.equal(item.unread, true);
});

test('a Feedly entry with no address or picture still maps', () => {
  const item = mapEntry({ id: 'entry-2', title: 'Bare', content: { content: '<p>Text only</p>' } });

  assert.equal(item.link, '');
  assert.equal(item.image, null);
  assert.equal(item.source.title, '');
  assert.equal(item.date, 0);
});

test('the calls counter reads as spent until its reset has passed', () => {
  const now = 1_700_000_000_000;

  localStorage.setItem(
    'feedlyBudget',
    JSON.stringify({ count: 12, limit: 50, resetAt: now + 3_600_000, at: now }),
  );
  assert.deepEqual(budgetState(now), { used: 12, left: 38, limit: 50, resetInMinutes: 60 });

  assert.equal(budgetState(now + 7_200_000).used, 0, 'a reset starts the day again');
  assert.equal(budgetState(now + 7_200_000).left, 50);
});
