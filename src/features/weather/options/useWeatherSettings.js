import { useCallback } from 'react';
import { useLocalStorageState } from 'utils/useLocalStorageState';
import variables from 'config/variables';
import EventBus from 'utils/eventbus';
export const useWeatherSettings = () => {
  const [location, setLocation] = useLocalStorageState('location', '');
  const [windSpeed, setWindSpeed] = useLocalStorageState('windspeed', 'true');

  const saveLocation = useCallback((value) => {
    localStorage.setItem('location', value.trim());
    localStorage.removeItem('currentWeather');
    EventBus.emit('refresh', 'weather');
  }, []);

  const changeLocation = (event) => setLocation(event.target.value);

  const getAutoLocation = useCallback(() => {
    setLocation(variables.getMessage('modals.main.loading'));

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const data = await (
          await fetch(
            `${variables.constants.API_URL}/gps?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}`,
          )
        ).json();
        setLocation(data[0].name);
        saveLocation(data[0].name);
      },
      (error) => {
        console.error(error);
      },
      {
        enableHighAccuracy: true,
      },
    );
  }, [setLocation, saveLocation]);

  return {
    location,
    windSpeedEnabled: windSpeed === 'true',
    setWindSpeed,
    changeLocation,
    saveLocation,
    getAutoLocation,
  };
};
