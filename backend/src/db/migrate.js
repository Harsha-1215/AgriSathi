require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { DataTypes } = require('sequelize');
const models = require('../models');
const configureEnumSync = require('./enumSync');

const { sequelize } = models;
const queryInterface = sequelize.getQueryInterface();
configureEnumSync(queryInterface);
const migrationDirectory = path.resolve(__dirname, '../../migrations');
const migrationTable = 'schema_migrations';

async function ensureMigrationTable() {
  const tables = await queryInterface.showAllTables();
  const exists = tables.some((table) => (typeof table === 'string' ? table : table.tableName) === migrationTable);
  if (!exists) {
    await queryInterface.createTable(migrationTable, {
      name: { type: DataTypes.STRING(255), primaryKey: true },
      state: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      executedAt: { type: DataTypes.DATE, allowNull: false },
    });
  }
}

async function runMigration(file, direction, state) {
  const migration = require(path.join(migrationDirectory, file));
  await sequelize.transaction(async (transaction) => {
    if (direction === 'up') {
      const appliedState = await migration.up({ queryInterface, models, transaction });
      await queryInterface.bulkInsert(migrationTable, [{
        name: file,
        state: JSON.stringify(appliedState || {}),
        executedAt: new Date(),
      }], { transaction });
    } else {
      await migration.down({ queryInterface, models, transaction, state });
      await queryInterface.bulkDelete(migrationTable, { name: file }, { transaction });
    }
  });
}

async function migrate(direction = 'up') {
  await sequelize.authenticate();
  await ensureMigrationTable();
  const [applied] = await sequelize.query(`SELECT name, state FROM "${migrationTable}" ORDER BY name`);
  const appliedNames = new Set(applied.map((row) => row.name));
  const files = fs.readdirSync(migrationDirectory).filter((file) => file.endsWith('.js')).sort();

  if (direction === 'down') {
    const latest = files.filter((file) => appliedNames.has(file)).pop();
    if (latest) await runMigration(latest, 'down', applied.find((row) => row.name === latest).state);
    return;
  }
  for (const file of files) {
    if (!appliedNames.has(file)) {
      await runMigration(file, 'up');
      process.stdout.write(`Applied ${file}\n`);
    }
  }
}

if (require.main === module) {
  migrate(process.argv.includes('--down') ? 'down' : 'up')
    .catch((error) => {
      process.stderr.write(`Database migration failed: ${error.message}\n`);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}

module.exports = { migrate, sequelize };
