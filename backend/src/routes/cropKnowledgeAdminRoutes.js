const express = require('express');
const multer = require('multer');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { requireAuth } = require('../middleware/auth');
const {
  Crop,
  CropCategory,
  CropKnowledge,
  CropKnowledgeRevision,
  CropGrowthStage,
  CropCalendar,
  AgriculturalRecommendation,
  CropPest,
  CropDisease,
  CropDiseaseSymptom,
  CropDiseaseRecommendation,
} = require('../models');
const { uploadPublicImage } = require('../services/cloudinaryService');
const assertUuid = require('../utils/assertUuid');

const router = express.Router();
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } }).single('image');
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const languageValues = ['en', 'te', 'hi'];
const sectionValues = ['overview', 'climate', 'soil', 'land-preparation', 'seed-selection', 'sowing', 'irrigation', 'fertilizer', 'weed', 'pest', 'disease', 'harvesting', 'storage', 'marketing', 'faq'];

router.use(requireAuth, (req, res, next) => {
  if (!['admin', 'agricultural_content_manager'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Agricultural content administration access is required.' });
  }
  return next();
});

function text(value, field, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, `${field} is required and must be no more than ${max} characters.`);
  }
  return value.trim();
}

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, `${field} must be an object.`);
  return value;
}

function language(value) {
  if (!languageValues.includes(value)) throw new HttpError(400, 'Choose English, Telugu, or Hindi.');
  return value;
}

function translations(value) {
  const result = object(value, 'Translations');
  for (const [key, label] of Object.entries(result)) {
    if (!languageValues.includes(key) || typeof label !== 'string' || label.trim().length > 160) {
      throw new HttpError(400, 'Translations must contain en, te, or hi text values of up to 160 characters.');
    }
  }
  return result;
}

function stringList(value, field, max = 40) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max
    || value.some((item) => typeof item !== 'string' || !item.trim() || item.trim().length > 500)) {
    throw new HttpError(400, `${field} must be a list of up to ${max} non-empty text values.`);
  }
  return value.map((item) => item.trim());
}

function sectionValue(value) {
  if (!sectionValues.includes(value)) throw new HttpError(400, 'Choose a supported crop knowledge section.');
  return value;
}

function publishedFields(body, userId) {
  if (body.isPublished !== undefined && typeof body.isPublished !== 'boolean') {
    throw new HttpError(400, 'isPublished must be true or false.');
  }
  const isPublished = body.isPublished === true;
  const source = body.source ? text(body.source, 'Source', 1000) : null;
  if (isPublished && !source) throw new HttpError(400, 'A source is required before publishing verified content.');
  return {
    source,
    isPublished,
    verifiedBy: isPublished ? userId : null,
    verifiedAt: isPublished ? new Date() : null,
  };
}

function knowledgePublicationUpdates(body, userId, row) {
  const updates = {};
  if (body.source !== undefined || body.isPublished !== undefined) {
    if (body.isPublished !== undefined && typeof body.isPublished !== 'boolean') {
      throw new HttpError(400, 'isPublished must be true or false.');
    }
    const isPublished = body.isPublished === undefined ? row.isPublished : body.isPublished === true;
    const source = body.source === undefined ? row.source : (body.source ? text(body.source, 'Source', 1000) : null);
    if (isPublished && !source) throw new HttpError(400, 'A source is required before publishing verified content.');
    updates.source = source;
    updates.isPublished = isPublished;
    updates.verifiedBy = isPublished ? userId : null;
    updates.verifiedAt = isPublished ? new Date() : null;
  }
  return updates;
}

function validateImageSignature(file) {
  if (!file) throw new HttpError(400, 'Select an image to upload.');
  const buffer = file.buffer;
  const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp = buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!isJpeg && !isPng && !isWebp) throw new HttpError(400, 'Upload a valid JPEG, PNG, or WebP image.');
}

function uploadHandler(req, res, next) {
  imageUpload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'Image must be 8 MB or smaller.'));
    if (error instanceof multer.MulterError) return next(new HttpError(400, 'Upload one image at a time.'));
    return next(error);
  });
}

