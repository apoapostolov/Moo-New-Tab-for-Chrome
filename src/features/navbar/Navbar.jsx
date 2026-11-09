import { useTranslationVersion } from 'contexts/TranslationContext';
import { useState, useEffect } from 'react';
import { useT } from 'contexts';

import { MdSettings } from 'react-icons/md';

import { Apps, Refresh, Maximise } from './components';
// Notes and To-do are parked until their redesign.
// import { Notes, Todo } from './components';
import { Tooltip } from 'components/Elements';

import EventBus from 'utils/eventbus';

import './scss/index.scss';
import FocusButton from 'features/focus/FocusButton';
import useNavbarClearance from './useNavbarClearance';

const Navbar = ({ openModal }) => {
  useTranslationVersion();
  const t = useT();
  const navbarRef = useNavbarClearance();
  const [classList] = useState(
    localStorage.getItem('widgetStyle') === 'legacy' ? 'navbar old' : 'navbar new',
  );

  const getZoomFontSize = () => {
    return Number(((localStorage.getItem('zoomNavbar') || 100) / 100) * 1.2) + 'rem';
  };

  const [refreshEnabled, setRefreshEnabled] = useState(localStorage.getItem('refresh'));
  const [refreshOption, setRefreshOption] = useState(localStorage.getItem('refreshOption') || '');
  const [zoomFontSize, setZoomFontSize] = useState(getZoomFontSize());
  const [surface, setSurface] = useState(() => localStorage.getItem('surfaceNavbar') || 'classic');
  const [navbarHover, setNavbarHover] = useState(localStorage.getItem('navbarHover') === 'true');
  const [viewEnabled, setViewEnabled] = useState(localStorage.getItem('view') === 'true');
  // const [notesEnabled, setNotesEnabled] = useState(localStorage.getItem('notesEnabled') === 'true');
  // const [todoEnabled, setTodoEnabled] = useState(localStorage.getItem('todoEnabled') === 'true');
  const [focusEnabled, setFocusEnabled] = useState(localStorage.getItem('focusEnabled') === 'true');
  const [appsEnabled, setAppsEnabled] = useState(localStorage.getItem('appsEnabled') === 'true');

  useEffect(() => {
    const handleRefresh = (data) => {
      if (data === 'navbar' || data === 'background') {
        setRefreshEnabled(localStorage.getItem('refresh'));
        setRefreshOption(localStorage.getItem('refreshOption'));
        setNavbarHover(localStorage.getItem('navbarHover') === 'true');
        setViewEnabled(localStorage.getItem('view') === 'true');
        // setNotesEnabled(localStorage.getItem('notesEnabled') === 'true');
        // setTodoEnabled(localStorage.getItem('todoEnabled') === 'true');
        setFocusEnabled(localStorage.getItem('focusEnabled') === 'true');
        setAppsEnabled(localStorage.getItem('appsEnabled') === 'true');
        setZoomFontSize(getZoomFontSize());
        setSurface(localStorage.getItem('surfaceNavbar') || 'classic');
      }
    };

    EventBus.on('refresh', handleRefresh);
    return () => {
      EventBus.off('refresh', handleRefresh);
    };
  }, []);

  const backgroundEnabled = localStorage.getItem('background') === 'true';

  const navbar = (
    <div className="navbar-container" ref={navbarRef}>
      <div
        className={`${classList}${surface === 'glass' ? ' navbarGlass' : ''}${focusEnabled ? ' focusNavbar' : ''}`}
      >
        {viewEnabled && backgroundEnabled ? <Maximise fontSize={zoomFontSize} /> : null}
        {focusEnabled && <FocusButton fontSize={zoomFontSize} />}
        {/* {notesEnabled && <Notes fontSize={zoomFontSize} />}
        {todoEnabled && <Todo fontSize={zoomFontSize} />} */}
        {appsEnabled && <Apps fontSize={zoomFontSize} />}

        {refreshEnabled !== 'false' && <Refresh fontSize={zoomFontSize} />}

        <Tooltip
          title={t('modals.main.navbar.settings', {
            type: t('modals.main.navbar.tooltips.refresh_' + refreshOption),
          })}
        >
          <button
            className="navbarButton"
            onClick={() => openModal('mainModal')}
            style={{ fontSize: zoomFontSize }}
            aria-label={t('modals.main.navbar.settings', {
              type: t('modals.main.navbar.tooltips.refresh_' + refreshOption),
            })}
          >
            <MdSettings className="settings-icon topicons" />
          </button>
        </Tooltip>
      </div>
    </div>
  );

  return navbarHover ? <div className="navbar-hover">{navbar}</div> : navbar;
};

export { Navbar as default, Navbar };
