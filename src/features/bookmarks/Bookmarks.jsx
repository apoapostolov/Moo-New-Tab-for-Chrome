import { useEffect, useMemo, useState } from 'react';
import {
  MdShuffle,
  MdOutlineBookmarkBorder,
  MdMenuBook,
  MdOutlineRateReview,
} from 'react-icons/md';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { uiText } from 'lib/translations';
import EventBus from 'utils/eventbus';
import { WidgetShell, EmptyState, IconButton } from '../widgetKit/WidgetKit';
import useRemoteWidget from '../widgetKit/useRemoteWidget';
import useItemPreview from '../widgetKit/useItemPreview';
import {
  BOOKMARK_SETTINGS,
  bookmarkSettings,
  bookmarkTitleUrl,
  loadBookmarks,
} from './bookmarkStore';
import { bookmarkPool, bookmarkRotation, SOURCES } from './bookmarkSelection';
import { recordBookmarkOpen } from './bookmarkOpens';
import { subscribeBrowserBookmarks } from './browserBookmarks';
import BrowserBookmarkAccess from './BrowserBookmarkAccess';
import BookmarkDetails from './BookmarkDetails';
import { bookmarkAssortment } from './bookmarkAssortment';
import './bookmarks.scss';

const session = `${Date.now()}-${Math.random()}`;
const errorLabel = (code) =>
  uiText(
    `bookmarks_error_${['auth', 'rate', 'offline', 'storage', 'setup', 'folder', 'browser'].includes(code) ? code : 'network'}`,
  );

