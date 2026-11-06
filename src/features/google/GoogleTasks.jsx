import { uiText } from 'lib/translations';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { useCallback, useEffect, useMemo, useRef, useState, useEffectEvent } from 'react';

import { requestOwner, settingsStamp } from 'utils/requests';
import EventBus from 'utils/eventbus';
import WidgetCard, { WidgetHeader } from 'components/Elements/WidgetCard/WidgetCard';
import { WidgetTitleLink } from 'features/widgetKit/WidgetKit';
import { calendarDate } from 'utils/date';

import { useGoogleAuth } from './hooks/useGoogleAuth';
import { listTaskLists, listTasks, setTaskCompleted } from './services/tasks';
import { getTasksSettings, refreshMs } from './settings';
import ConnectPrompt, { describeError } from './components/ConnectPrompt';
import TaskDialog from './components/TaskDialog';

import './google.scss';

const endOfDay = (date) => {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);

  return copy;
};

/** A task is due on a day, not a moment: Google stamps midnight UTC, so both sides are pulled back
 * to local midnight or a task due today reads as yesterday west of Greenwich. */
const dayNumber = (value) => {
  const date = calendarDate(value);

  if (Number.isNaN(date.getTime())) return null;

  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
};

const dueLabel = (due, dateStyle = 'relative') => {
  if (!due) return '';

  const date = calendarDate(due);

  if (Number.isNaN(date.getTime())) return '';

  if (dateStyle === 'absolute') {
    // Day first and a lower case month, the way a date is said out loud.
    const month = date.toLocaleDateString('en-GB', { month: 'short' }).toLowerCase();

    return `${date.getDate()} ${month}`;
  }

  const days = dayNumber(due) - dayNumber(new Date());

  const locale = (localStorage.getItem('language') || 'en_GB').replace('_', '-');
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day');
};

/** Overdue, today, next seven days, later, and anything without a date. */
const dueBucket = (due) => {
  if (!due) return 'No due date';

  const date = calendarDate(due);
  const today = new Date();

  if (date < new Date(today.toDateString())) return 'Overdue';
  if (date <= endOfDay(today)) return 'Today';

  const week = new Date(today);
  week.setDate(week.getDate() + 7);

  if (date <= week) return 'This week';

  return 'Later';
};

const BUCKET_ORDER = ['Overdue', 'Today', 'This week', 'Later', 'No due date'];
const BUCKET_KEYS = {
  Overdue: 'overdue',
  Today: 'today',
  'This week': 'this_week',
  Later: 'later',
  'No due date': 'no_due_date',
};