router.get('/crops', asyncHandler(async (req, res) => {
  const crops = await Crop.findAll({ include: [{ model: CropCategory, attributes: ['id', 'name'] }], order: [['name', 'ASC']] });
  return res.json({ success: true, data: crops });
}));

router.get('/categories', asyncHandler(async (req, res) => {
  const categories = await CropCategory.findAll({ order: [['name', 'ASC']] });
  return res.json({ success: true, data: categories });
}));

router.get('/pending', asyncHandler(async (req, res) => {
  const [crops, knowledge, pests, diseases] = await Promise.all([
    Crop.findAll({ where: { isPublished: false }, order: [['updatedAt', 'DESC']], limit: 50 }),
    CropKnowledge.findAll({ where: { isPublished: false }, include: [{ model: Crop, attributes: ['id', 'name'] }], order: [['updatedAt', 'DESC']], limit: 50 }),
    CropPest.findAll({ where: { isPublished: false }, include: [{ model: Crop, attributes: ['id', 'name'] }], order: [['updatedAt', 'DESC']], limit: 50 }),
    CropDisease.findAll({ where: { isPublished: false }, order: [['updatedAt', 'DESC']], limit: 50 }),
  ]);
  return res.json({ success: true, data: { crops, knowledge, pests, diseases } });
}));

router.post('/categories', asyncHandler(async (req, res) => {
  const id = text(req.body.id, 'Category ID', 60).toLowerCase();
  if (!slugPattern.test(id)) throw new HttpError(400, 'Category ID must be a lowercase URL-safe slug.');
  const category = await CropCategory.create({
    id,
    name: text(req.body.name, 'Category name', 100),
    translations: req.body.translations === undefined ? {} : translations(req.body.translations),
    description: req.body.description === undefined ? {} : object(req.body.description, 'Description'),
  });
  return res.status(201).json({ success: true, data: category });
}));

router.put('/categories/:categoryId', asyncHandler(async (req, res) => {
  const category = await CropCategory.findByPk(req.params.categoryId);
  if (!category) throw new HttpError(404, 'Crop category not found.');
  const updates = {};
  if (req.body.name !== undefined) updates.name = text(req.body.name, 'Category name', 100);
  if (req.body.translations !== undefined) updates.translations = translations(req.body.translations);
  if (req.body.description !== undefined) updates.description = object(req.body.description, 'Description');
  await category.update(updates);
  return res.json({ success: true, data: category });
}));

router.post('/crops', asyncHandler(async (req, res) => {
  const id = text(req.body.id, 'Crop ID', 80).toLowerCase();
  if (!slugPattern.test(id)) throw new HttpError(400, 'Crop ID must be a lowercase URL-safe slug.');
  const categoryId = text(req.body.categoryId, 'Category', 60);
  const category = await CropCategory.findByPk(categoryId);
  if (!category) throw new HttpError(400, 'Choose an existing crop category.');
  const translatedNames = req.body.translations === undefined ? {} : translations(req.body.translations);
  const publication = publishedFields(req.body, req.user.id);
  if (req.body.isFeatured !== undefined && typeof req.body.isFeatured !== 'boolean') throw new HttpError(400, 'isFeatured must be true or false.');
  if (req.body.isActive !== undefined && typeof req.body.isActive !== 'boolean') throw new HttpError(400, 'isActive must be true or false.');
  const crop = await Crop.create({
    id,
    name: text(req.body.name, 'Crop name', 120),
    categoryId,
    translations: translatedNames,
    description: req.body.description === undefined ? {} : object(req.body.description, 'Description'),
    growingSeasons: stringList(req.body.growingSeasons, 'Growing seasons'),
    scientificName: req.body.scientificName ? text(req.body.scientificName, 'Scientific name', 180) : null,
    isActive: req.body.isActive !== false,
    isFeatured: req.body.isFeatured === true,
    ...publication,
  });
  return res.status(201).json({ success: true, data: crop });
}));

