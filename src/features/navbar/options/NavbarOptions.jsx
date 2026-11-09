import { useTranslationVersion } from 'contexts/TranslationContext';
import variables from 'config/variables';

import { useState, memo } from 'react';
import { useT } from 'contexts';

import {
  // MdAssignment,
  MdCropFree,
  MdRefresh,
  // MdChecklist,
  MdOutlineApps,
  MdCenterFocusStrong,
} from 'react-icons/md';

import { Checkbox, Dropdown } from 'components/Form';
import EventBus from 'utils/eventbus';
import { saveFocusSession } from 'features/focus/focusStore';

import { Row, Content, Action, Group } from 'components/Layout/Settings/Item';
import { Header } from 'components/Layout/Settings';

import AppsOptions from './AppsOptions';
import WidgetSurface from 'components/Form/Settings/WidgetSurface/WidgetSurface';

function NavbarOptions() {
  useTranslationVersion();
  const t = useT();
  const [showRefreshOptions, setShowRefreshOptions] = useState(
    localStorage.getItem('refresh') === 'true',
  );
  const [appsEnabled, setAppsEnabled] = useState(
    localStorage.getItem('appsEnabled') === 'true' || false,
  );

  const NAVBAR_SECTION = 'modals.main.settings.sections.appearance.navbar';

  const AdditionalSettings = () => {
    useTranslationVersion();
    return (
      <Row final={false}>
        <Content
          title={t('modals.main.settings.additional_settings')}
          subtitle={t('modals.main.settings.sections.appearance.navbar.additional')}
        />
        <Action>
          <Checkbox name="navbarHover" text={t(`${NAVBAR_SECTION}.hover`)} category="navbar" />
        </Action>
      </Row>
    );
  };

  const NavbarOptions = () => {
    useTranslationVersion();
    const NavbarButton = ({ icon, messageKey, settingName }) => {
      useTranslationVersion();
      const [isDisabled, setIsDisabled] = useState(localStorage.getItem(settingName) !== 'true');
      const handleClick = () => {
        localStorage.setItem(settingName, isDisabled);

        if (settingName === 'refresh') {
          setShowRefreshOptions(!showRefreshOptions);
        } else if (settingName === 'appsEnabled') {
          setAppsEnabled(!appsEnabled);
        } else if (settingName === 'focusEnabled' && !isDisabled) {
          saveFocusSession(null);
        }

        setIsDisabled(!isDisabled);

        variables.stats.postEvent(
          'setting',
          `${settingName} ${!isDisabled === true ? 'enabled' : 'disabled'}`,
        );

        EventBus.emit('refresh', 'navbar');
      };

      return (
        <button
          type="button"
          onClick={handleClick}
          aria-pressed={!isDisabled}
          className={`navbarButtonOption ${isDisabled === true ? 'disabled' : ''}`}
        >
          {icon}
          <span className="subtitle">{t(messageKey)}</span>
        </button>
      );
    };

    const buttons = [
      {
        icon: <MdCenterFocusStrong />,
        settingName: 'focusEnabled',
        messageKey: 'ui.focus_title',
      },
      {
        icon: <MdCropFree />,
        settingName: 'view',
        messageKey: 'modals.main.settings.sections.background.buttons.view',
      },
      /* Notes and To-do are parked until their redesign.
      {
        icon: <MdAssignment />,
        settingName: 'notesEnabled',
        messageKey: `${NAVBAR_SECTION}.notes`,
      },
      {
        icon: <MdChecklist />,
        settingName: 'todoEnabled',
        messageKey: 'widgets.navbar.todo.title',
      },
      */
      {
        icon: <MdRefresh />,
        settingName: 'refresh',
        messageKey: `${NAVBAR_SECTION}.refresh`,
      },
      {
        icon: <MdOutlineApps />,
        settingName: 'appsEnabled',
        messageKey: 'widgets.navbar.apps.title',
      },
    ];

    return (
      <Row>
        <Content title={t('modals.main.settings.sections.appearance.navbar.widgets')} />
        <Action>
          <div className="navbarButtonOptions">
            {buttons.map((button, index) => (
              <NavbarButton key={index} {...button} />
            ))}
          </div>
        </Action>
      </Row>
    );
  };

  const RefreshOptions = () => {
    useTranslationVersion();
    return (
      <Row final={false} inactive={!showRefreshOptions}>
        <Content
          title={t(`${NAVBAR_SECTION}.refresh`)}
          subtitle={t('modals.main.settings.sections.appearance.navbar.refresh_subtitle')}
        />
        <Action>
          <Dropdown
            name="refreshOption"
            category="navbar"
            items={[
              {
                value: 'page',
                text: t('modals.main.settings.sections.appearance.navbar.refresh_options.page'),
              },
              {
                value: 'background',
                text: t('modals.main.settings.sections.background.title'),
              },
            ]}
          />
        </Action>
      </Row>
    );
  };

  return (
    <>
      <Header
        title={t(`${NAVBAR_SECTION}.title`)}
        setting="navbar"
        category="widgets"
        zoomSetting="zoomNavbar"
        zoomCategory="navbar"
      />
      <Group>
        <WidgetSurface setting="surfaceNavbar" category="navbar" />
        <AdditionalSettings />
        <NavbarOptions />
      </Group>
      <RefreshOptions />
      <AppsOptions appsEnabled={appsEnabled} />
    </>
  );
}

const MemoizedNavbarOptions = memo(NavbarOptions);

export { MemoizedNavbarOptions as default, MemoizedNavbarOptions as NavbarOptions };
