const { Op } = require('sequelize');

function getModel() {
  return require('../models').WeatherCacheMetadata;
}

function cacheTtlMs(dataType) {
  const variable = dataType === 'current' ? 'WEATHER_CURRENT_CACHE_TTL_SECONDS' : 'WEATHER_FORECAST_CACHE_TTL_SECONDS';
  const configured = Number(process.env[variable]);
  const defaultSeconds = dataType === 'current' ? 600 : 1800;
  const seconds = Number.isInteger(configured) && configured >= 60 && configured <= 86400
    ? configured
    : defaultSeconds;
  return seconds * 1000;
}

async function read(cacheKey) {
  const WeatherCacheMetadata = getModel();
  const row = await WeatherCacheMetadata.findOne({ where: { cacheKey } });
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    await row.destroy();
    return null;
  }
  return {
    payload: row.payload,
    providerUpdatedAt: row.providerUpdatedAt,
    fetchedAt: row.fetchedAt,
  };
}

async function write({ cacheKey, provider, dataType, payload, providerUpdatedAt }) {
  const WeatherCacheMetadata = getModel();
  const fetchedAt = new Date();
  await WeatherCacheMetadata.upsert({
    cacheKey,
    provider,
    dataType,
    payload,
    providerUpdatedAt: providerUpdatedAt ? new Date(providerUpdatedAt) : null,
    fetchedAt,
    expiresAt: new Date(fetchedAt.getTime() + cacheTtlMs(dataType)),
  });
  return fetchedAt;
}

async function cleanExpired() {
  const WeatherCacheMetadata = getModel();
  return WeatherCacheMetadata.destroy({ where: { expiresAt: { [Op.lte]: new Date() } } });
}

module.exports = { cacheTtlMs, read, write, cleanExpired };
