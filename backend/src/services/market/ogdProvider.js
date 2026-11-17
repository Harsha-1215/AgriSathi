const axios = require('axios');
const HttpError = require('../../utils/httpError');

const BASE_URL = 'https://api.data.gov.in/resource';

async function fetchRecords({ resourceId, offset = 0, limit = 100 }) {
  const apiKey = process.env.MARKET_DATA_API_KEY;
  if (!apiKey) throw new HttpError(503, 'Market prices are unavailable because the official data API key is not configured.');
  if (typeof resourceId !== 'string' || !/^[a-f0-9-]{20,80}$/i.test(resourceId)) {
    throw new HttpError(503, 'Configure a valid official market-data resource ID before synchronizing prices.');
  }
  try {
    const response = await axios.get(`${BASE_URL}/${encodeURIComponent(resourceId)}`, {
      params: { 'api-key': apiKey, format: 'json', limit, offset },
      timeout: 15000,
    });
    if (!response.data || !Array.isArray(response.data.records)) {
      throw new HttpError(502, 'The official market-data provider returned an unsupported response.');
    }
    return {
      records: response.data.records,
      total: Number.isInteger(response.data.total) ? response.data.total : null,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new HttpError(504, 'The official market-data provider timed out. Please retry later.');
    }
    throw new HttpError(502, 'The official market-data provider is temporarily unavailable.');
  }
}

module.exports = { name: 'data-gov-in', fetchRecords };
