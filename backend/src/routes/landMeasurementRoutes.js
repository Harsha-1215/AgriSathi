const express = require('express');
const rateLimit = require('express-rate-limit');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const assertUuid = require('../utils/assertUuid');
const { requireAuth, requireFarmer } = require('../middleware/auth');
const { FarmerLandPlot, LandMeasurement, LandMeasurementHistory } = require('../models');
const measurement = require('../services/landMeasurementService');

const router = express.Router();
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

router.use(requireAuth, requireFarmer);

function validatePlotName(value, required = false) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 120) {
    throw new HttpError(400, 'Plot name must contain between 1 and 120 characters.');
  }
  return value.trim();
}

function validateNotes(value) {
  if (value === undefined) return undefined;
  if (value !== null && typeof value !== 'string') throw new HttpError(400, 'Notes must be text.');
  const notes = typeof value === 'string' ? value.trim() : '';
  if (notes.length > 2000) throw new HttpError(400, 'Notes are limited to 2000 characters.');
  return notes || null;
}

function validateMethod(value) {
  if (!['gps', 'map', 'manual'].includes(value)) {
    throw new HttpError(400, 'Choose GPS, map, or manual measurement.');
  }
  return value;
}

function persistedAreaFields(areaSquareMeters) {
  const summary = measurement.areaSummary(areaSquareMeters);
  return {
    areaSquareMeters: summary.areaSquareMeters,
    areaAcres: summary.areaAcres,
    areaCents: summary.areaCents,
    areaHectares: summary.areaHectares,
  };
}

function boundaryFields(method, coordinates, accuracy) {
  if (method === 'manual') {
    throw new HttpError(400, 'Manual measurements must include shape, dimensions, and dimensionUnit.');
  }
  const result = measurement.calculateBoundaryArea(coordinates);
  let gpsAccuracy = null;
  if (method === 'gps') {
    if (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 10000) {
      throw new HttpError(400, 'GPS accuracy must be a positive distance in metres.');
    }
    gpsAccuracy = accuracy;
  }
  return {
    ...persistedAreaFields(result.areaSquareMeters),
    boundaryCoordinates: result.boundaryCoordinates,
    centerLatitude: result.centerLatitude,
    centerLongitude: result.centerLongitude,
    gpsAccuracy,
  };
}

function manualFields(body) {
  const calculated = measurement.calculateManualArea(body.shape, body.dimensions, body.dimensionUnit);
  return {
    ...persistedAreaFields(calculated.areaSquareMeters),
    boundaryCoordinates: null,
    centerLatitude: null,
    centerLongitude: null,
    gpsAccuracy: null,
  };
}

function serializePlot(plot) {
  const result = plot.toJSON();
  for (const key of ['areaSquareMeters', 'areaAcres', 'areaCents', 'areaHectares', 'centerLatitude', 'centerLongitude', 'gpsAccuracy']) {
    if (result[key] !== null && result[key] !== undefined) result[key] = Number(result[key]);
  }
  return result;
}

function measurementResult(areaSquareMeters, detail = {}) {
  return {
    ...measurement.areaSummary(areaSquareMeters),
    ...detail,
    accuracy: 'approximate',
    disclaimer: 'Digital area estimates are not legal or cadastral surveys.',
  };
}

async function saveMeasurement(userId, method, input, result, plotId = null, transaction) {
  return LandMeasurement.create({
    userId,
    plotId,
    measurementMethod: method,
    input,
    result,
    formulaVersion: '1',
  }, transaction ? { transaction } : undefined);
}

async function savePlotHistory(userId, plot, action, transaction) {
  return LandMeasurementHistory.create({
    userId,
    plotId: plot.id,
    action,
    snapshot: serializePlot(plot),
  }, transaction ? { transaction } : undefined);
}

router.get('/units', (req, res) => {
  res.json({ success: true, data: measurement.listUnits() });
});

router.post('/calculate', writeLimiter, asyncHandler(async (req, res) => {
  const calculated = measurement.calculateManualArea(req.body.shape, req.body.dimensions, req.body.dimensionUnit);
  const result = measurementResult(calculated.areaSquareMeters, calculated);
  const history = await saveMeasurement(req.user.id, 'manual', req.body, result);
  return res.json({
    success: true,
    data: { ...result, measurementId: history.id },
  });
}));

