const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const assertUuid = require('../utils/assertUuid');
const { requireAuth, requireRoles, checkAccountStatus } = require('../middleware/auth');
const {
  Commodity,
  CommodityCategory,
  AgriculturalMarket,
  MarketDataSource,
  MarketSyncLog,
} = require('../models');
const { synchronize } = require('../services/market/marketSyncService');

const router = express.Router();
router.use(requireAuth, requireRoles(['admin']), checkAccountStatus);

function requiredText(value, label, max = 180) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, `${label} is required and must be no more than ${max} characters.`);
  }
  return value.trim();
}

function slug(value, label) {
  const result = requiredText(value, label, 80).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result)) throw new HttpError(400, `${label} must be a lowercase URL-safe ID.`);
  return result;
}

function translations(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Translations must be an object.');
  for (const [language, label] of Object.entries(value)) {
    if (!['en', 'te', 'hi'].includes(language) || typeof label !== 'string' || label.trim().length > 160) {
      throw new HttpError(400, 'Translations must contain en, te, or hi text values of up to 160 characters.');
    }
  }
  return value;
}

router.post('/categories', asyncHandler(async (req, res) => {
  const category = await CommodityCategory.create({
    id: slug(req.body.id, 'Category ID'),
    name: requiredText(req.body.name, 'Category name', 120),
    translations: translations(req.body.translations),
  });
  return res.status(201).json({ success: true, data: category });
}));

router.put('/categories/:id', asyncHandler(async (req, res) => {
  const category = await CommodityCategory.findByPk(slug(req.params.id, 'Category ID'));
  if (!category) throw new HttpError(404, 'Commodity category not found.');
  const updates = {};
  if (req.body.name !== undefined) updates.name = requiredText(req.body.name, 'Category name', 120);
  if (req.body.translations !== undefined) updates.translations = translations(req.body.translations);
  if (req.body.isActive !== undefined) {
    if (typeof req.body.isActive !== 'boolean') throw new HttpError(400, 'isActive must be true or false.');
    updates.isActive = req.body.isActive;
  }
  await category.update(updates);
  return res.json({ success: true, data: category });
}));

router.post('/commodities', asyncHandler(async (req, res) => {
  const categoryId = req.body.categoryId ? slug(req.body.categoryId, 'Category ID') : null;
  if (categoryId && !await CommodityCategory.findOne({ where: { id: categoryId, isActive: true } })) {
    throw new HttpError(400, 'Choose an active commodity category.');
  }
  const commodity = await Commodity.create({
    id: slug(req.body.id, 'Commodity ID'),
    name: requiredText(req.body.name, 'Commodity name', 160),
    localName: req.body.localName ? requiredText(req.body.localName, 'Local name', 160) : null,
    translations: translations(req.body.translations),
    categoryId,
    standardUnit: requiredText(req.body.standardUnit, 'Standard unit', 40),
    isActive: req.body.isActive !== false,
  });
  return res.status(201).json({ success: true, data: commodity });
}));

router.put('/commodities/:id', asyncHandler(async (req, res) => {
  const commodity = await Commodity.findByPk(slug(req.params.id, 'Commodity ID'));
  if (!commodity) throw new HttpError(404, 'Commodity not found.');
  const updates = {};
  if (req.body.name !== undefined) updates.name = requiredText(req.body.name, 'Commodity name', 160);
  if (req.body.localName !== undefined) updates.localName = req.body.localName ? requiredText(req.body.localName, 'Local name', 160) : null;
  if (req.body.translations !== undefined) updates.translations = translations(req.body.translations);
  if (req.body.standardUnit !== undefined) updates.standardUnit = requiredText(req.body.standardUnit, 'Standard unit', 40);
  if (req.body.categoryId !== undefined) {
    const categoryId = req.body.categoryId ? slug(req.body.categoryId, 'Category ID') : null;
    if (categoryId && !await CommodityCategory.findOne({ where: { id: categoryId, isActive: true } })) {
      throw new HttpError(400, 'Choose an active commodity category.');
    }
    updates.categoryId = categoryId;
  }
  if (req.body.isActive !== undefined) {
    if (typeof req.body.isActive !== 'boolean') throw new HttpError(400, 'isActive must be true or false.');
    updates.isActive = req.body.isActive;
  }
  await commodity.update(updates);
  return res.json({ success: true, data: commodity });
}));

