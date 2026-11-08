import { uiText } from 'lib/translations';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { useState } from 'react';
import { MdAutoAwesome } from 'react-icons/md';
import {
  Header,
  Row,
  Content,
  Action,
  Group,
  PreferencesWrapper,
} from 'components/Layout/Settings';
import WidgetSurface from 'components/Form/Settings/WidgetSurface/WidgetSurface';
import { useWeatherSettings } from './useWeatherSettings';
import CustomOptions from './CustomOptions';
import { Radio, Dropdown } from 'components/Form/Settings';
import variables from 'config/variables';
import EventBus from 'utils/eventbus';
import { WEATHER_PROVIDERS, WEATHER_MODELS, WEATHER_KEY_NAMES } from '../api/providers';
import 'components/Form/Settings/Text/Text.scss';

const WeatherOptions = () => {
  useTranslationVersion();
  const {
    location,
    windSpeedEnabled,
    setWindSpeed,
    changeLocation,
    saveLocation,
    getAutoLocation,
  } = useWeatherSettings();
  const [weatherType, setWeatherType] = useState(() => localStorage.getItem('weatherType'));
  const [provider, setProvider] = useState(() => localStorage.getItem('weatherProvider') || 'mue');
  const [sinoptikUrl, setSinoptikUrl] = useState(
    () => localStorage.getItem('weatherSinoptikUrl') || '',
  );
  const keyName = WEATHER_KEY_NAMES[provider];
  const [apiKeys, setApiKeys] = useState(() => ({
    weatherOpenWeatherApiKey: localStorage.getItem('weatherOpenWeatherApiKey') || '',
    weatherWeatherApiKey: localStorage.getItem('weatherWeatherApiKey') || '',
    weatherVisualCrossingApiKey: localStorage.getItem('weatherVisualCrossingApiKey') || '',
  }));
  const providerKeyLinks = {
    openweather: 'https://home.openweathermap.org/users/sign_up',
    weatherapi: 'https://www.weatherapi.com/signup.aspx',
    visualcrossing: 'https://www.visualcrossing.com/weather-api/',
  };
  const WEATHER_SECTION = 'modals.main.settings.sections.weather';

  const WidgetType = () => (
    <Row>
      <Content title={variables.getMessage(`${WEATHER_SECTION}.widget_type`)} />
      <Action>
        <Dropdown
          label={variables.getMessage('modals.main.settings.sections.time.type')}
          name="weatherType"
          category="weather"
          onChange={setWeatherType}
          items={[
            { value: '1', text: variables.getMessage(`${WEATHER_SECTION}.options.basic`) },
            { value: '2', text: variables.getMessage(`${WEATHER_SECTION}.options.standard`) },
            { value: '3', text: variables.getMessage(`${WEATHER_SECTION}.options.expanded`) },
            { value: '4', text: variables.getMessage(`${WEATHER_SECTION}.options.custom`) },
          ]}
        />
      </Action>
    </Row>
  );

  const LocationSetting = () => (
    <Row>
      <Content title={variables.getMessage(`${WEATHER_SECTION}.location`)} />
      <Action>
        <div className="text-field-container">
          <div className="text-field">
            <div className="text-field-header">
              <label className="text-field-label" htmlFor="weather-location">
                {variables.getMessage(`${WEATHER_SECTION}.location`)}
              </label>
              <button type="button" className="text-field-reset" onClick={getAutoLocation}>
                <MdAutoAwesome />
                {variables.getMessage(`${WEATHER_SECTION}.auto`)}
              </button>
            </div>
            <input
              id="weather-location"
              type="text"
              className="text-field-input"
              value={location}
              onChange={changeLocation}
              onBlur={(event) => saveLocation(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              placeholder={uiText('london_4c57f0')}
            />
          </div>
        </div>
      </Action>
    </Row>
  );

  const TemperatureFormat = () => (
    <Row>
      <Content title={variables.getMessage(`${WEATHER_SECTION}.temp_format.title`)} />
      <Action>
        <Radio
          name="tempformat"
          options={[
            {
              name: `${variables.getMessage(`${WEATHER_SECTION}.temp_format.celsius`)} (°C)`,
              value: 'celsius',
            },
            {
              name: `${variables.getMessage(`${WEATHER_SECTION}.temp_format.fahrenheit`)} (°F)`,
              value: 'fahrenheit',
            },
            {
              name: `${variables.getMessage(`${WEATHER_SECTION}.temp_format.kelvin`)} (K)`,
              value: 'kelvin',
            },
          ]}
          category="weather"
        />
      </Action>
    </Row>
  );

  return (
    <>
      <Header
        title={variables.getMessage(`${WEATHER_SECTION}.title`)}
        setting="weatherEnabled"
        category="widgets"
        zoomSetting="zoomWeather"
        zoomCategory="weather"
        visibilityToggle={true}
      />
      <PreferencesWrapper
        setting="weatherEnabled"
        zoomSetting="zoomWeather"
        zoomCategory="weather"
        visibilityToggle={true}
      >
        <Group>
          <Row>
            <Content
              title={uiText('weather_provider')}
              subtitle={uiText('weather_provider_hint')}
            />
            <Action>
              <Dropdown
                name="weatherProvider"
                category="weather"
                items={WEATHER_PROVIDERS.map((item) =>
                  item.value === 'mue'
                    ? { ...item, text: uiText('weather_default_provider') }
                    : item,
                )}
                onChange={(value) => {
                  localStorage.removeItem('currentWeather');
                  setProvider(value);
                }}
              />
            </Action>
          </Row>
          {provider === 'openmeteo' && (
            <Row>
              <Content title={uiText('weather_model')} subtitle={uiText('weather_model_hint')} />
              <Action>
                <Dropdown
                  name="weatherModel"
                  category="weather"
                  items={WEATHER_MODELS.map((model) =>
                    model.value === 'best_match'
                      ? { ...model, text: variables.getMessage(`${WEATHER_SECTION}.auto`) }
                      : model,
                  )}
                  onChange={() => localStorage.removeItem('currentWeather')}
                />
              </Action>
            </Row>
          )}
          {provider === 'sinoptik' && (
            <Row>
              <Content
                title={uiText('weather_sinoptik_url')}
                subtitle={uiText('weather_sinoptik_url_hint')}
              />
              <Action>
                <div className="text-field-container">
                  <div className="text-field">
                    <input
                      className="text-field-input"
                      type="url"
                      aria-label={uiText('weather_sinoptik_url')}
                      placeholder="https://www.sinoptik.bg/sofia-bulgaria-100727011"
                      value={sinoptikUrl}
                      onChange={(event) => setSinoptikUrl(event.target.value)}
                      onBlur={() => {
                        localStorage.setItem('weatherSinoptikUrl', sinoptikUrl.trim());
                        localStorage.removeItem('currentWeather');
                        EventBus.emit('refresh', 'weather');
                      }}
                    />
                  </div>
                </div>
              </Action>
            </Row>
          )}
          {keyName && (
            <Row>
              <Content
                title={uiText('weather_api_key')}
                subtitle={uiText('weather_api_key_hint')}
              />
              <Action>
                <div className="text-field-container">
                  <div className="text-field">
                    <input
                      className="text-field-input"
                      type="password"
                      autoComplete="off"
                      aria-label={uiText('weather_api_key')}
                      value={apiKeys[keyName]}
                      onChange={(event) =>
                        setApiKeys({ ...apiKeys, [keyName]: event.target.value })
                      }
                      onBlur={() => {
                        localStorage.setItem(keyName, apiKeys[keyName].trim());
                        localStorage.removeItem('currentWeather');
                        EventBus.emit('refresh', 'weather');
                      }}
                    />
                  </div>
                </div>
                <a href={providerKeyLinks[provider]} target="_blank" rel="noopener noreferrer">
                  {WEATHER_PROVIDERS.find((item) => item.value === provider)?.text}
                </a>
              </Action>
            </Row>
          )}
          {provider === 'weatherapi' && (
            <Row>
              <Content title="WeatherAPI.com" subtitle={uiText('weatherapi_notice')} />
            </Row>
          )}
          {WidgetType()}
          {provider !== 'sinoptik' && LocationSetting()}
          {TemperatureFormat()}
          {weatherType === '4' && (
            <CustomOptions
              provider={provider}
              windSpeedEnabled={windSpeedEnabled}
              setWindSpeed={setWindSpeed}
            />
          )}
          <WidgetSurface setting="surfaceWeather" category="weather" />
        </Group>
      </PreferencesWrapper>
    </>
  );
};

export { WeatherOptions as default, WeatherOptions };
