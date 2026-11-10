import { KNOWLEDGE_LANGUAGES } from './knowledgeSettings';

export const wikiHost = (source, language) =>
  source === 'commons' ? 'commons.wikimedia.org' : `${language}.wikipedia.org`;
export const wikiPageUrl = (host, title) =>
  `https://${host}/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`;
export function knowledgeImage(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      !['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    )
      return '';
    for (const key of [...url.searchParams.keys()])
      if (key.startsWith('utm_')) url.searchParams.delete(key);
    return url.href;
  } catch {
    return '';
  }
}
/** Metadata is displayed as text only; it is never injected as HTML. */
export function wikiText(value, limit = 1200) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, key) => {
      if (!key.startsWith('#')) return entities[key.toLowerCase()] || match;
      const code = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}
export function validKnowledgeArticle(article) {
  if (
    !article ||
    !['wikipedia', 'commons'].includes(article.source) ||
    !KNOWLEDGE_LANGUAGES.includes(article.language)
  )
    return false;
  const text = (key, max) => typeof article[key] === 'string' && article[key].length <= max;
  if (
    !text('id', 100) ||
    !article.id ||
    !text('url', 3000) ||
    !text('imagePage', 3000) ||
    !text('title', 500) ||
    !article.title ||
    !text('summary', 1200) ||
    !text('subject', 100) ||
    !text('image', 3000) ||
    !text('imageTitle', 500) ||
    !text('credit', 500) ||
    !text('license', 120)
  )
    return false;
  const host = wikiHost(article.source, article.language);
  try {
    const page = new URL(article.url);
    const imagePage = article.imagePage ? new URL(article.imagePage) : null;
    return (
      page.protocol === 'https:' &&
      page.host === host &&
      !page.username &&
      !page.password &&
      page.pathname.startsWith('/wiki/') &&
      (!article.image || knowledgeImage(article.image) === article.image) &&
      (!imagePage ||
        (imagePage.protocol === 'https:' &&
          [host, 'commons.wikimedia.org'].includes(imagePage.host) &&
          !imagePage.username &&
          !imagePage.password &&
          imagePage.pathname.startsWith('/wiki/')))
    );
  } catch {
    return false;
  }
}
