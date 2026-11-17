const area = require('@turf/area').default || require('@turf/area');
const kinks = require('@turf/kinks').default || require('@turf/kinks');
const { polygon } = require('@turf/helpers');
const HttpError = require('../utils/httpError');

const ACRE_SQUARE_METERS = 4046.8564224;
const MAX_AREA_SQUARE_METERS = 999999999999;
const unitDefinitions = {
  square_metre: { label: 'Square metres', squareMeters: 1 },
  square_foot: { label: 'Square feet', squareMeters: 0.09290304 },
  square_yard: { label: 'Square yards', squareMeters: 0.83612736 },
  acre: { label: 'Acres', squareMeters: ACRE_SQUARE_METERS },
  cent: { label: 'Cents', squareMeters: ACRE_SQUARE_METERS / 100 },
  hectare: { label: 'Hectares', squareMeters: 10000 },
  are: { label: 'Ares', squareMeters: 100 },
  guntha: { label: 'Guntha', squareMeters: ACRE_SQUARE_METERS / 40 },
  bigha: { label: 'Bigha (regional)', squareMeters: null },
};

const lengthUnits = {
  metre: 1,
  foot: 0.3048,
  yard: 0.9144,
};

function round(value, places = 8) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function getUnitDefinition(code, region) {
  const definition = unitDefinitions[code];
  if (!definition) throw new HttpError(400, 'Choose a supported land area unit.');
  if (code !== 'bigha') return definition;

  const configuredArea = Number(process.env.BIGHA_SQUARE_METERS);
  const configuredRegion = String(process.env.BIGHA_REGION || '').trim();
  if (!Number.isFinite(configuredArea) || configuredArea <= 0 || !configuredRegion) {
    throw new HttpError(422, 'Bigha conversion is unavailable until a regional conversion is configured.');
  }
  if (typeof region !== 'string' || region.trim().toLowerCase() !== configuredRegion.toLowerCase()) {
    throw new HttpError(422, `Bigha conversion requires the configured region: ${configuredRegion}.`);
  }
  return { ...definition, squareMeters: configuredArea, region: configuredRegion };
}

function listUnits() {
  const bighaArea = Number(process.env.BIGHA_SQUARE_METERS);
  const bighaRegion = String(process.env.BIGHA_REGION || '').trim();
  return Object.entries(unitDefinitions).map(([code, value]) => ({
    code,
    label: value.label,
    available: code !== 'bigha' || (Number.isFinite(bighaArea) && bighaArea > 0 && Boolean(bighaRegion)),
    region: code === 'bigha' && bighaArea > 0 ? bighaRegion : null,
  }));
}

function normalizeAreaUnit(value, region) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, 'Choose a supported land area unit.');
  const normalized = value.trim().toLowerCase();
  const aliases = {
    acres: 'acre',
    hectares: 'hectare',
    cents: 'cent',
    'square metres': 'square_metre',
    'square meters': 'square_metre',
    'square feet': 'square_foot',
    'square yards': 'square_yard',
    'एकड़': 'acre',
    'हेक्टेयर': 'hectare',
    'सेंट': 'cent',
    'ఎకరాలు': 'acre',
    'హెక్టార్లు': 'hectare',
    'సెంట్లు': 'cent',
  };
  const code = aliases[normalized] || normalized;
  getUnitDefinition(code, region);
  return code;
}

function convertArea(value, fromUnit, toUnit, region) {
  if (!Number.isFinite(value) || value <= 0 || value > 1e15) {
    throw new HttpError(400, 'Enter a finite area greater than zero.');
  }
  const from = getUnitDefinition(fromUnit, region);
  const to = getUnitDefinition(toUnit, region);
  const squareMeters = value * from.squareMeters;
  if (!Number.isFinite(squareMeters)) throw new HttpError(400, 'The converted area is outside the supported range.');
  return {
    value: round(squareMeters / to.squareMeters),
    fromUnit,
    toUnit,
    region: fromUnit === 'bigha' || toUnit === 'bigha' ? region.trim() : null,
    formula: `${value} ${from.label} x ${from.squareMeters} m2 per unit / ${to.squareMeters} m2 per ${to.label}`,
    areaSquareMeters: round(squareMeters, 6),
  };
}

