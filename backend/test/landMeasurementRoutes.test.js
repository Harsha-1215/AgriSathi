const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@127.0.0.1:5432/agrisathi_test';
process.env.JWT_SECRET = 'land-measurement-test-secret';
const { LandMeasurement } = require('../src/models');
const landMeasurementRoutes = require('../src/routes/landMeasurementRoutes');
const errorHandler = require('../src/middleware/errorHandler');

test('land calculation and conversion endpoints require a farmer session', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/land-measurements', landMeasurementRoutes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const endpoint = `http://127.0.0.1:${address.port}/api/land-measurements/calculate`;
  const dimensions = { shape: 'rectangle', dimensions: { length: 10, width: 20 }, dimensionUnit: 'metre' };
  const originalCreate = LandMeasurement.create;
  LandMeasurement.create = async () => ({ id: '00000000-0000-4000-8000-000000000001' });

  try {
    const unauthenticated = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dimensions),
    });
    assert.equal(unauthenticated.status, 401);

    const expertToken = jwt.sign({ sub: 'expert-1', role: 'expert' }, process.env.JWT_SECRET);
    const forbidden = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${expertToken}` },
      body: JSON.stringify(dimensions),
    });
    assert.equal(forbidden.status, 403);

    const farmerToken = jwt.sign({ sub: 'farmer-1', role: 'farmer' }, process.env.JWT_SECRET);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${farmerToken}` },
      body: JSON.stringify(dimensions),
    });
    assert.equal(response.status, 200);
    const calculation = await response.json();
    assert.equal(calculation.data.areaSquareMeters, 200);
    assert.equal(calculation.data.measurementId, '00000000-0000-4000-8000-000000000001');

    const conversion = await fetch(endpoint.replace('/calculate', '/convert'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${farmerToken}` },
      body: JSON.stringify({ value: 1, fromUnit: 'acre', toUnit: 'cent' }),
    });
    assert.equal(conversion.status, 200);
    assert.equal((await conversion.json()).data.value, 100);
  } finally {
    LandMeasurement.create = originalCreate;
    server.close();
    await once(server, 'close');
  }
});
