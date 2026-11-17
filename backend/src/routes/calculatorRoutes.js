const express = require('express');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { requireAuth, requireFarmer } = require('../middleware/auth');
const { CalculatorHistory, AgriculturalRecommendation, Crop, FarmerLandPlot } = require('../models');
const calculator = require('../services/calculatorService');
const assertUuid = require('../utils/assertUuid');

const router = express.Router();
router.use(requireAuth, requireFarmer);

async function saveCalculationHistory(req, calculated) {
  const cropId = typeof req.body.cropId === 'string' ? req.body.cropId.trim().slice(0, 80) : null;
  if (cropId && !await Crop.findOne({ where: { id: cropId, isActive: true } })) {
    throw new HttpError(400, 'Choose a crop from the crop catalog.');
  }
  const plotId = typeof req.body.plotId === 'string' ? req.body.plotId.trim() : null;
  if (plotId) {
    assertUuid(plotId);
    const plot = await FarmerLandPlot.findOne({ where: { id: plotId, userId: req.user.id }, attributes: ['id'] });
    if (!plot) throw new HttpError(400, 'Choose one of your saved land plots.');
  }
  return CalculatorHistory.create({
    userId: req.user.id,
    calculatorType: calculated.type,
    formulaVersion: calculated.formulaVersion || '1',
    cropId,
    title: typeof req.body.title === 'string' && req.body.title.trim()
      ? req.body.title.trim().slice(0, 160)
      : calculated.title,
    inputs: calculated.inputs,
    result: { formula: calculated.formula, ...calculated.result },
  });
}

router.get('/supported', (req, res) => res.json({
  success: true,
  data: {
    calculators: Object.entries(calculator.TITLES).map(([id, title]) => ({ id, title })),
    areaUnits: Object.keys(calculator.AREA_UNITS_TO_SQUARE_METRES),
    note: 'Bigha is not included because its conversion varies by region.',
  },
}));

const conversionHandler = asyncHandler(async (req, res) => {
  const amount = Number(req.body.amount);
  const fromUnit = req.body.fromUnit;
  const fromFactor = calculator.AREA_UNITS_TO_SQUARE_METRES[fromUnit];
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12 || !fromFactor) {
    throw new HttpError(400, 'Enter a positive area and a supported source unit.');
  }
  const squareMetres = amount * fromFactor;
  if (!Number.isFinite(squareMetres)) throw new HttpError(400, 'The converted area is outside the supported range.');
  const conversions = Object.fromEntries(Object.entries(calculator.AREA_UNITS_TO_SQUARE_METRES)
    .map(([unit, factor]) => [unit, squareMetres / factor]));
  return res.json({ success: true, data: { amount, fromUnit, squareMetres, conversions } });
});

router.post(['/convert', '/unit-conversion'], conversionHandler);

router.get('/recommendations', asyncHandler(async (req, res) => {
  const where = { isPublished: true };
  if (req.query.cropId) where.cropId = String(req.query.cropId).slice(0, 80);
  if (req.query.type) {
    const supportedTypes = ['seed', 'fertilizer', 'irrigation', 'spacing', 'yield'];
    if (!supportedTypes.includes(req.query.type)) throw new HttpError(400, 'Choose a supported recommendation type.');
    where.recommendationType = String(req.query.type);
  }
  where[Op.or] = req.query.state
    ? [{ state: null }, { state: { [Op.iLike]: String(req.query.state).slice(0, 120) } }]
    : [{ state: null }];
  const rows = await AgriculturalRecommendation.findAll({
    where,
    include: [{ model: Crop, attributes: ['id', 'name', 'translations'] }],
    order: [['verifiedAt', 'DESC']],
    limit: 100,
  });
  return res.json({ success: true, data: rows });
}));

async function persistCalculation(req, res, calculated) {
  const history = await saveCalculationHistory(req, calculated);
  return res.status(201).json({
    success: true,
    data: {
      id: history.id,
      calculatorType: history.calculatorType,
      formulaVersion: history.formulaVersion,
      title: history.title,
      cropId: history.cropId,
      inputs: history.inputs,
      result: history.result,
      createdAt: history.createdAt,
    },
  });
}

