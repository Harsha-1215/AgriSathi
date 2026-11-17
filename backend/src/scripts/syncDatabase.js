require('dotenv').config();
const models = require('../models');
const { sequelize } = models;
const { seedCropCatalog } = require('../data/cropCatalog');
const { seedPlatformCatalogs } = require('../data/platformCatalogs');
const { migrate } = require('../db/migrate');
const configureEnumSync = require('../db/enumSync');

configureEnumSync(sequelize.getQueryInterface());

async function syncDatabase() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    await migrate();
    await seedCropCatalog(models);
    await seedPlatformCatalogs(models);
    process.stdout.write('AGRISATHI module tables and catalogs are ready.\n');
  } finally {
    await sequelize.close();
  }
}

syncDatabase().catch((error) => {
  process.stderr.write(`Database setup failed: ${error.message}\n`);
  process.exitCode = 1;
});
