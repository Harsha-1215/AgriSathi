const { Op } = require('sequelize');
const HttpError = require('../../utils/httpError');
const {
  MarketDataSource,
  MarketPrice,
  MarketPriceAlert,
  MarketSyncLog,
} = require('../../models');
const { getMarketProvider } = require('./marketProvider');
const { normalizeRecord } = require('./marketPriceService');

function alertMatches(alert, price) {
  if (alert.unit !== price.unit) return false;
  const amount = Number(price.modalPrice);
  if (alert.condition === 'at_or_above') return amount >= Number(alert.targetPrice);
  if (alert.condition === 'at_or_below') return amount <= Number(alert.targetPrice);
  return false;
}

async function evaluateAlerts(price) {
  const where = {
    commodityId: price.commodityId,
    isActive: true,
    [Op.or]: [{ marketId: null }, { marketId: price.marketId }],
  };
  const alerts = await MarketPriceAlert.findAll({ where });
  for (const alert of alerts) {
    if (alert.lastTriggeredPriceId === price.id || !alertMatches(alert, price)) continue;
    await alert.update({ lastTriggeredAt: new Date(), lastTriggeredPriceId: price.id });
  }
}

async function synchronize(sourceId, { limit = 100, offset = 0 } = {}) {
  const source = await MarketDataSource.findOne({
    where: { id: sourceId, isActive: true, isAuthorized: true },
  });
  if (!source) throw new HttpError(404, 'An active, authorized market data source was not found.');
  const provider = getMarketProvider(source);
  const log = await MarketSyncLog.create({
    sourceId: source.id,
    status: 'running',
    startedAt: new Date(),
  });
  let recordsFetched = 0;
  let recordsStored = 0;
  const errors = [];
  try {
    const result = await provider.fetchRecords({ resourceId: source.resourceId, limit, offset });
    recordsFetched = result.records.length;
    for (const record of result.records) {
      try {
        const normalized = await normalizeRecord(record, source);
        const [price, created] = await MarketPrice.findOrCreate({
          where: { sourceId: source.id, sourceRecordId: normalized.price.sourceRecordId },
          defaults: normalized.price,
        });
        if (created) {
          recordsStored += 1;
          await evaluateAlerts(price);
        }
      } catch (error) {
        errors.push({ message: error.message.slice(0, 300) });
      }
    }
    await source.update({ lastFetchedAt: new Date() });
    await log.update({
      status: errors.length ? 'completed_with_errors' : 'completed',
      completedAt: new Date(),
      recordsFetched,
      recordsStored,
      errors: errors.slice(0, 100),
    });
    return { recordsFetched, recordsStored, errors: errors.slice(0, 100), total: result.total };
  } catch (error) {
    await log.update({
      status: 'failed',
      completedAt: new Date(),
      recordsFetched,
      recordsStored,
      errors: [{ message: error.message.slice(0, 300) }],
    });
    throw error;
  }
}

module.exports = { synchronize };
