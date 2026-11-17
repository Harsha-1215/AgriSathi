const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const previousDatabaseUrl = process.env.DATABASE_URL;
if (!previousDatabaseUrl) process.env.DATABASE_URL = 'postgres://farmer:local-only@127.0.0.1:5432/agrisathi_test';
const app = require('../src/app');
const {
  paiseFor,
  productView,
  validateImageSignature,
} = require('../src/services/marketplaceService');
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

test('marketplace and administrator APIs use the existing authentication gate', async () => {
  await withServer(async (baseUrl) => {
    const paths = [
      '/api/marketplace/categories',
      '/api/marketplace/cart',
      '/api/marketplace/orders',
      '/api/admin/marketplace/dashboard',
    ];
    const responses = await Promise.all(paths.map((path) => fetch(`${baseUrl}${path}`)));
    assert.deepEqual(responses.map((response) => response.status), paths.map(() => 401));
  });
});

test('unconfigured online payment webhook cannot report a successful payment', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/marketplace/payments/webhook`, { method: 'POST' });
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.success, false);
  });
});

test('checkout rejects online payment and disabled COD before creating any order', async () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousCodSetting = process.env.MARKETPLACE_COD_ENABLED;
  process.env.JWT_SECRET = 'marketplace-test-secret';
  process.env.MARKETPLACE_COD_ENABLED = 'false';
  const token = jwt.sign({ sub: 'farmer-12', role: 'farmer' }, process.env.JWT_SECRET);
  try {
    await withServer(async (baseUrl) => {
      const online = await fetch(`${baseUrl}/api/marketplace/orders`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ paymentMethod: 'razorpay' }),
      });
      const cod = await fetch(`${baseUrl}/api/marketplace/orders`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ paymentMethod: 'cod' }),
      });
      assert.equal(online.status, 503);
      assert.equal(cod.status, 503);
    });
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    if (previousCodSetting === undefined) delete process.env.MARKETPLACE_COD_ENABLED;
    else process.env.MARKETPLACE_COD_ENABLED = previousCodSetting;
  }
});

test('seller operations reject buyers and malformed UUIDs are validated before database queries', async () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'marketplace-test-secret';
  const token = jwt.sign({ sub: 'buyer-21', role: 'buyer' }, process.env.JWT_SECRET);
  try {
    await withServer(async (baseUrl) => {
      const profile = await fetch(`${baseUrl}/api/marketplace/seller/profile`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const product = await fetch(`${baseUrl}/api/marketplace/products/not-a-uuid`, {
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(profile.status, 403);
      assert.equal(product.status, 400);
    });
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test('marketplace serialization hides seller license and precise public address details', () => {
  const result = productView({
    id: 'product-1',
    productName: 'Seed',
    price: '12.50',
    unit: 'kg',
    availableQuantity: '8.000',
    minOrderQuantity: '1.000',
    location: undefined,
    state: 'Andhra Pradesh',
    district: 'Guntur',
    village: 'Private village',
    pinCode: '522001',
    SellerProfile: {
      businessName: 'Farm supplies',
      verificationStatus: 'verified',
      licenseNumber: 'private-license',
      state: 'Andhra Pradesh',
      district: 'Guntur',
      village: 'Private village',
      pinCode: '522001',
    },
    ProductImages: [],
  });
  assert.deepEqual(result.location, { state: 'Andhra Pradesh', district: 'Guntur' });
  assert.deepEqual(result.seller.location, { state: 'Andhra Pradesh', district: 'Guntur' });
  assert.equal(Object.hasOwn(result.seller, 'licenseNumber'), false);
});

test('marketplace money and image helpers validate exact input data', () => {
  assert.equal(paiseFor('12.34', 1.5), 1851);
  assert.throws(() => validateImageSignature({
    buffer: Buffer.from('not-an-image'),
  }), /valid JPEG, PNG, or WebP/);
  assert.doesNotThrow(() => validateImageSignature({
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
  }));
});