router.put('/crops/:cropId', asyncHandler(async (req, res) => {
  const crop = await Crop.findByPk(req.params.cropId);
  if (!crop) throw new HttpError(404, 'Crop not found.');
  const updates = {};
  if (req.body.name !== undefined) updates.name = text(req.body.name, 'Crop name', 120);
  if (req.body.categoryId !== undefined) {
    const categoryId = text(req.body.categoryId, 'Category', 60);
    if (!await CropCategory.findByPk(categoryId)) throw new HttpError(400, 'Choose an existing crop category.');
    updates.categoryId = categoryId;
  }
  if (req.body.translations !== undefined) updates.translations = translations(req.body.translations);
  if (req.body.description !== undefined) updates.description = object(req.body.description, 'Description');
  if (req.body.growingSeasons !== undefined) {
    updates.growingSeasons = stringList(req.body.growingSeasons, 'Growing seasons');
  }
  if (req.body.scientificName !== undefined) updates.scientificName = req.body.scientificName ? text(req.body.scientificName, 'Scientific name', 180) : null;
  if (req.body.isActive !== undefined) {
    if (typeof req.body.isActive !== 'boolean') throw new HttpError(400, 'isActive must be true or false.');
    updates.isActive = req.body.isActive;
  }
  if (req.body.isFeatured !== undefined) {
    if (typeof req.body.isFeatured !== 'boolean') throw new HttpError(400, 'isFeatured must be true or false.');
    updates.isFeatured = req.body.isFeatured;
  }
  Object.assign(updates, knowledgePublicationUpdates(req.body, req.user.id, crop));
  await crop.update(updates);
  return res.json({ success: true, data: crop });
}));

router.delete('/crops/:cropId', asyncHandler(async (req, res) => {
  const crop = await Crop.findByPk(req.params.cropId);
  if (!crop) throw new HttpError(404, 'Crop not found.');
  await crop.update({ isActive: false, isFeatured: false });
  return res.json({ success: true, message: 'Crop archived.' });
}));

async function publishCrop(req, res) {
  const crop = await Crop.findByPk(req.params.cropId);
  if (!crop) throw new HttpError(404, 'Crop not found.');
  const source = text(req.body.source || crop.source, 'Source', 1000);
  await crop.update({
    isPublished: true,
    source,
    verifiedBy: req.user.id,
    verifiedAt: new Date(),
    isActive: true,
  });
  return res.json({ success: true, data: crop });
}

router.post('/crops/:cropId/publish', asyncHandler(publishCrop));
router.post('/crops/:cropId/approve', asyncHandler(publishCrop));

router.get('/pests', asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status === 'published') where.isPublished = true;
  else if (req.query.status === 'draft') where.isPublished = false;
  if (req.query.cropId) where.cropId = String(req.query.cropId).slice(0, 80);
  const pests = await CropPest.findAll({
    where,
    include: [{ model: Crop, attributes: ['id', 'name'] }],
    order: [['updatedAt', 'DESC']],
    limit: 100,
  });
  return res.json({ success: true, data: pests });
}));

router.post('/pests', asyncHandler(async (req, res) => {
  const cropId = text(req.body.cropId, 'Crop', 80);
  if (!await Crop.findByPk(cropId)) throw new HttpError(400, 'Choose an existing crop.');
  const publication = publishedFields(req.body, req.user.id);
  const pest = await CropPest.create({
    cropId,
    name: text(req.body.name, 'Pest name', 180),
    scientificName: req.body.scientificName ? text(req.body.scientificName, 'Scientific name', 180) : null,
    language: language(req.body.language),
    description: req.body.description ? text(req.body.description, 'Description', 4000) : null,
    symptoms: stringList(req.body.symptoms, 'Symptoms'),
    prevention: stringList(req.body.prevention, 'Prevention'),
    management: stringList(req.body.management, 'Management guidance'),
    ...publication,
  });
  return res.status(201).json({ success: true, data: pest });
}));

