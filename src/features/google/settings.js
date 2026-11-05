/**
 * Every Google preference in one place, read by the widgets and the settings screen so a control
 * cannot drift from the widget's value. Getters default to the pre-control behaviour.
 */

const readNumber = (key, fallback) => {
  const stored = localStorage.getItem(key);

  if (stored === null || stored === '') return fallback;

  const parsed = Number(stored);

  return Number.isFinite(parsed) ? parsed : fallback;
};

const readFlag = (key, fallback) => {
  const stored = localStorage.getItem(key);

  return stored === null ? fallback : stored === 'true';
};

const readText = (key, fallback = '') => {
  const stored = localStorage.getItem(key);

  return stored === null ? fallback : stored;
};

/** Lookahead for the agenda, in days. Today means the rest of today only. */
export const CALENDAR_RANGES = [
  { value: '1', label: 'Today' },
  { value: '3', label: 'Next 3 days' },
  { value: '7', label: 'Next 7 days' },
  { value: '14', label: 'Next 2 weeks' },
  { value: '30', label: 'Next 30 days' },
];

export const REFRESH_OPTIONS = [
  { value: '1', label: 'Every minute' },
  { value: '5', label: 'Every 5 minutes' },
  { value: '15', label: 'Every 15 minutes' },
  { value: '30', label: 'Every 30 minutes' },
];

export const TASK_DATE_STYLES = [
  { value: 'relative', label: 'In 12 days' },
  { value: 'absolute', label: '7 Nov' },
];

export const TASK_SORTS = [
  { value: 'due', label: 'Due date' },
  { value: 'title', label: 'Title' },
  { value: 'added', label: 'Newest first' },
  { value: 'manual', label: 'Order from Google' },
];

/** Gmail's own inbox categories, in the order Gmail shows them. */
export const MAIL_CATEGORIES = [
  { id: 'primary', label: 'Primary' },
  { id: 'social', label: 'Social' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'updates', label: 'Updates' },
  { id: 'forums', label: 'Forums' },
];

export const MAIL_QUERIES = [
  { value: 'is:unread in:inbox', label: 'Unread in inbox' },
  { value: 'is:unread', label: 'Unread only' },
  { value: 'in:inbox', label: 'Everything in the inbox' },
  { value: 'is:starred', label: 'Starred' },
  { value: 'is:important', label: 'Important' },
];

const readList = (key, fallback = []) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');

    return Array.isArray(parsed) ? parsed.filter(Boolean) : fallback;
  } catch {
    return fallback;
  }
};

/** Categories left switched on. An empty list fetches no category at all. */
export const readMailCategories = () =>
  readList(
    'googleMailCategories',
    MAIL_CATEGORIES.map((category) => category.id),
  );

export const readMailFolders = () =>
  readList('googleMailFolders', []).filter((folder) =>
    typeof folder === 'string' ? folder.length > 0 : Boolean(folder?.id),
  );

export const readCalendarIds = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem('googleCalendarIds') || '[]');

    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

/**
 * The calendar a new event starts in: one picked in settings wins, then the one used last,
 * then the caller's guess (Google's default or the first calendar listed).
 */
export const eventCalendarId = (calendars = [], fallback = 'primary') => {
  const listed = (id) => Boolean(id) && calendars.some((calendar) => calendar.id === id);

  const picked = readText('googlePrimaryCalendar');

  if (listed(picked)) return picked;

  const last = readText('googleLastCalendar');

  if (listed(last)) return last;

  return fallback;
};

/** The calendar picked in settings, or an empty string for "use the last one". */
export const readPrimaryCalendar = () => readText('googlePrimaryCalendar');

/** Remembered so the next new event opens on the calendar last used. */
export const rememberCalendar = (id) => {
  if (id) localStorage.setItem('googleLastCalendar', id);
};

export const getCalendarSettings = () => ({
  calendarIds: readCalendarIds(),
  rangeDays: readNumber('googleCalendarRange', 7),
  maxEvents: readNumber('googleCalendarMax', 12),
  includeDeclined: readFlag('googleCalendarDeclined', false),
  hideAllDay: readFlag('googleCalendarHideAllDay', false),
  showLocation: readFlag('googleCalendarLocation', true),
  showNotes: readFlag('googleCalendarNotes', false),
  groupByDay: readFlag('googleCalendarGroup', true),
  use24Hour: readFlag('googleCalendar24Hour', false),
  refreshMinutes: readNumber('googleCalendarRefresh', 5),
});

export const getTasksSettings = () => ({
  listId: readText('googleTasksList', ''),
  showCompleted: readFlag('googleTasksCompleted', false),
  hideUndated: readFlag('googleTasksHideUndated', false),
  showNotes: readFlag('googleTasksNotes', false),
  groupByDue: readFlag('googleTasksGroup', false),
  sort: readText('googleTasksSort', 'due'),
  dateStyle: readText('googleTasksDateStyle', 'relative'),
  maxItems: readNumber('googleTasksMax', 20),
  refreshMinutes: readNumber('googleTasksRefresh', 5),
});

export const getMailSettings = () => ({
  query:
    readText('googleMailCustomQuery', '').trim() ||
    readText('googleMailQuery', 'is:unread in:inbox'),
  categories: readMailCategories(),
  folders: readMailFolders(),
  maxMessages: readNumber('googleMailMax', 6),
  primary: readText('googleMailPrimary', 'sender'),
  showSnippet: readFlag('googleMailSnippet', false),
  badge: readText('googleMailBadge', 'count'),
  refreshMinutes: readNumber('googleMailRefresh', 5),
});

/**
 * A checkbox reads `=== 'true'`, so a preference defaulting to on must be written the first
 * time or the control and the widget disagree.
 */
const DEFAULTS = {
  googleCalendarRange: '7',
  googleCalendarMax: '12',
  googleCalendarDeclined: 'false',
  googleCalendarHideAllDay: 'false',
  googleCalendarLocation: 'true',
  googleCalendarNotes: 'false',
  googleCalendarGroup: 'true',
  googleCalendar24Hour: 'false',
  googleCalendarRefresh: '5',
  googleTasksCompleted: 'false',
  googleTasksHideUndated: 'false',
  googleTasksNotes: 'false',
  googleTasksGroup: 'false',
  googleTasksSort: 'due',
  googleTasksDateStyle: 'relative',
  googleTasksMax: '20',
  googleTasksRefresh: '5',
  googleMailQuery: 'is:unread in:inbox',
  googleMailMax: '6',
  googleMailPrimary: 'sender',
  googleMailSnippet: 'false',
  googleMailBadge: 'count',
  googleMailRefresh: '5',
};

export const ensureDefaults = () => {
  Object.entries(DEFAULTS).forEach(([key, value]) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
  });
};

/** Minutes to milliseconds, with a floor so a bad value cannot hammer Google. */
export const refreshMs = (minutes) => Math.max(1, minutes) * 60 * 1000;
