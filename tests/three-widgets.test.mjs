import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
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
const habits = await server.ssrLoadModule('/src/features/habits/habitStore.js');
const air = await server.ssrLoadModule('/src/features/airquality/airQualityStore.js');
const github = await server.ssrLoadModule('/src/features/github/githubStore.js');
const backup = await server.ssrLoadModule('/src/utils/settings/backupSchema.js');
const profile = await server.ssrLoadModule('/src/utils/settings/profile.js');
const translations = await server.ssrLoadModule('/src/lib/translations.js');
await translations.selectLanguage('en_GB');
const { AirQualityContent } = await server.ssrLoadModule(
  '/src/features/airquality/AirQualityContent.jsx',
);
const { default: HabitTable } = await server.ssrLoadModule('/src/features/habits/HabitTable.jsx');
after(async () => {
  globalThis.fetch = originalFetch;
  await server.close();
});
beforeEach(() => {
  localStorage.clear();
  globalThis.fetch = originalFetch;
});
const habit = (overrides = {}) => ({
  id: 'walk',
  title: 'Walk',
  description: '',
  frequency: 'daily',
  days: [1, 2, 3, 4, 5],
  target: 1,
  step: 1,
  unit: '',
  startDate: '2026-10-01',
  archived: false,
  logs: {},
  ...overrides,
});
const save = (values) =>
  Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
const airPayload = () => ({
  timezone: 'Europe/Berlin',
  current: { time: 1793181600, european_aqi: 23, us_aqi: 39, pm2_5: 0 },
  hourly: { time: [1793181600, 1793185200], european_aqi: [23, 29], us_aqi: [39, 44] },
});
const airLocation = () =>
  save({
    airQualityLocationMode: 'coordinates',
    airQualityLatitude: '52.52',
    airQualityLongitude: '13.41',
    airQualityLocation: 'Berlin',
  });
const githubAccount = (overrides = {}) =>
  save({ githubUsername: 'octocat', githubShowActions: 'false', ...overrides });
const issue = (title = 'Review change') => ({
  id: 42,
  title,
  number: 7,
  state: 'open',
  html_url: 'https://github.com/octocat/Hello-World/pull/7',
  updated_at: '2026-10-27T10:00:00Z',
});

test('habit dates respect zones, day boundaries, leap years and DST', () => {
  assert.equal(habits.validDay('2026-02-29'), false);
  assert.equal(habits.validDay('2028-02-29'), true);
  assert.equal(habits.shiftDay('2026-03-29', -1), '2026-03-28');
  assert.equal(
    habits.habitDay(new Date('2026-03-29T01:30:00Z'), { zone: 'Europe/Berlin', start: '04:00' }),
    '2026-03-28',
  );
  assert.equal(
    habits.habitDay(new Date('2026-03-29T02:30:00Z'), { zone: 'Europe/Berlin', start: '04:00' }),
    '2026-03-29',
  );
  assert.equal(
    habits.habitDay(new Date('2026-01-01T01:30:00Z'), { zone: 'America/New_York', start: '00:00' }),
    '2025-12-31',
  );
  assert.equal(habits.validZone('bad-zone'), false);
  assert.equal(habits.weekOf('2026-10-25', 1), '2026-10-19');
  assert.equal(habits.weekOf('2026-10-25', 0), '2026-10-25');
});
test('weekday streaks skip rest days but never forgive a missed scheduled day', () => {
  const value = habit({ frequency: 'weekdays', logs: { '2026-10-22': 1, '2026-10-23': 1 } });
  assert.equal(habits.scheduled(value, '2026-10-24'), false);
  assert.equal(habits.habitStreak(value, '2026-10-25'), 2);
  assert.equal(habits.habitStreak(value, '2026-10-26'), 2);
  assert.equal(habits.habitStreak(value, '2026-10-27'), 0);
  assert.equal(habits.habitStreak({ ...value, logs: { '2026-10-22': 1 } }, '2026-10-25'), 0);
});

