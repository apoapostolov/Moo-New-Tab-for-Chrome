import { Header, Group, Row, Content } from 'components/Layout/Settings';
import WidgetSurface from 'components/Form/Settings/WidgetSurface/WidgetSurface';
import { OptionSelect, OptionToggle } from 'features/widgetKit/WidgetKit';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { uiText } from 'lib/translations';

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
        <OptionSelect
          category="subscriptions"
          name="subscriptionsCurrency"
          title={uiText('subscriptions_default_currency')}
          hint={uiText('subscriptions_currency_hint')}
          items={Intl.supportedValuesOf('currency').map((value) => ({ value, text: value }))}
        />
        <OptionSelect
          category="subscriptions"
          name="subscriptionsLinkTarget"
          title={uiText('subscriptions_link_target')}
          items={[
            { value: '_blank', text: uiText('subscriptions_link_new_tab') },
            { value: '_self', text: uiText('subscriptions_link_same_tab') },
          ]}
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
        <Row>
          <Content
            title={uiText('subscriptions_rate_provider')}
            subtitle={
              <a href="https://frankfurter.dev/" target="_blank" rel="noopener noreferrer">
                Frankfurter · daily reference rates
              </a>
            }
          />
        </Row>
      </Group>
    </>
  );
}
