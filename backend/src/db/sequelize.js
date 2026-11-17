const { Sequelize } = require('sequelize');

function createSequelize() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL must be configured.');

  return new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' && process.env.SQL_LOGGING === 'true' ? console.log : false,
    dialectOptions: process.env.DB_SSL === 'true'
      ? { ssl: { require: true, rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } }
      : {},
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  });
}

module.exports = createSequelize();
