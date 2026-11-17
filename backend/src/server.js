require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');
const weather = require('./services/weatherService');

const port = Number(process.env.PORT) || 5001;
const weatherCacheCleanupInterval = 6 * 60 * 60 * 1000;

async function cleanExpiredWeatherCache() {
  try {
    const deleted = await weather.cleanExpiredCache();
    if (deleted > 0) process.stdout.write(`Removed ${deleted} expired weather cache entries.\n`);
  } catch (error) {
    console.error('Expired weather cache cleanup failed:', error.message);
  }
}

async function start() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must match the existing authentication service.');
  await sequelize.authenticate();
  const server = app.listen(port, () => {
    process.stdout.write(`AGRISATHI API is listening on port ${port}.\n`);
  });

  const cacheCleanupTimer = setInterval(cleanExpiredWeatherCache, weatherCacheCleanupInterval);
  cacheCleanupTimer.unref();
  cleanExpiredWeatherCache();

  const shutdown = async () => {
    clearInterval(cacheCleanupTimer);
    server.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error('AGRISATHI API could not start:', error.message);
  process.exitCode = 1;
});
