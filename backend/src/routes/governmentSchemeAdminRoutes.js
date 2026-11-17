const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { requireAuth } = require('../middleware/auth');
const {
  GovernmentScheme, SchemeCategory, SchemeTranslation, SchemeUpdate,
  SchemeAdminAuditLog, sequelize,
} = require('../models');
const assertUuid = require('../utils/assertUuid');

const router = express.Router();
router.use(requireAuth, (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Administrator access is required.' });
  return next();
});

const languages = new Set(['te', 'hi']);
const levels = new Set(['central', 'state']);
const statuses = new Set(['unknown', 'open', 'closed']);
const eligibilityFields = new Set([
  'state', 'district', 'landArea', 'currentCrops', 'farmerCategory',
  'irrigationMethod', 'livestock', 'agriculturalActivities',
]);
const eligibilityOperators = new Set(['equals', 'in', 'min', 'max', 'includes']);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function text(value, field, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, `${field} is required and must be no more than ${max} characters.`);
  }
  return value.trim();
}

function optionalText(value, field, max = 1000) {
  if (value === undefined || value === null || value === '') return null;
  return text(value, field, max);
}

function secureUrl(value, field, required = false) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} must be an official HTTPS URL.`);
    return null;
  }
  const raw = text(value, field, 1000);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new HttpError(400, `${field} must be an official HTTPS URL.`);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new HttpError(400, `${field} must be an official HTTPS URL.`);
  }
  return parsed.toString();
}

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, `${field} must be an object.`);
  return value;
}

function list(value, field, max = 80) {
  if (!Array.isArray(value) || value.length > max) throw new HttpError(400, `${field} must be a list of no more than ${max} items.`);
  return value;
}

function booleanValue(value, field) {
  if (typeof value !== 'boolean') throw new HttpError(400, `${field} must be true or false.`);
  return value;
}

function date(value, field, required = false) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} is required.`);
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new HttpError(400, `${field} must be a valid date.`);
  return parsed;
}

function validateCriteria(value) {
  return list(value, 'Eligibility criteria').map((item) => {
    const criterion = object(item, 'Eligibility criterion');
    if (!eligibilityFields.has(criterion.field)) throw new HttpError(400, 'Eligibility criteria contain an unsupported farmer information field.');
    const operator = criterion.operator || 'equals';
    if (!eligibilityOperators.has(operator)) throw new HttpError(400, 'Eligibility criteria contain an unsupported comparison.');
    if (!Object.prototype.hasOwnProperty.call(criterion, 'value')) throw new HttpError(400, 'Each eligibility criterion must include a value.');
    if (operator === 'in' && (!Array.isArray(criterion.value) || criterion.value.length > 100)) throw new HttpError(400, 'List-based eligibility values must be a list of no more than 100 items.');
    if (['min', 'max'].includes(operator) && !Number.isFinite(Number(criterion.value))) throw new HttpError(400, 'Land-area eligibility values must be numeric.');
    if (['equals', 'includes'].includes(operator) && !(typeof criterion.value === 'string' || typeof criterion.value === 'number' || typeof criterion.value === 'boolean')) {
      throw new HttpError(400, 'Eligibility values must be text, numbers, booleans, or a list of text values.');
    }
    return {
      field: criterion.field,
      operator,
      value: criterion.value,
      ...(criterion.label ? { label: text(criterion.label, 'Eligibility label', 120) } : {}),
    };
  });
}

function validateStringList(value, field, maxItem = 500) {
  return list(value, field).map((item) => text(item, field, maxItem));
}