router.put('/pests/:id', asyncHandler(async (req, res) => {
  const pest = await CropPest.findByPk(assertUuid(req.params.id));
  if (!pest) throw new HttpError(404, 'Crop pest information not found.');
  const updates = knowledgePublicationUpdates(req.body, req.user.id, pest);
  if (req.body.cropId !== undefined) {
    const cropId = text(req.body.cropId, 'Crop', 80);
    if (!await Crop.findByPk(cropId)) throw new HttpError(400, 'Choose an existing crop.');
    updates.cropId = cropId;
  }
  if (req.body.name !== undefined) updates.name = text(req.body.name, 'Pest name', 180);
  if (req.body.scientificName !== undefined) updates.scientificName = req.body.scientificName ? text(req.body.scientificName, 'Scientific name', 180) : null;
  if (req.body.language !== undefined) updates.language = language(req.body.language);
  if (req.body.description !== undefined) updates.description = req.body.description ? text(req.body.description, 'Description', 4000) : null;
  for (const field of ['symptoms', 'prevention', 'management']) {
    if (req.body[field] !== undefined) updates[field] = stringList(req.body[field], field);
  }
  await pest.update(updates);
  return res.json({ success: true, data: pest });
}));

router.post('/pests/:id/publish', asyncHandler(async (req, res) => {
  const pest = await CropPest.findByPk(assertUuid(req.params.id));
  if (!pest) throw new HttpError(404, 'Crop pest information not found.');
  const source = text(req.body.source || pest.source, 'Source', 1000);
  await pest.update({ isPublished: true, source, verifiedBy: req.user.id, verifiedAt: new Date() });
  return res.json({ success: true, data: pest });
}));

router.post('/diseases', asyncHandler(async (req, res) => {
  const disease = await CropDisease.create({
    name: text(req.body.name, 'Disease name', 180),
    cropName: text(req.body.cropName, 'Crop name', 120),
    scientificName: req.body.scientificName ? text(req.body.scientificName, 'Scientific name', 180) : null,
    description: req.body.description ? text(req.body.description, 'Description', 4000) : null,
    causes: stringList(req.body.causes, 'Causes'),
    symptoms: stringList(req.body.symptoms, 'Symptoms'),
    environmentalConditions: stringList(req.body.environmentalConditions, 'Environmental conditions'),
    prevention: stringList(req.body.prevention, 'Prevention'),
    managementMethods: stringList(req.body.managementMethods, 'Management guidance'),
    verifiedTreatmentGuidance: req.body.verifiedTreatmentGuidance
      ? text(req.body.verifiedTreatmentGuidance, 'Verified treatment guidance', 4000)
      : null,
    source: req.body.source ? text(req.body.source, 'Source', 1000) : null,
    isPublished: false,
  });
  return res.status(201).json({ success: true, data: disease });
}));

router.put('/diseases/:id', asyncHandler(async (req, res) => {
  const disease = await CropDisease.findByPk(assertUuid(req.params.id));
  if (!disease) throw new HttpError(404, 'Crop disease information not found.');
  const updates = {};
  for (const [field, label, max] of [
    ['name', 'Disease name', 180],
    ['cropName', 'Crop name', 120],
    ['scientificName', 'Scientific name', 180],
    ['description', 'Description', 4000],
    ['verifiedTreatmentGuidance', 'Verified treatment guidance', 4000],
    ['source', 'Source', 1000],
  ]) {
    if (req.body[field] !== undefined) updates[field] = req.body[field] ? text(req.body[field], label, max) : null;
  }
  for (const field of ['causes', 'symptoms', 'environmentalConditions', 'prevention', 'managementMethods']) {
    if (req.body[field] !== undefined) updates[field] = stringList(req.body[field], field);
  }
  if (req.body.isPublished !== undefined) {
    if (typeof req.body.isPublished !== 'boolean') throw new HttpError(400, 'isPublished must be true or false.');
  }
  const isPublished = req.body.isPublished === undefined ? disease.isPublished : req.body.isPublished;
  const source = req.body.source === undefined ? disease.source : updates.source;
  if (isPublished && !source) throw new HttpError(400, 'A source is required before publishing verified content.');
  if (req.body.isPublished !== undefined) {
    updates.isPublished = req.body.isPublished;
    updates.lastVerifiedAt = req.body.isPublished ? new Date() : null;
  }
  await disease.update(updates);
  return res.json({ success: true, data: disease });
}));

