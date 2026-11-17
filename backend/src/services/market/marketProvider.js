const HttpError = require('../../utils/httpError');
const ogdProvider = require('./ogdProvider');

const providers = new Map([[ogdProvider.name, ogdProvider]]);

function getMarketProvider(source) {
  const provider = source && providers.get(String(source.provider || '').toLowerCase());
  if (!provider) throw new HttpError(503, 'The configured market-data provider is not supported.');
  return provider;
}

module.exports = { getMarketProvider };
