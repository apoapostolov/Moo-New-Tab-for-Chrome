import { uiText } from 'lib/translations';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { requestOwner } from 'utils/requests';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MdRefresh } from 'react-icons/md';

import WidgetCard, { WidgetHeader } from 'components/Elements/WidgetCard/WidgetCard';
import { WidgetTitleLink } from 'features/widgetKit/WidgetTitleLink';
import EventBus from 'utils/eventbus';

import {
  loadItems,
  readCount,
  readFullArticle,
  readRefresh,
  readRssServiceUrl,
  readSource,
} from './feedStore';
import { loadFeedly, markFeedlyRead } from './feedly';
import { extractArticle, fetchArticle } from './extractArticle';
import { cachedImages, pruneArticles, readArticle, storeArticle } from './articleCache';

import './rss.scss';

const ARTICLE_DELAY = 260;

/** "3h" reads faster than a timestamp when every row is a headline. */
const relative = (stamp) => {
  if (!stamp) return '';

  const minutes = Math.round((Date.now() - stamp) / 60000);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);

  if (hours < 24) return `${hours}h`;

  const days = Math.round(hours / 24);

  if (days < 7) return `${days}d`;

  return new Date(stamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/** Merged headlines with a hover reader; full articles are prefetched when enabled. */
const Rss = () => {
  useTranslationVersion();
  const [feeds, setFeeds] = useState({
    items: [],
    errors: [],
    source: readSource(),
    unread: null,
    note: '',
    needsToken: false,
    loading: true,
  });
  const [open, setOpen] = useState(null);
  const [article, setArticle] = useState({ status: 'idle' });
  const [tick, setTick] = useState(0);
  // Bumped whenever the article cache changes, so the thumbnails pick up new images.
  const [, setStored] = useState(0);

  const owner = useRef(requestOwner());
  const panel = useRef(null);
  const closeTimer = useRef(null);
  const articleTimer = useRef(null);
  const articleRequest = useRef(null);

  const load = useCallback(async (force = false) => {
    const request = owner.current.start();
    const source = readSource();
    setFeeds((previous) => ({ ...previous, source, loading: previous.items.length === 0 }));

    try {
      if (source === 'feedly') {
        const result = await loadFeedly({ force, signal: request.signal, count: readCount() });
        if (!request.current()) return;

        setFeeds({
          items: result.items.slice(0, readCount()),
          errors: [],
          source,
          unread: result.unread,
          note: result.note || '',
          needsToken: Boolean(result.needsToken),
          loading: false,
        });

        return;
      }

      const result = await loadItems({ force, signal: request.signal });
      if (!request.current()) return;

      setFeeds({
        items: result.items.slice(0, readCount()),
        errors: result.errors,
        source,
        unread: null,
        note: '',
        needsToken: false,
        loading: false,
      });
    } catch (error) {
      if (!request.current()) return;
      setFeeds((previous) => ({
        ...previous,
        loading: false,
        errors: [{ url: '', message: error?.message || 'failed' }],
      }));
    }
  }, []);

  useEffect(() => {
    const effectOwner = owner.current;
    load();

    const refresh = setInterval(() => load(true), readRefresh() * 60000);
    const ages = setInterval(() => setTick((value) => value + 1), 60000);
    const onRefresh = (target) => {
      if (!target || target === 'rss') load(true);
    };

    EventBus.on('refresh', onRefresh);

    return () => {
      effectOwner.cancel();
      clearInterval(refresh);
      clearInterval(ages);
      EventBus.off('refresh', onRefresh);
    };
  }, [load]);

  useEffect(
    () => () => {
      clearTimeout(closeTimer.current);
      clearTimeout(articleTimer.current);
      articleRequest.current?.abort();
    },
    [],
  );

  // The card's own list is the licence to keep an article: anything it stops showing
  // goes, and anything past its age goes with it. It waits for that list: the first
  // render has none, and a prune against it would empty the cache on every visit.
  useEffect(() => {
    if (feeds.source !== 'feeds' || feeds.loading || !feeds.items.length) return;

    const links = feeds.items.map((item) => item.link).filter(Boolean);

    pruneArticles(new Set(links));
    setStored((value) => value + 1);
  }, [feeds.items, feeds.loading, feeds.source]);

  /**
   * Reading the articles while the page stands. One after another rather than all at
   * once: a dozen parallel page loads is a rude way to treat a dozen publishers, and
   * the pointer is rarely faster than the second story.
   */
  useEffect(() => {
    if (!readFullArticle() || feeds.source !== 'feeds') return undefined;

    const items = feeds.items;
    let stopped = false;
    const controller = new AbortController();

    (async () => {
      for (const item of items) {
        if (stopped) return;

        if (!item.link || readArticle(item.link)) continue;

        try {
          const fetched = await fetchArticle(item.link, { signal: controller.signal });
          if (stopped) return;
          storeArticle(item.link, fetched);
          if (!stopped) setStored((value) => value + 1);
        } catch {
          // Not every page can be read; the row keeps the feed's own summary.
        }
      }
    })();

    return () => {
      stopped = true;
      controller.abort();
    };
  }, [feeds.items, feeds.source]);

  const thumbs = (() => {
    const links = feeds.items.map((item) => item.link).filter(Boolean);
    const images = cachedImages(links);
    const out = {};

    for (const item of feeds.items) out[item.link] = item.image || images[item.link] || null;

    return out;
  })();

  const keep = () => {
    if (!closeTimer.current) return;

    clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const hide = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      clearTimeout(articleTimer.current);
      articleRequest.current?.abort();
      setOpen(null);
      setArticle({ status: 'idle' });
    }, 140);
  };

  const show = (item, element) => {
    keep();
    clearTimeout(articleTimer.current);
    articleRequest.current?.abort();
    setOpen({ item, element });

    // A Feedly entry arrives with its own words, so the panel opens with nothing to wait
    // for: the same block reader the fetched pages go through, run on the feed's HTML.
    if (item.content) {
      const built = extractArticle(item.content, item.link);
      const blocks = built.blocks.length
        ? built.blocks
        : item.excerpt
          ? [{ tag: 'p', text: item.excerpt }]
          : [];

      setArticle({
        status: 'ready',
        article: { ...built, image: built.image || item.image || null, blocks },
      });

      return;
    }

    // Kept already: there is nothing to wait for, so nothing is shown waiting.
    const kept = item.link ? readArticle(item.link) : null;

    if (kept) {
      setArticle({ status: 'ready', article: kept });

      return;
    }

    setArticle({ status: 'idle' });

    if (!readFullArticle()) return;
    const controller = new AbortController();
    articleRequest.current = controller;

    articleTimer.current = setTimeout(async () => {
      setArticle({ status: 'loading' });

      try {
        const fetched = await fetchArticle(item.link, { signal: controller.signal });
        if (controller.signal.aborted) return;

        storeArticle(item.link, fetched);
        setStored((value) => value + 1);
        setArticle({ status: 'ready', article: fetched });
      } catch {
        if (!controller.signal.aborted) setArticle({ status: 'unavailable' });
      }
    }, ARTICLE_DELAY);
  };

  // Match the mail reader: beside the card and centred vertically in the viewport.
  useLayoutEffect(() => {
    const node = panel.current;

    if (!node || !open) return undefined;

    const place = () => {
      const width = Math.min(430, window.innerWidth - 48);
      const card = open.element?.getBoundingClientRect();

      node.style.width = `${width}px`;
      node.style.maxHeight = `${Math.min(window.innerHeight * 0.62, window.innerHeight - 32)}px`;

      if (!card) return;

      const besideRight = card.left + card.width / 2 < window.innerWidth / 2;
      const wantedLeft = besideRight ? card.right + 12 : card.left - width - 12;

      node.style.left = `${Math.round(Math.max(16, Math.min(wantedLeft, window.innerWidth - width - 16)))}px`;
      node.style.top = `${Math.round(Math.max(16, (window.innerHeight - node.offsetHeight) / 2))}px`;
    };

    place();

    // The panel grows as the article arrives and its picture loads, and the placement is
    // measured from its height, so the height has to be watched rather than taken once.
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;

    observer?.observe(node);
    window.addEventListener('resize', place);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [open, article.status, article.article, tick]);

  /**
   * Opening a story is the action that changes the account, and the only one: a hover
   * reads, a click marks read, which is what Feedly's terms ask for.
   */
  const openItem = (item) => {
    window.open(item.link, '_blank', 'noopener,noreferrer');

    if (!item.entryId) return;

    setFeeds((previous) => ({
      ...previous,
      items: previous.items.filter((row) => row.entryId !== item.entryId),
      unread: Number.isFinite(previous.unread) ? Math.max(0, previous.unread - 1) : previous.unread,
    }));

    markFeedlyRead([item.entryId]);
  };

  const failed = feeds.errors.filter((error) => error.url);
  const blocks = article.status === 'ready' ? article.article.blocks : null;
  const unread =
    feeds.source === 'feedly' && Number.isFinite(feeds.unread)
      ? feeds.unread > 999
        ? '999+'
        : String(feeds.unread)
      : null;
  const empty =
    feeds.source === 'feedly'
      ? feeds.needsToken
        ? uiText('add_a_feedly_token_in_settings_under_feeds_d79793')
        : feeds.note || uiText('nothing_unread_in_feedly_78c437')
      : uiText('no_headlines_yet_add_feeds_in_settings_under_2306de');

  const reader =
    open &&
    createPortal(
      <div
        className="rssReader"
        ref={panel}
        role="dialog"
        aria-label={open.item.title}
        onMouseEnter={keep}
        tabIndex={0}
        onFocus={keep}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            open.element?.focus();
            setOpen(null);
          }
        }}
        onMouseLeave={hide}
      >
        <div className="rssReaderHead">
          <span className="rssReaderSource">{open.item.source.title}</span>
          <span className="rssReaderAge">{relative(open.item.date)}</span>
        </div>

        <h3 className="rssReaderTitle">{open.item.title}</h3>

        {article.status === 'loading' ? (
          <p className="rssReaderNote">{uiText('reading_the_article_6a4e0f')}</p>
        ) : null}

        {article.article?.image ? (
          <img className="rssReaderImage" src={article.article.image} alt="" loading="lazy" />
        ) : null}

        {blocks
          ? blocks.map((block, index) => (
              <p
                className={`rssBlock rssBlock-${block.tag}`}
                key={`${index}-${block.text.slice(0, 24)}`}
              >
                {block.text}
              </p>
            ))
          : null}

        {!blocks && open.item.excerpt ? (
          <p className="rssBlock rssBlock-p">{open.item.excerpt}</p>
        ) : null}

        {article.status === 'unavailable' ? (
          <p className="rssReaderNote">{uiText('the_article_could_not_be_read_here_70d641')}</p>
        ) : null}

        <footer className="rssReaderFoot">
          <a href={open.item.link} target="_blank" rel="noopener noreferrer">
            {uiText('open_article_5899c6')}
          </a>
        </footer>
      </div>,
      document.body,
    );

  return (
    <WidgetCard
      as="section"
      widget="rss"
      className="rssWidget"
      aria-label={uiText('rss_headlines_a9cbd7')}
    >
      <WidgetHeader className="rssHead">
        <span className="rssHeadLabel">
          <WidgetTitleLink className="rssLabel" href={readRssServiceUrl}>
            {uiText('reading_cffa2a')}
          </WidgetTitleLink>
          {unread ? <span className="rssUnread">{unread}</span> : null}
        </span>
        <button
          className="rssRefresh"
          type="button"
          aria-label={uiText('refresh_feeds_71e1bc')}
          onClick={() => load(true)}
        >
          <MdRefresh />
        </button>
      </WidgetHeader>

      {feeds.loading ? <p className="rssNote">{uiText('fetching_headlines_1f9878')}</p> : null}

      {!feeds.loading && !feeds.items.length ? (
        <p
          className={`rssNote${
            feeds.source === 'feedly' && (feeds.needsToken || feeds.note) ? ' rssNote-warn' : ''
          }`}
        >
          {empty}
        </p>
      ) : null}

      <ul className="rssList" onMouseLeave={hide}>
        {feeds.items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`rssItem${thumbs[item.link] ? ' rssItem-hasThumb' : ''}`}
              onMouseEnter={(event) => show(item, event.currentTarget)}
              onFocus={(event) => show(item, event.currentTarget)}
              onBlur={hide}
              onClick={() => openItem(item)}
            >
              {thumbs[item.link] ? (
                <img
                  className="rssThumb"
                  src={thumbs[item.link]}
                  alt=""
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.remove();
                  }}
                />
              ) : null}
              {/* Source and age share the line above the headline, so the age is placed
                  before the headline in the grid rather than after it: written after, the
                  headline spanning both columns pushed it onto a line of its own. */}
              <span className="rssSource">
                {item.source.title || (feeds.source === 'feedly' ? uiText('feedly_68002a') : '')}
              </span>
              <span className="rssAge">{relative(item.date)}</span>
              <span className="rssItemTitle">{item.title}</span>
            </button>
          </li>
        ))}
      </ul>

      {feeds.note && feeds.items.length ? (
        <p className="rssNote rssNote-warn">{feeds.note}</p>
      ) : null}

      {failed.length ? (
        <p
          className="rssNote rssNote-warn"
          title={failed.map((error) => `${error.url}: ${error.message}`).join('\n')}
        >
          {failed.length === 1
            ? '1 feed did not answer.'
            : `${failed.length} feeds did not answer.`}
        </p>
      ) : null}

      {reader}
    </WidgetCard>
  );
};

export default Rss;