export default function Bookmarks() {
  const { language } = useTranslationVersion();
  const settings = bookmarkSettings();
  const locale = language.replaceAll('_', '-');
  const state = useRemoteWidget('bookmarks', BOOKMARK_SETTINGS, loadBookmarks, settings.refresh);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [reshuffle, setReshuffle] = useState(null);
  const [now, setNow] = useState(Date.now);
  const [selection, setSelection] = useState({ scope: '', items: [], error: null });
  const sources = Object.keys(state.data?.sources || {});
  const sourceLabel = (key) =>
    key === 'browser' ? uiText('bookmarks_browser') : key === 'raindrop' ? 'Raindrop' : 'Readwise';
  const pool = useMemo(() => bookmarkPool(state.data?.items || []), [state.data]);
  const selectionSettings = JSON.stringify({
    mode: settings.mode,
    limit: settings.limit,
    age: settings.age,
    repeat: settings.repeat,
    domainLimit: settings.domainLimit,
    minMinutes: settings.minMinutes,
    hideOpened: settings.hideOpened,
    balance: settings.balance,
    rotation: settings.rotation,
  });
  const scope = `${state.data?.identity || ''}:${selectionSettings}`;
  const shuffle = reshuffle?.scope === scope ? reshuffle.nonce : 0;
  const period = bookmarkRotation(settings, now, session);
  const { reload } = state;
  useEffect(() => subscribeBrowserBookmarks(reload), [reload]);
  useEffect(() => {
    const changed = (event) => {
      if (event.key === 'bookmarksOpenCache') setHistoryVersion((value) => value + 1);
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);
  useEffect(() => {
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 50);
    const tick = () => setNow(Date.now());
    const timer = setTimeout(tick, midnight.getTime() - now);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [now]);
  const preview = useItemPreview(`${scope}:${shuffle}`, '.bookmarksWidget', '.bookmarkRow');
  useEffect(() => {
    if (!state.data) return undefined;
    let alive = true;
    bookmarkAssortment(
      {
        identity: state.data.identity,
        historyIdentity: state.data.historyIdentity,
        scope,
        period,
        shuffle,
        pool,
        settings: JSON.parse(selectionSettings),
      },
      () => alive,
    )
      .then((items) => {
        if (alive) setSelection({ scope, items, error: null });
      })
      .catch(() => {
        if (alive) setSelection({ scope, items: [], error: 'storage' });
      });
    return () => {
      alive = false;
    };
  }, [state.data, pool, scope, period, shuffle, selectionSettings, historyVersion]);
  useEffect(() => {
    if (
      !state.data ||
      !Object.values(state.data.sources).some((item) => !item.complete && !item.error)
    )
      return undefined;
    const timer = setTimeout(() => {
      if (!document.hidden) reload();
    }, 15000);
    return () => clearTimeout(timer);
  }, [state.data, reload]);
  const items =
    selection.scope === scope
      ? selection.items.flatMap((item) => {
          const current = pool.find((row) => row.selectionKey === item.selectionKey);
          return current ? [{ ...current, widgetOpenCount: item.widgetOpenCount }] : [];
        })
      : [];
  const hasLibrary = pool.length > 0 || sources.some((key) => !state.data.sources[key].error);
  const detail =
    preview.active &&
    preview.active.anchor.isConnected &&
    items.find((item) => item.selectionKey === preview.active.id);
  const opened = (item) => {
    recordBookmarkOpen(state.data.historyIdentity, item.selectionKey, item.widgetOpenCount);
    setHistoryVersion((value) => value + 1);
  };
  const incomplete =
    state.data && Object.values(state.data.sources).some((item) => !item.complete && !item.error);
  return (
    <>
      <WidgetShell
        widget="bookmarks"
        title={uiText('bookmarks_title')}
        titleHref={() => bookmarkTitleUrl(settings)}
        className="bookmarksWidget"
        showSettings={false}
        loading={state.loading}
        onRefresh={state.refresh}
        error={state.error && state.error.message !== 'setup' && errorLabel(state.error.message)}
        actions={
          state.data &&
          !['latest', 'most_opened'].includes(settings.mode) && (
            <IconButton
              label={uiText('bookmarks_shuffle')}
              onClick={() => {
                preview.close();
                setReshuffle({ scope, nonce: Date.now() });
              }}
            >
              <MdShuffle />
            </IconButton>
          )
        }
      >
        <div
          className="wkTabList bookmarkSources"
          role="group"
          aria-label={uiText('bookmarks_sources')}
        >
          {SOURCES.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={
                settings.sources[key].enabled &&
                (key === 'browser' || Boolean(settings.sources[key].token))
              }
              disabled={key !== 'browser' && !settings.sources[key].token}
              title={
                key !== 'browser' && !settings.sources[key].token
                  ? uiText('bookmarks_source_setup')
                  : sourceLabel(key)
              }
              onClick={() => {
                localStorage.setItem(
                  `bookmarks${key === 'browser' ? 'Browser' : key === 'raindrop' ? 'Raindrop' : 'Readwise'}Enabled`,
                  String(!settings.sources[key].enabled),
                );
                preview.close();
                EventBus.emit('refresh', 'bookmarks');
              }}
            >
              {sourceLabel(key)}
            </button>
          ))}
        </div>
        {!state.data ? (
          state.loading ? (
            <div className="bookmarkLoading" role="status">
              <span />
              <span />
              <span />
              <span className="srOnly">{uiText('widget_loading')}</span>
            </div>
          ) : (
            <EmptyState widget="bookmarks">{uiText('bookmarks_setup')}</EmptyState>
          )
        ) : (
          <>
            {sources
              .filter(
                (key) =>
                  state.data.sources[key].error &&
                  !['permission', 'unavailable'].includes(state.data.sources[key].error),
              )
              .map((key) => (
                <p className="wkNotice" role="status" key={key}>
                  {sourceLabel(key)} · {errorLabel(state.data.sources[key].error)}
                </p>
              ))}
            {selection.error && (
              <p className="wkNotice" role="status">
                {errorLabel(selection.error)}
              </p>
            )}
            {['permission', 'unavailable'].includes(state.data.sources.browser?.error) && (
              <BrowserBookmarkAccess access={state.data.sources.browser.error} />
            )}
            <section id="bookmark-results">
              <ul className="gwList bookmarkList">
                {items.map((item) => (
                  <li
                    className="bookmarkRow"
                    key={item.selectionKey}
                    onMouseEnter={(event) => preview.open(item.selectionKey, event.currentTarget)}
                    onMouseLeave={preview.leave}
                  >
                    <a
                      className="bookmarkItem"
                      href={
                        settings.openReader && item.source === 'readwise' && item.readerUrl
                          ? item.readerUrl
                          : item.url
                      }
                      target={settings.linkTarget}
                      rel="noopener noreferrer"
                      onClick={() => opened(item)}
                      onFocus={(event) => preview.open(item.selectionKey, event.currentTarget)}
                      onBlur={preview.leave}
                    >
                      {settings.thumbnails && (
                        <span className="bookmarkThumbnail">
                          {item.cover ? (
                            <img
                              src={item.cover}
                              alt=""
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(event) => {
                                event.currentTarget.hidden = true;
                              }}
                            />
                          ) : null}
                          {item.source !== 'readwise' ? (
                            <MdOutlineBookmarkBorder aria-hidden="true" />
                          ) : (
                            <MdMenuBook aria-hidden="true" />
                          )}
                        </span>
                      )}
                      <span className="bookmarkText">
                        <span className="bookmarkTitle">
                          {item.title || new URL(item.url).hostname}
                        </span>
                        <span className="bookmarkContext">
                          <span>{new URL(item.url).hostname.replace(/^www\./, '')}</span>
                          {item.minutes > 0 && (
                            <span>{uiText('bookmarks_minutes', { count: item.minutes })}</span>
                          )}
                        </span>
                      </span>
                    </a>
                    <button
                      type="button"
                      className="gwIconButton wkIcon bookmarkPreviewTrigger"
                      aria-haspopup="dialog"
                      aria-label={uiText('bookmarks_preview', { title: item.title })}
                      title={uiText('bookmarks_preview', { title: item.title })}
                      onFocus={(event) => preview.open(item.selectionKey, event.currentTarget)}
                      onBlur={preview.leave}
                      onClick={(event) =>
                        preview.open(item.selectionKey, event.currentTarget, true)
                      }
                    >
                      <MdOutlineRateReview aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              {!items.length && selection.scope === scope && !selection.error && hasLibrary && (
                <p className="bookmarkEmpty">
                  {uiText(pool.length ? 'bookmarks_no_match' : 'bookmarks_empty')}
                </p>
              )}
            </section>
            {hasLibrary && (
              <footer className="bookmarkFooter">
                <span>{uiText(`bookmarks_mode_${settings.mode}`)}</span>
                <span
                  title={uiText(incomplete ? 'bookmarks_indexing_hint' : 'bookmarks_indexed_hint')}
                >
                  {uiText(incomplete ? 'bookmarks_indexing' : 'bookmarks_indexed', {
                    count: new Intl.NumberFormat(locale).format(pool.length),
                  })}
                </span>
              </footer>
            )}
          </>
        )}
      </WidgetShell>
      {detail && (
        <BookmarkDetails
          item={detail}
          preview={preview}
          locale={locale}
          onOpen={opened}
          linkTarget={settings.linkTarget}
        />
      )}
    </>
  );
}
