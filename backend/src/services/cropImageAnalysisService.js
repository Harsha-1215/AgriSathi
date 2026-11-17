const HttpError = require('../utils/httpError');
const geminiService = require('./geminiService');
const huggingFaceService = require('./huggingFaceCropService');

function configuredProvider() {
  const provider = (process.env.CROP_DOCTOR_PROVIDER || 'gemini').toLowerCase();
  if (provider === 'gemini') return { name: provider, service: geminiService };
  if (provider === 'huggingface') return { name: provider, service: huggingFaceService };
  throw new HttpError(503, 'The configured crop image analysis provider is not supported.');
}

function assertConfigured() {
  const { name, service } = configuredProvider();
  if (name === 'huggingface') service.configuration();
  else service.getApiKey();
}

async function analyzeCropImage(options) {
  const { service } = configuredProvider();
  return service.analyzeCropImage(options);
}

module.exports = { assertConfigured, analyzeCropImage };
