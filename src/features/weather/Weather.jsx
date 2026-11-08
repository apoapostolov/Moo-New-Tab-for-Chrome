import { uiText } from 'lib/translations';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { fetchWithTimeout as fetch, requestOwner, settingsStamp } from 'utils/requests';
import variables from 'config/variables';
import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { formatNumber } from 'utils/formatNumber';

import WeatherIcon from './components/WeatherIcon';
import { getSurface } from 'utils/widgetSurface';
import Forecast from './components/Forecast';
import Expanded from './components/Expanded';
import WeatherSkeleton from './components/WeatherSkeleton';

import EventBus from 'utils/eventbus';
import { updateHash } from 'utils/deepLinking';

import { getWeather } from './api/getWeather.js';
import { weatherSettings, WEATHER_ATTRIBUTION } from './api/providers';

import './weather.scss';

const WeatherWidget = memo(({ compact = false }) => {
  useTranslationVersion();
  const owner = useRef(requestOwner());
  const geoOwner = useRef(requestOwner());
  const [location, setLocation] = useState(localStorage.getItem('location') || '');
  const [done, setDone] = useState(false);
  const [weatherData, setWeatherData] = useState({});

  const autoFindLocation = useCallback(() => {
    if (!navigator.geolocation || localStorage.getItem('offlineMode') === 'true') return;
    const request = geoOwner.current.start();
    const stamp = settingsStamp(/^(location|offlineMode)$/);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (!request.current()) return;
        try {
          const data = await (
            await fetch(
              `${variables.constants.API_URL}/gps?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}`,
              { signal: request.signal },
            )
          ).json();
          if (
            request.current() &&
            stamp === settingsStamp(/^(location|offlineMode)$/) &&
            data &&
            data[0] &&
            data[0].name
          ) {
            localStorage.setItem('location', data[0].name);
            setLocation(data[0].name);
          }
        } catch (e) {
          console.error(e);
        }
      },
      (error) => {
        if (error.code !== 1) console.error(error);
      },
      { enableHighAccuracy: true },
    );
  }, []);

  useEffect(() => {
    if (!location && localStorage.getItem('weatherProvider') !== 'sinoptik') {
      autoFindLocation();
    }
    const geo = geoOwner.current;
    return () => geo.cancel();
  }, [location, autoFindLocation]);
  const updateWeather = useCallback(
    async (requestedLocation = location) => {
      const request = owner.current.start();
      const stamp = settingsStamp(weatherSettings);
      const data = await getWeather(requestedLocation);
      if (!request.current() || stamp !== settingsStamp(weatherSettings)) return;
      if (data) {
        setWeatherData(data);
        setDone(data.done);
      } else {
        setWeatherData({ done: true });
        setDone(true);
      }

      const zoomWeather = `${Number((localStorage.getItem('zoomWeather') || 100) / 100)}em`;
      const weatherElement = document.querySelector('.weather');
      if (weatherElement) {
        weatherElement.style.fontSize = zoomWeather;
      }
    },
    [location],
  );

  useEffect(() => {
    const effectOwner = owner.current;
    const handleRefresh = async (data) => {
      if (data === 'weather') {
        const nextLocation = localStorage.getItem('location') || '';
        setLocation(nextLocation);
        await updateWeather(nextLocation);
      }
    };

    EventBus.on('refresh', handleRefresh);
    const first = setTimeout(updateWeather, 0);
    const timer = setInterval(updateWeather, 300000);

    return () => {
      effectOwner.cancel();
      clearTimeout(first);
      clearInterval(timer);
      EventBus.off('refresh', handleRefresh);
    };
  }, [updateWeather]);

  const weatherType = compact ? 1 : localStorage.getItem('weatherType') || 1;
  const source = WEATHER_ATTRIBUTION[weatherData.provider];

  if (done === false) {
    return <WeatherSkeleton weatherType={weatherType} />;
  }

  if (!weatherData.weather) {
    return (
      <div className={`weather weatherNotice ${getSurface('weather')}`}>
        {location || weatherData.location ? (
          <span className="loc">{weatherData.location || location}</span>
        ) : (
          <button
            type="button"
            className="weatherLocationButton"
            onClick={() => {
              updateHash('#settings/weather');
              EventBus.emit('modal', 'openMainModal');
            }}
          >
            {uiText('set_weather_location')}
          </button>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`weather weatherCompact ${getSurface('weather')}`}>
        <WeatherIcon name={weatherData.icon} />
        <span>{`${formatNumber(weatherData.weather.temp)}${weatherData.temp_text}`}</span>
        <span className="weatherCompactDesc">{weatherData.weather.description}</span>
        <span className="loc">{weatherData.displayLocation || location}</span>
        {source && (
          <a
            className="weatherAttribution"
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {source.name}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={`weather ${getSurface('weather')}`}>
      <div className="weatherCore">
        <div className="iconAndTemps">
          <div className="weathericon">
            <WeatherIcon name={weatherData.icon} />
            <span>{`${formatNumber(weatherData.weather.temp)}${weatherData.temp_text}`}</span>
          </div>
          {weatherType >= 2 && (
            <span className="minmax">
              <span className="subtitle">{`${formatNumber(weatherData.weather.temp_min)}${weatherData.temp_text}`}</span>
              <span className="subtitle">{`${formatNumber(weatherData.weather.temp_max)}${weatherData.temp_text}`}</span>
            </span>
          )}
        </div>
        {weatherType >= 2 && (
          <div className="extra-info">
            <span>
              {variables.getMessage('widgets.weather.feels_like', {
                amount: `${formatNumber(weatherData.weather.feels_like)}${weatherData.temp_text}`,
              })}
            </span>
            <span className="loc">{weatherData.displayLocation || location}</span>
          </div>
        )}
      </div>
      {weatherType >= 3 && <Forecast location={location} providedDays={weatherData.forecast} />}
      {Number(weatherType) === 4 && (
        <Expanded state={weatherData} weatherType={weatherType} variables={variables} />
      )}
      {source && (
        <a
          className="weatherAttribution"
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {source.name}
        </a>
      )}
    </div>
  );
});

WeatherWidget.displayName = 'WeatherWidget';

export { WeatherWidget as default, WeatherWidget };
