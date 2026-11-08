import { useTranslationVersion } from 'contexts/TranslationContext';
import { Row, Content, Action } from 'components/Layout/Settings';
import { Checkbox } from 'components/Form/Settings';
import variables from 'config/variables';
export default function CustomOptions({ provider, windSpeedEnabled, setWindSpeed }) {
  useTranslationVersion();
  const weatherOptions = [
    {
      name: 'weatherdescription',
      textKey: 'modals.main.settings.sections.weather.extra_info.show_description',
    },
    {
      name: 'cloudiness',
      textKey: 'modals.main.settings.sections.weather.extra_info.cloudiness',
    },
    {
      name: 'humidity',
      textKey: 'modals.main.settings.sections.weather.extra_info.humidity',
    },
    {
      name: 'visibility',
      textKey: 'modals.main.settings.sections.weather.extra_info.visibility',
    },
    {
      name: 'windspeed',
      textKey: 'modals.main.settings.sections.weather.extra_info.wind_speed',
      onChange: (value) => setWindSpeed(String(value)),
    },
    {
      name: 'windDirection',
      textKey: 'modals.main.settings.sections.weather.extra_info.wind_direction',
      disabled: !windSpeedEnabled,
    },
    {
      name: 'atmosphericpressure',
      textKey: 'modals.main.settings.sections.weather.extra_info.atmospheric_pressure',
    },
  ];

  return (
    <Row>
      <Content
        title={variables.getMessage('modals.main.settings.sections.weather.custom_settings')}
      />
      <Action>
        {weatherOptions
          .filter((item) => provider !== 'sinoptik' || item.name !== 'windDirection')
          .map((item) => (
            <Checkbox
              key={item.name}
              name={item.name}
              text={variables.getMessage(item.textKey)}
              category="weather"
              onChange={item.onChange}
              disabled={item.disabled}
            />
          ))}
      </Action>
    </Row>
  );
}
