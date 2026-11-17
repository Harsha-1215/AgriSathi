const HttpError = require('../utils/httpError');
const openMeteoProvider = require('./weatherProviders/openMeteoProvider');

const providers = new Map([[openMeteoProvider.name, openMeteoProvider]]);

function getWeatherProvider() {
  const name = (process.env.WEATHER_PROVIDER || 'open-meteo').trim().toLowerCase();
  const provider = providers.get(name);
  if (!provider) throw new HttpError(503, `The configured weather provider "${name}" is not supported.`);
  return provider;
}

module.exports = { getWeatherProvider };
