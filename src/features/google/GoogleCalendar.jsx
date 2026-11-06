import { uiText } from 'lib/translations';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { requestOwner, settingsStamp } from 'utils/requests';
import EventBus from 'utils/eventbus';
import WidgetCard, { WidgetHeader } from 'components/Elements/WidgetCard/WidgetCard';
import { WidgetTitleLink } from 'features/widgetKit/WidgetTitleLink';
import { calendarDate } from 'utils/date';

import { useGoogleAuth } from './hooks/useGoogleAuth';
import {
  listCalendars,
  listEvents,
  rangeBounds,
  eventKey,
  canEditCalendar,
} from './services/calendar';
import { getCalendarSettings, refreshMs } from './settings';
import ConnectPrompt, { describeError } from './components/ConnectPrompt';
import EventDialog from './components/EventDialog';
import EventPreview from './components/EventPreview';
import useItemPreview from 'features/widgetKit/useItemPreview';
import { calendarEventStatus } from './eventDetails';
import { clearEventDetailsCache } from './services/calendar';

import './google.scss';

const dayLabel = (value, today, tomorrow) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? calendarDate(value) : new Date(value);

  if (date.toDateString() === today.toDateString()) return uiText('today');
  if (date.toDateString() === tomorrow.toDateString()) return uiText('tomorrow');

  return date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
};

const timeLabel = (event, use24Hour) => {
  if (event.allDay) return uiText('all_day_114574');

  return new Date(event.start).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !use24Hour,
  });
};

const shortNotes = (value) => {
  const text = value.replace(/\s+/g, ' ').trim();

  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
};

