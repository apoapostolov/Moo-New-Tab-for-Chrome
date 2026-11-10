import { fetchWithTimeout } from 'utils/requests';
import {
  wikiRequest,
  shuffled,
  knowledgeQuery,
  imageMetadata,
  imageParams,
  wikiHttpError,
} from './knowledgeApi';
import {
  wikiHost,
  wikiPageUrl,
  wikiText,
  knowledgeImage,
  validKnowledgeArticle,
} from './knowledgeData';

async function wikipediaArticle(page, settings, signal) {
  const host = wikiHost('wikipedia', settings.language);
  const response = await fetchWithTimeout(
    `https://${host}/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`,
    { signal, credentials: 'omit', referrerPolicy: 'no-referrer' },
  );
  if (!response.ok) throw wikiHttpError(response);
  const summary = await response.json();
  if (summary.type === 'disambiguation') return null;
  const article = {
    id: `wikipedia:${settings.language}:${page.pageid}`,
    source: 'wikipedia',
    language: settings.language,
    title: wikiText(page.title, 500),
    summary: wikiText(summary.extract || page.description),
    url: wikiPageUrl(host, page.title),
    image: knowledgeImage(page.thumbnail?.source),
    imageTitle: '',
    imagePage: '',
    credit: '',
    license: '',
  };
  if (article.image && page.pageimage) {
    article.imagePage = wikiPageUrl(host, `File:${page.pageimage}`);
    article.imageTitle = wikiText(page.pageimage, 500);
    try {
      const [file] = await wikiRequest(
        'commons.wikimedia.org',
        {
          ...imageParams,
          iiextmetadatalanguage: settings.language,
          titles: `File:${page.pageimage}`,
        },
        signal,
      );
      if (file && !file.missing) {
        const metadata = imageMetadata(file, 'commons.wikimedia.org');
        Object.assign(article, {
          imagePage: metadata.imagePage,
          credit: metadata.credit,
          license: metadata.license,
        });
      }
    } catch (error) {
      signal?.throwIfAborted();
      if (error.name === 'AbortError') throw error;
    }
  }
  return article;
}

async function pickFromSource(source, subject, settings, signal, previous, random) {
  const host = wikiHost(source, settings.language);
  const params =
    source === 'commons'
      ? { ...imageParams, iiextmetadatalanguage: settings.language }
      : {
          prop: 'pageimages|pageprops|description',
          piprop: 'thumbnail|name',
          pithumbsize: '640',
          pilicense: 'free',
          ppprop: 'disambiguation',
        };
  const pages = await wikiRequest(host, { ...knowledgeQuery(source, subject), ...params }, signal);
  const candidates = shuffled(
    pages.filter(
      (page) =>
        page.title && !page.missing && !Object.hasOwn(page.pageprops || {}, 'disambiguation'),
    ),
    random,
  );
  candidates.sort(
    (a, b) =>
      Number(`${source}:${settings.language}:${a.pageid}` === previous) -
      Number(`${source}:${settings.language}:${b.pageid}` === previous),
  );
  for (const page of candidates.slice(0, 3)) {
    signal?.throwIfAborted();
    const article =
      source === 'commons'
        ? {
            ...imageMetadata(page, host),
            id: `commons:${settings.language}:${page.pageid}`,
            source,
            language: settings.language,
            title: wikiText(page.title.replace(/^File:/i, '').replace(/\.[a-z0-9]+$/i, ''), 500),
            url: wikiPageUrl(host, page.title),
          }
        : await wikipediaArticle(page, settings, signal);
    if (!article || (source === 'commons' && !article.image)) continue;
    article.subject = subject;
    if (validKnowledgeArticle(article)) return article;
  }
  return null;
}

export async function fetchKnowledgeArticle(
  settings,
  { signal, previous = '', random = Math.random } = {},
) {
  const subjects = settings.subjects.length
    ? shuffled(settings.subjects, random).slice(0, 3)
    : [''];
  const sources =
    settings.source === 'both' ? shuffled(['wikipedia', 'commons'], random) : [settings.source];
  let failure;
  for (const subject of subjects) {
    for (const source of sources) {
      try {
        const article = await pickFromSource(source, subject, settings, signal, previous, random);
        if (article) return article;
      } catch (error) {
        signal?.throwIfAborted();
        if (error.name === 'AbortError' || error.message === 'rate') throw error;
        failure = error;
      }
    }
  }
  throw failure || new Error('empty');
}
