import { useState } from 'react';
import { uiText } from 'lib/translations';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { Row, Content, Action } from 'components/Layout/Settings/Item';
import GoogleServiceSettings from './GoogleServiceSettings';

/** Everything that only makes sense once an account is connected. */
export const GoogleWidgetSettings = () => {
  useTranslationVersion();
  // Nothing is open until one is picked: the controls belong to the selected service.
  // Only the selected service exposes its controls.
  const [tab, setTab] = useState(null);

  const tabs = [
    { id: 'mail', label: uiText('mail_92379c') },
    { id: 'calendar', label: uiText('calendar_adab50') },
    { id: 'tasks', label: uiText('tasks_090ec5') },
    { id: 'drive', label: uiText('drive_title') },
  ];

  return (
    <>
      <Row>
        <Content
          title={uiText('widget_settings_02de30')}
          subtitle={
            tab
              ? 'These controls change what the widget shows.'
              : 'Choose a widget to change what it shows.'
          }
        />
        <Action>
          <div
            className="gwSegmented gwWidgetSelector"
            role="tablist"
            aria-label={uiText('which_widget_to_configure_0ad894')}
          >
            {tabs.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                className={`gwSegment${tab === entry.id ? ' active' : ''}`}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </Action>
      </Row>

      <GoogleServiceSettings tab={tab} />
    </>
  );
};

export default GoogleWidgetSettings;