const GoogleCalendar = () => {
  useTranslationVersion();
  const { auth, loading, error, connectAccount } = useGoogleAuth();
  const account = auth ? `${auth.email}:${auth.connectedAt}` : '';
  const accountRef = useRef(account);
  accountRef.current = account;
  const [loadedAccount, setLoadedAccount] = useState('');
  const calendarAccount = useRef('');
  const preview = useItemPreview(account, '.googleCalendarWidget', '.gwCalendarRow');
  const hoverIntent = useRef(null);
  useEffect(() => () => clearTimeout(hoverIntent.current), [account]);
  const openPreview = (event, anchor, immediate = false) => {
    clearTimeout(hoverIntent.current);
    const trigger = anchor.matches('.gwCalendarRow') ? anchor.querySelector('.gwItem') : anchor;
    if (immediate || preview.active) preview.open(eventKey(event), trigger);
    else hoverIntent.current = setTimeout(() => preview.open(eventKey(event), trigger), 280);
  };
  const leavePreview = () => {
    clearTimeout(hoverIntent.current);
    preview.leave();
  };
  const owner = useRef(requestOwner());
  const listOwner = useRef(requestOwner());
  useEffect(
    () => () => {
      owner.current.cancel();
      listOwner.current.cancel();
    },
    [auth],
  );
  const [settings, setSettings] = useState(getCalendarSettings);
  const [calendars, setCalendars] = useState([]);
  const [events, setEvents] = useState([]);
  const [fetchError, setFetchError] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = setInterval(update, 15000);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  // Nothing is drawn until there is something to draw: an empty card that fills in later
  // reads as broken.
  const [ready, setReady] = useState(false);
  const calendarsRef = useRef([]);

  const load = useCallback(async () => {
    const request = owner.current.start();
    const currentAccount = accountRef.current;
    const stamp = settingsStamp(/^(google|offlineMode)/);
    const valid = () =>
      request.current() &&
      currentAccount === accountRef.current &&
      stamp === settingsStamp(/^(google|offlineMode)/);
    const current = getCalendarSettings();
    setSettings(current);
    setBusy(true);
    setFetchError('');
    if (calendarAccount.current !== currentAccount) {
      calendarAccount.current = currentAccount;
      calendarsRef.current = [];
      setEvents([]);
      setCalendars([]);
      setEditing(null);
      clearEventDetailsCache();
    }

    try {
      const list = calendarsRef.current.length
        ? calendarsRef.current
        : await listCalendars(request.signal).catch(() => []);

      if (!valid()) return;
      calendarsRef.current = list;
      setCalendars(list);

      const result = await listEvents({
        signal: request.signal,
        ...rangeBounds(current.rangeDays),
        maxResults: current.maxEvents,
        calendarIds: current.calendarIds,
        calendars: list,
        hideAllDay: current.hideAllDay,
        includeDeclined: current.includeDeclined,
      });
      if (valid()) setEvents(result);
    } catch (loadError) {
      if (valid()) setFetchError(loadError.message);
    } finally {
      if (valid()) {
        setBusy(false);
        setReady(true);
        setLoadedAccount(currentAccount);
      }
    }
  }, []);

  useEffect(() => {
    const effectOwner = owner.current;
    if (!auth) return undefined;

    load();

    const timer = setInterval(load, refreshMs(settings.refreshMinutes));

    const onRefresh = (category) => {
      // The settings screen writes the same keys this widget reads.
      if (!category || category === 'google' || category === 'calendar') {
        calendarsRef.current = [];
        load();
      }
    };

    EventBus.on('refresh', onRefresh);

    return () => {
      effectOwner.cancel();
      clearInterval(timer);
      EventBus.off('refresh', onRefresh);
    };
  }, [auth, load, settings.refreshMinutes]);

  const visible = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return events
      .filter((event) => (settings.hideAllDay ? !event.allDay : true))
      .filter((event) => (settings.includeDeclined ? true : !event.declined))
      .map((event) => ({ ...event, day: dayLabel(event.start, today, tomorrow) }));
  }, [events, settings.hideAllDay, settings.includeDeclined]);

  const multiCalendar = useMemo(
    () => new Set(visible.map((event) => event.calendarId)).size > 1,
    [visible],
  );

  const onSaved = useCallback(() => {
    clearEventDetailsCache();
    load();
  }, [load]);
  const onDeleted = useCallback(
    (id, calendarId) => {
      clearEventDetailsCache();
      setEvents((current) => current.filter((event) => eventKey(event) !== `${calendarId}:${id}`));
      load();
    },
    [load],
  );
  if (loading) return null;

  if (!auth) {
    return (
      <ConnectPrompt label={uiText('calendar_adab50')} onConnect={connectAccount} error={error} />
    );
  }

  if (!ready || loadedAccount !== account) return null;
  const previewEvent =
    preview.active && visible.find((event) => eventKey(event) === preview.active.id);
  const editEvent = (event) => {
    clearTimeout(hoverIntent.current);
    preview.close();
    setEditing(event);
  };

  const byDay = visible.reduce((groups, event) => {
    const key = (event.allDay ? calendarDate(event.start) : new Date(event.start)).toDateString();

    groups[key] = groups[key] ?? [];
    groups[key].push(event);

    return groups;
  }, {});

  const item = (event) => (
    <li
      key={eventKey(event)}
      className="gwCalendarRow"
      onMouseEnter={(hoverEvent) => openPreview(event, hoverEvent.currentTarget)}
      onMouseLeave={leavePreview}
    >
      <button
        type="button"
        className="gwItem"
        onClick={() => editEvent(event)}
        onFocus={(focusEvent) => openPreview(event, focusEvent.currentTarget, true)}
        onBlur={leavePreview}
      >
        <span className="gwItemTop">
          <span className="gwItemTitle">
            {multiCalendar && (
              <span
                className="gwDot"
                style={event.calendarColor ? { background: event.calendarColor } : undefined}
              />
            )}
            {event.title}
          </span>
          <span className="gwItemMeta">
            {calendarEventStatus(event, now) && (
              <span className="gwEventStatus">
                {uiText(`calendar_event_${calendarEventStatus(event, now)}`)}
              </span>
            )}
            <span>
              {settings.groupByDay ? '' : `${event.day} · `}
              {timeLabel(event, settings.use24Hour)}
            </span>
          </span>
        </span>
        {settings.showLocation && event.location && (
          <span className="gwItemSub">{event.location}</span>
        )}
        {settings.showNotes && event.description && (
          <span className="gwItemSub">{shortNotes(event.description)}</span>
        )}
      </button>
    </li>
  );

  return (
    <WidgetCard widget="calendar" className="googleWidget googleCalendarWidget" aria-busy={busy}>
      <WidgetHeader className="gwHead">
        <span className="gwLabel">
          <WidgetTitleLink href="https://calendar.google.com/calendar/u/0/r">
            {uiText('calendar_adab50')}
          </WidgetTitleLink>
        </span>
        <button
          type="button"
          className="gwIconButton"
          disabled={!calendars.some(canEditCalendar)}
          onClick={() => editEvent({})}
          aria-label={uiText('new_event_2ef379')}
          title={uiText('new_event_2ef379')}
        >
          +
        </button>
      </WidgetHeader>

      {fetchError && <p className="gwError">{describeError(fetchError)}</p>}

      {!fetchError && !visible.length && (
        <p className="gwEmpty">
          {settings.rangeDays <= 1 ? 'Nothing else today.' : 'Nothing scheduled in this range.'}
        </p>
      )}

      {settings.groupByDay ? (
        Object.entries(byDay).map(([day, dayEvents]) => (
          <div className="gwDay" key={day}>
            <span className="gwDayLabel">{dayEvents[0].day}</span>
            <ul className="gwList">{dayEvents.map(item)}</ul>
          </div>
        ))
      ) : (
        <ul className="gwList">{visible.map(item)}</ul>
      )}

      {previewEvent && !editing && (
        <EventPreview
          key={`${account}:${eventKey(previewEvent)}`}
          event={previewEvent}
          preview={preview}
          account={account}
          viewer={{ email: auth.email, name: auth.name }}
          use24Hour={settings.use24Hour}
          onEdit={editEvent}
        />
      )}

      {editing && (
        <EventDialog
          event={editing.id ? editing : null}
          calendars={calendars}
          defaultCalendarId={settings.calendarIds[0] || calendars[0]?.id || 'primary'}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </WidgetCard>
  );
};

export default GoogleCalendar;
