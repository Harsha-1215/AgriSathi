const test = require('node:test');
const assert = require('node:assert/strict');
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@127.0.0.1:5432/agrisathi_test';
const { parseArrivalDate, price } = require('../src/services/market/marketPriceService');

test('market provider arrival dates are normalized and invalid dates are rejected', () => {
  assert.equal(parseArrivalDate('17/11/2026'), '2026-11-17');
  assert.equal(parseArrivalDate('2026-11-17'), '2026-11-17');
  assert.throws(() => parseArrivalDate('31/02/2026'), /invalid arrival date/i);
});

test('market prices reject negative, non-finite, and out-of-range values', () => {
  assert.equal(price('1250.5', 'modal price'), 1250.5);
  assert.throws(() => price('-1', 'modal price'), /invalid modal price/i);
  assert.throws(() => price('Infinity', 'modal price'), /invalid modal price/i);
});
