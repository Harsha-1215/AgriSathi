const test = require('node:test');
const assert = require('node:assert/strict');
const calculator = require('../src/services/calculatorService');

test('seed estimate adjusts for the farmer-entered germination percentage', () => {
  const { result } = calculator.calculate('seed', {
    areaValue: 1,
    areaUnit: 'acres',
    seedRateKgPerAcre: 50,
    germinationPercent: 50,
  });
  assert.equal(result.seedQuantityKg, 100);
});

test('fertilizer product weight uses the supplied nutrient rate and product analysis', () => {
  const { result } = calculator.calculate('fertilizer', {
    areaValue: 1,
    areaUnit: 'acres',
    nutrientRateKgPerAcre: 40,
    nutrientPercentage: 20,
  });
  assert.equal(result.productQuantityKg, 200);
  assert.match(result.note, /not a crop-specific fertilizer recommendation/);
});

test('pesticide arithmetic requires label confirmation and source attribution', () => {
  assert.throws(() => calculator.calculate('pesticide', {
    labelRate: 2,
    labelRateUnit: 'mlPerLitre',
    waterLitres: 15,
    labelSource: 'product label',
  }), /Confirm that the entered rate matches/);

  const { result } = calculator.calculate('pesticide', {
    labelConfirmed: true,
    labelSource: 'product label',
    labelRate: 2,
    labelRateUnit: 'mlPerLitre',
    waterLitres: 15,
  });
  assert.equal(result.productQuantity, 30);
  assert.equal(result.quantityUnit, 'ml');
});

test('irrigation calculation converts area and water depth to volume', () => {
  const { result } = calculator.calculate('irrigation', {
    areaValue: 1,
    areaUnit: 'acres',
    depthMm: 10,
    efficiencyPercent: 50,
  });
  assert.equal(result.waterLitres, 80937.128448);
});

test('spacing estimate rejects zero spacing and calculates population for valid dimensions', () => {
  assert.throws(() => calculator.calculate('spacing', {
    areaValue: 1, areaUnit: 'acres', rowSpacingCm: 0, plantSpacingCm: 50,
  }), /Row spacing/);
  const { result } = calculator.calculate('spacing', {
    areaValue: 1, areaUnit: 'acres', rowSpacingCm: 100, plantSpacingCm: 50,
  });
  assert.equal(result.estimatedPlantCount, 8093);
});

test('zero-interest loans and zero-revenue profit calculations are handled explicitly', () => {
  const loan = calculator.calculate('loan', {
    principal: 12000, annualInterestPercent: 0, termMonths: 12,
  }).result;
  assert.equal(loan.monthlyPayment, 1000);
  const loss = calculator.calculate('profit-loss', {
    revenue: 0, totalExpenses: 0,
  }).result;
  assert.equal(loss.netProfitLoss, 0);
  assert.equal(loss.profitMarginPercent, null);
});

test('expense totals accept optional land area and yield price inputs', () => {
  const expenses = calculator.calculate('expenses', {
    areaValue: '',
    items: [{ category: 'Labour', amount: 1200 }, { category: 'Transport', amount: 800 }],
  }).result;
  assert.equal(expenses.totalExpenses, 2000);
  assert.equal(expenses.expensePerAcre, null);
  const yieldEstimate = calculator.calculate('yield', {
    areaValue: 1, areaUnit: 'acres', yieldKgPerAcre: 1000, pricePerKg: '',
  }).result;
  assert.equal(yieldEstimate.productionKg, 1000);
  assert.equal(yieldEstimate.estimatedGrossRevenue, null);
});

test('area conversion rejects unconfigured regional units such as bigha', () => {
  assert.throws(() => calculator.calculate('seed', {
    areaValue: 1, areaUnit: 'bigha', seedRateKgPerAcre: 10,
  }), /regional conversion/);
});