function schemeFields(body, current, adminId) {
  const value = (key, fallback, validator) => body[key] === undefined
    ? fallback
    : validator(body[key]);
  const level = value('governmentLevel', current?.governmentLevel, (item) => {
    if (!levels.has(item)) throw new HttpError(400, 'Choose central or state government level.');
    return item;
  });
  const state = level === 'central' ? null : value('state', current?.state, (item) => optionalText(item, 'State', 120));
  if (level === 'state' && !state) throw new HttpError(400, 'State schemes must specify the relevant state.');
  const categoryId = value('categoryId', current?.categoryId, (item) => {
    assertUuid(item);
    return item;
  });
  const categoryCheck = categoryId ? SchemeCategory.findOne({ where: { id: categoryId, isActive: true } }) : Promise.resolve(null);
  return categoryCheck.then((category) => {
    if (!category) throw new HttpError(400, 'Choose an existing active scheme category.');
    const source = value('source', current?.source, (item) => secureUrl(item, 'Official information source', true));
    const officialWebsite = value('officialWebsite', current?.officialWebsite, (item) => secureUrl(item, 'Official website'));
    const guidelineUrl = value('guidelineUrl', current?.guidelineUrl, (item) => secureUrl(item, 'Guideline link'));
    const applicationStatus = value('applicationStatus', current?.applicationStatus || 'unknown', (item) => {
      if (!statuses.has(item)) throw new HttpError(400, 'Choose unknown, open, or closed application status.');
      return item;
    });
    const statusIsVerified = applicationStatus !== 'unknown';
    const statusSourceInput = statusIsVerified
      ? value('statusSource', current?.statusSource, (item) => secureUrl(item, 'Application status source', true))
      : null;
    const statusVerifiedInput = statusIsVerified
      ? value('applicationStatusVerifiedAt', current?.applicationStatusVerifiedAt, (item) => date(item, 'Application status verification date', true))
      : null;
    const lastVerifiedAt = value('lastVerifiedAt', current?.lastVerifiedAt, (item) => date(item, 'Last verified date', true));
    if (lastVerifiedAt && lastVerifiedAt.getTime() > Date.now()) throw new HttpError(400, 'Last verified date cannot be in the future.');
    if (statusVerifiedInput && statusVerifiedInput.getTime() > Date.now()) throw new HttpError(400, 'Application status verification date cannot be in the future.');
    if (statusIsVerified && (!statusSourceInput || !statusVerifiedInput)) {
      throw new HttpError(400, 'Open or closed status requires an official source and verification date.');
    }
    return {
      schemeName: value('schemeName', current?.schemeName, (item) => text(item, 'Scheme name', 240)),
      shortDescription: value('shortDescription', current?.shortDescription, (item) => text(item, 'Short description', 1500)),
      fullDescription: value('fullDescription', current?.fullDescription, (item) => text(item, 'Full description', 15000)),
      department: value('department', current?.department, (item) => text(item, 'Department', 240)),
      governmentLevel: level,
      state: level === 'central' ? null : state,
      categoryId,
      benefitDetails: value('benefitDetails', current?.benefitDetails || {}, (item) => object(item, 'Benefits')),
      eligibilityCriteria: value('eligibilityCriteria', current?.eligibilityCriteria || [], validateCriteria),
      requiredDocuments: value('requiredDocuments', current?.requiredDocuments || [], (item) => validateStringList(item, 'Required documents', 240)),
      applicationProcedure: value('applicationProcedure', current?.applicationProcedure || [], (item) => validateStringList(item, 'Application steps', 1200)),
      officialWebsite,
      guidelineUrl,
      applicationStartDate: value('applicationStartDate', current?.applicationStartDate, (item) => date(item, 'Application start date')),
      applicationEndDate: value('applicationEndDate', current?.applicationEndDate, (item) => date(item, 'Application end date')),
      applicationStatus: statusIsVerified ? applicationStatus : 'unknown',
      applicationStatusVerifiedAt: statusIsVerified ? statusVerifiedInput : null,
      statusSource: statusIsVerified ? statusSourceInput : null,
      source,
      lastVerifiedAt,
      verifiedBy: adminId,
    };
  });
}

async function validatePublication(scheme) {
  if (!scheme.categoryId || !scheme.source || !scheme.lastVerifiedAt || !scheme.department) {
    throw new HttpError(400, 'A category, department, official source, and verification date are required before publishing.');
  }
  secureUrl(scheme.source, 'Official information source', true);
  if (scheme.governmentLevel === 'state' && !scheme.state) throw new HttpError(400, 'State schemes must specify the relevant state.');
  if (scheme.applicationStatus !== 'unknown') {
    secureUrl(scheme.statusSource, 'Application status source', true);
    if (!date(scheme.applicationStatusVerifiedAt, 'Application status verification date', true)) throw new HttpError(400, 'Application status must be verified.');
  }
}

async function writeAudit(schemeId, adminId, action, details = {}) {
  await SchemeAdminAuditLog.create({ schemeId, adminId, action, details });
}

router.get('/categories', asyncHandler(async (req, res) => {
  const rows = await SchemeCategory.findAll({ order: [['name', 'ASC']] });
  return res.json({ success: true, data: rows });
}));

