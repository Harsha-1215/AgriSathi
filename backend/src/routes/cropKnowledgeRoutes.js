const express = require('express');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { requireAuth, requireFarmer } = require('../middleware/auth');
const assertUuid = require('../utils/assertUuid');
const {
  Crop,
  CropCategory,
  CropKnowledge,
  CropGrowthStage,
  CropCalendar,
  CropBookmark,
  CropRecentView,
  AgriculturalRecommendation,
  CropDisease,
  CropDiseaseSymptom,
  CropDiseaseRecommendation,
  CropPest,
} = require('../models');

const router = express.Router();
router.use(requireAuth, requireFarmer);

function languageFromRequest(req) {
  const requested = req.query.language || req.user.profile.preferredLanguage || 'en';
  const aliases = { english: 'en', telugu: 'te', hindi: 'hi' };
  const language = aliases[String(requested).toLowerCase()] || String(requested).toLowerCase();
  if (!['en', 'te', 'hi'].includes(language)) throw new HttpError(400, 'Choose English, Telugu, or Hindi.');
  return language;
}

function localizedText(record, language) {
  return { ...record.toJSON(), displayName: record.translations?.[language] || record.name };
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

router.get('/diseases', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 30));
  const where = { isPublished: true };
  if (typeof req.query.crop === 'string' && req.query.crop.trim()) {
    where.cropName = { [Op.iLike]: req.query.crop.trim().slice(0, 120) };
  }
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    const term = `%${req.query.q.trim().slice(0, 120)}%`;
    where[Op.or] = [
      { name: { [Op.iLike]: term } },
      { cropName: { [Op.iLike]: term } },
      { description: { [Op.iLike]: term } },
    ];
  }
  const result = await CropDisease.findAndCountAll({
    where,
    include: [
      { model: CropDiseaseSymptom, where: { language }, required: false },
      {
        model: CropDiseaseRecommendation,
        where: { language, isPublished: true },
        required: false,
      },
    ],
    order: [['cropName', 'ASC'], ['name', 'ASC']],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });
  return res.json({
    success: true,
    data: result.rows,
    pagination: { total: result.count, page, limit },
  });
}));

router.get('/diseases/:id', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const disease = await CropDisease.findOne({
    where: { id: assertUuid(req.params.id), isPublished: true },
    include: [
      { model: CropDiseaseSymptom, where: { language }, required: false },
      { model: CropDiseaseRecommendation, where: { language, isPublished: true }, required: false },
    ],
  });
  if (!disease) throw new HttpError(404, 'Published crop disease information not found.');
  return res.json({ success: true, data: disease });
}));

router.get('/pests', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 30));
  const where = { isPublished: true, language };
  if (req.query.cropId) where.cropId = String(req.query.cropId).slice(0, 80);
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    const term = `%${req.query.q.trim().slice(0, 120)}%`;
    where[Op.or] = [
      { name: { [Op.iLike]: term } },
      { scientificName: { [Op.iLike]: term } },
      { description: { [Op.iLike]: term } },
    ];
  }
  const result = await CropPest.findAndCountAll({
    where,
    include: [{ model: Crop, attributes: ['id', 'name', 'translations'], where: { isActive: true } }],
    order: [['name', 'ASC']],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });
  return res.json({ success: true, data: result.rows, pagination: { total: result.count, page, limit } });
}));

router.get('/pests/:id', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const pest = await CropPest.findOne({
    where: { id: assertUuid(req.params.id), isPublished: true, language },
    include: [{ model: Crop, attributes: ['id', 'name', 'translations'], where: { isActive: true } }],
  });
  if (!pest) throw new HttpError(404, 'Published crop pest information not found.');
  return res.json({ success: true, data: pest });
}));

router.get('/search', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  if (query.length < 2) throw new HttpError(400, 'Enter at least 2 characters to search crop knowledge.');
  const term = `%${query}%`;
  const [knowledge, diseases, pests] = await Promise.all([
    CropKnowledge.findAll({
      where: {
        language,
        isPublished: true,
        [Op.or]: [
          { title: { [Op.iLike]: term } },
          { sectionType: { [Op.iLike]: term } },
        ],
      },
      include: [{ model: Crop, attributes: ['id', 'name', 'translations'], where: { isActive: true } }],
      order: [['verifiedAt', 'DESC']],
      limit: 30,
    }),
    CropDisease.findAll({
      where: { isPublished: true, [Op.or]: [{ name: { [Op.iLike]: term } }, { cropName: { [Op.iLike]: term } }] },
      order: [['lastVerifiedAt', 'DESC']],
      limit: 30,
    }),
    CropPest.findAll({
      where: { isPublished: true, language, [Op.or]: [{ name: { [Op.iLike]: term } }, { scientificName: { [Op.iLike]: term } }] },
      include: [{ model: Crop, attributes: ['id', 'name', 'translations'], where: { isActive: true } }],
      order: [['verifiedAt', 'DESC']],
      limit: 30,
    }),
  ]);
  return res.json({
    success: true,
    data: [
      ...knowledge.map((item) => ({ type: 'knowledge', item })),
      ...diseases.map((item) => ({ type: 'disease', item })),
      ...pests.map((item) => ({ type: 'pest', item })),
    ],
  });
}));