const GoogleTasks = () => {
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
  const [settings, setSettings] = useState(getTasksSettings);
  const [lists, setLists] = useState([]);
  const [listId, setListId] = useState(() => getTasksSettings().listId);
  const [tasks, setTasks] = useState([]);
  const [fetchError, setFetchError] = useState('');
  // Nothing is drawn until the first answer is in: an empty card that fills in later reads
  // as broken.
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(null);

  const loadLists = useCallback(async () => {
    const request = listOwner.current.start();
    try {
      const loaded = await listTaskLists(request.signal);
      if (request.current()) setSettings(getTasksSettings());
      if (!request.current()) return '';
      setLists(loaded);

      const stored = getTasksSettings().listId;
      const valid = loaded.some((list) => list.id === stored);
      if (valid) setListId(stored);

      if (!valid && loaded.length) {
        localStorage.setItem('googleTasksList', loaded[0].id);
        setListId(loaded[0].id);
      }

      return valid ? stored : (loaded[0]?.id ?? '');
    } catch (loadError) {
      if (request.current()) setFetchError(loadError.message);

      return '';
    }
  }, []);

  const loadTasks = useCallback(async (id) => {
    const request = owner.current.start();
    const stamp = settingsStamp(/^(google|offlineMode)/);
    if (!id) return;

    const current = getTasksSettings();

    try {
      setFetchError('');
      const loaded = await listTasks(id, {
        showCompleted: current.showCompleted,
        signal: request.signal,
      });
      if (
        !request.current() ||
        stamp !== settingsStamp(/^(google|offlineMode)/) ||
        id !== getTasksSettings().listId
      )
        return;
      setTasks(current.hideUndated ? loaded.filter((task) => task.due) : loaded);
    } catch (loadError) {
      if (request.current()) setFetchError(loadError.message);
    }
  }, []);

  const reloadLists = useEffectEvent(loadLists);
  useEffect(() => {
    const effectOwner = owner.current;
    const effectListOwner = listOwner.current;
    if (!auth) return undefined;

    let timer;
    let cancelled = false;
    const startPolling = (id) => {
      if (cancelled) return;
      clearInterval(timer);
      timer = setInterval(
        () => loadTasks(getTasksSettings().listId || id),
        refreshMs(getTasksSettings().refreshMinutes),
      );
    };

    reloadLists()
      .then((id) =>
        // The interval starts only once the first list has been answered, so it never races the
        // initial load for the same data.
        loadTasks(id).then(() => {
          startPolling(id);
        }),
      )
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    const onRefresh = (category) => {
      if (!category || category === 'google' || category === 'tasks') {
        setSettings(getTasksSettings());
        reloadLists().then((id) => {
          if (cancelled) return;
          startPolling(id);
          return loadTasks(id);
        });
      }
    };

    EventBus.on('refresh', onRefresh);

    return () => {
      cancelled = true;
      effectOwner.cancel();
      effectListOwner.cancel();
      clearInterval(timer);
      EventBus.off('refresh', onRefresh);
    };
  }, [auth, loadTasks]);

  const changeList = (id) => {
    localStorage.setItem('googleTasksList', id);
    setListId(id);
    setEditing(null);
    setTasks([]);
    loadTasks(id);
  };

  const toggle = async (task) => {
    const completed = task.status !== 'completed';
    const originalList = listId;

    // Optimistic: the checkbox has to react under the finger.
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, status: completed ? 'completed' : 'needsAction' } : item,
      ),
    );

    try {
      await setTaskCompleted(listId, task.id, completed);
    } catch (toggleError) {
      if (getTasksSettings().listId !== originalList) return;
      setFetchError(toggleError.message);
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? { ...item, status: task.status } : item)),
      );
    }
  };

  const onSaved = useCallback((saved, sourceList) => {
    if (sourceList !== getTasksSettings().listId) return;
    setTasks((current) => {
      const exists = current.some((task) => task.id === saved.id);

      return exists
        ? current.map((task) => (task.id === saved.id ? saved : task))
        : [saved, ...current];
    });
  }, []);

  const onDeleted = useCallback((id, sourceList) => {
    if (sourceList !== getTasksSettings().listId) return;
    setTasks((current) => current.filter((task) => task.id !== id));
  }, []);

  const ordered = useMemo(() => {
    // A ticked task stays in the list, struck through, until Google is asked again: making it
    // vanish under the finger reads as a delete.
    const kept = tasks.filter(
      (task) =>
        (settings.showCompleted || task.status !== 'completed') &&
        (!settings.hideUndated || Boolean(task.due)),
    );

    const sorted = [...kept];

    if (settings.sort === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else if (settings.sort === 'due') {
      sorted.sort((a, b) => {
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;

        return new Date(a.due) - new Date(b.due);
      });
    } else if (settings.sort === 'added') {
      sorted.reverse();
    }

    return sorted.slice(0, settings.maxItems);
  }, [tasks, settings]);

  const groups = useMemo(() => {
    if (!settings.groupByDue) return null;

    const buckets = new Map();

    ordered.forEach((task) => {
      const key = dueBucket(task.due);
      buckets.set(key, [...(buckets.get(key) ?? []), task]);
    });

    return BUCKET_ORDER.filter((key) => buckets.has(key)).map((key) => [key, buckets.get(key)]);
  }, [ordered, settings.groupByDue]);

  if (loading) return null;

  if (!auth) {
    return (
      <ConnectPrompt label={uiText('tasks_090ec5')} onConnect={connectAccount} error={error} />
    );
  }

  if (!ready) return null;

  const row = (task) => (
    <li key={task.id} className={`gwTaskRow${task.status === 'completed' ? ' done' : ''}`}>
      {/* The slot is one line of the title's own text, so the box sits on the
          middle of the first line instead of on a guessed pixel offset. */}
      <span className="gwCheckSlot">
        <input
          type="checkbox"
          className="gwCheck"
          checked={task.status === 'completed'}
          onChange={() => toggle(task)}
          aria-label={`Complete ${task.title}`}
        />
      </span>
      <button type="button" className="gwItem bare" onClick={() => setEditing(task)}>
        <span className="gwItemTop">
          <span className="gwItemTitle">{task.title}</span>
          {task.due && <span className="gwItemMeta">{dueLabel(task.due, settings.dateStyle)}</span>}
        </span>
        {settings.showNotes && task.notes && <span className="gwItemSub">{task.notes}</span>}
      </button>
    </li>
  );

  return (
    <WidgetCard widget="tasks" className="googleWidget">
      <WidgetHeader className="gwHead">
        <span className="gwLabel">
          <WidgetTitleLink href="https://tasks.google.com/">
            {uiText('tasks_090ec5')}
          </WidgetTitleLink>
        </span>
        {lists.length > 1 && (
          <select
            className="gwSelect"
            value={listId}
            onChange={(changeEvent) => changeList(changeEvent.target.value)}
            aria-label={uiText('task_list_91c40a')}
          >
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.title}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="gwIconButton"
          onClick={() => setEditing({})}
          aria-label={uiText('new_task_17b2b8')}
          title={uiText('new_task_17b2b8')}
        >
          +
        </button>
      </WidgetHeader>

      {fetchError && <p className="gwError">{describeError(fetchError)}</p>}

      {!fetchError && !ordered.length && (
        <p className="gwEmpty">{uiText('nothing_left_to_do_9c8622')}</p>
      )}

      {groups ? (
        groups.map(([bucket, bucketTasks]) => (
          <div className="gwDay" key={bucket}>
            <span className="gwDayLabel">{uiText(BUCKET_KEYS[bucket])}</span>
            <ul className="gwList">{bucketTasks.map(row)}</ul>
          </div>
        ))
      ) : (
        <ul className="gwList">{ordered.map(row)}</ul>
      )}

      {editing && (
        <TaskDialog
          task={editing.id ? editing : null}
          listId={listId}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </WidgetCard>
  );
};

export default GoogleTasks;
