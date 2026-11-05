import { googleFetch } from '../api';

const MESSAGE_HEADERS = ['Subject', 'From', 'Date']
  .map((name) => `metadataHeaders=${name}`)
  .join('&');

const headerValue = (message, name) =>
  message.payload?.headers?.find((header) => header.name === name)?.value ?? '';

const toMessage = (message) => ({
  id: message.id,
  threadId: message.threadId,
  subject: headerValue(message, 'Subject') || '(no subject)',
  from: headerValue(message, 'From').replace(/\s*<.*>$/, '') || '(no sender)',
  date: headerValue(message, 'Date'),
  snippet: message.snippet ?? '',
  unread: (message.labelIds ?? []).includes('UNREAD'),
  labels: message.labelIds ?? [],
});

/** Every label the account has, minus the category labels Gmail keeps separate. */
export const listLabels = async () => {
  const data = await googleFetch('/gmail/v1/users/me/labels');

  return (data?.labels ?? [])
    .filter((label) => !String(label.id).startsWith('CATEGORY_') && label.id !== 'CHAT')
    .map((label) => ({
      id: label.id,
      name: label.name,
      type: label.type ?? 'user',
      // Gmail answers system labels in capitals; the picker reads better in title case,
      // while the name itself stays as the API sent it.
      display:
        (label.type ?? 'user') === 'system'
          ? label.name.charAt(0) + label.name.slice(1).toLowerCase()
          : label.name,
    }))
    .sort((a, b) => a.display.localeCompare(b.display));
};

/**
 * How many messages the search finds, not how many the widget shows: `resultSizeEstimate` is an
 * estimate, so ids are paged and counted. A mailbox that never ends is capped and shown as "1000+".
 */
const COUNT_CAP = 1000;

const countMatching = async (sources, cap = COUNT_CAP, signal) => {
  const seen = new Set();

  for (const source of sources) {
    let pageToken = '';

    do {
      const query = `/gmail/v1/users/me/messages?q=${encodeURIComponent(source)}&maxResults=500${
        pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''
      }`;
      // One source failing should not zero a count the other sources answered.
      const page = await googleFetch(query, { signal }).catch(() => null);

      if (!page) break;

      (page.messages ?? []).forEach((message) => seen.add(message.id));
      pageToken = page.nextPageToken ?? '';
    } while (pageToken && seen.size < cap);

    if (seen.size >= cap) break;
  }

  return { unreadCount: Math.min(seen.size, cap), unreadOverflow: seen.size >= cap };
};

/**
 * Gmail search takes no label id: system folders have their own operator, and custom labels
 * are matched by name, quoted when it contains a space.
 */
const SYSTEM_FOLDERS = {
  INBOX: 'in:inbox',
  SENT: 'in:sent',
  DRAFT: 'in:drafts',
  SPAM: 'in:spam',
  TRASH: 'in:trash',
  STARRED: 'is:starred',
  IMPORTANT: 'is:important',
};

const folderQuery = (folder) => {
  const id = typeof folder === 'string' ? folder : folder?.id;
  const name = typeof folder === 'string' ? folder : folder?.name || id;

  if (SYSTEM_FOLDERS[id]) return SYSTEM_FOLDERS[id];

  return `label:${/\s/.test(name) ? `"${name}"` : name}`;
};

const searchIds = async (query, maxResults, signal) => {
  // `maxResults` is the display limit; the badge counts the whole search in a separate pass
  // over the same sources.

  const list = await googleFetch(
    `/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    { signal },
  );

  return (list?.messages ?? []).map((message) => message.id);
};

/**
 * One list call per source, then one metadata call per message: Gmail has no browser-usable batch
 * endpoint. A source is the query narrowed by a category or label; Gmail cannot search "everything
 * except promotions", so switched-off categories are never asked for and the answers are merged.
 */
export const listMessages = async ({
  signal,
  query = 'is:unread in:inbox',
  maxResults = 6,
  categories = [],
  categoryIds = [],
  folders = [],
} = {}) => {
  const search = query.trim() || 'is:unread in:inbox';
  const everyCategory = categoryIds.length > 0 && categories.length >= categoryIds.length;

  const sources = [
    // Narrowing by category only pays off when some are switched off.
    ...(categories.length
      ? everyCategory
        ? [search]
        : categories.map((category) => `${search} category:${category}`)
      : []),
    ...folders.map((folder) => `${search} ${folderQuery(folder)}`),
  ];

  // Every category off and no folder chosen: there is nothing to ask for.
  if (!sources.length) return { messages: [], unreadCount: 0, unreadOverflow: false };

  const pages = await Promise.all(
    sources.map((source) => searchIds(source, maxResults, signal).catch(() => [])),
  );

  // Sources overlap often, so the same message can arrive twice.
  const ids = [...new Set(pages.flat())];

  if (!ids.length) return { messages: [], unreadCount: 0, unreadOverflow: false };

  // A little slack over the limit, because the merged order only becomes exact once the
  // dates are known.
  const wanted = ids.slice(0, maxResults * 2);

  const [messages, counted] = await Promise.all([
    Promise.all(
      wanted.map((id) =>
        googleFetch(`/gmail/v1/users/me/messages/${id}?format=metadata&${MESSAGE_HEADERS}`, {
          signal,
        }),
      ),
    ),
    countMatching(sources, COUNT_CAP, signal).catch(() => ({
      unreadCount: 0,
      unreadOverflow: false,
    })),
  ]);

  const sorted = messages
    .map(toMessage)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, maxResults);

  return { messages: sorted, ...counted };
};

/**
 * Bodies arrive as base64url over a MIME tree. A plain text part wins; HTML-only messages are
 * reduced to text rather than rendered, so a stranger's markup and tracking pixels never run.
 */
const decodeBody = (data) => {
  const base64 = String(data).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return new TextDecoder('utf-8').decode(bytes);
};

const htmlToText = (html) =>
  html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const walkParts = (part, found = { text: '', html: '', attachments: 0 }) => {
  if (!part) return found;

  if (part.filename) found.attachments += 1;

  if (part.mimeType === 'text/plain' && part.body?.data) {
    found.text += decodeBody(part.body.data);
  } else if (part.mimeType === 'text/html' && part.body?.data) {
    found.html += decodeBody(part.body.data);
  }

  (part.parts ?? []).forEach((child) => walkParts(child, found));

  return found;
};

/** One whole message, body included, for the hover preview. */
export const getMessage = async (id, { signal } = {}) => {
  const message = await googleFetch(
    `/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,
    { signal },
  );

  const parts = walkParts(message.payload);
  const body = (parts.text || htmlToText(parts.html) || message.snippet || '').trim();

  return {
    ...toMessage(message),
    to: headerValue(message, 'To'),
    body,
    attachments: parts.attachments,
  };
};

export const getMessageUrl = (message) =>
  `https://mail.google.com/mail/u/0/#inbox/${message.threadId ?? message.id}`;
