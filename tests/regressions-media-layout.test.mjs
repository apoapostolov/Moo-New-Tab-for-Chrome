import {
  assert,
  test,
  videoCheck,
  server,
  normaliseUrl,
  mergeItems,
  loadItems,
  resolveFeedUrl,
} from './regression-fixture.mjs';

test('offline feed reads do not request the network', async () => {
  localStorage.setItem('offlineMode', 'true');
  localStorage.setItem('rssFeeds', JSON.stringify([{ url: 'https://example.com/feed' }]));
  const previous = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('Network must stay idle');
  };
  try {
    assert.deepEqual((await loadItems()).items, []);
  } finally {
    globalThis.fetch = previous;
  }
});

test('RSS starts off in the centre above Mail and every widget has a preview', async () => {
  const widgets = await server.ssrLoadModule('/src/utils/widgets.js');
  const { default: migrate } = await server.ssrLoadModule('/src/utils/settings/migrations.js');
  const { WIDGET_PREVIEWS } = await server.ssrLoadModule(
    '/src/features/misc/sections/overview_skeletons/WidgetPreview.jsx',
  );
  const { THUMB_LAYOUT } = await server.ssrLoadModule(
    '/src/features/misc/sections/overview_skeletons/WidgetThumb.jsx',
  );
  assert.equal(widgets.isWidgetEnabled('rss'), false);
  localStorage.setItem('widgetPlacement', JSON.stringify({ rss: 'right', weather: 'right' }));
  localStorage.setItem('order', JSON.stringify(['time', 'mail', 'rss', 'tasks']));
  localStorage.setItem('rssEnabled', 'true');
  migrate();
  assert.equal(widgets.isWidgetEnabled('rss'), false);
  assert.equal(widgets.readPlacement().rss, 'center');
  assert.equal(widgets.readOrder().indexOf('rss') + 1, widgets.readOrder().indexOf('mail'));
  localStorage.setItem('rssEnabled', 'true');
  migrate();
  assert.equal(widgets.isWidgetEnabled('rss'), true);
  for (const widget of widgets.WIDGETS) {
    assert(Object.hasOwn(WIDGET_PREVIEWS, widget.id), `Missing ${widget.id} preview`);
    assert(WIDGET_PREVIEWS[widget.id] || THUMB_LAYOUT[widget.id], `Empty ${widget.id} preview`);
  }
});

test('Overview separates full-width centre lines from paired cards without changing side-column order', async () => {
  const { overviewRows } = await server.ssrLoadModule(
    '/src/features/misc/sections/overviewLayout.js',
  );
  const ids = ['time', 'mail', 'date', 'tasks', 'aiask', 'portfolio'];
  assert.deepEqual(overviewRows(ids, ['mail', 'tasks'], 'center'), [
    ['time'],
    ['date'],
    ['aiask'],
    ['mail', 'tasks'],
    ['portfolio'],
  ]);
  assert.deepEqual(
    overviewRows(ids, ['mail', 'tasks'], 'left'),
    ids.map((id) => [id]),
  );
  assert.deepEqual(overviewRows(['time', 'mail'], ['mail'], 'center'), [['time'], ['mail']]);
});

test('video uploads recognise MIME types and video URLs with query strings', () => {
  for (const value of [
    'video/mp4',
    'video/webm',
    'data:video/mp4;base64,AA==',
    'https://example.com/clip.MP4?token=fixture',
  ])
    assert.equal(videoCheck(value), true);
  for (const value of ['image/png', undefined, 'https://example.com/photo.jpg'])
    assert.equal(videoCheck(value), false);
});

test('feed links resolve relative URLs and reject executable or unsupported schemes', () => {
  assert.equal(resolveFeedUrl('/story', 'https://example.com/feed'), 'https://example.com/story');
  assert.equal(resolveFeedUrl('javascript:alert(1)', 'https://example.com/feed'), '');
  assert.equal(normaliseUrl('feed://example.com/rss'), 'https://example.com/rss');
  assert.equal(normaliseUrl('ftp://example.com/rss'), null);
});

test('feed deduplication keeps distinct query-based stories and ignores tracking parameters', () => {
  const items = [
    { link: 'https://example.com/?p=1', date: 1 },
    { link: 'https://example.com/?p=2', date: 2 },
    { link: 'https://example.com/?p=1&utm_source=rss', date: 1 },
  ];
  assert.equal(mergeItems(items).length, 2);
});

test('webcam migration preserves custom channels and does not restore removed entries', async () => {
  const live = await server.ssrLoadModule('/src/features/background/api/live.js');
  assert.ok(live.LIVE_CHANNELS.filter((entry) => entry.id.startsWith('webcam-')).length >= 100);
  localStorage.setItem(
    'liveChannels',
    JSON.stringify([{ id: 'custom', name: 'Mine', url: 'https://example.com/live.m3u8' }]),
  );
  const migrated = live.readChannels();
  assert.equal(migrated[0].id, 'custom');
  assert.ok(migrated.length > 100);
  const removed = migrated.find((entry) => entry.id.startsWith('webcam-'));
  live.removeChannel(removed.id);
  assert.equal(
    live.readChannels().some((entry) => entry.id === removed.id),
    false,
  );
  localStorage.clear();
  localStorage.setItem('liveChannels', '[]');
  assert.deepEqual(live.readChannels(), []);
});

test('public video libraries reject unusable and copyrighted results', async () => {
  const { fetchNasaVideo, fetchCommonsVideo } = await server.ssrLoadModule(
    '/src/features/background/api/publicVideo.js',
  );
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      const address = String(url);
      if (address.includes('images-api.nasa.gov'))
        return Response.json({
          collection: {
            items: [
              {
                href: 'https://images-assets.nasa.gov/video/test/collection.json',
                data: [{ nasa_id: 'test', title: 'Earth' }],
              },
            ],
          },
        });
      if (address.includes('images-assets.nasa.gov'))
        return Response.json(['http://images-assets.nasa.gov/video/test/test~medium.mp4']);
      return Response.json({
        query: {
          pages: {
            1: {
              pageid: 1,
              title: 'File:Free.webm',
              imageinfo: [
                {
                  url: 'https://upload.wikimedia.org/free.webm',
                  mime: 'video/webm',
                  extmetadata: { LicenseShortName: { value: 'CC0' } },
                },
              ],
            },
            2: {
              pageid: 2,
              title: 'File:Restricted.webm',
              imageinfo: [
                {
                  url: 'https://upload.wikimedia.org/restricted.webm',
                  mime: 'video/webm',
                  extmetadata: { LicenseShortName: { value: 'All rights reserved' } },
                },
              ],
            },
          },
        },
      });
    };
    const nasa = await fetchNasaVideo();
    assert.equal(nasa.url, 'https://images-assets.nasa.gov/video/test/test~medium.mp4');
    assert.equal(nasa.sourceCredit.text, 'NASA');
    const commons = await fetchCommonsVideo();
    assert.equal(commons.photoInfo.id, 'commons-1');
    assert.match(commons.sourceCredit.url, /^https:\/\/commons\.wikimedia\.org\/wiki\//);
  } finally {
    globalThis.fetch = original;
  }
});
