/**
 * Panels use the `%basic` scrim; glass uses a lighter one. Stored per widget, since a panel over a
 * bright sky and one over a dark photo want different scrims. The clock is absent: it draws onto
 * the wallpaper.
 */

const SURFACE_SETTINGS = {
  bookmarks: 'surfaceBookmarks',
  habits: 'surfaceHabits',
  planning: 'surfacePlanning',
  airquality: 'surfaceAirQuality',
  github: 'surfaceGithub',
  weather: 'surfaceWeather',
  quicklinks: 'surfaceQuicklinks',
  background: 'surfaceBackground',
  mail: 'surfaceMail',
  calendar: 'surfaceCalendar',
  tasks: 'surfaceTasks',
  rss: 'surfaceRss',
  portfolio: 'surfacePortfolio',
  countdown: 'surfaceCountdown',
};

function getSurface(setting) {
  return localStorage.getItem(SURFACE_SETTINGS[setting] || setting) === 'glass'
    ? 'glassSurface'
    : '';
}

export { SURFACE_SETTINGS, getSurface };
