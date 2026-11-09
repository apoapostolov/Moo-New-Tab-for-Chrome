import { assert, test, server, getWeather } from './regression-fixture.mjs';

test('weather providers retain units, omit absent fields and keep API keys out of backups', async () => {
  const { getOpenMeteo, getVisualCrossing } = await server.ssrLoadModule(
    '/src/features/weather/api/providers.js',
  );
  const variables = (await server.ssrLoadModule('/src/config/variables.js')).default;
  const originalFetch = globalThis.fetch;
  const originalMessage = variables.getMessage;
  variables.getMessage = () => 'Cloudy';
  try {
    globalThis.fetch = async (url) => ({
      ok: true,
      json: async () => {
        if (String(url).includes('geocoding-api'))
          return { results: [{ latitude: 42, longitude: 23 }] };
        if (String(url).includes('api.open-meteo'))
          return {
            current: { temperature_2m: 10, apparent_temperature: 9, is_day: 1, weather_code: 3 },
            daily: {
              time: ['2026-10-27'],
              weather_code: [3],
              temperature_2m_min: [5],
              temperature_2m_max: [12],
            },
          };
        return {
          currentConditions: { temp: 10, feelslike: 9, icon: 'cloudy', windspeed: 36 },
          days: [{ datetime: '2026-10-27', tempmin: 5, tempmax: 12, icon: 'cloudy' }],
        };
      },
    });
    const meteo = await getOpenMeteo('Sofia', 'fahrenheit', 'icon_eu');
    assert.equal(meteo.weather.temp, 50);
    assert.equal(meteo.forecast[0].max, 54);
    const visual = await getVisualCrossing('Sofia', 'kelvin', 'fixture-key');
    assert.equal(visual.weather.temp, 283);
    assert.equal(visual.weather.wind_speed, 10);
    const { createBackup } = await server.ssrLoadModule('/src/utils/settings/export.js');
    const { isCredential } = await server.ssrLoadModule('/src/utils/settings/backupSchema.js');
    localStorage.setItem('weatherVisualCrossingApiKey', 'fixture-key');
    localStorage.setItem('weatherProvider', 'visualcrossing');
    assert.equal(isCredential('weatherVisualCrossingApiKey'), true);
    assert.equal((await createBackup()).settings.weatherVisualCrossingApiKey, undefined);
    assert.equal((await createBackup()).settings.weatherProvider, 'visualcrossing');
  } finally {
    globalThis.fetch = originalFetch;
    variables.getMessage = originalMessage;
  }
});

test('weather shares in-flight reads and invalidates the cache for units and location', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return {
      ok: true,
      json: async () => ({
        main: { temp: 273.15, temp_min: 272.15, temp_max: 274.15, feels_like: 273.15 },
        weather: [{ icon: '01d', description: 'Clear' }],
        wind: { speed: 1, deg: 0 },
        clouds: { all: 0 },
      }),
    };
  };
  try {
    localStorage.setItem('tempformat', 'celsius');
    localStorage.setItem('currentWeather', 'damaged cache');
    const [first, second] = await Promise.all([getWeather('Sofia'), getWeather('Sofia')]);
    assert.equal(first.weather.temp, 0);
    assert.deepEqual(first, second);
    assert.equal(calls, 1);
    localStorage.setItem('tempformat', 'fahrenheit');
    assert.equal((await getWeather('Sofia')).weather.temp, 32);
    assert.equal(calls, 2);
    await getWeather('London');
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = previous;
  }
});
