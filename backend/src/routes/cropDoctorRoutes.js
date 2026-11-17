const express = require('express');
const axios = require('axios');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { requireAuth, requireFarmer, checkAccountStatus } = require('../middleware/auth');
const { imageUpload } = require('../middleware/upload');
const {
  Crop,
  CropDiagnosis,
  CropDiagnosisFeedback,
  CropDisease,
  CropDiseaseRecommendation,
  CropDiseaseSymptom,
  CropKnowledge,
} = require('../models');
const { assertConfigured, analyzeCropImage } = require('../services/cropImageAnalysisService');
const { uploadPrivateImage, getPrivateImageUrl, deletePrivateImage } = require('../services/cloudinaryService');
const { detectImageMime } = require('../utils/fileValidation');
const assertUuid = require('../utils/assertUuid');

const router = express.Router();
const languageCodes = ['en', 'te', 'hi'];
const diagnosisLimiter = require('express-rate-limit')({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

router.use(requireAuth, requireFarmer, checkAccountStatus);

function isValidDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

async function serializeDiagnosis(diagnosis) {
  const record = diagnosis.toJSON();
  record.imageUrl = getPrivateImageUrl(diagnosis.imagePublicId, diagnosis.imageFormat);
  record.disclaimer = 'This AI-generated information is preliminary and is not a confirmed diagnosis. Consult a qualified agricultural expert before taking high-risk action.';
  if (record.externalProcessingConsent) {
    record.externalProcessingNotice = 'The image was sent to the configured external AI provider and stored privately for your report after your consent.';
  }
  delete record.imagePublicId;
  return record;
}

router.get('/crops', asyncHandler(async (req, res) => {
  const items = await Crop.findAll({
    where: { isActive: true },
    attributes: ['id', 'name', 'translations', 'imageUrl'],
    order: [['name', 'ASC']],
  });
  return res.json({ success: true, data: items });
}));

router.get('/diseases', asyncHandler(async (req, res) => {
  const page = Math.max(1, Math.min(1000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 30));
  const where = { isPublished: true };
  const crop = typeof req.query.crop === 'string' ? req.query.crop.trim().slice(0, 120) : '';
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 120) : '';
  if (crop) where.cropName = { [Op.iLike]: crop };
  if (search) where[Op.or] = [
    { name: { [Op.iLike]: `%${search}%` } },
    { cropName: { [Op.iLike]: `%${search}%` } },
  ];
  const result = await CropDisease.findAndCountAll({
    where,
    include: [
      { model: CropDiseaseSymptom, attributes: ['description', 'language'], required: false },
      {
        model: CropDiseaseRecommendation,
        attributes: ['category', 'description', 'source', 'language'],
        where: { isPublished: true },
        required: false,
      },
    ],
    order: [['cropName', 'ASC'], ['name', 'ASC']],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });
  return res.json({ success: true, data: { items: result.rows, page, limit, total: result.count } });
}));

router.get('/diseases/:id', asyncHandler(async (req, res) => {
  const disease = await CropDisease.findOne({
    where: { id: assertUuid(req.params.id), isPublished: true },
    include: [
      { model: CropDiseaseSymptom, attributes: ['description', 'language'], required: false },
      {
        model: CropDiseaseRecommendation,
        attributes: ['category', 'description', 'source', 'language'],
        where: { isPublished: true },
        required: false,
      },
    ],
  });
  if (!disease) throw new HttpError(404, 'Verified disease guidance was not found.');
  return res.json({ success: true, data: disease });
}));

router.post('/analyze', diagnosisLimiter, imageUpload, asyncHandler(async (req, res) => {
  const cropId = typeof req.body.cropId === 'string' ? req.body.cropId.trim() : '';
  const requestedCropName = typeof req.body.cropName === 'string' ? req.body.cropName.trim() : '';
  const language = req.body.language || 'en';
  if ((!cropId && !requestedCropName) || requestedCropName.length > 120) throw new HttpError(400, 'Select a crop from the crop catalog.');
  if (!languageCodes.includes(language)) throw new HttpError(400, 'Choose English, Telugu, or Hindi.');
  if (req.body.externalProcessingConsent !== true && req.body.externalProcessingConsent !== 'true') {
    throw new HttpError(400, 'Consent is required before sending the crop image to the configured external AI provider.');
  }
  const symptoms = typeof req.body.symptoms === 'string' ? req.body.symptoms.trim() : '';
  if (symptoms.length > 1500) throw new HttpError(400, 'Reported symptoms are limited to 1500 characters.');
  if (!req.file) throw new HttpError(400, 'Capture or upload a crop image to continue.');

  const selectedCrop = cropId
    ? await Crop.findOne({ where: { id: cropId, isActive: true } })
    : await Crop.findOne({ where: { name: { [Op.iLike]: requestedCropName }, isActive: true } });
  if (!selectedCrop) throw new HttpError(400, 'Choose an active crop from the crop catalog.');
  const cropName = selectedCrop.name;
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const mimeType = detectImageMime(req.file.buffer);
  if (!mimeType || !allowedTypes.includes(mimeType)) {
    throw new HttpError(415, 'Use a JPEG, PNG, or WebP image file.');
  }
  assertConfigured();

  const [publishedDiseases, publishedKnowledge] = await Promise.all([
    CropDisease.findAll({
      where: { cropName: { [Op.iLike]: cropName }, isPublished: true },
      attributes: ['name', 'description', 'symptoms', 'prevention', 'managementMethods', 'source', 'lastVerifiedAt'],
      limit: 8,
      order: [['lastVerifiedAt', 'DESC']],
    }),
    CropKnowledge.findAll({
      where: { cropId: selectedCrop.id, sectionType: 'disease', language, isPublished: true },
      attributes: ['title', 'content', 'source', 'verifiedAt'],
      limit: 8,
      order: [['verifiedAt', 'DESC']],
    }),
  ]);
  const verifiedDiseaseKnowledge = [
    ...publishedDiseases.map((disease) => ({
      cropName,
      name: disease.name,
      description: disease.description,
      symptoms: disease.symptoms,
      prevention: disease.prevention,
      managementMethods: disease.managementMethods,
      source: disease.source,
      lastVerifiedAt: disease.lastVerifiedAt,
    })),
    ...publishedKnowledge.map((item) => ({
      cropName,
      name: item.title,
      description: JSON.stringify(item.content).slice(0, 3000),
      source: item.source,
      lastVerifiedAt: item.verifiedAt,
    })),
  ];
  const storedImage = await uploadPrivateImage(req.file.buffer);
  let diagnosis;
  try {
    const analysis = await analyzeCropImage({
      imageBuffer: req.file.buffer,
      mimeType,
      cropName,
      language,
      symptoms,
      verifiedDiseaseKnowledge,
    });
    diagnosis = await CropDiagnosis.create({
      userId: req.user.id,
      cropId: selectedCrop.id,
      cropName,
      imageUrl: storedImage.secureUrl,
      imagePublicId: storedImage.publicId,
      imageFormat: storedImage.format,
      externalProcessingConsent: true,
      externalProcessingConsentAt: new Date(),
      ...analysis,
    });
  } catch (error) {
    try {
      await deletePrivateImage(storedImage.publicId);
    } catch (cleanupError) {
      console.error('Could not remove an unrecorded crop image:', cleanupError.message);
    }
    throw error;
  }
  return res.status(201).json({ success: true, data: await serializeDiagnosis(diagnosis) });
}));

router.get('/history', asyncHandler(async (req, res) => {
  const page = Math.max(1, Math.min(1000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 20));
  const where = { userId: req.user.id };
  if (typeof req.query.status === 'string') {
    const allowedStatuses = ['possible_issue', 'image_unclear', 'no_reliable_match', 'healthy_looking', 'analysis_unavailable'];
    if (!allowedStatuses.includes(req.query.status)) throw new HttpError(400, 'Choose a valid diagnosis status.');
    where.analysisStatus = req.query.status;
  }
  if (typeof req.query.cropId === 'string' && req.query.cropId.trim()) {
    where.cropId = req.query.cropId.trim().slice(0, 80);
  }
  if (typeof req.query.crop === 'string' && req.query.crop.trim()) {
    where.cropName = { [Op.iLike]: `%${req.query.crop.trim().slice(0, 120)}%` };
  }
  if (req.query.from || req.query.to) {
    const range = {};
    if (req.query.from) {
      if (!isValidDate(req.query.from)) throw new HttpError(400, 'Enter a valid start date.');
      range[Op.gte] = new Date(req.query.from);
    }
    if (req.query.to) {
      if (!isValidDate(req.query.to)) throw new HttpError(400, 'Enter a valid end date.');
      range[Op.lte] = new Date(req.query.to);
    }
    if (range[Op.gte] && range[Op.lte] && range[Op.gte] > range[Op.lte]) {
      throw new HttpError(400, 'The start date must be before the end date.');
    }
    where.createdAt = range;
  }
  const result = await CropDiagnosis.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });
  const items = await Promise.all(result.rows.map(serializeDiagnosis));
  return res.json({ success: true, data: { items, total: result.count, page, limit } });
}));

