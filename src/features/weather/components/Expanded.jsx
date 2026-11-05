import { useTranslationVersion } from 'contexts/TranslationContext';
import { memo, useMemo } from 'react';

import { WiHumidity, WiWindy, WiBarometer, WiCloud } from 'react-icons/wi';
import { MdDisabledVisible } from 'react-icons/md';

import WeatherIcon from './WeatherIcon';
import WindDirectionIcon from './WindDirectionIcon';

import { Tooltip } from 'components/Elements';

const weatherTypes = {
  cloudiness: {
    icon: WiCloud,
    key: 'cloudiness',
    unit: '%',
    title: 'modals.main.settings.sections.weather.extra_info.cloudiness',
  },
  windspeed: {
    icon: WiWindy,
    key: 'wind_speed',
    unit: 'm/s',
    title: 'modals.main.settings.sections.weather.extra_info.wind_speed',
    extra: 'windDirection',
  },
  atmosphericpressure: {
    icon: WiBarometer,
    key: 'pressure',
    unit: 'hPa',
    title: 'modals.main.settings.sections.weather.extra_info.atmospheric_pressure',
  },
  weatherdescription: {
    icon: WeatherIcon,
    key: 'description',
    title: 'modals.main.settings.sections.weather.extra_info.weather_description',
  },
  visibility: {
    icon: MdDisabledVisible,
    key: 'visibility',
    unit: 'm',
    title: 'modals.main.settings.sections.weather.extra_info.visibility',
  },
  humidity: {
    icon: WiHumidity,
    key: 'humidity',
    unit: '%',
    title: 'modals.main.settings.sections.weather.extra_info.humidity',
  },
};

function Expanded({ state: { weather, icon }, weatherType, variables }) {
  useTranslationVersion();
  const enabled = useMemo(() => {
    return (setting) => {
      return (
        (localStorage.getItem(setting) === 'true' && Number(weatherType) >= 3) ||
        Number(weatherType) === 3
      );
    };
  }, [weatherType]);

  const WeatherTooltip = ({ type }) => {
    useTranslationVersion();
    const { icon: Icon, key, unit, title, extra } = weatherTypes[type];
    return (
      enabled(type) && weather[key] != null && weather[key] !== '' && (
        <Tooltip title={variables.getMessage(title)} placement="left">
          <span>
            <Icon className="weatherIcon" name={icon} />
            {`${weather[key]} ${unit || ''}`}
            {extra && weather.wind_degrees != null && (weatherType === '3' || localStorage.getItem(extra) === 'true') && (
              <div style={{ fontSize: '25px', display: 'grid' }}>
                <WindDirectionIcon className="weatherIcon" degrees={weather.wind_degrees} />
              </div>
            )}
          </span>
        </Tooltip>
      )
    );
  };

  const anyTooltipEnabled = Object.keys(weatherTypes).some((type) => enabled(type) && weather[weatherTypes[type].key] != null && weather[weatherTypes[type].key] !== '');

  return (
    anyTooltipEnabled && (
      <div className="weatherExpandedInfo">
        {weatherType >= 3 && (
          <span className="subtitle">
            {variables.getMessage('widgets.weather.extra_information')}
          </span>
        )}
        <div className="weatherExpandedInfoItems">
          {Object.keys(weatherTypes).map((type) => (
            <WeatherTooltip key={type} type={type} />
          ))}
        </div>
      </div>
    )
  );
}

export default memo(Expanded);