function calculateManualArea(shape, dimensions, unit) {
  if (!Object.prototype.hasOwnProperty.call(lengthUnits, unit)) {
    throw new HttpError(400, 'Choose metres, feet, or yards for dimensions.');
  }
  const values = dimensions && typeof dimensions === 'object' ? dimensions : {};
  const requiredByShape = {
    rectangle: ['length', 'width'],
    square: ['side'],
    triangle: ['base', 'height'],
    circle: ['radius'],
  };
  const required = requiredByShape[shape];
  if (!required) throw new HttpError(400, 'Choose rectangle, square, triangle, or circle.');
  for (const key of required) {
    if (typeof values[key] !== 'number' || !Number.isFinite(values[key]) || values[key] <= 0 || values[key] > 1000000) {
      throw new HttpError(400, `Enter a valid positive ${key}.`);
    }
  }

  const metres = Object.fromEntries(required.map((key) => [key, values[key] * lengthUnits[unit]]));
  let areaSquareMeters;
  let formula;
  if (shape === 'rectangle') {
    areaSquareMeters = metres.length * metres.width;
    formula = 'length x width';
  } else if (shape === 'square') {
    areaSquareMeters = metres.side ** 2;
    formula = 'side x side';
  } else if (shape === 'triangle') {
    areaSquareMeters = 0.5 * metres.base * metres.height;
    formula = '(base x height) / 2';
  } else {
    areaSquareMeters = Math.PI * metres.radius ** 2;
    formula = 'pi x radius squared';
  }
  if (!Number.isFinite(areaSquareMeters) || areaSquareMeters <= 0 || areaSquareMeters > MAX_AREA_SQUARE_METERS) {
    throw new HttpError(400, 'The calculated area is outside the supported range.');
  }
  return {
    shape,
    dimensions: values,
    dimensionUnit: unit,
    areaSquareMeters: round(areaSquareMeters, 6),
    formula,
    measurementMethod: 'manual',
  };
}

function normalizeBoundaryCoordinates(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 3 || coordinates.length > 1000) {
    throw new HttpError(400, 'A field boundary must contain between 3 and 1000 points.');
  }
  const points = coordinates.map((coordinate) => {
    if (!Array.isArray(coordinate) || coordinate.length !== 2) {
      throw new HttpError(400, 'Boundary points must be [longitude, latitude] pairs.');
    }
    const [longitude, latitude] = coordinate;
    if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
      || typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new HttpError(400, 'Boundary coordinates must be valid longitude and latitude values.');
    }
    return [longitude, latitude];
  });

  const openPoints = points.length > 3 && points[0][0] === points[points.length - 1][0]
    && points[0][1] === points[points.length - 1][1]
    ? points.slice(0, -1)
    : points;
  const uniquePoints = new Set(openPoints.map(([longitude, latitude]) => `${longitude},${latitude}`));
  if (uniquePoints.size < 3) throw new HttpError(400, 'A field boundary requires at least 3 distinct points.');
  if (uniquePoints.size !== openPoints.length) throw new HttpError(400, 'A field boundary cannot repeat a boundary point.');
  for (let index = 0; index < openPoints.length; index += 1) {
    const current = openPoints[index];
    const next = openPoints[(index + 1) % openPoints.length];
    if (current[0] === next[0] && current[1] === next[1]) {
      throw new HttpError(400, 'A field boundary cannot contain consecutive duplicate points.');
    }
  }
  return openPoints;
}

function calculateBoundaryArea(coordinates) {
  const points = normalizeBoundaryCoordinates(coordinates);
  const ring = [...points, points[0]];
  const feature = polygon([ring]);
  if (kinks(feature).features.length) {
    throw new HttpError(400, 'The boundary crosses itself. Adjust the points so the field outline does not overlap.');
  }
  const areaSquareMeters = area(feature);
  if (!Number.isFinite(areaSquareMeters) || areaSquareMeters <= 0 || areaSquareMeters > MAX_AREA_SQUARE_METERS) {
    throw new HttpError(400, 'The boundary does not enclose a measurable area.');
  }
  const center = points.reduce((result, [longitude, latitude]) => ({
    longitude: result.longitude + longitude / points.length,
    latitude: result.latitude + latitude / points.length,
  }), { longitude: 0, latitude: 0 });
  return {
    areaSquareMeters: round(areaSquareMeters, 6),
    boundaryCoordinates: points,
    centerLatitude: round(center.latitude, 7),
    centerLongitude: round(center.longitude, 7),
  };
}

function areaSummary(areaSquareMeters) {
  if (typeof areaSquareMeters !== 'number' || !Number.isFinite(areaSquareMeters) || areaSquareMeters <= 0) {
    throw new HttpError(400, 'Area must be a finite value greater than zero square metres.');
  }
  return {
    areaSquareMeters: round(areaSquareMeters, 6),
    areaAcres: round(areaSquareMeters / ACRE_SQUARE_METERS, 8),
    areaCents: round(areaSquareMeters / (ACRE_SQUARE_METERS / 100), 8),
    areaHectares: round(areaSquareMeters / 10000, 10),
    areaSquareFeet: round(areaSquareMeters / unitDefinitions.square_foot.squareMeters, 4),
    areaSquareYards: round(areaSquareMeters / unitDefinitions.square_yard.squareMeters, 4),
  };
}

module.exports = {
  ACRE_SQUARE_METERS,
  MAX_AREA_SQUARE_METERS,
  listUnits,
  normalizeAreaUnit,
  convertArea,
  calculateManualArea,
  normalizeBoundaryCoordinates,
  calculateBoundaryArea,
  areaSummary,
};
