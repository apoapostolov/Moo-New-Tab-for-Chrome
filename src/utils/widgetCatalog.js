import variables from 'config/variables';
import { uiText } from 'lib/translations';

/**
 * Every widget in one list, read by both the settings panel and the page so the
 * two cannot disagree. `zone` is the default placement; widgets without one sit
 * in the centre column.
 */
export const WIDGETS = [
  {
    id: 'time',
    label: () => variables.getMessage('modals.main.settings.sections.time.title'),
    setting: 'time',
    onByDefault: true,
    fullWidth: true,
  },
  {
    // The full card, not the one-line reading.
    id: 'weather',
    label: () => uiText('weather_full_widget'),
    setting: 'weatherEnabled',
    onByDefault: true,
    zone: 'right',
  },
  {
    id: 'date',
    label: () => variables.getMessage('modals.main.settings.sections.date.title'),
    setting: 'date',
    fullWidth: true,
  },
  {
    id: 'quickweather',
    label: () => uiText('weather_now_69ed32'),
    setting: 'quickWeatherEnabled',
    fullWidth: true,
  },
  {
    // Search and answer services share a query.
    id: 'aiask',
    label: () => uiText('search_ask_bar'),
    setting: 'aiAskEnabled',
    onByDefault: true,
    fullWidth: true,
  },
  {
    id: 'quicklinks',
    label: () => variables.getMessage('modals.main.settings.sections.quicklinks.title'),
    setting: 'quicklinksenabled',
    fullWidth: true,
  },
  {
    id: 'mail',
    label: () => uiText('mail_92379c'),
    setting: 'googleMailEnabled',
  },
  {
    id: 'calendar',
    label: () => uiText('calendar_adab50'),
    setting: 'googleCalendarEnabled',
  },
  {
    id: 'tasks',
    label: () => uiText('tasks_090ec5'),
    setting: 'googleTasksEnabled',
  },
  {
    // Photographer credit card, driven by the `photoInformation` setting.
    id: 'photoinfo',
    label: () => uiText('image_info_widget'),
    setting: 'photoInformation',
    zone: 'left',
  },
  {
    id: 'rss',
    label: () => uiText('rss_fcae0f'),
    setting: 'rssEnabled',
    zone: 'center',
  },
  {
    id: 'countdown',
    label: () => uiText('countdown_title'),
    setting: 'countdownEnabled',
    zone: 'center',
  },
  {
    id: 'portfolio',
    label: () => uiText('portfolio_title'),
    setting: 'portfolioEnabled',
    zone: 'center',
  },
  { id: 'habits', label: () => uiText('habits_title'), setting: 'habitsEnabled', zone: 'center' },
  {
    id: 'planning',
    label: () => uiText('planning_title'),
    setting: 'planningEnabled',
    zone: 'center',
  },
  {
    id: 'airquality',
    label: () => uiText('air_title'),
    setting: 'airQualityEnabled',
    zone: 'left',
  },
  {
    id: 'bookmarks',
    label: () => uiText('bookmarks_title'),
    setting: 'bookmarksEnabled',
    zone: 'center',
  },
  { id: 'github', label: () => 'GitHub', setting: 'githubEnabled', zone: 'center' },
];

export const ZONES = ['top-left', 'left', 'center', 'right', 'top-right'];

export const WIDGET_IDS = WIDGETS.map((widget) => widget.id);

export const DEFAULT_ORDER = [
  'time',
  'weather',
  'date',
  'quickweather',
  'quicklinks',
  'aiask',
  'rss',
  'mail',
  'calendar',
  'tasks',
  'portfolio',
  'countdown',
  'planning',
  'habits',
  'airquality',
  'github',
  'bookmarks',
  'photoinfo',
];
