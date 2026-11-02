import { createElement, Fragment, useMemo } from 'react';
import DOMPurify from 'dompurify';

import { eventUrl } from '../eventDetails';

const elements = new Set([
  'p',
  'div',
  'br',
  'strong',
  'em',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);
/** Read a sanitized allowlist of description markup into React elements. */
export default function EventDescription({ text }) {
  const content = useMemo(() => {
    if (!globalThis.document?.createElement) return text;
    const fragment = DOMPurify.sanitize(String(text || ''), {
      ALLOWED_TAGS: [...elements, 'a', 'b', 'i'],
      ALLOWED_ATTR: ['href'],
      RETURN_DOM_FRAGMENT: true,
    });
    const render = (nodes, path = '') =>
      [...nodes].map((node, index) => {
        const key = `${path}:${index}`;
        if (node.nodeType === 3) return node.textContent;
        if (node.nodeType !== 1) return null;
        const tag = node.tagName.toLowerCase();
        const children = render(node.childNodes, key);
        if (tag === 'a') {
          const href = eventUrl(node.getAttribute('href'));
          return href ? (
            <a key={key} href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ) : (
            <Fragment key={key}>{children}</Fragment>
          );
        }
        const safeTag = tag === 'b' ? 'strong' : tag === 'i' ? 'em' : tag;
        if (!elements.has(safeTag)) return <Fragment key={key}>{children}</Fragment>;
        return createElement(safeTag, { key }, ...(safeTag === 'br' ? [] : children));
      });
    return render(fragment.childNodes);
  }, [text]);
  return <div className="gwEventDescription">{content}</div>;
}