router.post('/categories', asyncHandler(async (req, res) => {
  const slug = text(req.body.slug, 'Category slug', 80).toLowerCase();
  if (!slugPattern.test(slug)) throw new HttpError(400, 'Category slug must be a lowercase URL-safe value.');
  const translations = req.body.translations === undefined ? {} : object(req.body.translations, 'Translations');
  for (const [language, name] of Object.entries(translations)) {
    if (!['en', 'te', 'hi'].includes(language) || typeof name !== 'string' || !name.trim()) throw new HttpError(400, 'Category translations must use en, te, or hi language keys and non-empty text.');
  }
  const category = await SchemeCategory.create({
    slug,
    name: text(req.body.name, 'Category name', 160),
    translations,
    description: req.body.description === undefined ? {} : object(req.body.description, 'Description'),
    icon: req.body.icon ? text(req.body.icon, 'Icon', 60) : 'sprout',
    isActive: req.body.isActive !== false,
  });
  await writeAudit(null, req.user.id, 'category_created', { categoryId: category.id, slug });
  return res.status(201).json({ success: true, data: category });
}));

router.put('/categories/:id', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const category = await SchemeCategory.findByPk(req.params.id);
  if (!category) throw new HttpError(404, 'Scheme category not found.');
  const updates = {};
  if (req.body.name !== undefined) updates.name = text(req.body.name, 'Category name', 160);
  if (req.body.slug !== undefined) {
    updates.slug = text(req.body.slug, 'Category slug', 80).toLowerCase();
    if (!slugPattern.test(updates.slug)) throw new HttpError(400, 'Category slug must be a lowercase URL-safe value.');
  }
  if (req.body.translations !== undefined) updates.translations = object(req.body.translations, 'Translations');
  if (req.body.description !== undefined) updates.description = object(req.body.description, 'Description');
  if (req.body.icon !== undefined) updates.icon = text(req.body.icon, 'Icon', 60);
  if (req.body.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);
  await category.update(updates);
  await writeAudit(null, req.user.id, 'category_updated', { categoryId: category.id, fields: Object.keys(updates) });
  return res.json({ success: true, data: category });
}));

router.get('/', asyncHandler(async (req, res) => {
  const rows = await GovernmentScheme.findAll({
    include: [{ model: SchemeCategory, attributes: ['id', 'slug', 'name'] }],
    order: [['updatedAt', 'DESC']],
    limit: 200,
  });
  return res.json({ success: true, data: rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  if (req.body.isPublished !== undefined) booleanValue(req.body.isPublished, 'isPublished');
  if (req.body.isActive !== undefined) booleanValue(req.body.isActive, 'isActive');
  const fields = await schemeFields(req.body, null, req.user.id);
  const isPublished = req.body.isPublished === true;
  if (isPublished) await validatePublication(fields);
  const scheme = await GovernmentScheme.create({ ...fields, isPublished: false, isActive: true });
  if (isPublished) await scheme.update({ isPublished: true });
  await writeAudit(scheme.id, req.user.id, isPublished ? 'created_and_published' : 'created_draft', { informationVersion: scheme.informationVersion });
  return res.status(201).json({ success: true, data: scheme });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  if (req.body.isPublished !== undefined) booleanValue(req.body.isPublished, 'isPublished');
  if (req.body.isActive !== undefined) booleanValue(req.body.isActive, 'isActive');
  assertUuid(req.params.id);
  const scheme = await GovernmentScheme.findByPk(req.params.id);
  if (!scheme) throw new HttpError(404, 'Government scheme not found.');
  const fields = await schemeFields(req.body, scheme, req.user.id);
  const publish = req.body.isPublished === undefined ? scheme.isPublished : req.body.isPublished === true;
  if (publish) await validatePublication({ ...scheme.toJSON(), ...fields });
  const updateSummary = req.body.updateSummary === undefined ? null : text(req.body.updateSummary, 'Public update summary', 5000);
  let update;
  const transaction = await sequelize.transaction();
  try {
    await scheme.update({
      ...fields,
      isPublished: publish,
      isActive: req.body.isActive === undefined ? scheme.isActive : Boolean(req.body.isActive),
      informationVersion: scheme.informationVersion + 1,
    }, { transaction });
    if (updateSummary) {
      update = await SchemeUpdate.create({
        schemeId: scheme.id,
        title: text(req.body.updateTitle, 'Update title', 240),
        summary: updateSummary,
        source: secureUrl(req.body.updateSource, 'Update source', true),
        verifiedAt: date(req.body.updateVerifiedAt, 'Update verification date', true),
        createdBy: req.user.id,
      }, { transaction });
    }
    await SchemeAdminAuditLog.create({
      schemeId: scheme.id,
      adminId: req.user.id,
      action: publish ? 'updated_and_published' : 'updated',
      details: { informationVersion: scheme.informationVersion, publicUpdateId: update?.id || null, fields: Object.keys(req.body) },
    }, { transaction });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
  return res.json({ success: true, data: scheme });
}));

router.post('/:id/publish', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const scheme = await GovernmentScheme.findByPk(req.params.id);
  if (!scheme) throw new HttpError(404, 'Government scheme not found.');
  await validatePublication(scheme);
  await scheme.update({ isPublished: true, isActive: true, verifiedBy: req.user.id, informationVersion: scheme.informationVersion + 1 });
  await writeAudit(scheme.id, req.user.id, 'published', { informationVersion: scheme.informationVersion });
  return res.json({ success: true, data: scheme });
}));

router.post('/:id/unpublish', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const scheme = await GovernmentScheme.findByPk(req.params.id);
  if (!scheme) throw new HttpError(404, 'Government scheme not found.');
  await scheme.update({ isPublished: false });
  await writeAudit(scheme.id, req.user.id, 'unpublished', { reason: optionalText(req.body.reason, 'Reason', 1000) });
  return res.json({ success: true, data: scheme });
}));

