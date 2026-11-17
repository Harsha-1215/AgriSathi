const HttpError = require('../utils/httpError');

const AREA_UNITS_TO_SQUARE_METRES = Object.freeze({
  squareMetres: 1,
  squareFeet: 0.09290304,
  squareYards: 0.83612736,
  acres: 4046.8564224,
  cents: 40.468564224,
  hectares: 10000,
  ares: 100,
  guntha: 101.17141056,
});

const TITLES = Object.freeze({
  seed: 'Seed requirement',
  fertilizer: 'Fertilizer requirement',
  pesticide: 'Pesticide dilution',
  irrigation: 'Irrigation requirement',
  spacing: 'Plant spacing and population',
  yield: 'Yield estimate',
  expenses: 'Farm expenses',
  'profit-loss': 'Profit and loss',
  loan: 'Farm loan estimate',
});

const FORMULAS = Object.freeze({
  seed: 'seed quantity = area in acres x seed rate per acre / germination fraction',
  fertilizer: 'product quantity = area in acres x nutrient rate per acre / nutrient fraction',
  pesticide: 'product quantity = verified label rate x supplied water volume or area',
  irrigation: 'gross water volume = area in square metres x depth in millimetres / application efficiency',
  spacing: 'estimated plant count = area in square metres / row spacing / plant spacing',
  yield: 'estimated production = area in acres x user-entered yield rate per acre',
  expenses: 'total investment = sum of supplied expense items',
  'profit-loss': 'net profit or loss = supplied revenue - sum of supplied expenses',
  loan: 'monthly EMI = P x r x (1 + r)^n / ((1 + r)^n - 1)',
});

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function number(value, name, { min = 0, max = 1e12, allowZero = false } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (!allowZero && parsed === 0)) {
    throw new HttpError(400, `${name} must be a number between ${min} and ${max}${allowZero ? '' : ' (excluding zero)'}.`);
  }
  return parsed;
}

function requiredText(value, name, maxLength = 200) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new HttpError(400, `${name} is required and must be no more than ${maxLength} characters.`);
  }
  return value.trim();
}

function optionalText(value, name, maxLength = 200) {
  if (value === undefined || value === null || value === '') return null;
  return requiredText(value, name, maxLength);
}

function areaInSquareMetres(input) {
  const value = number(input.areaValue, 'Area');
  const unit = input.areaUnit || 'acres';
  const factor = AREA_UNITS_TO_SQUARE_METRES[unit];
  if (!factor) throw new HttpError(400, 'Choose a supported area unit. Bigha requires a configured regional conversion.');
  const squareMetres = value * factor;
  return { areaValue: value, areaUnit: unit, areaSquareMetres: squareMetres, areaAcres: squareMetres / AREA_UNITS_TO_SQUARE_METRES.acres };
}

function calculateSeed(input) {
  const area = areaInSquareMetres(input);
  const rate = number(input.seedRateKgPerAcre, 'Seed rate (kg per acre)', { max: 10000 });
  const germination = input.germinationPercent === undefined ? 100 : number(input.germinationPercent, 'Germination percentage', { min: 1, max: 100 });
  return {
    ...area,
    seedRateKgPerAcre: rate,
    germinationPercent: germination,
    seedQuantityKg: area.areaAcres * rate / (germination / 100),
    note: 'Estimate based only on the seed rate and germination percentage you entered. Confirm crop-specific rates with a verified local source.',
  };
}

function calculateFertilizer(input) {
  const area = areaInSquareMetres(input);
  const nutrientRate = number(input.nutrientRateKgPerAcre, 'Nutrient rate (kg per acre)', { max: 10000 });
  const nutrientPercent = number(input.nutrientPercentage, 'Nutrient percentage', { min: 0.01, max: 100 });
  return {
    ...area,
    nutrientRateKgPerAcre: nutrientRate,
    nutrientPercentage: nutrientPercent,
    productQuantityKg: area.areaAcres * nutrientRate / (nutrientPercent / 100),
    note: 'Calculation uses the nutrient rate and product analysis you entered; it is not a crop-specific fertilizer recommendation.',
  };
}