router.get('/history/:id', asyncHandler(async (req, res) => {
  const diagnosis = await CropDiagnosis.findOne({ where: { id: assertUuid(req.params.id), userId: req.user.id } });
  if (!diagnosis) throw new HttpError(404, 'Diagnosis report not found.');
  return res.json({ success: true, data: await serializeDiagnosis(diagnosis) });
}));

router.get('/history/:id/status', asyncHandler(async (req, res) => {
  const diagnosis = await CropDiagnosis.findOne({
    where: { id: assertUuid(req.params.id), userId: req.user.id },
    attributes: ['id', 'processingStatus', 'analysisStatus', 'createdAt', 'updatedAt'],
  });
  if (!diagnosis) throw new HttpError(404, 'Diagnosis report not found.');
  return res.json({ success: true, data: diagnosis });
}));

router.post('/history/:id/feedback', asyncHandler(async (req, res) => {
  const diagnosisId = assertUuid(req.params.id);
  const category = req.body.category;
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : null;
  const allowedCategories = ['incorrect_analysis', 'incorrect_crop', 'missing_symptoms', 'unclear_recommendations', 'helpful'];
  if (!allowedCategories.includes(category)) throw new HttpError(400, 'Choose a valid feedback category.');
  if (comment && comment.length > 1500) throw new HttpError(400, 'Feedback comments are limited to 1500 characters.');
  const diagnosis = await CropDiagnosis.findOne({ where: { id: diagnosisId, userId: req.user.id }, attributes: ['id'] });
  if (!diagnosis) throw new HttpError(404, 'Diagnosis report not found.');
  const [feedback] = await CropDiagnosisFeedback.upsert({
    diagnosisId,
    userId: req.user.id,
    category,
    comment: comment || null,
  }, { returning: true });
  return res.json({ success: true, data: feedback });
}));