router.post('/markets', asyncHandler(async (req, res) => {
  const latitude = req.body.latitude === undefined ? null : Number(req.body.latitude);
  const longitude = req.body.longitude === undefined ? null : Number(req.body.longitude);
  if ((latitude === null) !== (longitude === null)
    || (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90))
    || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
    throw new HttpError(400, 'Provide both valid coordinates or leave both empty.');
  }
  const market = await AgriculturalMarket.create({
    marketCode: requiredText(req.body.marketCode, 'Market code', 120),
    name: requiredText(req.body.name, 'Market name', 180),
    state: requiredText(req.body.state, 'State', 120),
    district: requiredText(req.body.district, 'District', 120),
    mandal: req.body.mandal ? requiredText(req.body.mandal, 'Mandal', 120) : null,
    address: req.body.address ? requiredText(req.body.address, 'Address', 500) : null,
    latitude,
    longitude,
    isActive: req.body.isActive !== false,
  });
  return res.status(201).json({ success: true, data: market });
}));

router.put('/markets/:id', asyncHandler(async (req, res) => {
  const market = await AgriculturalMarket.findByPk(assertUuid(req.params.id));
  if (!market) throw new HttpError(404, 'Agricultural market not found.');
  const updates = {};
  for (const field of ['name', 'state', 'district', 'mandal', 'address']) {
    if (req.body[field] !== undefined) updates[field] = req.body[field] === null && ['mandal', 'address'].includes(field)
      ? null
      : requiredText(req.body[field], field, field === 'address' ? 500 : 180);
  }
  if (req.body.latitude !== undefined || req.body.longitude !== undefined) {
    const latitude = req.body.latitude === undefined ? Number(market.latitude) : Number(req.body.latitude);
    const longitude = req.body.longitude === undefined ? Number(market.longitude) : Number(req.body.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new HttpError(400, 'Provide valid coordinates.');
    }
    updates.latitude = latitude;
    updates.longitude = longitude;
  }
  if (req.body.isActive !== undefined) {
    if (typeof req.body.isActive !== 'boolean') throw new HttpError(400, 'isActive must be true or false.');
    updates.isActive = req.body.isActive;
  }
  await market.update(updates);
  return res.json({ success: true, data: market });
}));

router.post('/sources', asyncHandler(async (req, res) => {
  const provider = requiredText(req.body.provider, 'Provider', 80).toLowerCase();
  if (provider !== 'data-gov-in') throw new HttpError(400, 'Only the configured official Data.gov.in provider is currently supported.');
  const resourceId = requiredText(req.body.resourceId, 'Resource ID', 160);
  if (!/^[a-f0-9-]{20,80}$/i.test(resourceId)) throw new HttpError(400, 'Resource ID has an invalid format.');
  const sourceUrl = requiredText(req.body.sourceUrl, 'Source URL', 1000);
  let parsedUrl;
  try { parsedUrl = new URL(sourceUrl); } catch { throw new HttpError(400, 'Source URL must be a valid HTTPS URL.'); }
  if (parsedUrl.protocol !== 'https:') throw new HttpError(400, 'Source URL must use HTTPS.');
  const priceUnit = requiredText(req.body.priceUnit, 'Price unit', 40);
  const currency = req.body.currency === undefined ? 'INR' : requiredText(req.body.currency, 'Currency', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new HttpError(400, 'Currency must be a three-letter code.');
  const source = await MarketDataSource.create({
    name: requiredText(req.body.name, 'Source name', 160),
    provider,
    resourceId,
    sourceUrl,
    isAuthorized: req.body.isAuthorized === true,
    isActive: req.body.isActive === true,
    config: { priceUnit, currency },
  });
  return res.status(201).json({ success: true, data: source });
}));

router.get('/sources', asyncHandler(async (req, res) => {
  const sources = await MarketDataSource.findAll({
    attributes: ['id', 'name', 'provider', 'resourceId', 'sourceUrl', 'isAuthorized', 'isActive', 'config', 'lastFetchedAt'],
    order: [['createdAt', 'DESC']],
  });
  return res.json({ success: true, data: sources });
}));

router.post('/sync', asyncHandler(async (req, res) => {
  const sourceId = assertUuid(req.body.sourceId);
  const limit = req.body.limit === undefined ? 100 : Number(req.body.limit);
  const offset = req.body.offset === undefined ? 0 : Number(req.body.offset);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000
    || !Number.isInteger(offset) || offset < 0 || offset > 10000000) {
    throw new HttpError(400, 'Sync limit must be from 1 to 1000 and offset must be non-negative.');
  }
  const result = await synchronize(sourceId, { limit, offset });
  return res.json({ success: true, data: result });
}));

router.get('/sync-logs', asyncHandler(async (req, res) => {
  const logs = await MarketSyncLog.findAll({
    order: [['startedAt', 'DESC']],
    limit: Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 30)),
  });
  return res.json({ success: true, data: logs });
}));

router.delete('/sources/:id', asyncHandler(async (req, res) => {
  const source = await MarketDataSource.findByPk(assertUuid(req.params.id));
  if (!source) throw new HttpError(404, 'Market data source not found.');
  await source.update({ isActive: false });
  return res.json({ success: true, message: 'Market data source disabled.' });
}));

module.exports = router;