router.post('/diseases/:id/publish', asyncHandler(async (req, res) => {
  const disease = await CropDisease.findByPk(assertUuid(req.params.id));
  if (!disease) throw new HttpError(404, 'Crop disease information not found.');
  const source = text(req.body.source || disease.source, 'Source', 1000);
  await disease.update({ isPublished: true, source, lastVerifiedAt: new Date() });
  return res.json({ success: true, data: disease });
}));

router.post('/diseases/:id/symptoms', asyncHandler(async (req, res) => {
  const diseaseId = assertUuid(req.params.id);
  if (!await CropDisease.findByPk(diseaseId)) throw new HttpError(404, 'Crop disease information not found.');
  const symptom = await CropDiseaseSymptom.create({
    diseaseId,
    language: language(req.body.language),
    description: text(req.body.description, 'Symptom', 500),
  });
  return res.status(201).json({ success: true, data: symptom });
}));

router.post('/diseases/:id/recommendations', asyncHandler(async (req, res) => {
  const diseaseId = assertUuid(req.params.id);
  if (!await CropDisease.findByPk(diseaseId)) throw new HttpError(404, 'Crop disease information not found.');
  const categories = ['cultural', 'sanitation', 'monitoring', 'integrated_pest_management', 'chemical_label_guidance'];
  if (!categories.includes(req.body.category)) throw new HttpError(400, 'Choose a supported recommendation category.');
  const isPublished = req.body.isPublished === true;
  const source = req.body.source ? text(req.body.source, 'Source', 1000) : null;
  if (isPublished && !source) throw new HttpError(400, 'A source is required before publishing treatment guidance.');
  const recommendation = await CropDiseaseRecommendation.create({
    diseaseId,
    category: req.body.category,
    description: text(req.body.description, 'Recommendation', 1500),
    source,
    language: language(req.body.language),
    isPublished,
  });
  return res.status(201).json({ success: true, data: recommendation });
}));

router.post('/crops/:cropId/image', uploadHandler, asyncHandler(async (req, res) => {
  const crop = await Crop.findByPk(req.params.cropId);
  if (!crop) throw new HttpError(404, 'Crop not found.');
  validateImageSignature(req.file);
  const uploaded = await uploadPublicImage(req.file.buffer);
  await crop.update({ imageUrl: uploaded.secureUrl });
  return res.status(201).json({ success: true, data: { imageUrl: uploaded.secureUrl } });
}));

router.get('/knowledge', asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.cropId) where.cropId = String(req.query.cropId).slice(0, 80);
  if (req.query.status === 'published') where.isPublished = true;
  else if (req.query.status === 'draft') where.isPublished = false;
  const rows = await CropKnowledge.findAll({
    where,
    include: [{ model: Crop, attributes: ['id', 'name'] }],
    order: [['updatedAt', 'DESC']],
    limit: 100,
  });
  return res.json({ success: true, data: rows });
}));

router.post('/crops/:cropId/knowledge', asyncHandler(async (req, res) => {
  const crop = await Crop.findByPk(req.params.cropId);
  if (!crop) throw new HttpError(404, 'Crop not found.');
  const fields = publishedFields(req.body, req.user.id);
  const row = await CropKnowledge.create({
    cropId: crop.id,
    sectionType: sectionValue(req.body.sectionType),
    language: language(req.body.language),
    title: text(req.body.title, 'Title', 180),
    content: object(req.body.content, 'Content'),
    ...fields,
  });
  return res.status(201).json({ success: true, data: row });
}));

