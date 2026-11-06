import { uiText } from 'lib/translations';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { useCallback, useEffect, useRef, useState } from 'react';

import { requestOwner, settingsStamp } from 'utils/requests';
import EventBus from 'utils/eventbus';
import WidgetCard, { WidgetHeader } from 'components/Elements/WidgetCard/WidgetCard';
import { WidgetTitleLink } from 'features/widgetKit/WidgetTitleLink';

import { useGoogleAuth } from './hooks/useGoogleAuth';
import { getMessageUrl, listMessages } from './services/gmail';
import { MAIL_CATEGORIES, getMailSettings, refreshMs } from './settings';
import ConnectPrompt, { describeError } from './components/ConnectPrompt';
import MailPreview from './components/MailPreview';

import './google.scss';

const formatTime = (value) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

// The hover panel is placed against the card, not the row: it floats beside the widget,
// level with the middle of the window, and stays put as the hand moves down the list.
const anchorFor = (node) => (node && node.closest('.googleWidget')) || node;

const GoogleMail = () => {
  useTranslationVersion();
  const { auth, loading, error, connectAccount } = useGoogleAuth();
  const owner = useRef(requestOwner());
  const listOwner = useRef(requestOwner());
  useEffect(
    () => () => {
      owner.current.cancel();
      listOwner.current.cancel();
    },
    [auth],
  );
  const [settings, setSettings] = useState(getMailSettings);
  const [state, setState] = useState({ messages: [], unreadCount: 0, unreadOverflow: false });
  const [fetchError, setFetchError] = useState('');
  const [busy, setBusy] = useState(false);
  // Nothing is drawn until the first answer is in: an empty card that fills in later reads
  // as broken.
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState(null);
  const hoverTimer = useRef(null);
  // Where the hand is. A wheel turns without moving the pointer, so the row under it changes
  // while the pointer does not; without this there is nothing to hit-test after a scroll.
  const pointer = useRef(null);
  const followFrame = useRef(0);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  // A short intent delay, so sweeping the pointer across the list does not fire a fetch for
  // every row it crosses.
  const openPreview = (message) => (hoverEvent) => {
    const anchor = anchorFor(hoverEvent.currentTarget);
    const trigger = hoverEvent.currentTarget.querySelector('a');

    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setPreview({ message, anchor, trigger }), 280);
  };

  const keepPreview = () => clearTimeout(hoverTimer.current);

  // Not immediate: the pointer must be able to cross the gap into the panel to scroll a long
  // message, and crossing the gap leaves the row first.
  const closePreview = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setPreview(null), 240);
  };

  // The row under the pointer. Scrolling moves rows under a hand that never moves, and
  // mouseenter is not dependable for that: the panel would keep showing the message the pointer
  // left behind.
  const followHoveredRow = useCallback(
    (closeWhenMissing) => {
      const point = pointer.current;

      if (!point) return;

      const element = document.elementFromPoint(point.x, point.y);

      if (!element) return;

      // Reading inside the panel is not a hover: leave the message alone.
      if (element.closest('.gwPreview')) return;

      const row = element.closest('.gwList li');
      const message = row && state.messages.find((item) => item.id === row.dataset.messageId);

      if (!message) {
        // A scroll can take the row out from under the hand, leaving nothing to describe. A move
        // that crosses a gap is on its way somewhere, and the leave timer decides.
        if (closeWhenMissing) setPreview(null);

        return;
      }

      const anchor = anchorFor(row);

      setPreview({ message, anchor });
    },
    [state.messages],
  );

  useEffect(() => {
    const remember = (event) => {
      if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
        pointer.current = { x: event.clientX, y: event.clientY };
      }
    };

    document.addEventListener('pointermove', remember, { passive: true });
    document.addEventListener('wheel', remember, { passive: true });

    return () => {
      document.removeEventListener('pointermove', remember);
      document.removeEventListener('wheel', remember);
    };
  }, []);

  useEffect(() => {
    if (!preview) return undefined;

    // One answer per scroll, decided by its origin: inside the panel it is the reader scrolling
    // the message, inside the list it moves a new email under the hand, and anywhere else the
    // panel would point at the wrong row.
    const scheduleFollow = (closeWhenMissing) => {
      window.cancelAnimationFrame(followFrame.current);
      followFrame.current = window.requestAnimationFrame(() => followHoveredRow(closeWhenMissing));
    };

    const onScroll = (event) => {
      const target = event.target instanceof Element ? event.target : null;

      if (target?.closest('.gwPreview')) return;

      if (target?.closest('.gwList')) {
        scheduleFollow(true);

        return;
      }

      setPreview(null);
    };

    // A slow sweep crosses row boundaries faster than the intent delay, so the panel trails the
    // pointer by a row and looks stuck on the email it left behind. With a panel already open
    // the row under the hand is the answer, at once.
    const onMove = () => {
      if (pointer.current) scheduleFollow(false);
    };

    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('pointermove', onMove);
      window.cancelAnimationFrame(followFrame.current);
      clearTimeout(hoverTimer.current);
    };
  }, [followHoveredRow, preview]);

  const load = useCallback(async () => {
    const request = owner.current.start();
    const stamp = settingsStamp(/^(google|offlineMode)/);
    const valid = () => request.current() && stamp === settingsStamp(/^(google|offlineMode)/);
    const current = getMailSettings();
    setSettings(current);
    setBusy(true);
    setFetchError('');

    try {
      const result = await listMessages({
        signal: request.signal,
        query: current.query,
        maxResults: current.maxMessages,
        categories: current.categories,
        categoryIds: MAIL_CATEGORIES.map((category) => category.id),
        folders: current.folders,
      });
      if (valid()) setState(result);
    } catch (loadError) {
      if (valid()) setFetchError(loadError.message);
    } finally {
      if (valid()) {
        setBusy(false);
        setReady(true);
      }
    }
  }, []);

  useEffect(() => {
    const effectOwner = owner.current;
    if (!auth) return undefined;

    load();

    const timer = setInterval(load, refreshMs(settings.refreshMinutes));

    const onRefresh = (category) => {
      if (!category || category === 'google' || category === 'mail') load();
    };

    EventBus.on('refresh', onRefresh);

    return () => {
      effectOwner.cancel();
      clearInterval(timer);
      EventBus.off('refresh', onRefresh);
    };
  }, [auth, load, settings.refreshMinutes]);

  if (loading) return null;

  if (!auth) {
    return <ConnectPrompt label={uiText('mail_92379c')} onConnect={connectAccount} error={error} />;
  }

  if (!ready) return null;

  const title = settings.query.trim() || 'is:unread in:inbox';

  return (
    <WidgetCard widget="mail" className="googleWidget">
      <WidgetHeader className="gwHead">
        <span className="gwLabel">
          <WidgetTitleLink href="https://mail.google.com/mail/u/0/#inbox">
            {uiText('mail_92379c')}
          </WidgetTitleLink>
        </span>
        {settings.badge === 'count' && (
          <span className="gwBadge">
            {state.unreadCount}
            {state.unreadOverflow ? '+' : ''}
          </span>
        )}
        {settings.badge === 'dot' && state.unreadCount > 0 && <span className="gwBadge dot" />}
        <button
          type="button"
          className="gwIconButton"
          onClick={load}
          disabled={busy}
          aria-label={uiText('refresh_mail_8661d3')}
          title={title}
        >
          ↻
        </button>
      </WidgetHeader>

      {fetchError && <p className="gwError">{describeError(fetchError)}</p>}

      {!fetchError && !state.messages.length && (
        <p className="gwEmpty">
          {!settings.categories.length
            ? 'Every category is switched off in settings.'
            : ['is:unread', 'is:unread in:inbox'].includes(title)
              ? 'Inbox is clear.'
              : 'Nothing matches.'}
        </p>
      )}

      <ul className="gwList">
        {state.messages.map((message) => {
          const lead = settings.primary === 'subject' ? message.subject : message.from;
          const second = settings.primary === 'subject' ? message.from : message.subject;

          return (
            <li
              key={message.id}
              data-message-id={message.id}
              onMouseEnter={openPreview(message)}
              onFocus={openPreview(message)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setPreview(null);
              }}
              onMouseLeave={closePreview}
            >
              <a
                className="gwItem"
                href={getMessageUrl(message)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="gwItemTop">
                  <span className="gwItemTitle">{lead}</span>
                  <span className="gwItemMeta">{formatTime(message.date)}</span>
                </span>
                <span className="gwItemSub">{second}</span>
                {settings.showSnippet && message.snippet && (
                  <span className="gwItemSub snippet">{message.snippet}</span>
                )}
              </a>
            </li>
          );
        })}
      </ul>

      {preview && (
        <MailPreview
          key={preview.message.id}
          message={preview.message}
          account={`${auth.email}:${auth.connectedAt}`}
          anchor={preview.anchor}
          onClose={() => {
            preview.trigger?.focus();
            clearTimeout(hoverTimer.current);
            setPreview(null);
          }}
          onEnter={keepPreview}
          onLeave={closePreview}
        />
      )}
    </WidgetCard>
  );
};

export default GoogleMail;
