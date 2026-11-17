const { createHash } = require('node:crypto');
const { Op } = require('sequelize');
const HttpError = require('../../utils/httpError');
const { Commodity, AgriculturalMarket } = require('../../models');

function text(value, field, max = 180) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpError(422, `The source record is missing a valid ${field}.`);
  }
  return value.trim();
}

function price(value, field) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1e12) {
    throw new HttpError(422, `The source record has an invalid ${field}.`);
  }
  return parsed;
}

function parseArrivalDate(value) {
  const source = String(value || '').trim();
  const ddmmyyyy = source.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const normalized = ddmmyyyy ? `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}` : source;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(date.getTime())
    || date.toISOString().slice(0, 10) !== normalized) {
    throw new HttpError(422, 'The source record has an invalid arrival date.');
  }
  return normalized;
}

function stableHash(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function findCommodity(name) {
  const normalized = text(name, 'commodity name').toLocaleLowerCase();
  const candidates = await Commodity.findAll({ where: { isActive: true } });
  const commodity = candidates.find((item) => {
    const labels = [item.name, item.localName, ...Object.values(item.translations || {})];
    return labels.some((label) => typeof label === 'string' && label.trim().toLocaleLowerCase() === normalized);
  });
  return commodity || null;
}

async function normalizeRecord(raw, source) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(422, 'The source record must be an object.');
  const state = text(raw.state, 'state', 120);
  const district = text(raw.district, 'district', 120);
  const marketName = text(raw.market || raw.market_name, 'market name');
  const commodityName = text(raw.commodity || raw.commodity_name, 'commodity name');
  const commodity = await findCommodity(commodityName);
  if (!commodity) throw new HttpError(422, `The source commodity "${commodityName}" is not mapped to the approved commodity catalog.`);

  const arrivalDate = parseArrivalDate(raw.arrival_date || raw.arrivalDate || raw.date);
  const minimumPrice = price(raw.min_price ?? raw.minimum_price, 'minimum price');
  const maximumPrice = price(raw.max_price ?? raw.maximum_price, 'maximum price');
  const modalPrice = price(raw.modal_price, 'modal price');
  if (minimumPrice > maximumPrice || modalPrice < minimumPrice || modalPrice > maximumPrice) {
    throw new HttpError(422, 'The source record contains inconsistent minimum, maximum, and modal prices.');
  }
  const unit = text(raw.unit || source.config?.priceUnit, 'price unit', 40);
  const currency = text(raw.currency || source.config?.currency || 'INR', 'currency', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new HttpError(422, 'The source record has an invalid currency.');

  const providerMarketCode = typeof raw.market_code === 'string' && raw.market_code.trim()
    ? raw.market_code.trim()
    : `${marketName}|${district}|${state}`.toLocaleLowerCase();
  const marketCode = `ogd-${stableHash(providerMarketCode).slice(0, 32)}`;
  const [market] = await AgriculturalMarket.findOrCreate({
    where: { marketCode },
    defaults: {
      marketCode,
      name: marketName,
      state,
      district,
      mandal: typeof raw.mandal === 'string' ? raw.mandal.slice(0, 120) : null,
      sourceId: source.id,
      isActive: true,
    },
  });
  const sourceRecordId = typeof raw.id === 'string' || typeof raw.id === 'number'
    ? String(raw.id)
    : stableHash(JSON.stringify({
      commodityId: commodity.id,
      marketCode,
      arrivalDate,
      minimumPrice,
      maximumPrice,
      modalPrice,
      unit,
      variety: raw.variety || null,
      grade: raw.grade || null,
    }));

  return {
    commodity,
    market,
    price: {
      commodityId: commodity.id,
      marketId: market.id,
      arrivalDate,
      minimumPrice,
      maximumPrice,
      modalPrice,
      unit,
      currency,
      sourceId: source.id,
      sourceRecordId,
      fetchedAt: new Date(),
      rawRecord: raw,
    },
  };
}

function validatePriceRange(query) {
  const minimum = query.minPrice === undefined ? undefined : Number(query.minPrice);
  const maximum = query.maxPrice === undefined ? undefined : Number(query.maxPrice);
  if ((minimum !== undefined && (!Number.isFinite(minimum) || minimum < 0))
    || (maximum !== undefined && (!Number.isFinite(maximum) || maximum < 0))
    || (minimum !== undefined && maximum !== undefined && minimum > maximum)) {
    throw new HttpError(400, 'Provide a valid minimum and maximum price range.');
  }
  return { minimum, maximum };
}

function priceQuery(query) {
  const where = {};
  if (query.commodityId) where.commodityId = String(query.commodityId).slice(0, 80);
  if (query.marketId) where.marketId = String(query.marketId);
  if (query.from || query.to) {
    const range = {};
    for (const [key, value] of [['from', query.from], ['to', query.to]]) {
      if (value === undefined) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
        throw new HttpError(400, 'Dates must use YYYY-MM-DD format.');
      }
      range[key === 'from' ? Op.gte : Op.lte] = String(value);
    }
    where.arrivalDate = range;
  }
  const { minimum, maximum } = validatePriceRange(query);
  if (minimum !== undefined) where.modalPrice = { ...(where.modalPrice || {}), [Op.gte]: minimum };
  if (maximum !== undefined) where.modalPrice = { ...(where.modalPrice || {}), [Op.lte]: maximum };
  return where;
}

function validatePagination(query) {
  const limit = Number.parseInt(query.limit, 10) || 30;
  const page = Number.parseInt(query.page, 10) || 1;
  if (limit < 1 || limit > 100 || page < 1 || page > 10000) {
    throw new HttpError(400, 'Page must be positive and limit must be from 1 to 100.');
  }
  return { limit, page, offset: (page - 1) * limit };
}

module.exports = {
  normalizeRecord,
  priceQuery,
  validatePagination,
  parseArrivalDate,
  price,
  text,
};