for (const shape of ['rectangle', 'square', 'triangle', 'circle']) {
  router.post(`/${shape}`, writeLimiter, asyncHandler(async (req, res) => {
    const calculated = measurement.calculateManualArea(
      shape,
      req.body.dimensions || req.body,
      req.body.dimensionUnit || req.body.unit,
    );
    const result = measurementResult(calculated.areaSquareMeters, calculated);
    const history = await saveMeasurement(req.user.id, 'manual', req.body, result);
    return res.json({ success: true, data: { ...result, measurementId: history.id } });
  }));
}

router.post('/convert', writeLimiter, asyncHandler(async (req, res) => {
  const value = req.body.value;
  const fromUnit = req.body.fromUnit;
  const toUnit = req.body.toUnit;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new HttpError(400, 'Area value must be a number.');
  return res.json({
    success: true,
    data: measurement.convertArea(value, fromUnit, toUnit, req.body.region),
  });
}));

router.get('/location', (req, res) => {
  const { latitude, longitude } = req.user.profile;
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (latitude === undefined || longitude === undefined || !Number.isFinite(lat) || lat < -90 || lat > 90
    || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new HttpError(404, 'No verified farm coordinates are available in your account. Use device GPS or search for the field location.');
  }
  return res.json({
    success: true,
    data: { latitude: lat, longitude: lon, source: 'authenticated farmer profile' },
  });
});

router.post('/boundaries', writeLimiter, asyncHandler(async (req, res) => {
  const result = measurement.calculateBoundaryArea(req.body.boundaryCoordinates);
  const data = measurementResult(result.areaSquareMeters, result);
  const history = await saveMeasurement(req.user.id, 'map', req.body, data);
  return res.json({
    success: true,
    data: { ...data, measurementId: history.id },
  });
}));

router.post('/polygon', writeLimiter, asyncHandler(async (req, res) => {
  const coordinates = req.body.coordinates || req.body.boundaryCoordinates;
  const calculated = measurement.calculateBoundaryArea(coordinates);
  const result = measurementResult(calculated.areaSquareMeters, calculated);
  const history = await saveMeasurement(req.user.id, 'map', req.body, result);
  return res.json({ success: true, data: { ...result, measurementId: history.id } });
}));

router.get('/history', asyncHandler(async (req, res) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 30;
  if (page < 1 || page > 10000 || limit < 1 || limit > 100) {
    throw new HttpError(400, 'Page must be positive and limit must be from 1 to 100.');
  }
  const where = { userId: req.user.id };
  if (req.query.plotId) where.plotId = assertUuid(req.query.plotId);
  if (req.query.method) where.measurementMethod = validateMethod(req.query.method);
  const result = await LandMeasurement.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });
  return res.json({
    success: true,
    data: result.rows,
    pagination: { total: result.count, page, limit },
  });
}));

router.get('/history/:id', asyncHandler(async (req, res) => {
  const record = await LandMeasurement.findOne({
    where: { id: assertUuid(req.params.id), userId: req.user.id },
  });
  if (!record) throw new HttpError(404, 'Measurement history record not found.');
  return res.json({ success: true, data: record });
}));

router.get('/', asyncHandler(async (req, res) => {
  const summaryWhere = { userId: req.user.id };
  const where = { ...summaryWhere };
  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    where.plotName = { [Op.iLike]: `%${req.query.search.trim().slice(0, 120)}%` };
  }
  const sortBy = req.query.sortBy === 'area' ? 'areaSquareMeters' : 'updatedAt';
  const sortDirection = req.query.sortDirection === 'asc' ? 'ASC' : 'DESC';
  const page = Math.max(1, Math.min(1000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 50));
  const [result, totalAreaSquareMeters, plotCount] = await Promise.all([
    FarmerLandPlot.findAndCountAll({
      where,
      order: [[sortBy, sortDirection]],
      limit,
      offset: (page - 1) * limit,
    }),
    FarmerLandPlot.sum('areaSquareMeters', { where: summaryWhere }),
    FarmerLandPlot.count({ where: summaryWhere }),
  ]);
  const total = Number(totalAreaSquareMeters) || 0;
  return res.json({
    success: true,
    data: {
      items: result.rows.map(serializePlot),
      total: result.count,
      page,
      limit,
      summary: {
        plotCount,
        areaSquareMeters: total,
        areaAcres: Math.round((total / measurement.ACRE_SQUARE_METERS) * 1e8) / 1e8,
        areaCents: Math.round((total / (measurement.ACRE_SQUARE_METERS / 100)) * 1e8) / 1e8,
        areaHectares: Math.round((total / 10000) * 1e10) / 1e10,
        areaSquareFeet: Math.round((total / 0.09290304) * 1e4) / 1e4,
        areaSquareYards: Math.round((total / 0.83612736) * 1e4) / 1e4,
      },
    },
  });
}));

