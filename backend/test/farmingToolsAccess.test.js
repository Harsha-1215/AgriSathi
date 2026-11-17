const test = require('node:test');
const assert = require('node:assert/strict');
const previousDatabaseUrl = process.env.DATABASE_URL;
if (!previousDatabaseUrl) process.env.DATABASE_URL = 'postgres://farmer:local-only@127.0.0.1:5432/agrisathi_test';
const app = require('../src/app');
if (!previousDatabaseUrl) delete process.env.DATABASE_URL;

async function withServer(run) {
  const server = app.listen(0);
  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('calculator history and calculations require the existing farmer authentication', async () => {
  await withServer(async (baseUrl) => {
    const history = await fetch(`${baseUrl}/api/calculators/history`);
    const calculation = await fetch(`${baseUrl}/api/calculators/seed/calculate`, { method: 'POST' });
    assert.equal(history.status, 401);
    assert.equal(calculation.status, 401);
  });
});

test('crop knowledge and admin publishing APIs require authentication', async () => {
  await withServer(async (baseUrl) => {
    const catalog = await fetch(`${baseUrl}/api/crop-knowledge/crops`);
    const publishing = await fetch(`${baseUrl}/api/admin/crop-knowledge/knowledge`);
    assert.equal(catalog.status, 401);
    assert.equal(publishing.status, 401);
  });
});

test('weather, market, land, and crop APIs require a farmer session', async () => {
  await withServer(async (baseUrl) => {
    const paths = [
      '/api/weather/forecast',
      '/api/market/prices',
      '/api/land-measurements',
      '/api/crop-knowledge/search?q=rice',
    ];
    const responses = await Promise.all(paths.map((path) => fetch(`${baseUrl}${path}`)));
    assert.deepEqual(responses.map((response) => response.status), paths.map(() => 401));
  });
});

test('government scheme and Agri Shorts endpoints require the existing authenticated session', async () => {
  await withServer(async (baseUrl) => {
    const paths = [
      '/api/government-schemes',
      '/api/government-schemes/categories',
      '/api/scheme-applications',
      '/api/agri-shorts/videos',
      '/api/admin/government-schemes',
      '/api/admin/agri-shorts/videos',
    ];
    const responses = await Promise.all(paths.map((path) => fetch(`${baseUrl}${path}`)));
    assert.deepEqual(responses.map((response) => response.status), paths.map(() => 401));
  });
});
