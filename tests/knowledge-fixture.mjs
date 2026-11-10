import { beforeEach } from 'node:test';
import { assert, test, server, importSettings } from './regression-fixture.mjs';

const settings = await server.ssrLoadModule('/src/features/knowledge/knowledgeSettings.js');
const data = await server.ssrLoadModule('/src/features/knowledge/knowledgeData.js');
const api = await server.ssrLoadModule('/src/features/knowledge/knowledgeApi.js');
const provider = await server.ssrLoadModule('/src/features/knowledge/knowledgeProvider.js');
const store = await server.ssrLoadModule('/src/features/knowledge/knowledgeStore.js');
const { createBackup } = await server.ssrLoadModule('/src/utils/settings/export.js');
const { validateSettings } = await server.ssrLoadModule('/src/utils/settings/backupSchema.js');
const widgets = await server.ssrLoadModule('/src/utils/widgets.js');
beforeEach(() => localStorage.setItem('profileRevision', crypto.randomUUID()));
const article = (patch = {}) => ({
  id: 'wikipedia:en:1',
  source: 'wikipedia',
  language: 'en',
  title: 'Astronomy',
  summary: 'The study of the sky.',
  subject: '',
  url: 'https://en.wikipedia.org/wiki/Astronomy',
  image: '',
  imageTitle: '',
  imagePage: '',
  credit: '',
  license: '',
  ...patch,
});
const mockWiki = (calls, handler) => async (url, options) => {
  calls.push({ url: new URL(url), options });
  if (handler) return handler(new URL(url), options);
  if (String(url).includes('/summary/'))
    return new Response(JSON.stringify({ type: 'standard', extract: 'An article summary.' }));
  return new Response(
    JSON.stringify({
      query: {
        pages: [
          { pageid: 1, title: 'Astronomy', description: 'The sky' },
          { pageid: 2, title: 'Botany' },
        ],
      },
    }),
  );
};

export {
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
};
