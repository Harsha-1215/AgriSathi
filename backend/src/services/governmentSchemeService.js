const HttpError = require('../utils/httpError');

const ELIGIBILITY_FIELDS = new Set([
  'state', 'district', 'landArea', 'currentCrops', 'farmerCategory',
  'irrigationMethod', 'livestock', 'agriculturalActivities',
]);
const OPERATORS = new Set(['equals', 'in', 'min', 'max', 'includes']);

function isFresh(date, maxAgeDays) {
  if (!date) return false;
  const age = Date.now() - new Date(date).getTime();
  return age >= 0 && age <= maxAgeDays * 24 * 60 * 60 * 1000;
}

function localizedScheme(scheme, language, category, translation) {
  const row = scheme.toJSON ? scheme.toJSON() : scheme;
  const isTranslationFresh = translation && isFresh(translation.verifiedAt, 365);
  const localized = language === 'en' || !isTranslationFresh ? null : (translation.toJSON ? translation.toJSON() : translation);
  const isStatusFresh = isFresh(row.applicationStatusVerifiedAt, 30) && row.statusSource;
  return {
    id: row.id,
    schemeName: localized?.translatedName || row.schemeName,
    officialSchemeName: row.schemeName,
    shortDescription: localized?.translatedDescription || row.shortDescription,
    fullDescription: localized?.translatedDescription || row.fullDescription,
    department: row.department,
    governmentLevel: row.governmentLevel,
    state: row.state,
    category: category ? {
      id: category.id,
      slug: category.slug,
      name: category.translations?.[language] || category.name,
      icon: category.icon,
    } : null,
    benefitDetails: localized?.translatedBenefits || row.benefitDetails,
    eligibilityCriteria: localized?.translatedEligibility || row.eligibilityCriteria,
    requiredDocuments: row.requiredDocuments,
    applicationProcedure: localized?.translatedProcedure || row.applicationProcedure,
    officialWebsite: row.officialWebsite,
    guidelineUrl: row.guidelineUrl,
    applicationStartDate: row.applicationStartDate,
    applicationEndDate: row.applicationEndDate,
    applicationStatus: isStatusFresh ? row.applicationStatus : 'unknown',
    applicationStatusVerifiedAt: isStatusFresh ? row.applicationStatusVerifiedAt : null,
    statusSource: isStatusFresh ? row.statusSource : null,
    source: row.source,
    lastVerifiedAt: row.lastVerifiedAt,
    informationVersion: row.informationVersion,
    isTranslationAvailable: language === 'en' || Boolean(localized),
    translationVerifiedAt: localized?.verifiedAt || null,
    needsReview: !isFresh(row.lastVerifiedAt, 180),
    updatedAt: row.updatedAt,
  };
}

function getFarmerValue(field, profile, answers) {
  if (!ELIGIBILITY_FIELDS.has(field)) throw new HttpError(500, 'A scheme has an unsupported eligibility field and must be reviewed.');
  if (answers[field] !== undefined && answers[field] !== null && answers[field] !== '') return answers[field];
  if (profile[field] !== undefined && profile[field] !== null && profile[field] !== '') return profile[field];
  return undefined;
}

function compare(actual, operator, expected) {
  if (!OPERATORS.has(operator)) throw new HttpError(500, 'A scheme has an unsupported eligibility rule and must be reviewed.');
  if (operator === 'in') {
    if (!Array.isArray(expected)) throw new HttpError(500, 'A scheme eligibility list is invalid and must be reviewed.');
    const values = Array.isArray(actual) ? actual : [actual];
    return values.some((value) => expected.some((candidate) => String(value).toLocaleLowerCase() === String(candidate).toLocaleLowerCase()));
  }
  if (operator === 'includes') {
    const values = Array.isArray(actual) ? actual : [actual];
    return values.some((value) => String(value).toLocaleLowerCase().includes(String(expected).toLocaleLowerCase()));
  }
  if (operator === 'min') return Number(actual) >= Number(expected);
  if (operator === 'max') return Number(actual) <= Number(expected);
  const actualValues = Array.isArray(actual) ? actual : [actual];
  return actualValues.some((value) => String(value).toLocaleLowerCase() === String(expected).toLocaleLowerCase());
}

function evaluateEligibility(criteria, profile, answers = {}) {
  if (!Array.isArray(criteria)) throw new HttpError(500, 'Scheme eligibility criteria are invalid and must be reviewed.');
  if (!criteria.length) {
    return {
      status: 'eligibility_not_configured',
      matches: [],
      doesNotMatch: [],
      missingInformation: [],
      note: 'Eligibility requirements have not been configured for this scheme. Confirm them with the official department before applying.',
    };
  }
  const matches = [];
  const doesNotMatch = [];
  const missingInformation = [];
  criteria.forEach((criterion) => {
    if (!criterion || typeof criterion !== 'object' || Array.isArray(criterion) || typeof criterion.field !== 'string') {
      throw new HttpError(500, 'Scheme eligibility criteria are invalid and must be reviewed.');
    }
    const actual = getFarmerValue(criterion.field, profile, answers);
    const label = typeof criterion.label === 'string' && criterion.label.trim()
      ? criterion.label.trim()
      : criterion.field;
    if (actual === undefined) {
      missingInformation.push({ field: criterion.field, label });
      return;
    }
    if (['min', 'max'].includes(criterion.operator) && !Number.isFinite(Number(actual))) {
      missingInformation.push({ field: criterion.field, label });
      return;
    }
    const matched = compare(actual, criterion.operator || 'equals', criterion.value);
    (matched ? matches : doesNotMatch).push({ field: criterion.field, label });
  });
  const status = doesNotMatch.length
    ? 'does_not_appear_to_qualify'
    : missingInformation.length ? 'more_information_required' : 'likely_eligible';
  return {
    status,
    matches,
    doesNotMatch,
    missingInformation,
    note: 'This is a preliminary guide based on the information provided and does not guarantee official approval or payment.',
  };
}

module.exports = { localizedScheme, evaluateEligibility, ELIGIBILITY_FIELDS };
