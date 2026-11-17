const axios = require('axios');
const { createHash } = require('node:crypto');
const { Op } = require('sequelize');
const HttpError = require('../utils/httpError');
const { getWeatherProvider } = require('./weatherProvider');
const weatherCache = require('./weatherCacheService');

const weatherDescriptions = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

function coordinates(latitude, longitude) {
  const validNumber = (value) => (typeof value === 'number'
    || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value));
  if (!validNumber(latitude) || !validNumber(longitude)) {
    throw new HttpError(400, 'Provide a valid latitude and longitude for the weather location.');
  }
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new HttpError(400, 'Provide a valid latitude and longitude for the weather location.');
  }
  return { latitude: lat, longitude: lon };
}

function locationFromRequest(req) {
  return coordinates(req.query.latitude, req.query.longitude);
}

function locationHash(location) {
  const point = coordinates(location.latitude, location.longitude);
  return createHash('sha256')
    .update(`${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`)
    .digest('hex');
}

function validNumberOrNull(value) {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function validateForecastResponse(data) {
  const currentFields = [
    'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'precipitation',
    'weather_code', 'wind_speed_10m',
  ];
  const dailyFields = [
    'weather_code', 'temperature_2m_max', 'temperature_2m_min',
    'precipitation_probability_max', 'precipitation_sum', 'sunrise', 'sunset',
  ];
  const hourlyFields = [
    'temperature_2m', 'precipitation_probability', 'precipitation', 'wind_speed_10m',
  ];
  const arraysMatch = (record, fields, time) => fields.every((field) => Array.isArray(record[field])
    && record[field].length === time.length);

  if (!data || !data.current || !data.daily || !data.hourly
    || typeof data.current.time !== 'string'
    || currentFields.some((field) => !validNumberOrNull(data.current[field]))
    || !Array.isArray(data.daily.time) || !data.daily.time.length
    || !arraysMatch(data.daily, dailyFields, data.daily.time)
    || !Array.isArray(data.hourly.time) || !data.hourly.time.length
    || !arraysMatch(data.hourly, hourlyFields, data.hourly.time)) {
    throw new HttpError(502, 'The weather provider returned incomplete or invalid forecast data.');
  }
  return data;
}

function cacheKey(location, days, provider) {
  return createHash('sha256')
    .update(`${provider}:${locationHash(location)}:${days}`)
    .digest('hex');
}

async function fetchForecastResult(location, days = 7) {
  const point = coordinates(location.latitude, location.longitude);
  if (!Number.isInteger(days) || days < 1 || days > 7) {
    throw new HttpError(400, 'Forecast days must be a whole number from 1 to 7.');
  }
  const provider = getWeatherProvider();
  const providerName = provider.name;
  const key = cacheKey(point, days, providerName);
  const dataType = days === 1 ? 'current' : 'forecast';
  const cached = await weatherCache.read(key);
  if (cached) {
    return {
      data: validateForecastResponse(cached.payload),
      source: 'Open-Meteo',
      cacheStatus: 'hit',
      updatedAt: cached.providerUpdatedAt,
      fetchedAt: cached.fetchedAt,
    };
  }

  let data;
  try {
    data = validateForecastResponse(await provider.fetchForecast({ ...point, days }));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new HttpError(504, 'Live weather is taking too long to load. Please retry.');
    }
    throw new HttpError(502, 'Live weather is temporarily unavailable.');
  }

  const providerUpdatedAt = data.current.time;
  let fetchedAt = new Date();
  let cacheStatus = 'miss';
  try {
    fetchedAt = await weatherCache.write({
      cacheKey: key,
      provider: providerName,
      dataType,
      payload: data,
      providerUpdatedAt,
    });
  } catch (error) {
    cacheStatus = 'not-stored';
    console.error('Weather response could not be cached:', error.message);
  }
  return { data, source: 'Open-Meteo', cacheStatus, updatedAt: providerUpdatedAt, fetchedAt };
}

async function recordWeatherData(data, location, providerName = 'open-meteo') {
  const { WeatherObservation, WeatherForecast } = require('../models');
  const hash = locationHash(location);
  const observedAt = new Date(data.current.time);
  if (Number.isNaN(observedAt.getTime())) throw new HttpError(502, 'The weather provider returned an invalid observation time.');
  await WeatherObservation.findOrCreate({
    where: { locationHash: hash, provider: providerName, observedAt },
    defaults: {
      locationHash: hash,
      locationName: location.name || null,
      latitude: location.latitude,
      longitude: location.longitude,
      observedAt,
      provider: providerName,
      data: currentConditions(data, location.name),
    },
  });
  const fetchedAt = new Date();
  const dailyRows = dailyForecast(data);
  const forecastRows = data.daily.time.map((date, index) => {
    const forecastAt = new Date(`${date}T12:00:00.000Z`);
    return {
      locationHash: hash,
      latitude: location.latitude,
      longitude: location.longitude,
      forecastAt,
      fetchedAt,
      provider: providerName,
      data: dailyRows[index],
      createdAt: fetchedAt,
      updatedAt: fetchedAt,
    };
  });
  await WeatherForecast.bulkCreate(forecastRows, {
    updateOnDuplicate: ['fetchedAt', 'data', 'updatedAt'],
  });
}

