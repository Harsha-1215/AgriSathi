const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const previousDatabaseUrl = process.env.DATABASE_URL;
if (!previousDatabaseUrl) process.env.DATABASE_URL = 'postgres://farmer:local-only@127.0.0.1:5432/agrisathi_test';
const app = require('../src/app');
const livestockService = require('../src/services/livestockService');
if (!previousDatabaseUrl) delete process.env.DATABASE_URL;

async function withServer(run) {
  const server = app.listen(0);
  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test('livestock routes use the existing authentication gate', async () => {
  await withServer(async (baseUrl) => {
    const paths = [
      '/api/livestock',
      '/api/livestock/categories',
      '/api/livestock/enquiries',
      '/api/livestock/wishlist',
      '/api/admin/livestock',
      '/api/admin/livestock/dashboard',
    ];
    const responses = await Promise.all(paths.map((path) => fetch(`${baseUrl}${path}`)));
    assert.deepEqual(responses.map((response) => response.status), paths.map(() => 401));
  });
});

test('livestock seller and administrator actions enforce existing account roles', async () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'livestock-test-secret';
  const buyerToken = jwt.sign({ sub: 'buyer-10', role: 'buyer' }, process.env.JWT_SECRET);
  const farmerToken = jwt.sign({ sub: 'farmer-11', role: 'farmer' }, process.env.JWT_SECRET);
  try {
    await withServer(async (baseUrl) => {
      const createListing = await fetch(`${baseUrl}/api/livestock`, {
        method: 'POST',
        headers: { authorization: `Bearer ${buyerToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const adminDashboard = await fetch(`${baseUrl}/api/admin/livestock/dashboard`, {
        headers: { authorization: `Bearer ${farmerToken}` },
      });
      const invalidSellerFilter = await fetch(`${baseUrl}/api/livestock/seller/listings?status=unknown`, {
        headers: { authorization: `Bearer ${farmerToken}` },
      });
      const invalidListingId = await fetch(`${baseUrl}/api/livestock/not-a-uuid`, {
        headers: { authorization: `Bearer ${farmerToken}` },
      });
      assert.equal(createListing.status, 403);
      assert.equal(adminDashboard.status, 403);
      assert.equal(invalidSellerFilter.status, 400);
      assert.equal(invalidListingId.status, 400);
    });
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test('livestock identifiers and listing values reject malformed input', () => {
  assert.throws(() => livestockService.uuid('not-a-uuid', 'Listing'), /valid identifier/i);
  assert.throws(() => livestockService.requiredNumber('NaN', 'Price', { min: 1 }), /must be a number/i);
  assert.throws(() => livestockService.optionalNumber('-1', 'Age'), /must be a number/i);
  assert.throws(() => livestockService.date('2025-02-30', 'Vaccination date', { required: true }), /not a valid date/i);
  assert.equal(livestockService.text('  Nellore  ', 'Breed', 20), 'Nellore');
});

test('public livestock serialization excludes private seller and precise location details', () => {
  const listing = {
    id: 'listing-id',
    sellerId: 'seller-22',
    listingName: 'Cow',
    ageMonths: 36,
    gender: 'female',
    weightKg: '320.00',
    price: '42000.00',
    locationPublic: false,
    state: 'Andhra Pradesh',
    district: 'Guntur',
    mandal: 'Private mandal',
    village: 'Private village',
    pinCode: '522001',
    contactPreference: 'platform',
    LivestockCategory: { id: 'category-id', name: 'Cattle', translations: { en: 'Cattle' } },
    LivestockBreed: { id: 'breed-id', name: 'Nellore' },
    LivestockSellerProfile: {
      userId: 'seller-22',
      sellerName: 'Local farmer',
      contactPhone: '+919999999999',
      allowPhoneContact: true,
      verificationStatus: 'verified',
      pinCode: '522001',
    },
    LivestockImages: [],
    LivestockHealthRecords: [{ id: 'health-id', recordDate: '2025-02-01', note: 'Seller note', certificatePublicId: 'private/cert' }],
  };
  const result = livestockService.listingView(listing, { profileId: 'buyer-5' });
  assert.deepEqual(result.location, { state: 'Andhra Pradesh', district: 'Guntur' });
  assert.equal(result.seller.phone, null);
  assert.equal(result.isOwner, false);
  assert.equal(result.healthRecords[0].certificateAvailable, true);
  assert.equal('certificatePublicId' in result.healthRecords[0], false);
  assert.equal('pinCode' in result.seller, false);
  assert.equal('village' in result.location, false);
});