router.put('/knowledge/:id', asyncHandler(async (req, res) => {
  const row = await CropKnowledge.findByPk(req.params.id);
  if (!row) throw new HttpError(404, 'Knowledge article not found.');
  const transaction = await CropKnowledge.sequelize.transaction();
  try {
    const maxVersion = await CropKnowledgeRevision.max('version', { where: { knowledgeId: row.id }, transaction });
    await CropKnowledgeRevision.create({
      knowledgeId: row.id,
      version: (maxVersion || 0) + 1,
      snapshot: row.toJSON(),
      changedBy: req.user.id,
    }, { transaction });
    const updates = knowledgePublicationUpdates(req.body, req.user.id, row);
    if (req.body.title !== undefined) updates.title = text(req.body.title, 'Title', 180);
    if (req.body.sectionType !== undefined) updates.sectionType = sectionValue(req.body.sectionType);
    if (req.body.language !== undefined) updates.language = language(req.body.language);
    if (req.body.content !== undefined) updates.content = object(req.body.content, 'Content');
    await row.update(updates, { transaction });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
  return res.json({ success: true, data: row });
}));

router.get('/knowledge/:id/revisions', asyncHandler(async (req, res) => {
  const row = await CropKnowledge.findByPk(req.params.id, { attributes: ['id'] });
  if (!row) throw new HttpError(404, 'Knowledge article not found.');
  const revisions = await CropKnowledgeRevision.findAll({
    where: { knowledgeId: row.id },
    order: [['version', 'DESC']],
    limit: 50,
  });
  return res.json({ success: true, data: revisions });
}));

router.post('/crops/:cropId/stages', asyncHandler(async (req, res) => {
  if (!await Crop.findByPk(req.params.cropId)) throw new HttpError(404, 'Crop not found.');
  const fields = publishedFields(req.body, req.user.id);
  const durationDays = req.body.durationDays === undefined || req.body.durationDays === null ? null : Number(req.body.durationDays);
  if (durationDays !== null && (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 1000)) throw new HttpError(400, 'Stage duration must be from 1 to 1000 days.');
  const sequence = Number(req.body.sequence);
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 100) throw new HttpError(400, 'Stage order must be from 1 to 100.');
  const stage = await CropGrowthStage.create({
    cropId: req.params.cropId, language: language(req.body.language), sequence,
    name: text(req.body.name, 'Stage name', 160), durationDays,
    details: object(req.body.details, 'Stage details'), ...fields,
  });
  return res.status(201).json({ success: true, data: stage });
}));

router.post('/crops/:cropId/calendars', asyncHandler(async (req, res) => {
  if (!await Crop.findByPk(req.params.cropId)) throw new HttpError(404, 'Crop not found.');
  const fields = publishedFields(req.body, req.user.id);
  const calendar = await CropCalendar.create({
    cropId: req.params.cropId,
    language: language(req.body.language),
    state: text(req.body.state, 'State', 120),
    district: req.body.district ? text(req.body.district, 'District', 120) : null,
    season: text(req.body.season, 'Season', 120),
    sowingWindow: object(req.body.sowingWindow, 'Sowing window'),
    harvestingWindow: object(req.body.harvestingWindow, 'Harvesting window'),
    activities: Array.isArray(req.body.activities) ? req.body.activities : [],
    ...fields,
  });
  return res.status(201).json({ success: true, data: calendar });
}));

router.post('/recommendations', asyncHandler(async (req, res) => {
  if (!await Crop.findByPk(req.body.cropId)) throw new HttpError(404, 'Crop not found.');
  const fields = publishedFields(req.body, req.user.id);
  if (!fields.isPublished) throw new HttpError(400, 'Agricultural recommendations must be source-verified before they can be stored.');
  const allowedTypes = ['seed', 'fertilizer', 'irrigation', 'spacing', 'yield'];
  if (!allowedTypes.includes(req.body.recommendationType)) throw new HttpError(400, 'Choose a supported recommendation type.');
  const recommendation = await AgriculturalRecommendation.create({
    cropId: req.body.cropId,
    recommendationType: req.body.recommendationType,
    state: req.body.state ? text(req.body.state, 'State', 120) : null,
    details: object(req.body.details, 'Recommendation details'),
    ...fields,
  });
  return res.status(201).json({ success: true, data: recommendation });
}));

module.exports = router;
