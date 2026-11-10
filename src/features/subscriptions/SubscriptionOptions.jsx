import { Header, Group, Row, Content } from 'components/Layout/Settings';
import WidgetSurface from 'components/Form/Settings/WidgetSurface/WidgetSurface';
import { OptionInput, OptionToggle } from 'features/widgetKit/WidgetKit';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { uiText } from 'lib/translations';
import { validCurrency } from './subscriptionSchema';

export default function SubscriptionOptions() {
  useTranslationVersion();
  return (
    <>
      <Header
        title={uiText('subscriptions_title')}
        setting="subscriptionsEnabled"
        category="widgets"
        visibilityToggle
      />
      <Group>
        <Row>
          <Content
            title={uiText('subscriptions_about')}
            subtitle={uiText('subscriptions_about_hint')}
          />
        </Row>
        <WidgetSurface setting="surfaceSubscriptions" category="subscriptions" />
        <OptionInput
          category="subscriptions"
          name="subscriptionsCurrency"
          title={uiText('subscriptions_default_currency')}
          hint={uiText('subscriptions_currency_hint')}
          maxLength={3}
          validate={validCurrency}
        />
        <OptionToggle
          category="subscriptions"
          name="subscriptionsRemoteIcons"
          title={uiText('subscriptions_remote_logos')}
          hint={uiText('subscriptions_remote_hint')}
        />
        <Row>
          <Content
            title={uiText('subscriptions_logo_library')}
            subtitle={
              <a
                href="https://github.com/homarr-labs/dashboard-icons"
                target="_blank"
                rel="noopener noreferrer"
              >
                Dashboard Icons · Homarr Labs · Apache-2.0
              </a>
            }
          />
        </Row>
      </Group>
    </>
  );
}
