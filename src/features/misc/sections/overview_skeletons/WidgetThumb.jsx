import { useTranslationVersion } from 'contexts/TranslationContext';
import { memo } from 'react';

/**
 * A widget as the preview draws it: one entry, bars for text, dots for the card's glyph. Drawn
 * rather than cloned for the cards that cannot render inside the settings panel.
 */

export const THUMB_LAYOUT = {
  bookmarks: { icon: 'square', lines: ['wide', 'medium'] },
  habits: { icon: 'check', lines: ['wide', 'short'] },
  drive: { icon: 'square', lines: ['wide', 'medium'] },
  subscriptions: { icon: 'square', lines: ['wide', 'short'] },
  planning: { icon: 'check', lines: ['wide', 'medium', 'short'] },
  airquality: { icon: 'weather', lines: ['medium', 'short'] },
  github: { icon: 'article', lines: ['wide', 'medium'] },
  mail: { icon: 'dot', lines: ['wide', 'medium'] },
  calendar: { icon: 'square', lines: ['medium', 'wide'] },
  tasks: { icon: 'check', lines: ['wide'] },
  photoinfo: { icon: null, lines: ['medium', 'short'] },
  rss: { icon: 'article', lines: ['wide', 'medium', 'short'] },
  weather: { icon: 'weather', lines: ['medium', 'short'] },
  countdown: { icon: 'square', lines: ['wide', 'short'] },
  portfolio: { icon: 'dot', lines: ['wide', 'short'] },
};

function WidgetThumb({ type, label }) {
  useTranslationVersion();
  const layout = THUMB_LAYOUT[type];

  if (!layout) return null;

  return (
    <div className={`gwSkeleton gwSkeleton-${type}`} role="img" aria-label={label || type}>
      <div className="gwSkeletonHead">
        <span className="gwSkeletonDot" />
        <span className="gwSkeletonBar gwSkeletonBar-short" />
        <span className="gwSkeletonDot gwSkeletonDot-small" />
      </div>
      {type === 'weather' && <span className="weatherThumbReading">☁ 18°</span>}
      {type === 'portfolio' && <span className="weatherThumbReading">$12,450</span>}
      {type === 'portfolio' && (
        <svg viewBox="0 0 100 18" width="100%" height="18" aria-hidden="true">
          <path
            d="M0 16 L14 13 L24 15 L37 9 L49 11 L63 5 L75 7 L88 2 L100 3"
            fill="none"
            stroke="#8dd5af"
            strokeWidth="1.5"
          />
        </svg>
      )}
      <div className="gwSkeletonEntry">
        {layout.icon ? <span className={`gwSkeletonIcon gwSkeletonIcon-${layout.icon}`} /> : null}
        <span className="gwSkeletonLines">
          {layout.lines.map((line) => (
            <span className={`gwSkeletonBar gwSkeletonBar-${line}`} key={line} />
          ))}
        </span>
      </div>
      {type === 'rss' && (
        <div className="gwSkeletonEntry">
          <span className="gwSkeletonIcon gwSkeletonIcon-article" />
          <span className="gwSkeletonLines">
            <span className="gwSkeletonBar gwSkeletonBar-medium" />
            <span className="gwSkeletonBar gwSkeletonBar-wide" />
          </span>
        </div>
      )}
    </div>
  );
}

export default memo(WidgetThumb);