async function cropRecommendations(req, res, recommendationType) {
  const cropId = String(req.params.cropId).slice(0, 80);
  const crop = await Crop.findOne({ where: { id: cropId, isActive: true } });
  if (!crop) throw new HttpError(404, 'Crop not found.');
  const where = { cropId, isPublished: true, recommendationType };
  where[Op.or] = req.query.state
    ? [{ state: null }, { state: { [Op.iLike]: String(req.query.state).slice(0, 120) } }]
    : [{ state: null }];
  const recommendations = await AgriculturalRecommendation.findAll({
    where,
    order: [['verifiedAt', 'DESC']],
    limit: 100,
  });
  return res.json({
    success: true,
    data: recommendations,
    note: 'Recommendations are source-verified references, not a substitute for soil testing or local expert guidance.',
  });
}

router.get('/:cropId/fertilizer', asyncHandler((req, res) => cropRecommendations(req, res, 'fertilizer')));
router.get('/:cropId/irrigation', asyncHandler((req, res) => cropRecommendations(req, res, 'irrigation')));

router.get('/crops', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const query = typeof req.query.q === 'string' ? req.query.q.trim().toLocaleLowerCase().slice(0, 100) : '';
  const where = { isActive: true };
  if (req.query.categoryId) where.categoryId = String(req.query.categoryId).slice(0, 60);
  const allCrops = await Crop.findAll({
    where,
    include: [{ model: CropCategory, attributes: ['id', 'name', 'translations'] }],
    order: [['name', 'ASC']],
  });
  const filtered = query
    ? allCrops.filter((crop) => [crop.name, crop.translations?.en, crop.translations?.te, crop.translations?.hi]
      .some((value) => typeof value === 'string' && value.toLocaleLowerCase().includes(query)))
    : allCrops;
  const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 100));
  const offset = Math.max(0, Math.min(10000, Number.parseInt(req.query.offset, 10) || 0));
  return res.json({
    success: true,
    data: filtered.slice(offset, offset + limit).map((crop) => ({
      ...localizedText(crop, language),
      categoryName: crop.CropCategory?.translations?.[language] || crop.CropCategory?.name || null,
    })),
    pagination: { offset, limit, total: filtered.length },
  });
}));

router.get('/crops/:cropId', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const crop = await Crop.findOne({
    where: { id: req.params.cropId, isActive: true },
    include: [
      { model: CropCategory, attributes: ['id', 'name', 'translations'] },
      { model: CropKnowledge, where: { language, isPublished: true }, required: false, order: [['sectionType', 'ASC']] },
      { model: CropGrowthStage, where: { language, isPublished: true }, required: false, order: [['sequence', 'ASC']] },
    ],
  });
  if (!crop) throw new HttpError(404, 'Crop not found.');
  const plain = crop.toJSON();
  const currentDate = new Date();
  const state = typeof req.query.state === 'string' ? req.query.state.trim().slice(0, 120) : null;
  const calendarWhere = { cropId: crop.id, language, isPublished: true };
  if (state) calendarWhere.state = { [Op.iLike]: state };
  const calendars = state ? await CropCalendar.findAll({
    where: calendarWhere,
    order: [['district', 'ASC'], ['season', 'ASC']],
  }) : [];
  const recommendationWhere = { cropId: crop.id, isPublished: true };
  recommendationWhere[Op.or] = state
    ? [{ state: null }, { state: { [Op.iLike]: state } }]
    : [{ state: null }];
  const recommendations = await AgriculturalRecommendation.findAll({
    where: recommendationWhere,
    order: [['verifiedAt', 'DESC']],
  });
  const viewedAt = currentDate;
  const [recent, created] = await CropRecentView.findOrCreate({
    where: { userId: req.user.id, cropId: crop.id },
    defaults: { userId: req.user.id, cropId: crop.id, lastViewedAt: viewedAt },
  });
  if (!created) await recent.update({ lastViewedAt: viewedAt });
  return res.json({
    success: true,
    data: {
      ...localizedText(crop, language),
      categoryName: plain.CropCategory?.translations?.[language] || plain.CropCategory?.name || null,
      knowledge: plain.CropKnowledges || [],
      growthStages: plain.CropGrowthStages || [],
      calendars,
      recommendations,
      guidanceNote: 'Published cultivation information is source-attributed. Empty sections mean verified guidance is not currently available.',
    },
  });
}));

