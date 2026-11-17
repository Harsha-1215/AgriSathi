const express = require('express');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const {
  sequelize,
  Crop,
  CropCategory,
  CropKnowledge,
  CropGrowthStage,
  CropCalendar,
  AgriculturalRecommendation,
} = require('../models');

const router = express.Router();
const languageCodes = ['en', 'te', 'hi'];

function languageFromRequest(req) {
  const requested = String(req.query.language || 'en').toLowerCase();
  const aliases = { english: 'en', telugu: 'te', hindi: 'hi' };
  const language = aliases[requested] || requested;
  if (!languageCodes.includes(language)) throw new HttpError(400, 'Choose English, Telugu, or Hindi.');
  return language;
}

function pagination(query) {
  const page = Number.parseInt(query.page, 10) || 1;
  const limit = Number.parseInt(query.limit, 10) || 30;
  if (page < 1 || page > 10000 || limit < 1 || limit > 100) {
    throw new HttpError(400, 'Page must be positive and limit must be from 1 to 100.');
  }
  return { page, limit, offset: (page - 1) * limit };
}

function localized(record, language) {
  const item = record.toJSON();
  return {
    ...item,
    displayName: item.translations?.[language] || item.name,
    publishedDescription: item.isPublished ? item.description : {},
    description: undefined,
  };
}

function searchCondition(query, language) {
  const term = `%${query}%`;
  return {
    [Op.or]: [
      { name: { [Op.iLike]: term } },
      { scientificName: { [Op.iLike]: term } },
      sequelize.where(sequelize.json(`translations.${language}`), { [Op.iLike]: term }),
      sequelize.where(sequelize.json('translations.en'), { [Op.iLike]: term }),
      sequelize.where(sequelize.json('translations.te'), { [Op.iLike]: term }),
      sequelize.where(sequelize.json('translations.hi'), { [Op.iLike]: term }),
    ],
  };
}

async function applyRegion(where, query) {
  const state = typeof query.state === 'string' ? query.state.trim().slice(0, 120) : '';
  const district = typeof query.district === 'string' ? query.district.trim().slice(0, 120) : '';
  if (!state && !district && !query.region) return;
  const region = state || (typeof query.region === 'string' ? query.region.trim().slice(0, 120) : '');
  const calendarWhere = { isPublished: true };
  if (region) calendarWhere.state = { [Op.iLike]: region };
  if (district) calendarWhere.district = { [Op.iLike]: district };
  const calendars = await CropCalendar.findAll({ where: calendarWhere, attributes: ['cropId'], group: ['cropId'] });
  const ids = calendars.map((calendar) => calendar.cropId);
  where.id = { [Op.in]: ids };
}

async function listCrops(req, res, { search = false, featured = false } = {}) {
  const language = languageFromRequest(req);
  const { page, limit, offset } = pagination(req.query);
  const where = { isActive: true };
  if (req.query.categoryId) where.categoryId = String(req.query.categoryId).slice(0, 60);
  if (req.query.season) {
    const season = String(req.query.season).trim().slice(0, 80);
    if (!season) throw new HttpError(400, 'Provide a valid crop season.');
    where.growingSeasons = { [Op.contains]: [season] };
  }
  if (featured) where.isFeatured = true;
  if (search) {
    const query = typeof req.query.q === 'string' ? req.query.q.trim().toLocaleLowerCase().slice(0, 100) : '';
    if (query.length < 2) throw new HttpError(400, 'Enter at least 2 characters to search crops.');
    Object.assign(where, searchCondition(query, language));
  } else if (req.query.q !== undefined) {
    const query = String(req.query.q).trim().toLocaleLowerCase().slice(0, 100);
    if (query.length >= 2) Object.assign(where, searchCondition(query, language));
  }
  await applyRegion(where, req.query);
  const result = await Crop.findAndCountAll({
    where,
    include: [{ model: CropCategory, attributes: ['id', 'name', 'translations'], required: false }],
    order: featured ? [['isFeatured', 'DESC'], ['name', 'ASC']] : [['name', 'ASC']],
    limit,
    offset,
    distinct: true,
  });
  return res.json({
    success: true,
    data: result.rows.map((crop) => ({
      ...localized(crop, language),
      categoryName: crop.CropCategory?.translations?.[language] || crop.CropCategory?.name || null,
    })),
    pagination: { total: result.count, page, limit },
  });
}

router.get('/categories', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const categories = await CropCategory.findAll({ order: [['name', 'ASC']] });
  return res.json({
    success: true,
    data: categories.map((item) => ({
      ...item.toJSON(),
      displayName: item.translations?.[language] || item.name,
    })),
  });
}));