router.delete('/history/:id', asyncHandler(async (req, res) => {
  const diagnosis = await CropDiagnosis.findOne({ where: { id: assertUuid(req.params.id), userId: req.user.id } });
  if (!diagnosis) throw new HttpError(404, 'Diagnosis report not found.');
  await deletePrivateImage(diagnosis.imagePublicId);
  await diagnosis.destroy();
  return res.json({ success: true, message: 'Diagnosis report deleted.' });
}));

router.post('/consultation', asyncHandler(async (req, res) => {
  const endpoint = process.env.EXPERT_CONSULTATION_API_URL;
  const serviceToken = process.env.EXPERT_CONSULTATION_API_TOKEN;
  if (!endpoint || !serviceToken) throw new HttpError(503, 'Expert consultation is not connected on this server yet.');
  const diagnosisId = typeof req.body.diagnosisId === 'string' ? req.body.diagnosisId : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
  if (!diagnosisId) throw new HttpError(400, 'A diagnosis report is required for consultation.');
  if (description.length > 2000) throw new HttpError(400, 'The consultation description is limited to 2000 characters.');

  const diagnosis = await CropDiagnosis.findOne({ where: { id: assertUuid(diagnosisId), userId: req.user.id } });
  if (!diagnosis) throw new HttpError(404, 'Diagnosis report not found.');
  const payload = {
    cropName: diagnosis.cropName,
    possibleDisease: diagnosis.possibleDisease,
    diagnosisId: diagnosis.id,
    description,
  };
  if (req.body.includeImage === true && process.env.CONSULTATION_ALLOW_IMAGE === 'true') {
    payload.imageUrl = getPrivateImageUrl(diagnosis.imagePublicId, diagnosis.imageFormat);
  }

  try {
    const response = await axios.post(endpoint, payload, {
      headers: { Authorization: `Bearer ${serviceToken}` },
      timeout: 15000,
    });
    return res.status(201).json({ success: true, data: response.data });
  } catch (error) {
    if (error.code === 'ECONNABORTED') throw new HttpError(504, 'Expert consultation could not be reached. Please retry.');
    throw new HttpError(502, 'Expert consultation is temporarily unavailable.');
  }
}));

module.exports = router;
