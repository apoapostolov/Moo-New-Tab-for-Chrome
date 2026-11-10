import { fetchWithTimeout } from 'utils/requests';
import { knowledgeImage, wikiPageUrl, wikiText } from './knowledgeData';

export function wikiHttpError(response) {
  const error = new Error(response.status === 429 ? 'rate' : 'network');
  if (error.message === 'rate') {
    const header = response.headers.get('Retry-After');
    const parsed = /^\d+$/.test(header || '')
      ? Date.now() + Number(header) * 1000
      : Date.parse(header);
    error.retryAt = Math.min(Date.now() + 86400000, Math.max(Date.now() + 60000, parsed || 0));
  }
  return error;
}

export async function wikiRequest(host, params, signal) {
  const query = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    maxlag: '5',
    ...params,
  });
  const response = await fetchWithTimeout(`https://${host}/w/api.php?${query}`, {
    signal,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: {
      'Api-User-Agent':
        'MooKnowledge/1.0.3 (https://github.com/apoapostolov/Moo-New-Tab-for-Firefox)',
    },
  });
  if (!response.ok) throw wikiHttpError(response);
  const data = await response.json();
  if (data.error)
    throw new Error(
      data.error.code === 'maxlag' || data.error.code === 'ratelimited' ? 'rate' : 'network',
    );
  return data.query?.pages || [];
}
export const shuffled = (items, random = Math.random) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
};
export function knowledgeQuery(source, subject) {
  const namespace = source === 'commons' ? '6' : '0';
  if (!subject) return { generator: 'random', grnnamespace: namespace, grnlimit: '12' };
  const literal = subject.replace(/["\\]/g, ' ').trim();
  return {
    generator: 'search',
    gsrnamespace: namespace,
    gsrsearch: `"${literal}"`,
    gsrlimit: '12',
  };
}
export function imageMetadata(page, host) {
  const info = page?.imageinfo?.[0];
  const metadata = info?.extmetadata || {};
  return {
    image: info?.mime?.startsWith('image/') ? knowledgeImage(info.thumburl || info.url) : '',
    imageTitle: wikiText(page?.title, 500),
    imagePage: page?.title ? wikiPageUrl(host, page.title) : '',
    credit: wikiText(metadata.Artist?.value, 500),
    license: wikiText(metadata.LicenseShortName?.value, 120),
    summary: wikiText(metadata.ImageDescription?.value),
  };
}
export const imageParams = {
  prop: 'imageinfo',
  iiprop: 'url|mime|extmetadata',
  iiurlwidth: '640',
  iiextmetadatafilter: 'ImageDescription|Artist|LicenseShortName',
};
