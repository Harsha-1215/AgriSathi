const axios = require('axios');
const HttpError = require('../utils/httpError');

function configuration() {
  const token = process.env.HUGGINGFACE_API_TOKEN;
  const model = process.env.HUGGINGFACE_CROP_MODEL || 'surgeonwz/plant-village';
  if (!token) throw new HttpError(503, 'Hosted crop image analysis is not configured on this server.');
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(model)) {
    throw new HttpError(503, 'The configured crop image model identifier is invalid.');
  }
  return { token, model };
}

function normalize(value) {
  return String(value || '').toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
}

function safeList(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim()).slice(0, 6).map((item) => item.trim().slice(0, 250))
    : [];
}

function buildAnalysis({ labels, cropName, verifiedDiseaseKnowledge, model }) {
  const topLabel = labels[0].label.trim();
  const parts = topLabel.split('___');
  const labelCrop = parts.length > 1 ? parts[0].trim() : '';
  const conditionLabel = parts.length > 1 ? parts.slice(1).join('___').replace(/_/g, ' ').trim() : '';
  const matchingCrop = normalize(labelCrop) === normalize(cropName);
  const isHealthy = matchingCrop && normalize(conditionLabel) === 'healthy';
  const matchedKnowledge = matchingCrop && conditionLabel
    ? verifiedDiseaseKnowledge.find((item) => normalize(item.name) === normalize(conditionLabel))
    : null;

  if (isHealthy) {
    return {
      analysisStatus: 'healthy_looking',
      processingStatus: 'inconclusive',
      possibleDisease: null,
      possibleConditions: [],
      observedSymptoms: [],
      limitations: [
        'This hosted image classifier is not validated for field diagnosis or all crop varieties.',
        'A healthy class result does not prove that the plant is disease-free.',
      ],
      severity: null,
      aiExplanation: 'The image model returned a healthy class for the selected crop. This is only a preliminary image-model output and does not establish that the plant is disease-free.',
      recommendations: ['Inspect the plant and consult a qualified agricultural expert if symptoms continue.'],
      provider: 'huggingface',
      modelVersion: model,
    };
  }

  if (matchedKnowledge) {
    return {
      analysisStatus: 'possible_issue',
      processingStatus: 'inconclusive',
      possibleDisease: matchedKnowledge.name,
      possibleConditions: [{ name: matchedKnowledge.name, description: matchedKnowledge.description || '' }],
      observedSymptoms: [],
      limitations: [
        'This hosted image classifier is not validated for field diagnosis or all crop varieties.',
        'The model label is only a possible comparison with published crop guidance, not a confirmed diagnosis.',
      ],
      severity: null,
      aiExplanation: `The image model returned a label that exactly matches the crop and a published disease reference. This is only a possible comparison, not a confirmed diagnosis. Source: ${matchedKnowledge.source || 'not recorded'}.`,
      recommendations: safeList(matchedKnowledge.prevention).concat(
        'Consult a qualified agricultural expert before treatment or other high-risk action.',
      ).slice(0, 7),
      provider: 'huggingface',
      modelVersion: model,
    };
  }

  return {
    analysisStatus: 'no_reliable_match',
    processingStatus: 'inconclusive',
    possibleDisease: null,
    possibleConditions: [],
    observedSymptoms: [],
    limitations: [
      'This hosted image classifier is not validated for field diagnosis or all crop varieties.',
      'No disease guidance is shown unless the model label exactly matches a published reference for the selected crop.',
    ],
    severity: null,
    aiExplanation: 'The image model did not produce a label that could be safely matched to published guidance for this crop. No disease has been identified.',
    recommendations: ['Take a clear photo in natural light and ask a qualified agricultural expert to inspect the crop.'],
    provider: 'huggingface',
    modelVersion: model,
  };
}

async function analyzeCropImage({ imageBuffer, mimeType, cropName, verifiedDiseaseKnowledge = [] }) {
  const { token, model } = configuration();
  const encodedModel = model.split('/').map(encodeURIComponent).join('/');
  try {
    const response = await axios.post(
      `https://router.huggingface.co/hf-inference/models/${encodedModel}`,
      imageBuffer,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': mimeType,
          Accept: 'application/json',
        },
        timeout: 45000,
        maxBodyLength: 8 * 1024 * 1024,
      },
    );
    if (!Array.isArray(response.data) || response.data.length === 0) {
      throw new HttpError(502, 'The hosted crop model returned an unsupported response.');
    }
    const labels = response.data.filter((item) => item
      && typeof item.label === 'string'
      && Number.isFinite(item.score)
      && item.score >= 0
      && item.score <= 1);
    if (!labels.length) throw new HttpError(502, 'The hosted crop model returned no usable labels.');
    return buildAnalysis({ labels, cropName, verifiedDiseaseKnowledge, model });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error.code === 'ECONNABORTED') throw new HttpError(504, 'Hosted image analysis timed out. Please retry with a clear image.');
    if (error.response?.status === 429 || error.response?.status === 503) {
      throw new HttpError(503, 'The hosted model is temporarily unavailable or over quota. Please retry later.');
    }
    if (error.response) throw new HttpError(502, 'The hosted crop model could not analyze this image.');
    throw new HttpError(502, 'The hosted crop model is temporarily unavailable.');
  }
}

module.exports = { analyzeCropImage, configuration, buildAnalysis };
