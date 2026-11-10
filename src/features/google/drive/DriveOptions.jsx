import { Header, Group, Row, Content } from 'components/Layout/Settings';
import WidgetSurface from 'components/Form/Settings/WidgetSurface/WidgetSurface';
import { OptionSelect, numberChoices } from 'features/widgetKit/WidgetKit';
import { uiText } from 'lib/translations';
import { useTranslationVersion } from 'contexts/TranslationContext';

export default function DriveOptions() {
  useTranslationVersion();
  return (
    <>
      <Header
        title={uiText('drive_title')}
        setting="googleDriveEnabled"
        category="widgets"
        visibilityToggle
      />
      <Group>
        <Row>
          <Content title={uiText('drive_about')} subtitle={uiText('drive_setup')} />
        </Row>
        <WidgetSurface setting="surfaceDrive" category="google" />
        <OptionSelect
          category="google"
          name="googleDriveMax"
          title={uiText('drive_page_size')}
          items={numberChoices([5, 10, 20, 30])}
        />
        <OptionSelect
          category="google"
          name="googleDriveRefresh"
          title={uiText('refresh_56e3ba')}
          items={numberChoices([5, 15, 30], 'min')}
        />
      </Group>
    </>
  );
}
