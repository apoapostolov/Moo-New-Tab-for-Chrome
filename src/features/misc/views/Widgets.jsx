import { useTranslationVersion } from 'contexts/TranslationContext';
import { useState, useEffect, Fragment, Suspense, lazy } from 'react';

import Clock from '../../time/Clock';
import QuickLinks from '../../quicklinks/QuickLinks';
import Date from '../../time/Date';
import AIAsk from '../../aiask/AIAsk';
import { WidgetsLayout } from 'components/Layout';
import WidgetScroll from 'components/Layout/WidgetsLayout/WidgetScroll';
import { uiText } from 'lib/translations';
import {
  ZONES,
  readOrder,
  readPlacement,
  readSecondLane,
  groupByZone,
  isWidgetEnabled,
  isFullWidth,
} from 'utils/widgets';

import EventBus from 'utils/eventbus';
import useFocusWorkspace from 'features/focus/useFocusWorkspace';
import useCompactLayout from 'utils/useCompactLayout';

// Lazy loaded because the weather icon module is large enough to delay first paint.
const Weather = lazy(() => import('../../weather/Weather'));
const QuickWeather = lazy(() => import('../../weather/QuickWeather'));
const GoogleMail = lazy(() => import('../../google/GoogleMail'));
const GoogleCalendar = lazy(() => import('../../google/GoogleCalendar'));
const GoogleTasks = lazy(() => import('../../google/GoogleTasks'));
const PhotoInfoWidget = lazy(() => import('../../background/components/PhotoInfoWidget'));
const Rss = lazy(() => import('../../rss/Rss'));
const Countdown = lazy(() => import('../../countdown/Countdown'));
const Portfolio = lazy(() => import('../../portfolio/Portfolio'));
const Habits = lazy(() => import('../../habits/Habits'));
const AirQuality = lazy(() => import('../../airquality/AirQuality'));
const Bookmarks = lazy(() => import('../../bookmarks/Bookmarks'));
const GitHub = lazy(() => import('../../github/GitHub'));

/**
 * A rail each side and the middle column; Overview decides which. The middle splits in two only
 * once a widget is moved aside, so an unsplit profile draws one column.
 */

const Widgets = () => {
  useTranslationVersion();
  const compact = useCompactLayout();
  const online = localStorage.getItem('offlineMode') !== 'true';
  const focused = useFocusWorkspace();
  const profile = focused ? 'focus' : 'standard';
  const [, refresh] = useState(0);
  const layout = {
    order: readOrder(profile),
    placement: readPlacement(profile),
    lane: readSecondLane(profile),
  };
  const enabled = (id) => isWidgetEnabled(id, profile);

  const widgets = {
    bookmarks: enabled('bookmarks') ? <Bookmarks /> : null,
    habits: enabled('habits') ? <Habits /> : null,
    airquality: enabled('airquality') ? <AirQuality /> : null,
    github: enabled('github') ? <GitHub /> : null,
    time: enabled('time') && <Clock />,
    date: enabled('date') && <Date />,
    quicklinks: enabled('quicklinks') && online ? <QuickLinks /> : null,
    aiask: enabled('aiask') ? <AIAsk /> : null,
    weather: enabled('weather') && online ? <Weather /> : null,
    quickweather: enabled('quickweather') && online ? <QuickWeather /> : null,
    mail: enabled('mail') ? <GoogleMail /> : null,
    calendar: enabled('calendar') ? <GoogleCalendar /> : null,
    tasks: enabled('tasks') ? <GoogleTasks /> : null,
    photoinfo: enabled('photoinfo') ? <PhotoInfoWidget /> : null,
    rss: enabled('rss') ? <Rss /> : null,
    countdown: enabled('countdown') ? <Countdown /> : null,
    portfolio: enabled('portfolio') ? <Portfolio /> : null,
  };
  const basicLayout =
    widgets.weather &&
    layout.placement.weather === 'left' &&
    ['time', 'aiask'].every((id) => !widgets[id] || layout.placement[id] === 'center') &&
    Object.entries(widgets).every(
      ([id, widget]) => !widget || ['time', 'aiask', 'weather'].includes(id),
    );

  useEffect(() => {
    const handleRefresh = () => refresh((value) => value + 1);
    EventBus.on('refresh', handleRefresh);
    window.addEventListener('storage', handleRefresh);
    return () => {
      EventBus.off('refresh', handleRefresh);
      window.removeEventListener('storage', handleRefresh);
    };
  }, []);

  const groups = groupByZone(layout.order, layout.placement);

  const draw = (ids) =>
    ids.map((id) => {
      const widget = widgets[id];

      if (!widget) return null;

      return <Fragment key={id}>{widget}</Fragment>;
    });

  // A widget that is switched off is not on the page, so it cannot be half of a pair. The
  // lane outlives the switch, and counting a hidden partner as a card drew a two-column
  // page around nothing, with the cards that were left squeezed into the first column.
  // `widgets` is the same answer the drawing uses, so offline mode's missing cards count
  // as absent here too.
  const shown = groups.center.filter((id) => Boolean(widgets[id]));

  // Full-width lines read across the whole middle column and are never part of
  // the two-column pair, so they are drawn first.
  const lines = shown.filter((id) => isFullWidth(id));
  const cards = shown.filter((id) => !isFullWidth(id));

  // An empty lane is not a column: the split only exists once a card is moved in.
  const secondColumn = cards.filter((id) => layout.lane.includes(id));
  const firstColumn = cards.filter((id) => !layout.lane.includes(id));
  const split = secondColumn.length > 0;

  const middle = (
    <>
      {draw(lines)}
      {split ? (
        <div className="widgetPair">
          <WidgetScroll className="widgetColumn" label={uiText('center_left_widgets_label')}>
            {draw(firstColumn)}
          </WidgetScroll>
          <WidgetScroll className="widgetColumn" label={uiText('center_right_widgets_label')}>
            {draw(secondColumn)}
          </WidgetScroll>
        </div>
      ) : (
        draw(cards)
      )}
    </>
  );

  return (
    <Suspense fallback={<></>}>
      {compact && !basicLayout ? (
        <WidgetScroll className="compactWidgets" label={uiText('center_widgets_label')}>
          <WidgetsLayout scroll={false}>{draw(layout.order)}</WidgetsLayout>
        </WidgetScroll>
      ) : (
        <>
          {ZONES.filter((zone) => zone !== 'center').map((zone) => (
            <div key={zone} className={`widgetRail widgetRail-${zone}`}>
              {draw(groups[zone])}
            </div>
          ))}
          <WidgetsLayout split={split}>{middle}</WidgetsLayout>
        </>
      )}
    </Suspense>
  );
};

export { Widgets as default, Widgets };
