const test = require('node:test');
const assert = require('node:assert/strict');
const measurement = require('../src/services/landMeasurementService');

test('calculates manual area using the selected length unit', () => {
  const result = measurement.calculateManualArea(
    'rectangle',
    { length: 10, width: 20 },
    'metre'
  );
  assert.equal(result.areaSquareMeters, 200);
  assert.equal(measurement.areaSummary(result.areaSquareMeters).areaCents, 4.94210763);
});

test('calculates square, triangle, and circle areas', () => {
  const square = measurement.calculateManualArea('square', { side: 10 }, 'foot');
  const triangle = measurement.calculateManualArea('triangle', { base: 10, height: 4 }, 'foot');
  const circle = measurement.calculateManualArea('circle', { radius: 1 }, 'metre');
  assert.equal(square.areaSquareMeters, 9.290304);
  assert.equal(triangle.areaSquareMeters, 1.858061);
  assert.equal(circle.areaSquareMeters, 3.141593);
});

test('converts standard Andhra Pradesh area units', () => {
  const result = measurement.convertArea(1, 'acre', 'cent');
  assert.equal(result.value, 100);
  assert.equal(result.areaSquareMeters, 4046.856422);
  assert.equal(measurement.normalizeAreaUnit('Acres'), 'acre');
  assert.equal(measurement.normalizeAreaUnit('సెంట్లు'), 'cent');
});

test('calculates geodesic area and normalizes a polygon boundary', () => {
  const result = measurement.calculateBoundaryArea([
    [78.5, 17.4],
    [78.501, 17.4],
    [78.501, 17.401],
    [78.5, 17.401],
  ]);
  assert.equal(result.boundaryCoordinates.length, 4);
  assert.ok(result.areaSquareMeters > 10000 && result.areaSquareMeters < 13000);
});

test('rejects invalid and self-crossing boundaries', () => {
  assert.throws(
    () => measurement.calculateBoundaryArea([[181, 17], [78, 17], [78, 18]]),
    /valid longitude and latitude/
  );
  assert.throws(
    () => measurement.calculateBoundaryArea([[0, 0], [1, 1], [0, 1], [1, 0]]),
    /crosses itself/
  );
});

test('requires a configured regional convention for bigha', () => {
  const previousArea = process.env.BIGHA_SQUARE_METERS;
  const previousRegion = process.env.BIGHA_REGION;
  delete process.env.BIGHA_SQUARE_METERS;
  delete process.env.BIGHA_REGION;
  try {
    assert.throws(() => measurement.convertArea(1, 'bigha', 'acre'), /regional conversion is configured/);
  } finally {
    if (previousArea === undefined) delete process.env.BIGHA_SQUARE_METERS;
    else process.env.BIGHA_SQUARE_METERS = previousArea;
    if (previousRegion === undefined) delete process.env.BIGHA_REGION;
    else process.env.BIGHA_REGION = previousRegion;
  }
});

test('converts bigha only for the configured region', () => {
  const previousArea = process.env.BIGHA_SQUARE_METERS;
  const previousRegion = process.env.BIGHA_REGION;
  process.env.BIGHA_SQUARE_METERS = '1000';
  process.env.BIGHA_REGION = 'Example District';
  try {
    assert.equal(measurement.convertArea(1, 'bigha', 'square_metre', 'Example District').value, 1000);
    assert.throws(() => measurement.convertArea(1, 'bigha', 'acre', 'Other Region'), /configured region/);
  } finally {
    if (previousArea === undefined) delete process.env.BIGHA_SQUARE_METERS;
    else process.env.BIGHA_SQUARE_METERS = previousArea;
    if (previousRegion === undefined) delete process.env.BIGHA_REGION;
    else process.env.BIGHA_REGION = previousRegion;
  }
});