router.post('/:id/translations', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  if (!languages.has(req.body.language)) throw new HttpError(400, 'Translation language must be Telugu or Hindi.');
  const scheme = await GovernmentScheme.findByPk(req.params.id);
  if (!scheme) throw new HttpError(404, 'Government scheme not found.');
  const source = secureUrl(req.body.source, 'Translation verification source', true);
  const verifiedAt = date(req.body.verifiedAt, 'Translation verification date', true);
  if (verifiedAt.getTime() > Date.now()) throw new HttpError(400, 'Translation verification date cannot be in the future.');
  const [translation, created] = await SchemeTranslation.findOrCreate({
    where: { schemeId: scheme.id, language: req.body.language },
    defaults: {
      schemeId: scheme.id,
      language: req.body.language,
      translatedName: text(req.body.translatedName, 'Translated name', 240),
      translatedDescription: text(req.body.translatedDescription, 'Translated description', 15000),
      translatedEligibility: req.body.translatedEligibility === undefined ? [] : list(req.body.translatedEligibility, 'Translated eligibility'),
      translatedBenefits: req.body.translatedBenefits === undefined ? {} : object(req.body.translatedBenefits, 'Translated benefits'),
      translatedProcedure: req.body.translatedProcedure === undefined ? [] : list(req.body.translatedProcedure, 'Translated procedure'),
      source,
      verifiedBy: req.user.id,
      verifiedAt,
    },
  });
  if (!created) {
    await translation.update({
      translatedName: text(req.body.translatedName, 'Translated name', 240),
      translatedDescription: text(req.body.translatedDescription, 'Translated description', 15000),
      translatedEligibility: req.body.translatedEligibility === undefined ? translation.translatedEligibility : list(req.body.translatedEligibility, 'Translated eligibility'),
      translatedBenefits: req.body.translatedBenefits === undefined ? translation.translatedBenefits : object(req.body.translatedBenefits, 'Translated benefits'),
      translatedProcedure: req.body.translatedProcedure === undefined ? translation.translatedProcedure : list(req.body.translatedProcedure, 'Translated procedure'),
      source,
      verifiedBy: req.user.id,
      verifiedAt,
    });
  }
  await writeAudit(scheme.id, req.user.id, created ? 'translation_added' : 'translation_updated', { language: req.body.language });
  return res.status(created ? 201 : 200).json({ success: true, data: translation });
}));

router.delete('/:id/translations/:language', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  if (!languages.has(req.params.language)) throw new HttpError(400, 'Translation language must be Telugu or Hindi.');
  const removed = await SchemeTranslation.destroy({ where: { schemeId: req.params.id, language: req.params.language } });
  if (!removed) throw new HttpError(404, 'Verified translation not found.');
  await writeAudit(req.params.id, req.user.id, 'translation_removed', { language: req.params.language });
  return res.json({ success: true, message: 'Translation removed.' });
}));

router.get('/:id/audit', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const rows = await SchemeAdminAuditLog.findAll({
    where: { schemeId: req.params.id },
    order: [['createdAt', 'DESC']],
    limit: 100,
  });
  return res.json({ success: true, data: rows });
}));

module.exports = router;