test('habit table weeks respect Sunday/Monday boundaries and distinguish rest, future and missed cells', () => {
  assert.deepEqual(habits.habitWeek('2026-11-01', 1), [
    '2026-10-26',
    '2026-10-27',
    '2026-10-28',
    '2026-10-29',
    '2026-10-30',
    '2026-10-31',
    '2026-11-01',
  ]);
  assert.equal(habits.habitWeek('2026-11-01', 0)[0], '2026-11-01');
  const value = habit({ frequency: 'weekdays', target: 8, logs: { '2026-10-29': 3 } });
  assert.equal(habits.habitCell(value, '2026-10-29', '2026-10-29').fraction, 1 / 2);
  assert.equal(habits.habitCell(value, '2026-10-28', '2026-10-29').missed, true);
  assert.equal(habits.habitCell(value, '2026-10-31', '2026-10-29').due, false);
  assert.equal(habits.habitCell(value, '2026-10-30', '2026-10-29').editable, false);
  assert.equal(
    habits.habitCell({ ...value, frequency: 'weekly' }, '2026-10-28', '2026-10-29').missed,
    false,
  );
  assert.equal(habits.habitCell(value, '2026-09-30', '2026-10-29').editable, false);
});

test('habit rows contain names and seven day controls while keeping descriptions and targets out of visible rows', () => {
  const value = habit({
    title: 'Drink water',
    description: 'Private detail belongs in the hover panel',
    target: 8,
    unit: 'glasses',
    logs: { '2026-10-29': 3 },
  });
  const noop = () => {};
  const html = renderToStaticMarkup(
    React.createElement(HabitTable, {
      habits: [value],
      days: habits.habitWeek('2026-10-29'),
      today: '2026-10-29',
      locale: 'en-GB',
      pending: false,
      onHover: noop,
      onFocus: noop,
      onLeave: noop,
      onName: noop,
      onCell: noop,
    }),
  );
  assert.ok(html.includes('<table') && html.includes('<thead>') && html.includes('Drink water'));
  assert.equal((html.match(/<button[^>]+class="habitCell/g) || []).length, 7);
  assert.ok(
    !html.includes(value.description) && !html.includes('glasses') && !html.includes('streak'),
  );
  assert.ok(html.includes('Undo Drink water') && html.includes('aria-pressed="true"'));
  assert.ok(html.includes('isFuture') && html.includes('disabled=""'));
});
test('weekly goals count confirmed days once and corrections preserve original history', () => {
  const value = habit({
    frequency: 'weekly',
    target: 3,
    logs: { '2026-10-19': 2, '2026-10-23': 1, '2026-10-26': 1 },
  });
  assert.deepEqual(habits.habitProgress(value, '2026-10-23'), {
    count: 2,
    target: 3,
    fraction: 2 / 3,
    complete: false,
  });
  assert.equal(habits.habitStreak(value, '2026-10-27'), 1);
  const corrected = habits.logHabit(value, '2026-10-23', 0);
  assert.equal(corrected.logs['2026-10-23'], undefined);
  assert.equal(value.logs['2026-10-23'], 1);
  assert.equal(habits.habitProgress(corrected, '2026-10-23').fraction, 1 / 3);
  assert.throws(() => habits.logHabit(value, '2026-09-01', 2));
});
test('habit writes serialize against latest progress and damaged data is preserved', async () => {
  save({ habitsData: JSON.stringify([habit({ target: 8 })]) });
  await Promise.all(
    Array.from({ length: 6 }, () =>
      habits.updateHabits((current) =>
        current.map((item) =>
          habits.logHabit(item, '2026-10-28', (item.logs['2026-10-28'] || 0) + 1),
        ),
      ),
    ),
  );
  assert.equal(habits.readHabits().habits[0].logs['2026-10-28'], 1);
  localStorage.setItem('habitsData', '[broken');
  await assert.rejects(
    habits.updateHabits(() => []),
    /damaged/,
  );
  assert.equal(localStorage.getItem('habitsData'), '[broken');
  assert.equal(habits.validHabits([habit(), habit()]), false);
  assert.equal(habits.validHabit(habit({ logs: { '2026-02-30': 1 } })), false);
});

test('daily confirmation is binary and stale, future and rest-day confirmations are rejected', () => {
  const original = habit({ target: 8, logs: { '2026-10-27': 3 } });
  const confirmed = habits.confirmHabit(original, '2026-10-28', true, false, '2026-10-29');
  assert.equal(confirmed.logs['2026-10-28'], 1);
  assert.equal(confirmed.logs['2026-10-27'], 3);
  assert.equal(original.logs['2026-10-28'], undefined);
  assert.throws(
    () => habits.confirmHabit(confirmed, '2026-10-28', true, false, '2026-10-29'),
    /habit-changed/,
  );
  assert.equal(
    habits.confirmHabit(confirmed, '2026-10-28', false, true, '2026-10-29').logs['2026-10-28'],
    undefined,
  );
  assert.throws(
    () => habits.confirmHabit(original, '2026-10-30', true, false, '2026-10-29'),
    /invalid-day/,
  );
  assert.throws(
    () =>
      habits.confirmHabit(
        habit({ frequency: 'weekdays' }),
        '2026-10-25',
        true,
        false,
        '2026-10-29',
      ),
    /invalid-day/,
  );
});

test('concurrent confirmation intents cannot add a second confirmation or silently undo another tab', async () => {
  save({ habitsData: JSON.stringify([habit()]) });
  const results = await Promise.allSettled(
    Array.from({ length: 2 }, () =>
      habits.updateHabits((current) =>
        current.map((item) => habits.confirmHabit(item, '2026-10-28', true, false, '2026-10-29')),
      ),
    ),
  );
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(habits.readHabits().habits[0].logs['2026-10-28'], 1);
});

test('ten milestones follow the best streak through a break and recompute after historical undo', () => {
  assert.deepEqual(habits.HABIT_MILESTONES, [2, 5, 10, 20, 30, 60, 90, 180, 270, 365]);
  for (const days of habits.HABIT_MILESTONES) {
    const logs = Object.fromEntries(
      Array.from({ length: days }, (_, index) => [habits.shiftDay('2025-01-01', index), 1]),
    );
    const value = habit({ startDate: '2025-01-01', logs });
    const end = habits.shiftDay('2025-01-01', days - 1);
    assert.equal(habits.habitStreak(value, end), days);
    assert.equal(habits.habitMilestone(value, habits.shiftDay(end, 2)), days);
    assert.deepEqual(habits.habitStreaks(value, habits.shiftDay(end, 2)), {
      current: 0,
      best: days,
    });
  }
  const value = habit({
    logs: { '2026-10-26': 1, '2026-10-27': 1, '2026-10-28': 1, '2026-10-29': 1, '2026-10-30': 1 },
  });
  assert.equal(habits.habitMilestone(value, '2026-10-30'), 5);
  assert.equal(habits.habitMilestone(habits.logHabit(value, '2026-10-28', 0), '2026-10-30'), 2);
});

test('monthly history counts recorded days rather than amounts, respects schedules and leaves future months empty', () => {
  const value = habit({
    startDate: '2024-01-01',
    logs: {
      '2024-02-29': 8,
      '2026-09-30': 2,
      '2026-10-01': 8,
      '2026-10-02': 1,
      '2026-10-30': 1,
      '2026-11-01': 1,
    },
  });
  assert.equal(habits.habitMonths(value, 2024, '2026-10-29')[1].count, 1);
  const months = habits.habitMonths(value, 2026, '2026-10-29');
  assert.equal(months.length, 12);
  assert.equal(months[8].count, 1);
  assert.equal(months[9].count, 2);
  assert.equal(months[10].count, null);
  assert.equal(
    habits.habitMonths({ ...value, frequency: 'weekdays', days: [4] }, 2026, '2026-10-29')[9].count,
    1,
  );
});

test('day rings show the streak reached that day toward its next milestone', () => {
  const logs = Object.fromEntries(
    Array.from({ length: 366 }, (_, index) => [habits.shiftDay('2025-01-01', index), 1]),
  );
  const value = habit({ startDate: '2025-01-01', logs });
  for (const [day, threshold] of [
    [1, 2],
    [2, 2],
    [3, 5],
    [5, 5],
    [6, 10],
    [10, 10],
    [11, 20],
    [364, 365],
    [365, 365],
    [366, 365],
  ]) {
    const cell = habits.habitCell(value, habits.shiftDay('2025-01-01', day - 1), '2026-10-29');
    assert.equal(cell.streak, day);
    assert.equal(cell.threshold, threshold);
    assert.equal(cell.fraction, Math.min(1, day / threshold));
  }
  assert.equal(habits.habitCell(habit(), '2026-10-29', '2026-10-29').fraction, 0);
});
test('AQI boundaries match both official scales and missing readings stay missing', () => {
  assert.deepEqual(
    [0, 20, 21, 40, 41, 60, 61, 80, 81, 100, 101].map((value) => air.aqiBand(value)),
    [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5],
  );
  assert.deepEqual(
    [50, 51, 100, 101, 150, 151, 200, 201, 300, 301].map((value) => air.aqiBand(value, 'us')),
    [0, 1, 1, 2, 2, 3, 3, 4, 4, 5],
  );
  for (const value of [null, undefined, '', -1, Infinity, NaN])
    assert.equal(air.numberReading(value), null);
  assert.equal(air.numberReading(0), 0);
  for (const pair of [
    [null, 0],
    [undefined, 0],
    ['', 0],
    [' ', 0],
    [91, 0],
    [0, 181],
  ])
    assert.equal(air.coordinatesValid(...pair), false);
  assert.equal(air.coordinatesValid('0', '0'), true);
});

test('Air Quality defaults to Basic and keeps the detail preference in backups', () => {
  assert.equal(air.airDetailLevel(), 'basic');
  for (const level of ['summary', 'detailed']) {
    localStorage.setItem('airQualityDetailLevel', level);
    assert.equal(air.airDetailLevel(), level);
    assert.equal(
      backup.validateSettings({ airQualityDetailLevel: level }).settings.airQualityDetailLevel,
      level,
    );
  }
  localStorage.setItem('airQualityDetailLevel', 'unknown');
  assert.equal(air.airDetailLevel(), 'basic');
});

test('AQI forecasts have a rolling 24-hour boundary and retain missing hours as gaps', () => {
  const start = 1000000000000;
  const data = {
    updated: start,
    hourly: {
      time: [start - 3600000, start, start + 3600000, start + 7200000, start + 86400000],
      european_aqi: [10, 0, null, 40, 90],
    },
  };
  const forecast = air.airForecast(data, 'european');
  assert.deepEqual(
    forecast.map((item) => item.value),
    [0, null, 40],
  );
  const trend = air.airTrend(forecast, 'european');
  assert.equal(trend.peak.value, 40);
  assert.equal(trend.ceiling, 40);
  assert.equal(trend.paths.length, 2);
  assert.ok(trend.paths.every((path) => !path.includes('NaN')));
  assert.equal(
    air.airTrend(
      [
        { time: 0, value: 0 },
        { time: 7200000, value: 20 },
      ],
      'us',
    ).paths.length,
    2,
  );
  assert.equal(air.airTrend([{ time: 0, value: null }], 'us').peak, null);
});

test('Air Quality depth progressively reveals forecasts and measurements without losing options', () => {
  const data = air.parseAirData(airPayload(), 'Berlin', air.airSettings(), 1793181600000);
  const props = {
    data,
    scale: 'european',
    format: (value) => (value === null ? '—' : String(value)),
    time: (value) => new Date(value).toISOString().slice(11, 16),
    showForecast: true,
    showPollutants: true,
    metrics: ['pm2_5', 'nitrogen_dioxide'],
    showUV: true,
    showPollen: true,
  };
  const render = (level) =>
    renderToStaticMarkup(React.createElement(AirQualityContent, { ...props, level }));
  const basic = render('basic');
  assert.ok(basic.includes('Berlin') && basic.includes('Fair'));
  assert.ok(
    !basic.includes('airTrend') && !basic.includes('airMeasurements') && !basic.includes('Pollen'),
  );
  const summary = render('summary');
  assert.ok(summary.includes('Next 24 hours') && summary.includes('airTrendLine'));
  assert.ok(
    !summary.includes('airMeasurements') &&
      !summary.includes('Hourly values') &&
      !summary.includes('<table>'),
  );
  const detailed = render('detailed');
  assert.ok(
    detailed.includes('Nitrogen dioxide') &&
      detailed.includes('UV index') &&
      detailed.includes('Pollen'),
  );
  assert.ok(detailed.includes('airPollen"><summary>') && !detailed.includes('airPollen" open'));
  assert.ok(!detailed.includes('Hourly values') && !detailed.includes('<table>'));
  assert.equal(render('basic'), basic);
});

test('a profile change cancels a pending habit write before it can enter the new profile', async () => {
  save({ habitsData: JSON.stringify([habit()]), profileRevision: 'original' });
  const pending = habits.updateHabits((current) =>
    current.map((item) => ({ ...item, title: 'Old editor' })),
  );
  localStorage.setItem('profileRevision', 'replaced');
  await assert.rejects(pending, /profile-changed/);
  assert.equal(habits.readHabits().habits[0].title, 'Walk');
});
test('air parsing normalizes time, keeps unavailable pollen null and rejects corrupt caches', () => {
  airLocation();
  const parsed = air.parseAirData(airPayload(), 'Berlin', air.airSettings());
  assert.equal(parsed.measured, 1793181600000);
  assert.equal(parsed.current.pm2_5, 0);
  assert.equal(parsed.current.grass_pollen, null);
  assert.deepEqual(parsed.hourly.pm2_5, [null, null]);
  localStorage.setItem('airQualityCache', JSON.stringify(parsed));
  assert.ok(air.readAirCache());
  localStorage.setItem('airQualityCache', JSON.stringify({ ...parsed, timezone: 'bad-zone' }));
  assert.equal(air.readAirCache(), null);
  localStorage.setItem('airQualityCache', JSON.stringify({ ...parsed, updated: 1e100 }));
  assert.equal(air.readAirCache(), null);
  localStorage.setItem('airQualityCache', JSON.stringify({ ...parsed, hourly: { time: [] } }));
  assert.equal(air.readAirCache(), null);
  assert.throws(
    () => air.parseAirData({ current: { time: 1 }, hourly: { time: [] } }, '', air.airSettings()),
    /no-data/,
  );
});
test('air requests include 24-hour coverage; offline and failed refresh retain matching cached data', async () => {
  airLocation();
  let requests = 0;
  globalThis.fetch = async (url) => {
    requests++;
    const query = new URL(url).searchParams;
    assert.equal(query.get('forecast_hours'), '24');
    assert.equal(query.get('timeformat'), 'unixtime');
    assert.ok(query.get('current').includes('grass_pollen'));
    return json(airPayload());
  };
  const first = await air.loadAirQuality();
  assert.equal(first.data.location, 'Berlin');
  await air.loadAirQuality();
  assert.equal(requests, 1);
  save({ offlineMode: 'true' });
  assert.equal((await air.loadAirQuality()).error.message, 'offline');
  save({ offlineMode: 'false' });
  globalThis.fetch = async () => json({}, 503);
  assert.equal((await air.loadAirQuality(true)).data.current.european_aqi, 23);
  save({ airQualityLongitude: '0' });
  await assert.rejects(air.loadAirQuality(true), /network/);
});
test('in-flight air responses cannot populate a changed location', async () => {
  airLocation();
  globalThis.fetch = async () => {
    localStorage.setItem('airQualityLatitude', '0');
    return json(airPayload());
  };
  await assert.rejects(air.loadAirQuality(), /changed/);
  assert.equal(localStorage.getItem('airQualityCache'), null);
});
test('GitHub search separates issue and PR filters, scope and draft choices', () => {
  githubAccount({
    githubRepositories: 'octocat/Hello-World, openai/codex',
    githubOrganization: 'openai',
    githubExtraQuery: 'label:bug',
    githubState: 'closed',
  });
  const settings = github.githubSettings();
  const query = github.githubQuery('pulls', settings, 'octocat');
  assert.ok(query.includes('is:pr author:octocat is:closed draft:false'));
  assert.ok(query.includes('repo:openai/codex org:openai label:bug'));
  assert.ok(github.githubQuery('reviews', settings, 'octocat').includes('is:open'));
  assert.ok(
    github.githubQuery('issues', settings, 'octocat').startsWith('is:issue assignee:octocat'),
  );
  assert.equal(github.githubLink('javascript:alert(1)'), null);
  assert.equal(github.githubLink('https://github.com.evil.test/a/b'), null);
  assert.equal(github.githubLink('https://user:pass@github.com/a/b'), null);
  assert.equal(github.validRepository('owner/../evil'), false);
});
test('GitHub title destinations cover key pages and account repositories', () => {
  assert.equal(github.githubTitleUrl('octocat'), 'https://github.com/');
  for (const [destination, url] of [
    ['notifications', 'https://github.com/notifications'],
    ['pulls', 'https://github.com/pulls'],
    ['issues', 'https://github.com/issues'],
    ['explore', 'https://github.com/explore'],
    ['profile', 'https://github.com/octocat'],
    ['repositories', 'https://github.com/octocat?tab=repositories'],
  ]) {
    localStorage.setItem('githubTitleDestination', destination);
    assert.equal(github.githubTitleUrl('octocat'), url);
  }
  localStorage.setItem('githubTitleDestination', 'repositories');
  assert.equal(github.githubTitleUrl(''), 'https://github.com/');
});
test('GitHub public mode caches minimal safe rows and token identities never contain the credential', async () => {
  githubAccount({ githubToken: 'test-private-token' });
  let count = 0;
  globalThis.fetch = async (url, options) => {
    count++;
    assert.equal(options.headers.Authorization, 'Bearer test-private-token');
    assert.equal(options.headers['X-GitHub-Api-Version'], '2026-03-10');
    assert.equal(new URL(url).searchParams.get('per_page'), '6');
    return json({
      total_count: 1,
      items: [issue(), { ...issue(), html_url: 'https://evil.test/' }],
    });
  };
  const result = await github.loadGitHub();
  assert.equal(result.data.views.reviews.items.length, 1);
  assert.equal(result.data.authenticated, true);
  assert.equal(localStorage.getItem('githubCache').includes('test-private-token'), false);
  await github.loadGitHub();
  assert.equal(count, 3);
  save({ offlineMode: 'true' });
  assert.equal((await github.loadGitHub()).error.message, 'offline');
});

test('GitHub retains complete descriptions and normalizes developer metadata without adding detail requests', async () => {
  githubAccount();
  const body = '# Full description\n\n' + 'A paragraph of detail.\n\n'.repeat(3000) + 'END OF BODY';
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return json({
      total_count: 1,
      items: [
        {
          ...issue(),
          body,
          comments: 12,
          user: { login: 'developer' },
          labels: [
            { name: 'bug', color: 'ff0000' },
            { name: 'unsafe style', color: 'red;position:fixed' },
          ],
          assignees: [{ login: 'reviewer' }],
          created_at: '2026-10-01T10:00:00Z',
          pull_request: { merged_at: '2026-10-28T10:00:00Z' },
          state: 'closed',
        },
      ],
    });
  };
  const result = await github.loadGitHub();
  const item = result.data.views.pulls.items[0];
  assert.equal(item.body, body);
  assert.equal(item.state, 'merged');
  assert.equal(item.kind, 'pull');
  assert.equal(item.author, 'developer');
  assert.equal(item.comments, 12);
  assert.equal(item.labels[1].color, null);
  assert.deepEqual(item.assignees, ['reviewer']);
  assert.equal(requests, 3);
  assert.equal(JSON.parse(localStorage.getItem('githubCache')).views.pulls.items[0].body, body);
});

test('GitHub preview links resolve repository files and reject executable or credential-bearing destinations', async () => {
  const { githubBodyUrl, githubStatus } = await server.ssrLoadModule(
    '/src/features/github/githubPresentation.js',
  );
  const item = { repository: 'owner/project', url: 'https://github.com/owner/project/issues/7' };
  assert.equal(
    githubBodyUrl('docs/setup.md', item),
    'https://github.com/owner/project/blob/HEAD/docs/setup.md',
  );
  assert.equal(githubBodyUrl('#context', item), item.url + '#context');
  assert.equal(
    githubBodyUrl('assets/example.png', item, true),
    'https://github.com/owner/project/blob/HEAD/assets/example.png?raw=true',
  );
  for (const link of [
    'javascript:alert(1)',
    'data:text/html,evil',
    'file:///secret',
    'https://user:secret@example.com/image.png',
  ])
    assert.equal(githubBodyUrl(link, item), null);
  assert.equal(githubStatus({ state: 'merged', kind: 'pull' }, 'pulls').tone, 'merged');
  assert.equal(githubStatus({ state: 'open', draft: true, kind: 'pull' }, 'pulls').state, 'draft');
  assert.equal(githubStatus({ state: 'timed_out', kind: 'action' }, 'actions').tone, 'danger');
  assert.equal(githubStatus({ state: 'unexpected', kind: 'action' }, 'actions').state, 'unknown');
});

test('GitHub rows keep the full title and an accessible preview without including body or labels in the row', async () => {
  const { default: GitHubRow } = await server.ssrLoadModule('/src/features/github/GitHubRow.jsx');
  const item = {
    id: '7',
    kind: 'pull',
    title: 'Fix loading with a useful descriptive title',
    repository: 'owner/project',
    url: 'https://github.com/owner/project/pull/7',
    number: 7,
    state: 'open',
    comments: 4,
    body: 'PRIVATE BODY IN PREVIEW ONLY',
    labels: [{ name: 'Only in hover', color: null }],
  };
  const html = renderToStaticMarkup(
    React.createElement(GitHubRow, {
      item,
      view: 'pulls',
      locale: 'en-GB',
      showUpdated: true,
      preview: { active: null, open: () => {}, leave: () => {} },
    }),
  );
  assert.ok(html.includes(item.title));
  assert.ok(html.includes('aria-haspopup="dialog"'));
  assert.ok(html.includes('Comments: 4'));
  assert.ok(!html.includes(item.body) && !html.includes('Only in hover'));
});

test('malformed cached GitHub body metadata is discarded and older caches refresh to populate descriptions', async () => {
  githubAccount();
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return json({ total_count: 1, items: [{ ...issue(), body: 'Description' }] });
  };
  await github.loadGitHub();
  const damaged = JSON.parse(localStorage.getItem('githubCache'));
  damaged.views.reviews.items[0].labels = [{ name: 'broken', color: 'not-a-colour' }];
  localStorage.setItem('githubCache', JSON.stringify(damaged));
  await github.loadGitHub();
  assert.equal(requests, 6);
  const old = JSON.parse(localStorage.getItem('githubCache'));
  delete old.version;
  localStorage.setItem('githubCache', JSON.stringify(old));
  await github.loadGitHub();
  assert.equal(requests, 9);
});
test('partial GitHub failures preserve the affected cached view and successful views update', async () => {
  githubAccount();
  globalThis.fetch = async () => json({ total_count: 1, items: [issue('Old title')] });
  await github.loadGitHub();
  globalThis.fetch = async (url) =>
    new URL(url).searchParams.get('q').includes('review-requested:')
      ? json({}, 503)
      : json({ total_count: 1, items: [issue('New title')] });
  const result = await github.loadGitHub(true);
  assert.equal(result.data.failures.reviews, 'network');
  assert.equal(result.data.views.reviews.items[0].title, 'Old title');
  assert.equal(result.data.views.pulls.items[0].title, 'New title');
});

test('damaged GitHub timestamps invalidate a cached view instead of crashing rendering', async () => {
  githubAccount();
  let count = 0;
  globalThis.fetch = async () => {
    count++;
    return json({ total_count: 1, items: [issue()] });
  };
  await github.loadGitHub();
  const damaged = JSON.parse(localStorage.getItem('githubCache'));
  damaged.views.reviews.items[0].updated = 1e100;
  localStorage.setItem('githubCache', JSON.stringify(damaged));
  const result = await github.loadGitHub();
  assert.equal(count, 6);
  assert.ok(Number.isFinite(new Date(result.data.views.reviews.items[0].updated).getTime()));
});
test('revoked GitHub tokens purge private cached data, including account lookup failures', async () => {
  githubAccount({ githubToken: 'test-token' });
  globalThis.fetch = async () =>
    json({ total_count: 1, items: [{ ...issue(), body: 'PRIVATE DESCRIPTION' }] });
  await github.loadGitHub();
  assert.ok(localStorage.getItem('githubCache').includes('PRIVATE DESCRIPTION'));
  globalThis.fetch = async () => json({}, 401);
  await assert.rejects(github.loadGitHub(true), /auth/);
  assert.equal(localStorage.getItem('githubCache'), null);
  save({ githubUsername: '', githubCache: '{"private":"old"}' });
  await assert.rejects(github.loadGitHub(true), /auth/);
  assert.equal(localStorage.getItem('githubCache'), null);
});
test('partial workflow rate limits pause manual refresh and persist across reloads', async () => {
  githubAccount({
    githubRepositories: 'one/repo two/repo',
    githubShowReviews: 'false',
    githubShowPulls: 'false',
    githubShowIssues: 'false',
    githubShowActions: 'true',
    githubActionsBranch: 'main',
  });
  let count = 0;
  globalThis.fetch = async (url) => {
    count++;
    assert.equal(new URL(url).searchParams.get('branch'), 'main');
    assert.equal(new URL(url).searchParams.get('status'), 'failure');
    return url.includes('two/repo')
      ? json({}, 429, { 'Retry-After': '120' })
      : json({
          total_count: 1,
          workflow_runs: [
            {
              id: 9,
              name: 'Build',
              html_url: 'https://github.com/one/repo/actions/runs/9',
              conclusion: 'failure',
              head_branch: 'main',
            },
          ],
        });
  };
  const first = await github.loadGitHub();
  assert.equal(first.error.message, 'rate');
  assert.equal(first.data.views.actions.items.length, 1);
  assert.equal(first.data.views.actions.failedRepos, 1);
  assert.ok(first.error.retryAt >= Date.now() + 110000);
  assert.equal((await github.loadGitHub(true)).error.message, 'rate');
  assert.equal((await github.loadGitHub()).error.message, 'rate');
  assert.equal(count, 2);
});
test('secondary rate limits without rate headers are recognized and configurations isolate private results', async () => {
  githubAccount();
  globalThis.fetch = async () =>
    json({ message: 'You have exceeded a secondary rate limit.' }, 403);
  await assert.rejects(github.loadGitHub(), /rate/);
  localStorage.removeItem('githubRetry');
  globalThis.fetch = async () => {
    localStorage.setItem('githubUsername', 'another-user');
    return json({ total_count: 1, items: [issue()] });
  };
  await assert.rejects(github.loadGitHub(true), /changed/);
  assert.equal(localStorage.getItem('githubCache'), null);
});
test('new widget settings and habit records round-trip while tokens and remote caches are excluded', async () => {
  const data = JSON.stringify([habit({ logs: { '2026-10-28': 1 } })]);
  const result = backup.validateSettings({
    habitsData: data,
    habitsEnabled: true,
    surfaceHabits: 'glass',
    airQualityEnabled: true,
    githubEnabled: true,
    githubToken: 'private',
    githubCache: '{}',
    githubRetry: '{}',
    airQualityCache: '{}',
  });
  assert.equal(result.settings.habitsData, data);
  assert.equal(result.settings.surfaceHabits, 'glass');
  for (const key of ['githubToken', 'githubCache', 'githubRetry', 'airQualityCache'])
    assert.ok(result.skipped.includes(key));
  assert.throws(() =>
    backup.validateSettings({ habitsData: JSON.stringify([habit({ target: -1 })]) }),
  );
  localStorage.setItem('habitsData', data);
  await profile.resetProfile();
  assert.equal(localStorage.getItem('habitsData'), data);
  const defaults = JSON.parse(
    readFileSync(new URL('../src/utils/data/default_settings.json', import.meta.url)),
  );
  for (const name of ['habitsEnabled', 'airQualityEnabled', 'githubEnabled'])
    assert.equal(String(defaults.find((item) => item.name === name).value), 'false');
});
