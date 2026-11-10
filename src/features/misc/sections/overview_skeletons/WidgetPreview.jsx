import Clock from './Clock';
import Date from './Date';
import QuickLinks from './QuickLinks';
import QuickWeather from './QuickWeather';
import WidgetThumb from './WidgetThumb';
const AskPreview = () => (
  <div className="aiAskSkeleton" aria-hidden="true">
    <span className="aiAskSkeletonText" />
    <span className="aiAskSkeletonLine" />
  </div>
);
export const WIDGET_PREVIEWS = {
  time: Clock,
  date: Date,
  quicklinks: QuickLinks,
  quickweather: QuickWeather,
  aiask: AskPreview,
  weather: null,
  mail: null,
  calendar: null,
  tasks: null,
  photoinfo: null,
  rss: null,
  portfolio: null,
  countdown: null,
  habits: null,
  planning: null,
  airquality: null,
  github: null,
  bookmarks: null,
};
export default function WidgetPreview({ id, label }) {
  const Preview = WIDGET_PREVIEWS[id];
  return Preview ? <Preview /> : <WidgetThumb type={id} label={label} />;
}
