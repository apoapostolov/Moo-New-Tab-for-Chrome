import { withLock } from 'utils/requests';
import { readKnowledgeSettings, knowledgeKey, knowledgeExpiry } from './knowledgeSettings';
import { validKnowledgeArticle } from './knowledgeData';
import { fetchKnowledgeArticle } from './knowledgeProvider';

let pageSelection;
export function readKnowledgeCache() {
  try {
    const cache = JSON.parse(localStorage.getItem('knowledgeCache') || 'null');
    return cache?.version === 1 &&
      typeof cache.key === 'string' &&
      Number.isFinite(cache.createdAt) &&
      validKnowledgeArticle(cache.article)
      ? cache
      : null;
  } catch {
    return null;
  }
}
export function currentKnowledgeCache(cache, settings, now = Date.now()) {
  return Boolean(
    cache &&
    cache.key === knowledgeKey(settings) &&
    cache.createdAt <= now &&
    knowledgeExpiry(settings, cache.createdAt) > now,
  );
}
function knowledgeBackoff(key) {
  try {
    const retry = JSON.parse(localStorage.getItem('knowledgeRetry') || 'null');
    return retry?.key === key && Number.isFinite(retry.until) && retry.until > Date.now();
  } catch {
    return false;
  }
}
export async function loadKnowledge(force = false, signal) {
  const settings = readKnowledgeSettings();
  const key = knowledgeKey(settings);
  const profile = localStorage.getItem('profileRevision');
  const current = () =>
    key === knowledgeKey(readKnowledgeSettings()) &&
    profile === localStorage.getItem('profileRevision');
  return withLock('moo-knowledge', async () => {
    signal?.throwIfAborted();
    if (!current()) throw new DOMException('Settings changed', 'AbortError');
    const saved = readKnowledgeCache();
    const cache =
      settings.mode === 'reload'
        ? pageSelection?.profile === profile
          ? pageSelection
          : null
        : saved;
    if (!force && currentKnowledgeCache(cache, settings))
      return {
        data: { article: cache.article, stale: localStorage.getItem('offlineMode') === 'true' },
      };
    if (localStorage.getItem('offlineMode') === 'true') {
      if (saved?.key === key) return { data: { article: saved.article, stale: true } };
      throw new Error('offline');
    }
    if (knowledgeBackoff(key)) {
      const error = new Error('rate');
      if (saved?.key === key) return { data: { article: saved.article, stale: true }, error };
      throw error;
    }
    let article;
    try {
      article = await fetchKnowledgeArticle(settings, { signal, previous: saved?.article.id });
    } catch (error) {
      signal?.throwIfAborted();
      if (!current()) throw new DOMException('Settings changed', 'AbortError');
      if (error.message === 'rate') {
        try {
          localStorage.setItem(
            'knowledgeRetry',
            JSON.stringify({ key, until: error.retryAt || Date.now() + 60000 }),
          );
        } catch {
          /* Backoff must not hide a readable saved page. */
        }
      }
      if (saved?.key === key) return { data: { article: saved.article, stale: true }, error };
      throw error;
    }
    signal?.throwIfAborted();
    if (!current()) throw new DOMException('Settings changed', 'AbortError');
    const next = { version: 1, key, createdAt: Date.now(), article };
    pageSelection = { ...next, profile };
    let cacheWarning = false;
    try {
      localStorage.setItem('knowledgeCache', JSON.stringify(next));
    } catch {
      cacheWarning = true;
    }
    return { data: { article, stale: false, cacheWarning } };
  });
}