function currentConditions(data, locationName) {
  const code = data.current.weather_code;
  return {
    location: locationName || null,
    coordinates: { latitude: data.latitude, longitude: data.longitude },
    observedAt: data.current.time,
    temperatureC: data.current.temperature_2m,
    feelsLikeC: data.current.apparent_temperature,
    humidityPercent: data.current.relative_humidity_2m,
    precipitationMm: data.current.precipitation,
    windSpeedKph: data.current.wind_speed_10m,
    windDirectionDegrees: data.current.wind_direction_10m ?? null,
    pressureHpa: data.current.pressure_msl ?? null,
    cloudCoverPercent: data.current.cloud_cover ?? null,
    weatherCode: code,
    condition: weatherDescriptions[code] || 'Weather condition not described by provider',
    source: 'Open-Meteo',
  };
}

function dailyForecast(data) {
  return data.daily.time.map((date, index) => ({
    date,
    condition: weatherDescriptions[data.daily.weather_code[index]] || 'Weather condition not described by provider',
    weatherCode: data.daily.weather_code[index],
    maximumC: data.daily.temperature_2m_max[index],
    minimumC: data.daily.temperature_2m_min[index],
    precipitationProbabilityPercent: data.daily.precipitation_probability_max[index],
    precipitationMm: data.daily.precipitation_sum[index],
    sunrise: data.daily.sunrise[index],
    sunset: data.daily.sunset[index],
  }));
}

function hourlyForecast(data) {
  const start = data.hourly.time.findIndex((time) => time >= data.current.time);
  if (start < 0) throw new HttpError(502, 'The weather provider returned no current or future hourly forecast.');
  return data.hourly.time.slice(start, start + 24).map((time, index) => ({
    time,
    temperatureC: data.hourly.temperature_2m[start + index],
    precipitationProbabilityPercent: data.hourly.precipitation_probability[start + index],
    precipitationMm: data.hourly.precipitation[start + index],
    windSpeedKph: data.hourly.wind_speed_10m[start + index],
  }));
}

function farmingAdvisories(data) {
  const advice = [];
  const rainProbability = data.daily.precipitation_probability_max && data.daily.precipitation_probability_max[0];
  const rainAmount = data.daily.precipitation_sum && data.daily.precipitation_sum[0];
  const wind = data.current.wind_speed_10m;
  const temperature = data.current.temperature_2m;

  if (typeof rainProbability === 'number' && rainProbability >= 60) {
    advice.push({
      type: 'rain',
      message: `Rain is likely today (${rainProbability}% forecast probability). Check field conditions before irrigation or other field work.`,
      basedOn: 'Open-Meteo daily precipitation probability',
    });
  } else if (typeof rainAmount === 'number' && rainAmount > 0) {
    advice.push({
      type: 'rain',
      message: 'Rain is included in today’s forecast. Check local field conditions before irrigation or other field work.',
      basedOn: 'Open-Meteo daily precipitation forecast',
    });
  }
  if (typeof wind === 'number' && wind >= 25) {
    advice.push({
      type: 'wind',
      message: `Wind is currently ${wind} km/h. Consider local conditions and product-label precautions before any spraying.`,
      basedOn: 'Open-Meteo current wind speed',
    });
  }
  if (typeof temperature === 'number' && temperature >= 38) {
    advice.push({
      type: 'heat',
      message: `The current temperature is ${temperature}°C. Monitor crops and livestock for heat stress and follow local agricultural guidance.`,
      basedOn: 'Open-Meteo current temperature',
    });
  }
  return advice;
}

