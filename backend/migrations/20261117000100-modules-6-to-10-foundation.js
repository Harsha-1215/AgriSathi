const modelNames = [
  'WeatherObservation',
  'WeatherForecast',
  'WeatherAdvisory',
  'WeatherCacheMetadata',
  'CommodityCategory',
  'MarketDataSource',
  'Commodity',
  'AgriculturalMarket',
  'MarketPrice',
  'MarketSyncLog',
  'FarmerFavoriteCommodity',
  'FarmerFavoriteMarket',
  'MarketPriceAlert',
  'LandMeasurement',
  'LandMeasurementHistory',
  'LandUnit',
  'RegionalLandUnitConversion',
  'CalculatorReferenceValue',
  'CalculatorUnitConversion',
  'CropPest',
];

function tableName(model) {
  const name = model.getTableName();
  return typeof name === 'string' ? name : name.tableName;
}

function indexFields(index) {
  return (index.fields || []).map((field) => {
    if (typeof field === 'string') return field;
    return field.attribute || field.name || field.field;
  }).filter(Boolean);
}

function hasEquivalentIndex(existingIndexes, index) {
  const expectedFields = indexFields(index);
  return existingIndexes.some((existing) => {
    const actualFields = (existing.fields || []).map((field) => field.attribute || field.name);
    return Boolean(existing.unique) === Boolean(index.unique)
      && expectedFields.length === actualFields.length
      && expectedFields.every((field, position) => field === actualFields[position]);
  });
}

async function ensureModel(queryInterface, model, transaction, createdTables) {
  const name = tableName(model);
  const tables = await queryInterface.showAllTables({ transaction });
  const exists = tables.some((table) => (typeof table === 'string' ? table : table.tableName) === name);
  if (!exists) {
    await queryInterface.createTable(name, model.getAttributes(), { transaction }, model);
    createdTables.push(name);
  }
  let existingIndexes = await queryInterface.showIndex(name, { transaction });
  for (const index of model.options.indexes || []) {
    if (hasEquivalentIndex(existingIndexes, index)) continue;
    await queryInterface.addIndex(name, index.fields, { ...index, transaction });
    existingIndexes = await queryInterface.showIndex(name, { transaction });
  }
}

module.exports = {
  async up({ queryInterface, models, transaction }) {
    const createdTables = [];
    const names = new Set(modelNames);
    const orderedModels = models.sequelize.modelManager.getModelsTopoSortedByForeignKey()
      || modelNames.map((name) => models[name]);
    for (const model of orderedModels) {
      if (names.has(model.name)) await ensureModel(queryInterface, model, transaction, createdTables);
    }
    return { createdTables };
  },

  async down({ queryInterface, transaction, state = { createdTables: [] } }) {
    for (const table of [...state.createdTables].reverse()) {
      await queryInterface.dropTable(table, { transaction });
    }
  },
};
