import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MdSettings } from 'react-icons/md';
import { uiText } from 'lib/translations';
import { widgetById } from 'utils/widgets';
import './widgetSettingsShortcut.scss';

import { openWidgetSettings } from './widgetSettings';

// The marker leaves the widget's root in its existing layout. A portal places
// the shortcut in the actual header, including headers rendered after loading.
export default function WidgetSettingsShortcut({ widget, children, enabled }) {
  const marker = useRef(null);
  const [target, setTarget] = useState(null);
  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const parent = marker.current.parentElement;
    let host;
    const locate = () => {
      const root = marker.current.nextElementSibling;
      const valid = root && !root.hasAttribute('data-widget-marker');
      const header = valid && root.querySelector('.gwHead, .widgetHeader');
      const next = header || (valid ? root : null);
      if (host !== next) {
        host?.classList.remove('widgetSettingsHost');
        host = next;
        if (host && !header) host.classList.add('widgetSettingsHost');
        setTarget(next);
      }
    };
    locate();
    const observer = new window.MutationObserver(locate);
    observer.observe(parent, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      host?.classList.remove('widgetSettingsHost');
    };
  }, [enabled, widget]);
  const label = `${uiText('widget_settings')}: ${widgetById(widget)?.label() || widget}`;
  if (!enabled) return children;
  return (
    <>
      <span ref={marker} data-widget-marker={widget} hidden />
      {children}
      {enabled &&
        target &&
        createPortal(
          <button
            type="button"
            className="widgetSettingsShortcut gwIconButton"
            title={label}
            aria-label={label}
            onClick={() => openWidgetSettings(widget)}
          >
            <MdSettings />
          </button>,
          target,
        )}
    </>
  );
}
