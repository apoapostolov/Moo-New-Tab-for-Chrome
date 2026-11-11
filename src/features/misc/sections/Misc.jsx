import { useTranslationVersion } from 'contexts/TranslationContext';
import variables from 'config/variables';

import { Dropdown, Switch } from 'components/Form/Settings';
import { Header, Row, Content, Action, Group } from 'components/Layout/Settings';
import { uiText } from 'lib/translations';

const MiscOptions = () => {
  useTranslationVersion();
  const MISC_SECTION = 'modals.main.settings.sections.misc';

  return (
    <>
      <Header title={variables.getMessage(`${MISC_SECTION}.title`)} />

      <Group>
        <Row>
          <Content title={uiText('widget_settings_buttons')} />
          <Action>
            <Switch name="widgetSettingsButtons" category="other" stateText />
          </Action>
        </Row>
        <Row>
          <Content
            title={uiText('bookmarks_open_links_in')}
            subtitle="Applies to Mail, Calendar, Tasks, GitHub and RSS widget titles."
          />
          <Action>
            <Dropdown
              name="widgetTitleLinkTarget"
              category="other"
              items={[
                { value: '_blank', text: uiText('bookmarks_new_tab') },
                { value: '_self', text: uiText('bookmarks_same_tab') },
              ]}
            />
          </Action>
        </Row>
        <Row>
          <Content
            title={variables.getMessage(`${MISC_SECTION}.cinema.title`)}
            subtitle={variables.getMessage(`${MISC_SECTION}.cinema.subtitle`)}
          />
          <Action>
            <Switch name="cinemaMode" category="other" stateText />
          </Action>
        </Row>
      </Group>
    </>
  );
};

export { MiscOptions as default, MiscOptions };
