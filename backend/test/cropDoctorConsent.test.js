const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const jwt = require('jsonwebtoken');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@127.0.0.1:5432/agrisathi_test';
process.env.JWT_SECRET = 'crop-doctor-consent-test-secret';
const express = require('express');
const models = require('../src/models');
const cropDoctorRoutes = require('../src/routes/cropDoctorRoutes');
const errorHandler = require('../src/middleware/errorHandler');

test('crop image analysis requires external-processing consent before accessing the image provider', async () => {
  const originalUserFindByPk = models.User.findByPk;
  const originalRoleFindOne = models.UserRole.findOne;
  models.User.findByPk = async () => ({ status: 'active', isVerified: true });
  models.UserRole.findOne = async () => ({ id: 'farmer-role' });
  const app = express();
  app.use('/api/crop-doctor', cropDoctorRoutes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const token = jwt.sign({ sub: 'farmer-1', role: 'farmer' }, process.env.JWT_SECRET);
  try {
    const form = new FormData();
    form.append('cropId', 'tomato');
    form.append('language', 'en');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/crop-doctor/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /consent is required/i);
  } finally {
    models.User.findByPk = originalUserFindByPk;
    models.UserRole.findOne = originalRoleFindOne;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
