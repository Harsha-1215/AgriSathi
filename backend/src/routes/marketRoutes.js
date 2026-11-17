const express = require('express');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const assertUuid = require('../utils/assertUuid');
const { requireAuth, requireFarmer } = require('../middleware/auth');
const {
  Commodity,
  CommodityCategory,
  AgriculturalMarket,
  MarketPrice,
  FarmerFavoriteCommodity,
  FarmerFavoriteMarket,
  MarketPriceAlert,
} = require('../models');
const { priceQuery, validatePagination, text } = require('../services/market/marketPriceService');
const { comparable } = require('../services/market/marketComparisonService');

const router = express.Router();
router.use(requireAuth, requireFarmer);

function marketWhereFromQuery(query) {
  const where = { isActive: true };
  if (query.state) where.state = { [Op.iLike]: String(query.state).trim().slice(0, 120) };
  if (query.district) where.district = { [Op.iLike]: String(query.district).trim().slice(0, 120) };
  if (query.q) {
    const term = String(query.q).trim().slice(0, 120);
    where[Op.or] = [
      { name: { [Op.iLike]: `%${term}%` } },
      { district: { [Op.iLike]: `%${term}%` } },
      { state: { [Op.iLike]: `%${term}%` } },
    ];
  }
  return where;
}

function distanceKm(latitudeA, longitudeA, latitudeB, longitudeB) {
  const radians = (value) => value * Math.PI / 180;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

router.get('/commodities', asyncHandler(async (req, res) => {
  const { limit, page, offset } = validatePagination(req.query);
  const where = { isActive: true };
  if (req.query.categoryId) where.categoryId = String(req.query.categoryId).slice(0, 80);
  const result = await Commodity.findAndCountAll({
    where,
    include: [{ model: CommodityCategory, attributes: ['id', 'name', 'translations'], required: false }],
    order: [['name', 'ASC']],
    limit,
    offset,
  });
  return res.json({ success: true, data: result.rows, pagination: { total: result.count, page, limit } });
}));

router.get('/commodities/search', asyncHandler(async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  if (query.length < 2) throw new HttpError(400, 'Enter at least 2 characters to search commodities.');
  const { limit, page, offset } = validatePagination(req.query);
  const result = await Commodity.findAndCountAll({
    where: {
      isActive: true,
      [Op.or]: [
        { name: { [Op.iLike]: `%${query}%` } },
        { localName: { [Op.iLike]: `%${query}%` } },
      ],
    },
    order: [['name', 'ASC']],
    limit,
    offset,
  });
  return res.json({ success: true, data: result.rows, pagination: { total: result.count, page, limit } });
}));

router.get('/commodities/:id', asyncHandler(async (req, res) => {
  const commodity = await Commodity.findOne({
    where: { id: String(req.params.id).slice(0, 80), isActive: true },
    include: [{ model: CommodityCategory, attributes: ['id', 'name', 'translations'], required: false }],
  });
  if (!commodity) throw new HttpError(404, 'Commodity not found.');
  return res.json({ success: true, data: commodity });
}));

router.get('/markets/nearby', asyncHandler(async (req, res) => {
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  const radiusKm = req.query.radiusKm === undefined ? 100 : Number(req.query.radiusKm);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
    || !Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 500) {
    throw new HttpError(400, 'Provide valid coordinates and a radius from 1 to 500 kilometres.');
  }
  const { limit, page } = validatePagination(req.query);
  const candidates = await AgriculturalMarket.findAll({
    where: { ...marketWhereFromQuery(req.query), latitude: { [Op.ne]: null }, longitude: { [Op.ne]: null } },
    attributes: ['id', 'marketCode', 'name', 'state', 'district', 'mandal', 'latitude', 'longitude'],
  });
  const matches = candidates.map((market) => ({
    ...market.toJSON(),
    distanceKm: distanceKm(latitude, longitude, Number(market.latitude), Number(market.longitude)),
  })).filter((market) => market.distanceKm <= radiusKm).sort((a, b) => a.distanceKm - b.distanceKm);
  const offset = (page - 1) * limit;
  return res.json({
    success: true,
    data: matches.slice(offset, offset + limit),
    pagination: { total: matches.length, page, limit },
    location: { latitude, longitude, radiusKm },
  });
}));

router.get('/markets/search', asyncHandler(async (req, res) => {
  const { limit, page, offset } = validatePagination(req.query);
  const result = await AgriculturalMarket.findAndCountAll({
    where: marketWhereFromQuery(req.query),
    order: [['state', 'ASC'], ['district', 'ASC'], ['name', 'ASC']],
    limit,
    offset,
  });
  return res.json({ success: true, data: result.rows, pagination: { total: result.count, page, limit } });
}));

router.get('/markets', asyncHandler(async (req, res) => {
  const { limit, page, offset } = validatePagination(req.query);
  const result = await AgriculturalMarket.findAndCountAll({
    where: marketWhereFromQuery(req.query),
    order: [['state', 'ASC'], ['district', 'ASC'], ['name', 'ASC']],
    limit,
    offset,
  });
  return res.json({ success: true, data: result.rows, pagination: { total: result.count, page, limit } });
}));