function calculatePesticide(input) {
  if (input.labelConfirmed !== true) {
    throw new HttpError(400, 'Confirm that the entered rate matches the product label before calculating.');
  }
  const labelSource = requiredText(input.labelSource, 'Product label or source', 500);
  const rate = number(input.labelRate, 'Label application rate', { max: 100000 });
  const unit = input.labelRateUnit;
  let productQuantity;
  let waterLitres;
  let quantityUnit;
  if (unit === 'mlPerLitre' || unit === 'gPerLitre') {
    waterLitres = number(input.waterLitres, 'Water volume', { max: 1000000 });
    productQuantity = rate * waterLitres;
    quantityUnit = unit === 'mlPerLitre' ? 'ml' : 'g';
  } else if (unit === 'mlPerAcre' || unit === 'gPerAcre') {
    const area = areaInSquareMetres(input);
    productQuantity = rate * area.areaAcres;
    waterLitres = input.waterLitres === undefined || input.waterLitres === null || input.waterLitres === ''
      ? null
      : number(input.waterLitres, 'Water volume', { max: 1000000 });
    quantityUnit = unit === 'mlPerAcre' ? 'ml' : 'g';
    return {
      ...area, labelRate: rate, labelRateUnit: unit, waterLitres,
      productQuantity, quantityUnit, labelSource,
      note: 'Arithmetic from the rate and source you entered only. Follow the complete product label and local regulations; this is not pesticide-use advice.',
    };
  } else {
    throw new HttpError(400, 'Choose a supported label rate unit.');
  }
  return {
    labelRate: rate, labelRateUnit: unit, waterLitres,
    productQuantity, quantityUnit, labelSource,
    note: 'Arithmetic from the rate and source you entered only. Follow the complete product label and local regulations; this is not pesticide-use advice.',
  };
}

function calculateIrrigation(input) {
  const area = areaInSquareMetres(input);
  const depth = number(input.depthMm, 'Water depth (mm)', { max: 10000 });
  const efficiency = input.efficiencyPercent === undefined
    ? 100
    : number(input.efficiencyPercent, 'Application efficiency percentage', { min: 1, max: 100 });
  const grossLitres = area.areaSquareMetres * depth / (efficiency / 100);
  const flow = input.flowRateLitresPerMinute === undefined || input.flowRateLitresPerMinute === null || input.flowRateLitresPerMinute === ''
    ? null
    : number(input.flowRateLitresPerMinute, 'Flow rate (litres per minute)', { max: 1e8 });
  return {
    ...area, depthMm: depth, efficiencyPercent: efficiency,
    waterLitres: grossLitres, waterCubicMetres: grossLitres / 1000,
    estimatedMinutes: flow ? grossLitres / flow : null,
    note: 'Water depth and system efficiency are user-entered estimates. Check soil moisture, crop stage, and local conditions.',
  };
}

function calculateSpacing(input) {
  const area = areaInSquareMetres(input);
  const rowSpacingCm = number(input.rowSpacingCm, 'Row spacing (cm)', { max: 100000 });
  const plantSpacingCm = number(input.plantSpacingCm, 'Plant spacing (cm)', { max: 100000 });
  const areaPerPlant = (rowSpacingCm / 100) * (plantSpacingCm / 100);
  return {
    ...area, rowSpacingCm, plantSpacingCm, areaPerPlantSquareMetres: areaPerPlant,
    estimatedPlantCount: Math.floor(area.areaSquareMetres / areaPerPlant),
    estimatedPlantsPerAcre: Math.floor(AREA_UNITS_TO_SQUARE_METRES.acres / areaPerPlant),
    note: 'The result is a geometric estimate and does not account for paths, field shape, borders, or crop-specific recommendations.',
  };
}

function calculateYield(input) {
  const area = areaInSquareMetres(input);
  const yieldKgPerAcre = number(input.yieldKgPerAcre, 'Yield estimate (kg per acre)', { max: 1e8, allowZero: true });
  const productionKg = area.areaAcres * yieldKgPerAcre;
  const pricePerKg = input.pricePerKg === undefined || input.pricePerKg === null || input.pricePerKg === ''
    ? null
    : number(input.pricePerKg, 'Price per kg', { max: 1e8, allowZero: true });
  return {
    ...area, yieldKgPerAcre, productionKg, productionTonnes: productionKg / 1000,
    estimatedGrossRevenue: pricePerKg === null ? null : productionKg * pricePerKg,
    pricePerKg,
    note: 'Yield and price are user-entered estimates, not live market data or a guaranteed harvest.',
  };
}

function expenseItems(items, name = 'Expenses') {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    throw new HttpError(400, `${name} must contain between 1 and 100 items.`);
  }
  return items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, `Expense item ${index + 1} is invalid.`);
    return {
      category: requiredText(item.category, `Expense item ${index + 1} category`, 80),
      amount: number(item.amount, `Expense item ${index + 1} amount`, { max: 1e12, allowZero: true }),
    };
  });
}

function calculateExpenses(input) {
  const items = expenseItems(input.items);
  const total = roundMoney(items.reduce((sum, item) => sum + item.amount, 0));
  const area = input.areaValue === undefined || input.areaValue === null || input.areaValue === ''
    ? null
    : areaInSquareMetres(input);
  return {
    items, totalExpenses: total,
    expensePerAcre: area && area.areaAcres > 0 ? roundMoney(total / area.areaAcres) : null,
    ...(area || {}),
    currency: optionalText(input.currency, 'Currency', 8) || 'INR',
  };
}

