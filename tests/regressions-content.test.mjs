import {
  assert,
  readFileSync,
  test,
  React,
  renderToStaticMarkup,
  calendarDate,
  parseNatural,
  isValidUrl,
  server,
  translations,
  calendar,
} from './regression-fixture.mjs';

test('date-only API values stay on their named local day', () => {
  for (const text of ['2026-10-26', '2026-10-26T00:00:00.000Z']) {
    const date = calendarDate(text);
    assert.equal(date.getFullYear(), 2026);
    assert.equal(date.getMonth(), 9);
    assert.equal(date.getDate(), 26);
    assert.equal(date.getHours(), 0);
  }
});

test('all-day event ends are exclusive in API requests and inclusive in the form', () => {
  assert.deepEqual(calendar.eventBounds({ start: '2026-10-26', end: '2026-10-26', allDay: true }), {
    start: { date: '2026-10-26' },
    end: { date: '2026-10-27' },
  });
  assert.deepEqual(
    calendar.eventBounds({ start: '2026-12-31', end: '2026-12-31', allDay: true }).end,
    { date: '2027-01-01' },
  );
  assert.equal(calendar.toAllDayEndInput('2026-10-27').slice(0, 10), '2026-10-26');
  assert.equal(calendar.toLocalInput('2026-10-26').slice(0, 10), '2026-10-26');
});

test('natural dates prefer day after tomorrow over tomorrow and recognise @places', () => {
  const now = new Date(2026, 9, 26, 12);
  const result = parseNatural('Lunch the day after tomorrow at noon', { now });
  assert.equal(result.date.getDate(), 28);
  assert.equal(result.title, 'Lunch');
  assert.equal(parseNatural('Meeting @office tomorrow', { now }).location, 'office');
});

test('web links reject disguised javascript schemes and accept local and international hosts', () => {
  assert.equal(isValidUrl('javascript:alert("https://example.com")'), false);
  assert.equal(isValidUrl('data:text/html,https://example.com'), false);
  assert.equal(isValidUrl('https://пример.бг/news'), true);
  assert.equal(isValidUrl('http://localhost:3000'), true);
});

test('notes flush the latest text before reload and retain a failed write for retry', async () => {
  const { durableWriter } = await import('../src/utils/durableWriter.js');
  let saved;
  let full = false;
  let state;
  const writer = durableWriter(
    (value) => {
      if (full) throw new Error('quota');
      saved = value;
    },
    (value) => {
      state = value;
    },
  );
  writer.schedule('first');
  writer.schedule('latest');
  assert.equal(writer.flush(), true);
  assert.equal(saved, 'latest');
  full = true;
  writer.schedule('retained');
  assert.equal(writer.flush(), false);
  assert.match(state, /Not saved/);
  full = false;
  assert.equal(writer.flush(), true);
  assert.equal(saved, 'retained');
  assert.equal(state, 'Saved');
});

test('locale tags are preserved, fallback works and new UI keys are present', async () => {
  const { initTranslations, normalizeLocale } = await server.ssrLoadModule(
    '/src/lib/translations.js',
  );
  assert.equal(normalizeLocale('pt-BR'), 'pt_BR');
  assert.equal(normalizeLocale('zh-Hant'), 'zh_Hant');
  assert.equal(normalizeLocale('invalid'), 'en_GB');
  const language = await initTranslations('bg');
  assert.equal(language.getMessage('bg', 'ui.close_bbfa77'), 'Затвори');
  const fallback = await initTranslations('peo');
  assert.equal(fallback.getMessage('peo', 'ui.close_bbfa77'), 'Close');
});

test('scratch Markdown renders tables, images, links and task lists without executable HTML', async () => {
  const { default: Markdown } = await server.ssrLoadModule('/src/features/scratch/Markdown.jsx');
  const text =
    '# Title\n\n[link](https://example.com) ![alt](https://example.com/a.png)\n\n| A | B |\n| --- | ---: |\n| one | **two** |\n\n- [x] Done\n- [ ] Next\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1)) ![bad](javascript:alert(1))';
  const html = renderToStaticMarkup(React.createElement(Markdown, { text }));
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /href="https:\/\/example.com" target="_blank" rel="noreferrer noopener"/);
  assert.match(html, /<img[^>]+src="https:\/\/example.com\/a.png"/);
  assert.match(html, /<table>/);
  assert.match(html, /<strong>two<\/strong>/);
  assert.equal((html.match(/type="checkbox"/g) || []).length, 2);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script|(?:href|src)="javascript:/);
});

test('selectable languages cover English keys and retain interpolation placeholders', () => {
  const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const languages = read('../src/i18n/languages.json');
  const flatten = (value, prefix = '') =>
    Object.entries(value).flatMap(([key, item]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return item && typeof item === 'object' && !Array.isArray(item)
        ? flatten(item, path)
        : [[path, item]];
    });
  const source = flatten(read('../src/i18n/locales/en_GB.json'));
  const placeholders = (text) => (text.match(/\{[^{}]+\}/g) || []).sort();
  for (const { value } of languages) {
    const code = value === 'pt_PT' ? 'pt' : value;
    const locale = new Map(flatten(read(`../src/i18n/locales/${code}.json`)));
    for (const [key, text] of source) {
      assert.ok(typeof locale.get(key) === 'string' && locale.get(key).trim(), `${value}: ${key}`);
      assert.deepEqual(placeholders(locale.get(key)), placeholders(text), `${value}: ${key}`);
    }
  }
  for (const retired of ['peo', 'arz', 'azb']) {
    assert.ok(!languages.some((language) => language.value === retired));
  }
});