router.post('/', writeLimiter, asyncHandler(async (req, res) => {
  const plotName = validatePlotName(req.body.plotName, true);
  const method = validateMethod(req.body.measurementMethod);
  const notes = validateNotes(req.body.notes);
  const fields = method === 'manual'
    ? manualFields(req.body)
    : boundaryFields(method, req.body.boundaryCoordinates, req.body.gpsAccuracy);
  const transaction = await FarmerLandPlot.sequelize.transaction();
  let plot;
  try {
    plot = await FarmerLandPlot.create({
      userId: req.user.id,
      plotName,
      measurementMethod: method,
      notes: notes || null,
      ...fields,
    }, { transaction });
    await savePlotHistory(req.user.id, plot, 'created', transaction);
    await saveMeasurement(
      req.user.id,
      method,
      req.body,
      measurementResult(Number(plot.areaSquareMeters), serializePlot(plot)),
      plot.id,
      transaction,
    );
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
  return res.status(201).json({ success: true, data: serializePlot(plot) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const plot = await FarmerLandPlot.findOne({
    where: { id: assertUuid(req.params.id), userId: req.user.id },
  });
  if (!plot) throw new HttpError(404, 'Land record not found.');
  return res.json({ success: true, data: serializePlot(plot) });
}));

router.put('/:id', writeLimiter, asyncHandler(async (req, res) => {
  const plot = await FarmerLandPlot.findOne({
    where: { id: assertUuid(req.params.id), userId: req.user.id },
  });
  if (!plot) throw new HttpError(404, 'Land record not found.');
  const before = serializePlot(plot);

  const updates = {};
  if (req.body.plotName !== undefined) updates.plotName = validatePlotName(req.body.plotName, true);
  if (req.body.notes !== undefined) updates.notes = validateNotes(req.body.notes);

  if (req.body.measurementMethod !== undefined || req.body.boundaryCoordinates !== undefined
    || req.body.manualMeasurement !== undefined) {
    const method = validateMethod(req.body.measurementMethod || plot.measurementMethod);
    if (method === 'manual') {
      if (!req.body.manualMeasurement) throw new HttpError(400, 'Provide manualMeasurement to recalculate this plot.');
      Object.assign(updates, manualFields(req.body.manualMeasurement));
    } else {
      const coordinates = req.body.boundaryCoordinates || plot.boundaryCoordinates;
      const accuracy = req.body.gpsAccuracy !== undefined ? req.body.gpsAccuracy : Number(plot.gpsAccuracy);
      Object.assign(updates, boundaryFields(method, coordinates, accuracy));
    }
    updates.measurementMethod = method;
  } else if (req.body.gpsAccuracy !== undefined) {
    if (plot.measurementMethod !== 'gps') throw new HttpError(400, 'GPS accuracy applies only to GPS measurements.');
    if (typeof req.body.gpsAccuracy !== 'number' || !Number.isFinite(req.body.gpsAccuracy) || req.body.gpsAccuracy <= 0 || req.body.gpsAccuracy > 10000) {
      throw new HttpError(400, 'GPS accuracy must be a positive distance in metres.');
    }
    updates.gpsAccuracy = req.body.gpsAccuracy;
  }

  const transaction = await FarmerLandPlot.sequelize.transaction();
  try {
    await plot.update(updates, { transaction });
    await LandMeasurementHistory.create({
      userId: req.user.id,
      plotId: plot.id,
      action: 'updated',
      snapshot: { before, after: serializePlot(plot) },
    }, { transaction });
    await saveMeasurement(
      req.user.id,
      plot.measurementMethod,
      req.body,
      measurementResult(Number(plot.areaSquareMeters), serializePlot(plot)),
      plot.id,
      transaction,
    );
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
  return res.json({ success: true, data: serializePlot(plot) });
}));

router.delete('/:id', writeLimiter, asyncHandler(async (req, res) => {
  const plot = await FarmerLandPlot.findOne({
    where: { id: assertUuid(req.params.id), userId: req.user.id },
  });
  if (!plot) throw new HttpError(404, 'Land record not found.');
  const transaction = await FarmerLandPlot.sequelize.transaction();
  try {
    await savePlotHistory(req.user.id, plot, 'deleted', transaction);
    const deleted = await FarmerLandPlot.destroy({
      where: { id: plot.id, userId: req.user.id },
      transaction,
    });
    if (!deleted) throw new HttpError(404, 'Land record not found.');
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
  return res.json({ success: true, message: 'Land record deleted.' });
}));

module.exports = router;