function calculateProfitLoss(input) {
  const revenue = number(input.revenue, 'Revenue', { max: 1e12, allowZero: true });
  const costs = input.items
    ? expenseItems(input.items)
    : [{ category: 'Total expenses', amount: number(input.totalExpenses, 'Total expenses', { max: 1e12, allowZero: true }) }];
  const totalExpenses = roundMoney(costs.reduce((sum, item) => sum + item.amount, 0));
  const netProfitLoss = roundMoney(revenue - totalExpenses);
  return {
    revenue: roundMoney(revenue), expenses: costs, totalExpenses, netProfitLoss,
    profitMarginPercent: revenue > 0 ? roundMoney((netProfitLoss / revenue) * 100) : null,
    breakEvenRevenue: totalExpenses,
    currency: optionalText(input.currency, 'Currency', 8) || 'INR',
  };
}

function calculateLoan(input) {
  const principal = number(input.principal, 'Loan principal', { max: 1e12 });
  const annualInterestPercent = number(input.annualInterestPercent, 'Annual interest percentage', { max: 1000, allowZero: true });
  const termMonths = number(input.termMonths, 'Loan term in months', { min: 1, max: 1200 });
  if (!Number.isInteger(termMonths)) throw new HttpError(400, 'Loan term in months must be a whole number.');
  const monthlyRate = annualInterestPercent / 1200;
  const monthlyPayment = monthlyRate === 0
    ? principal / termMonths
    : principal * monthlyRate / (1 - ((1 + monthlyRate) ** -termMonths));
  const totalRepayment = monthlyPayment * termMonths;
  return {
    principal: roundMoney(principal),
    annualInterestPercent,
    termMonths,
    monthlyPayment: roundMoney(monthlyPayment),
    totalRepayment: roundMoney(totalRepayment),
    estimatedInterest: roundMoney(totalRepayment - principal),
    simpleInterestTotal: roundMoney(principal + (principal * annualInterestPercent / 100 * termMonths / 12)),
    currency: optionalText(input.currency, 'Currency', 8) || 'INR',
    note: 'Illustrative estimate only. Actual loan terms, fees, subsidies, and eligibility vary by lender and scheme.',
  };
}

function loanInputs(input) {
  const principal = number(input.principal, 'Loan principal', { max: 1e12 });
  const annualInterestPercent = number(input.annualInterestPercent, 'Annual interest percentage', { max: 1000, allowZero: true });
  const durationYears = input.durationYears === undefined
    ? number(input.termMonths, 'Loan term in months', { min: 1, max: 1200 }) / 12
    : number(input.durationYears, 'Loan term in years', { min: 1 / 12, max: 100 });
  return { principal, annualInterestPercent, durationYears };
}

function calculateSimpleInterest(input) {
  const { principal, annualInterestPercent, durationYears } = loanInputs(input);
  const interest = roundMoney(principal * annualInterestPercent * durationYears / 100);
  return {
    principal: roundMoney(principal),
    annualInterestPercent,
    durationYears,
    interest,
    totalRepayment: roundMoney(principal + interest),
    currency: optionalText(input.currency, 'Currency', 8) || 'INR',
    formula: 'SI = P x R x T / 100',
  };
}

function calculateCompoundInterest(input) {
  const { principal, annualInterestPercent, durationYears } = loanInputs(input);
  const periodsPerYear = input.compoundingPeriodsPerYear === undefined
    ? 1
    : number(input.compoundingPeriodsPerYear, 'Compounding periods per year', { min: 1, max: 365 });
  if (!Number.isInteger(periodsPerYear)) throw new HttpError(400, 'Compounding periods per year must be a whole number.');
  const periods = periodsPerYear * durationYears;
  if (!Number.isInteger(periods)) throw new HttpError(400, 'The duration must result in a whole number of compounding periods.');
  const amount = principal * (1 + annualInterestPercent / (100 * periodsPerYear)) ** periods;
  if (!Number.isFinite(amount) || amount > 1e15) throw new HttpError(400, 'The compound-interest result is outside the supported range.');
  return {
    principal: roundMoney(principal),
    annualInterestPercent,
    durationYears,
    compoundingPeriodsPerYear: periodsPerYear,
    totalAmount: roundMoney(amount),
    interest: roundMoney(amount - principal),
    currency: optionalText(input.currency, 'Currency', 8) || 'INR',
    formula: 'A = P x (1 + R / (100 x n))^(n x T)',
  };
}

const calculators = {
  seed: calculateSeed,
  fertilizer: calculateFertilizer,
  pesticide: calculatePesticide,
  irrigation: calculateIrrigation,
  spacing: calculateSpacing,
  yield: calculateYield,
  expenses: calculateExpenses,
  'profit-loss': calculateProfitLoss,
  loan: calculateLoan,
};

function calculate(type, input) {
  if (!Object.prototype.hasOwnProperty.call(calculators, type)) throw new HttpError(404, 'Choose a supported calculator.');
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'Provide calculator inputs.');
  return { type, title: TITLES[type], formula: FORMULAS[type], formulaVersion: '1', inputs: input, result: calculators[type](input) };
}

module.exports = {
  AREA_UNITS_TO_SQUARE_METRES,
  TITLES,
  FORMULAS,
  calculate,
  calculators,
  calculateSimpleInterest,
  calculateCompoundInterest,
};
