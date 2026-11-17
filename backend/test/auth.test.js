const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { requireAuth, requireFarmer } = require('../src/middleware/auth');

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('JWT authentication uses the existing signed cookie and exposes only selected profile fields', () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret-with-sufficient-length';
  const token = jwt.sign({
    sub: 'farmer-42',
    role: 'farmer',
    profile: { name: 'Ravi', district: 'Guntur', privateNote: 'must not be copied' },
  }, process.env.JWT_SECRET);
  const req = {
    cookies: { accessToken: token },
    get: () => '',
  };
  const res = createResponse();
  let continued = false;
  try {
    requireAuth(req, res, () => { continued = true; });
    assert.equal(continued, true);
    assert.deepEqual(req.user, { id: 'farmer-42', role: 'farmer', roles: ['farmer'], profile: { name: 'Ravi', district: 'Guntur' } });
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test('authentication rejects missing and invalid credentials', () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret';
  try {
    const missingResponse = createResponse();
    requireAuth({ cookies: {}, get: () => '' }, missingResponse, () => assert.fail('must not authenticate'));
    assert.equal(missingResponse.statusCode, 401);

    const invalidResponse = createResponse();
    requireAuth({ cookies: { accessToken: 'invalid' }, get: () => '' }, invalidResponse, () => assert.fail('must not authenticate'));
    assert.equal(invalidResponse.statusCode, 401);
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test('farmer-only endpoints reject other authenticated roles', () => {
  const response = createResponse();
  requireFarmer({ user: { role: 'expert' } }, response, () => assert.fail('must not continue'));
  assert.equal(response.statusCode, 403);
});
