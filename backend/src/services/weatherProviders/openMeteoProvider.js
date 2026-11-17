const axios = require('axios');

const forecastUrl = 'https://api.open-meteo.com/v1/forecast';
const geocodingUrl = 'https://geocoding-api.open-meteo.com/v1/search';

async function fetchForecast({ latitude, longitude, days }) {
  const response = await axios.get(forecastUrl, {
    params: {
      latitude,
      longitude,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover',
      hourly: 'temperature_2m,precipitation_probability,precipitation,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset',
      forecast_days: days,
      timezone: 'auto',
    },
    timeout: 12000,
  });
  return response.data;
}

async function searchLocations({ query, language }) {
  const response = await axios.get(geocodingUrl, {
    params: { name: query, count: 10, language, format: 'json' },
    timeout: 10000,
  });
  return response.data;
}

module.exports = {
  name: 'open-meteo',
  fetchForecast,
  searchLocations,
};