for (const [path, type] of Object.entries({
  seed: 'seed',
  fertilizer: 'fertilizer',
  pesticide: 'pesticide',
  irrigation: 'irrigation',
  'crop-spacing': 'spacing',
  yield: 'yield',
  investment: 'expenses',
  'profit-loss': 'profit-loss',
})) {
  router.post(`/${path}`, asyncHandler(async (req, res) => {
    return persistCalculation(req, res, calculator.calculate(type, req.body));
  }));
}

router.post('/loan/simple-interest', asyncHandler(async (req, res) => {
  const result = calculator.calculateSimpleInterest(req.body);
  return persistCalculation(req, res, {
    type: 'loan', title: 'Simple interest', formula: result.formula, formulaVersion: '1',
    inputs: { ...req.body, loanCalculation: 'simple-interest' }, result,
  });
}));

router.post('/loan/compound-interest', asyncHandler(async (req, res) => {
  const result = calculator.calculateCompoundInterest(req.body);
  return persistCalculation(req, res, {
    type: 'loan', title: 'Compound interest', formula: result.formula, formulaVersion: '1',
    inputs: { ...req.body, loanCalculation: 'compound-interest' }, result,
  });
}));

router.post('/loan/emi', asyncHandler(async (req, res) => {
  const calculated = calculator.calculate('loan', req.body);
  return persistCalculation(req, res, calculated);
}));

router.post('/:type/calculate', asyncHandler(async (req, res) => {
  const calculated = calculator.calculate(req.params.type, req.body);
  return persistCalculation(req, res, calculated);
}));

router.post('/history', asyncHandler(async (req, res) => {
  const type = req.body.calculatorType;
  if (!Object.prototype.hasOwnProperty.call(calculator.TITLES, type)) {
    throw new HttpError(400, 'Choose a supported calculator type.');
  }
  const inputs = req.body.inputs;
  let calculated;
  if (type === 'loan' && inputs && inputs.loanCalculation === 'simple-interest') {
    const result = calculator.calculateSimpleInterest(inputs);
    calculated = {
      type, title: 'Simple interest', formula: result.formula, formulaVersion: '1', inputs, result,
    };
  } else if (type === 'loan' && inputs && inputs.loanCalculation === 'compound-interest') {
    const result = calculator.calculateCompoundInterest(inputs);
    calculated = {
      type, title: 'Compound interest', formula: result.formula, formulaVersion: '1', inputs, result,
    };
  } else {
    calculated = calculator.calculate(type, inputs);
  }
  return persistCalculation({
    user: req.user,
    body: { ...inputs, cropId: req.body.cropId, plotId: req.body.plotId, title: req.body.title },
  }, res, calculated);
}));

router.get('/history', asyncHandler(async (req, res) => {
  const limit = Number.parseInt(req.query.limit, 10) || 30;
  const page = Number.parseInt(req.query.page, 10) || 1;
  if (limit < 1 || limit > 100 || page < 1 || page > 10000) throw new HttpError(400, 'Page must be positive and limit must be from 1 to 100.');
  const where = { userId: req.user.id };
  if (req.query.type && !Object.prototype.hasOwnProperty.call(calculator.TITLES, req.query.type)) {
    throw new HttpError(400, 'Choose a supported calculator type.');
  }
  if (req.query.type) {
    where.calculatorType = req.query.type;
  }
  if (req.query.q) {
    const query = String(req.query.q).trim().slice(0, 120);
    where[Op.or] = [{ title: { [Op.iLike]: `%${query}%` } }, { calculatorType: { [Op.iLike]: `%${query}%` } }];
  }
  const result = await CalculatorHistory.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });
  return res.json({ success: true, data: result.rows, pagination: { total: result.count, page, limit } });
}));

router.get('/history/:id', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const item = await CalculatorHistory.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!item) throw new HttpError(404, 'Calculation not found.');
  return res.json({ success: true, data: item });
}));

router.delete('/history/:id', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const deleted = await CalculatorHistory.destroy({ where: { id: req.params.id, userId: req.user.id } });
  if (!deleted) throw new HttpError(404, 'Calculation not found.');
  return res.json({ success: true, message: 'Calculation history deleted.' });
}));

module.exports = router;
