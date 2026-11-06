import { useEffect, useState } from 'react';
import EventBus from 'utils/eventbus';
import './widgetKit.scss';

const readTarget = () =>
  localStorage.getItem('widgetTitleLinkTarget') === '_self' ? '_self' : '_blank';
const resolveHref = (href) => (typeof href === 'function' ? href() : href);

export function WidgetTitleLink({ href, children, className = '' }) {
  const [target, setTarget] = useState(readTarget);
  const [resolvedHref, setResolvedHref] = useState(() => resolveHref(href));

  useEffect(() => {
    const refreshTarget = (category) => {
      if (
        !category ||
        category === 'other' ||
        category === 'widgetTitle' ||
        category === 'rss' ||
        category === 'bookmarks' ||
        category === 'github'
      ) {
        setTarget(readTarget());
        setResolvedHref(resolveHref(href));
      }
    };
    const storageChanged = (event) => {
      if (event.key === 'widgetTitleLinkTarget' || event.key === 'rssServiceUrl') {
        setTarget(readTarget());
        setResolvedHref(resolveHref(href));
      }
    };

    EventBus.on('refresh', refreshTarget);
    window.addEventListener('storage', storageChanged);

    return () => {
      EventBus.off('refresh', refreshTarget);
      window.removeEventListener('storage', storageChanged);
    };
  }, [href]);

  useEffect(() => {
    setResolvedHref(resolveHref(href));
  }, [href]);

  if (!resolvedHref) {
    return <span className={`gwTitleLink ${className}`.trim()}>{children}</span>;
  }

  return (
    <a
      className={`gwTitleLink ${className}`.trim()}
      href={resolvedHref}
      target={target}
      rel={target === '_blank' ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  );
}

export default WidgetTitleLink;