router.get('/featured', asyncHandler((req, res) => listCrops(req, res, { featured: true })));
router.get('/search', asyncHandler((req, res) => listCrops(req, res, { search: true })));
router.get('/', asyncHandler((req, res) => listCrops(req, res)));

router.get('/:cropId/guides/:guideId', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const guide = await CropKnowledge.findOne({
    where: {
      id: req.params.guideId,
      cropId: req.params.cropId,
      isPublished: true,
      language,
    },
  });
  if (!guide) throw new HttpError(404, 'Published cultivation guide not found.');
  return res.json({ success: true, data: guide });
}));

router.get('/:cropId/guides', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const crop = await Crop.findOne({ where: { id: req.params.cropId, isActive: true }, attributes: ['id'] });
  if (!crop) throw new HttpError(404, 'Crop not found.');
  const { page, limit, offset } = pagination(req.query);
  const result = await CropKnowledge.findAndCountAll({
    where: { cropId: crop.id, isPublished: true, language },
    order: [['sectionType', 'ASC'], ['title', 'ASC']],
    limit,
    offset,
  });
  return res.json({ success: true, data: result.rows, pagination: { total: result.count, page, limit } });
}));

router.get('/:cropId/growth-stages', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const crop = await Crop.findOne({ where: { id: req.params.cropId, isActive: true }, attributes: ['id'] });
  if (!crop) throw new HttpError(404, 'Crop not found.');
  const stages = await CropGrowthStage.findAll({
    where: { cropId: crop.id, isPublished: true, language },
    order: [['sequence', 'ASC']],
    limit: 100,
  });
  return res.json({ success: true, data: stages });
}));

router.get('/:cropId/calendar', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const crop = await Crop.findOne({ where: { id: req.params.cropId, isActive: true }, attributes: ['id'] });
  if (!crop) throw new HttpError(404, 'Crop not found.');
  const where = { cropId: crop.id, isPublished: true, language };
  for (const field of ['state', 'district', 'season']) {
    if (req.query[field]) where[field] = { [Op.iLike]: String(req.query[field]).trim().slice(0, 120) };
  }
  const calendars = await CropCalendar.findAll({
    where,
    order: [['state', 'ASC'], ['district', 'ASC'], ['season', 'ASC']],
    limit: 100,
  });
  return res.json({ success: true, data: calendars });
}));

async function listRecommendations(req, res, type) {
  const language = languageFromRequest(req);
  const crop = await Crop.findOne({ where: { id: req.params.cropId, isActive: true }, attributes: ['id', 'name', 'translations'] });
  if (!crop) throw new HttpError(404, 'Crop not found.');
  const where = { cropId: crop.id, isPublished: true };
  if (type) where.recommendationType = type;
  const state = typeof req.query.state === 'string' ? req.query.state.trim().slice(0, 120) : '';
  where[Op.or] = state ? [{ state: null }, { state: { [Op.iLike]: state } }] : [{ state: null }];
  const recommendations = await AgriculturalRecommendation.findAll({
    where,
    order: [['verifiedAt', 'DESC']],
    limit: 100,
  });
  return res.json({
    success: true,
    data: {
      crop: { id: crop.id, name: crop.name, displayName: crop.translations?.[language] || crop.name },
      recommendations,
      note: 'Recommendations are returned only when source-verified and published. Check regional and soil-test conditions before use.',
    },
  });
}

router.get('/:cropId/fertilizer', asyncHandler((req, res) => listRecommendations(req, res, 'fertilizer')));
router.get('/:cropId/irrigation', asyncHandler((req, res) => listRecommendations(req, res, 'irrigation')));
router.get('/:cropId/recommendations', asyncHandler((req, res) => listRecommendations(req, res, null)));

router.get('/:cropId', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const crop = await Crop.findOne({
    where: { id: req.params.cropId, isActive: true },
    include: [
      { model: CropCategory, attributes: ['id', 'name', 'translations'] },
      { model: CropKnowledge, where: { isPublished: true, language }, required: false, order: [['sectionType', 'ASC']] },
      { model: CropGrowthStage, where: { isPublished: true, language }, required: false, order: [['sequence', 'ASC']] },
    ],
  });
  if (!crop) throw new HttpError(404, 'Crop not found.');
  return res.json({
    success: true,
    data: {
      ...localized(crop, language),
      categoryName: crop.CropCategory?.translations?.[language] || crop.CropCategory?.name || null,
      knowledge: crop.CropKnowledges || [],
      growthStages: crop.CropGrowthStages || [],
      source: crop.isPublished ? crop.source : null,
      verifiedAt: crop.isPublished ? crop.verifiedAt : null,
    },
  });
}));

module.exports = router;