async function searchLocations(query, language = 'en') {
  const trimmed = String(query || '').trim();
  const validLanguages = ['en', 'te', 'hi'];
  if (trimmed.length < 2 || trimmed.length > 100) {
    throw new HttpError(400, 'Enter at least 2 characters and no more than 100 characters to search.');
  }
  if (!validLanguages.includes(language)) throw new HttpError(400, 'Choose English, Telugu, or Hindi.');
  try {
    const provider = getWeatherProvider();
    const response = await provider.searchLocations({ query: trimmed, language });
    if (!response || (response.results !== undefined && !Array.isArray(response.results))) {
      throw new HttpError(502, 'The location provider returned incomplete data.');
    }
    return (response.results || []).map((item) => ({
      name: item.name,
      admin1: item.admin1 || null,
      country: item.country || null,
      latitude: coordinates(item.latitude, item.longitude).latitude,
      longitude: coordinates(item.latitude, item.longitude).longitude,
      timezone: item.timezone || null,
    }));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') throw new HttpError(504, 'Location search timed out. Please retry.');
    throw new HttpError(502, 'Location search is temporarily unavailable.');
  }
}

function parseAlertDate(value, label) {
  if (value === null || value === undefined) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(502, `The configured alert provider returned an invalid ${label}.`);
  return date.toISOString();
}

async function fetchOfficialAlerts(location) {
  const url = process.env.WEATHER_ALERTS_URL;
  if (!url) throw new HttpError(503, 'Official weather alerts are unavailable because no alert provider is configured.');
  const point = coordinates(location.latitude, location.longitude);
  try {
    const response = await axios.get(url, { params: point, timeout: 12000 });
    if (!response.data || !Array.isArray(response.data.alerts)) {
      throw new HttpError(502, 'The configured alert provider returned an unsupported response.');
    }
    const source = typeof response.data.source === 'string' && response.data.source.trim()
      ? response.data.source.trim().slice(0, 300)
      : 'Configured alert provider';
    const updatedAt = parseAlertDate(response.data.updatedAt || new Date(), 'update time');
    const alerts = response.data.alerts.map((alert) => {
      if (!alert || typeof alert !== 'object' || Array.isArray(alert)
        || typeof alert.title !== 'string' || !alert.title.trim()
        || typeof alert.description !== 'string') {
        throw new HttpError(502, 'The configured alert provider returned an invalid alert record.');
      }
      const startsAt = parseAlertDate(alert.startsAt, 'start time');
      const endsAt = parseAlertDate(alert.endsAt, 'end time');
      if (startsAt && endsAt && new Date(endsAt) < new Date(startsAt)) {
        throw new HttpError(502, 'The configured alert provider returned an invalid alert period.');
      }
      const id = typeof alert.id === 'string' && alert.id.trim()
        ? alert.id.trim().slice(0, 180)
        : createHash('sha256').update(`${alert.title}:${startsAt || ''}:${source}`).digest('hex');
      return {
        id,
        title: alert.title.trim().slice(0, 180),
        category: typeof alert.category === 'string' ? alert.category.trim().slice(0, 100) : 'other',
        severity: typeof alert.severity === 'string' ? alert.severity.trim().slice(0, 50) : null,
        description: alert.description.trim().slice(0, 1200),
        startsAt,
        endsAt,
        location: typeof alert.location === 'string' ? alert.location.trim().slice(0, 180) : location.name || null,
        source,
        updatedAt,
      };
    });
    const { WeatherAlert } = require('../models');
    for (const alert of alerts) {
      await WeatherAlert.upsert({
        providerAlertId: `${source}:${alert.id}`.slice(0, 255),
        location: alert.location || `${point.latitude},${point.longitude}`,
        alertType: alert.category,
        severity: alert.severity,
        description: alert.description,
        startTime: alert.startsAt,
        endTime: alert.endsAt,
        source,
        lastUpdatedAt: alert.updatedAt,
      });
    }
    return { source, updatedAt, alerts };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') throw new HttpError(504, 'Official weather alerts timed out. Please retry.');
    throw new HttpError(502, 'Official weather alerts are temporarily unavailable.');
  }
}

async function weatherHistory({ location, before, limit = 30 }) {
  const { WeatherObservation } = require('../models');
  const where = { locationHash: locationHash(location) };
  if (before) where.observedAt = { [Op.lt]: new Date(before) };
  return WeatherObservation.findAll({
    where,
    order: [['observedAt', 'DESC']],
    limit,
    attributes: ['id', 'locationName', 'observedAt', 'provider', 'data'],
  });
}

async function cleanExpiredCache() {
  return weatherCache.cleanExpired();
}

module.exports = {
  coordinates,
  locationFromRequest,
  fetchForecast: async (location, days = 7) => (await fetchForecastResult(location, days)).data,
  fetchForecastResult,
  validateForecastResponse,
  recordWeatherData,
  currentConditions,
  dailyForecast,
  hourlyForecast,
  farmingAdvisories,
  searchLocations,
  fetchOfficialAlerts,
  weatherHistory,
  cleanExpiredCache,
};