router.get('/calendars', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const where = { isPublished: true, language };
  if (req.query.cropId) where.cropId = String(req.query.cropId).slice(0, 80);
  if (req.query.state) where.state = { [Op.iLike]: String(req.query.state).slice(0, 120) };
  if (req.query.district) where.district = { [Op.iLike]: String(req.query.district).slice(0, 120) };
  const calendars = await CropCalendar.findAll({
    where,
    include: [{ model: Crop, attributes: ['id', 'name', 'translations'] }],
    order: [['season', 'ASC']],
    limit: 100,
  });
  return res.json({ success: true, data: calendars });
}));

router.get('/recommendations', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const where = { isPublished: true };
  if (req.query.cropId) where.cropId = String(req.query.cropId).slice(0, 80);
  if (req.query.type) {
    const supportedTypes = ['seed', 'fertilizer', 'irrigation', 'spacing', 'yield'];
    if (!supportedTypes.includes(req.query.type)) throw new HttpError(400, 'Choose a supported recommendation type.');
    where.recommendationType = String(req.query.type);
  }
  where[Op.or] = req.query.state
    ? [{ state: null }, { state: { [Op.iLike]: String(req.query.state).slice(0, 120) } }]
    : [{ state: null }];
  const recommendations = await AgriculturalRecommendation.findAll({
    where,
    include: [{ model: Crop, attributes: ['id', 'name', 'translations'] }],
    order: [['verifiedAt', 'DESC']],
    limit: 100,
  });
  return res.json({
    success: true,
    data: recommendations.map((item) => ({ ...item.toJSON(), displayName: item.Crop?.translations?.[language] || item.Crop?.name })),
  });
}));

router.get('/bookmarks', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const bookmarks = await CropBookmark.findAll({
    where: { userId: req.user.id },
    include: [{ model: Crop, where: { isActive: true }, include: [{ model: CropCategory, attributes: ['id', 'name', 'translations'] }] }],
    order: [['createdAt', 'DESC']],
  });
  return res.json({
    success: true,
    data: bookmarks.map((bookmark) => ({
      id: bookmark.id,
      createdAt: bookmark.createdAt,
      crop: localizedText(bookmark.Crop, language),
      categoryName: bookmark.Crop.CropCategory?.translations?.[language] || bookmark.Crop.CropCategory?.name,
    })),
  });
}));

router.post('/bookmarks/:cropId', asyncHandler(async (req, res) => {
  const crop = await Crop.findOne({ where: { id: req.params.cropId, isActive: true } });
  if (!crop) throw new HttpError(404, 'Crop not found.');
  const [bookmark] = await CropBookmark.findOrCreate({
    where: { userId: req.user.id, cropId: crop.id },
    defaults: { userId: req.user.id, cropId: crop.id },
  });
  return res.status(201).json({ success: true, data: bookmark });
}));

router.delete('/bookmarks/:cropId', asyncHandler(async (req, res) => {
  const deleted = await CropBookmark.destroy({ where: { userId: req.user.id, cropId: req.params.cropId } });
  if (!deleted) throw new HttpError(404, 'Bookmark not found.');
  return res.json({ success: true, message: 'Bookmark removed.' });
}));

const recentHandler = asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const views = await CropRecentView.findAll({
    where: { userId: req.user.id },
    include: [{ model: Crop, where: { isActive: true }, include: [{ model: CropCategory, attributes: ['id', 'name', 'translations'] }] }],
    order: [['lastViewedAt', 'DESC']],
    limit: 30,
  });
  return res.json({
    success: true,
    data: views.map((view) => ({
      lastViewedAt: view.lastViewedAt,
      crop: localizedText(view.Crop, language),
      categoryName: view.Crop.CropCategory?.translations?.[language] || view.Crop.CropCategory?.name,
    })),
  });
});

router.get(['/recent', '/recently-viewed'], recentHandler);

module.exports = router;