router.get('/markets/:id', asyncHandler(async (req, res) => {
  const market = await AgriculturalMarket.findOne({ where: { id: assertUuid(req.params.id), isActive: true } });
  if (!market) throw new HttpError(404, 'Agricultural market not found.');
  return res.json({ success: true, data: market });
}));

router.get('/prices', asyncHandler(async (req, res) => {
  const { limit, page, offset } = validatePagination(req.query);
  const where = priceQuery(req.query);
  const marketWhere = {};
  if (req.query.state) marketWhere.state = { [Op.iLike]: String(req.query.state).trim().slice(0, 120) };
  if (req.query.district) marketWhere.district = { [Op.iLike]: String(req.query.district).trim().slice(0, 120) };
  const result = await MarketPrice.findAndCountAll({
    where,
    include: [
      { model: Commodity, attributes: ['id', 'name', 'translations', 'standardUnit'], where: { isActive: true } },
      { model: AgriculturalMarket, attributes: ['id', 'name', 'state', 'district', 'mandal'], where: marketWhere },
      { model: require('../models').MarketDataSource, attributes: ['name', 'sourceUrl'] },
    ],
    order: [['arrivalDate', 'DESC'], ['fetchedAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });
  res.set('Cache-Control', 'private, max-age=120');
  return res.json({ success: true, data: result.rows, pagination: { total: result.count, page, limit } });
}));

router.get('/prices/:commodityId', asyncHandler(async (req, res) => {
  const commodityId = String(req.params.commodityId).slice(0, 80);
  const commodity = await Commodity.findOne({ where: { id: commodityId, isActive: true } });
  if (!commodity) throw new HttpError(404, 'Commodity not found.');
  const { limit, page, offset } = validatePagination(req.query);
  const result = await MarketPrice.findAndCountAll({
    where: { ...priceQuery(req.query), commodityId },
    include: [
      { model: AgriculturalMarket, attributes: ['id', 'name', 'state', 'district', 'mandal'] },
      { model: require('../models').MarketDataSource, attributes: ['name', 'sourceUrl'] },
    ],
    order: [['arrivalDate', 'DESC'], ['fetchedAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });
  return res.json({
    success: true,
    data: {
      commodity,
      prices: result.rows,
      pagination: { total: result.count, page, limit },
      note: 'Modal price is a reported market observation, not a guaranteed selling price.',
    },
  });
}));

router.get('/compare', asyncHandler(async (req, res) => {
  const commodityId = String(req.query.commodityId || '').slice(0, 80);
  const marketIds = Array.isArray(req.query.marketIds)
    ? req.query.marketIds
    : String(req.query.marketIds || '').split(',').filter(Boolean);
  const date = String(req.query.date || '');
  if (!commodityId || marketIds.length < 2 || marketIds.length > 20
    || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new HttpError(400, 'Provide a commodityId, 2 to 20 marketIds, and a YYYY-MM-DD date.');
  }
  const normalizedIds = marketIds.map((id) => assertUuid(String(id)));
  const prices = await MarketPrice.findAll({
    where: { commodityId, marketId: { [Op.in]: normalizedIds }, arrivalDate: date },
    include: [{ model: AgriculturalMarket, attributes: ['id', 'name', 'state', 'district'] }],
    order: [['fetchedAt', 'DESC']],
  });
  const selected = normalizedIds.map((marketId) => prices.find((price) => price.marketId === marketId) || null);
  const available = selected.filter(Boolean);
  return res.json({
    success: true,
    data: {
      date,
      prices: available,
      missingMarketIds: normalizedIds.filter((id) => !available.some((item) => item.marketId === id)),
      ...comparable(available),
    },
  });
}));

router.get('/history/:commodityId', asyncHandler(async (req, res) => {
  const commodityId = String(req.params.commodityId).slice(0, 80);
  const commodity = await Commodity.findOne({ where: { id: commodityId, isActive: true } });
  if (!commodity) throw new HttpError(404, 'Commodity not found.');
  const days = Number.parseInt(req.query.days, 10) || 30;
  if (![7, 30, 90].includes(days) && !(req.query.from && req.query.to)) {
    throw new HttpError(400, 'Choose 7, 30, or 90 days, or provide both from and to dates.');
  }
  const where = { commodityId };
  if (req.query.from || req.query.to) {
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
      throw new HttpError(400, 'Provide a valid custom date range using YYYY-MM-DD.');
    }
    where.arrivalDate = { [Op.between]: [from, to] };
  } else {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - days + 1);
    where.arrivalDate = { [Op.gte]: start.toISOString().slice(0, 10) };
  }
  const prices = await MarketPrice.findAll({
    where,
    include: [{ model: AgriculturalMarket, attributes: ['id', 'name', 'state', 'district'] }],
    order: [['arrivalDate', 'ASC']],
    limit: 1000,
  });
  return res.json({ success: true, data: { commodity, prices, periodDays: days } });
}));

router.get('/favorites/prices', asyncHandler(async (req, res) => {
  const [commodities, markets] = await Promise.all([
    FarmerFavoriteCommodity.findAll({ where: { userId: req.user.id }, attributes: ['commodityId'] }),
    FarmerFavoriteMarket.findAll({ where: { userId: req.user.id }, attributes: ['marketId'] }),
  ]);
  const commodityIds = commodities.map((item) => item.commodityId);
  const marketIds = markets.map((item) => item.marketId);
  if (!commodityIds.length && !marketIds.length) return res.json({ success: true, data: [] });
  const prices = await MarketPrice.findAll({
    where: {
      [Op.or]: [
        ...(commodityIds.length ? [{ commodityId: { [Op.in]: commodityIds } }] : []),
        ...(marketIds.length ? [{ marketId: { [Op.in]: marketIds } }] : []),
      ],
    },
    include: [
      { model: Commodity, attributes: ['id', 'name'] },
      { model: AgriculturalMarket, attributes: ['id', 'name', 'state', 'district'] },
    ],
    order: [['arrivalDate', 'DESC']],
    limit: 100,
  });
  return res.json({ success: true, data: prices });
}));

router.get('/favorites', asyncHandler(async (req, res) => {
  const [commodities, markets] = await Promise.all([
    FarmerFavoriteCommodity.findAll({
      where: { userId: req.user.id },
      include: [{ model: Commodity, where: { isActive: true } }],
      order: [['createdAt', 'DESC']],
    }),
    FarmerFavoriteMarket.findAll({
      where: { userId: req.user.id },
      include: [{ model: AgriculturalMarket, where: { isActive: true } }],
      order: [['createdAt', 'DESC']],
    }),
  ]);
  return res.json({ success: true, data: { commodities, markets } });
}));

router.post('/favorites', asyncHandler(async (req, res) => {
  const commodityId = req.body.commodityId === undefined ? null : String(req.body.commodityId).slice(0, 80);
  const marketId = req.body.marketId === undefined ? null : assertUuid(req.body.marketId);
  if (Boolean(commodityId) === Boolean(marketId)) {
    throw new HttpError(400, 'Provide exactly one commodityId or marketId.');
  }
  let favorite;
  if (commodityId) {
    if (!await Commodity.findOne({ where: { id: commodityId, isActive: true } })) throw new HttpError(404, 'Commodity not found.');
    [favorite] = await FarmerFavoriteCommodity.findOrCreate({
      where: { userId: req.user.id, commodityId },
      defaults: { userId: req.user.id, commodityId },
    });
  } else {
    if (!await AgriculturalMarket.findOne({ where: { id: marketId, isActive: true } })) throw new HttpError(404, 'Agricultural market not found.');
    [favorite] = await FarmerFavoriteMarket.findOrCreate({
      where: { userId: req.user.id, marketId },
      defaults: { userId: req.user.id, marketId },
    });
  }
  return res.status(201).json({ success: true, data: favorite });
}));

router.delete('/favorites/:id', asyncHandler(async (req, res) => {
  const [commodityCount, marketCount] = await Promise.all([
    FarmerFavoriteCommodity.destroy({ where: { id: req.params.id, userId: req.user.id } }),
    FarmerFavoriteMarket.destroy({ where: { id: req.params.id, userId: req.user.id } }),
  ]);
  if (!commodityCount && !marketCount) throw new HttpError(404, 'Favorite not found.');
  return res.json({ success: true, message: 'Favorite removed.' });
}));

router.post('/price-alerts', asyncHandler(async (req, res) => {
  const commodityId = text(req.body.commodityId, 'Commodity ID', 80);
  const condition = req.body.condition;
  const targetPrice = Number(req.body.targetPrice);
  const unit = text(req.body.unit, 'Price unit', 40);
  const marketId = req.body.marketId ? assertUuid(req.body.marketId) : null;
  if (!['at_or_above', 'at_or_below'].includes(condition)
    || !Number.isFinite(targetPrice) || targetPrice < 0 || targetPrice > 1e12) {
    throw new HttpError(400, 'Provide a valid alert condition and target price.');
  }
  if (!await Commodity.findOne({ where: { id: commodityId, isActive: true } })) throw new HttpError(404, 'Commodity not found.');
  if (marketId && !await AgriculturalMarket.findOne({ where: { id: marketId, isActive: true } })) throw new HttpError(404, 'Agricultural market not found.');
  const alert = await MarketPriceAlert.create({
    userId: req.user.id, commodityId, marketId, condition, targetPrice, unit,
  });
  return res.status(201).json({ success: true, data: alert });
}));

router.get('/price-alerts', asyncHandler(async (req, res) => {
  const alerts = await MarketPriceAlert.findAll({
    where: { userId: req.user.id },
    order: [['createdAt', 'DESC']],
  });
  return res.json({ success: true, data: alerts });
}));

router.delete('/price-alerts/:id', asyncHandler(async (req, res) => {
  const deleted = await MarketPriceAlert.destroy({
    where: { id: assertUuid(req.params.id), userId: req.user.id },
  });
  if (!deleted) throw new HttpError(404, 'Price alert not found.');
  return res.json({ success: true, message: 'Price alert deleted.' });
}));

module.exports = router;
