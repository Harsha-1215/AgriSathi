const express = require('express');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { requireAuth, requireFarmer } = require('../middleware/auth');
const {
  GovernmentScheme, SchemeCategory, SchemeTranslation, FarmerSavedScheme,
  SchemeUpdate,
} = require('../models');
const { localizedScheme, evaluateEligibility, ELIGIBILITY_FIELDS } = require('../services/governmentSchemeService');
const assertUuid = require('../utils/assertUuid');

const router = express.Router();
router.use(requireAuth, requireFarmer);
const languages = new Set(['en', 'te', 'hi']);

function languageFromRequest(req) {
  const raw = req.query.language || req.user.profile.preferredLanguage || 'en';
  const aliases = { english: 'en', telugu: 'te', hindi: 'hi' };
  const language = aliases[String(raw).toLowerCase()] || String(raw).toLowerCase();
  if (!languages.has(language)) throw new HttpError(400, 'Choose English, Telugu, or Hindi.');
  return language;
}

function pagination(query) {
  const limit = Math.max(1, Math.min(50, Number.parseInt(query.limit, 10) || 20));
  const offset = Math.max(0, Math.min(10000, Number.parseInt(query.offset, 10) || 0));
  return { limit, offset };
}

async function schemeResponse(scheme, language) {
  let translation = null;
  if (language !== 'en') {
    translation = await SchemeTranslation.findOne({
      where: { schemeId: scheme.id, language },
      attributes: { exclude: ['source'] },
    });
  }
  return localizedScheme(scheme, language, scheme.SchemeCategory, translation);
}

function applicableToFarmer(scheme, profile) {
  if (scheme.governmentLevel === 'central') return true;
  if (!scheme.state) return true;
  return !profile.state || String(profile.state).toLocaleLowerCase() === scheme.state.toLocaleLowerCase();
}

router.get('/categories', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const categories = await SchemeCategory.findAll({
    where: { isActive: true },
    order: [['name', 'ASC']],
  });
  const counts = await GovernmentScheme.count({
    where: { isPublished: true, isActive: true },
    attributes: ['categoryId'],
    group: ['categoryId'],
  });
  const countById = new Map(counts.map((row) => [row.categoryId, Number(row.count)]));
  return res.json({
    success: true,
    data: categories.map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.translations?.[language] || item.name,
      icon: item.icon,
      count: countById.get(item.id) || 0,
    })),
  });
}));

router.get('/', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const { limit, offset } = pagination(req.query);
  const where = { isPublished: true, isActive: true };
  if (req.query.level === 'central' || req.query.level === 'state') where.governmentLevel = req.query.level;
  if (req.query.state) where.state = { [Op.iLike]: String(req.query.state).slice(0, 120) };
  if (req.query.category) {
    const category = await SchemeCategory.findOne({ where: { slug: String(req.query.category).slice(0, 80), isActive: true } });
    if (!category) throw new HttpError(400, 'Choose an existing scheme category.');
    where.categoryId = category.id;
  }
  if (['open', 'closed'].includes(req.query.applicationStatus)) {
    where.applicationStatus = req.query.applicationStatus;
    where.applicationStatusVerifiedAt = {
      [Op.between]: [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()],
    };
  }
  if (req.query.q) {
    const search = String(req.query.q).trim().slice(0, 120);
    if (search) where[Op.or] = [
      { schemeName: { [Op.iLike]: `%${search}%` } },
      { shortDescription: { [Op.iLike]: `%${search}%` } },
      { department: { [Op.iLike]: `%${search}%` } },
    ];
  }
  const result = await GovernmentScheme.findAndCountAll({
    where,
    include: [{ model: SchemeCategory, attributes: ['id', 'slug', 'name', 'translations', 'icon'] }],
    order: [['lastVerifiedAt', 'DESC'], ['updatedAt', 'DESC']],
    limit,
    offset,
  });
  const data = await Promise.all(result.rows.map((scheme) => schemeResponse(scheme, language)));
  return res.json({ success: true, data: { items: data, pagination: { offset, limit, total: result.count } } });
}));

router.get('/search', asyncHandler(async (req, res) => {
  if (typeof req.query.q !== 'string' || req.query.q.trim().length < 2) throw new HttpError(400, 'Enter at least two characters to search schemes.');
  const language = languageFromRequest(req);
  const search = req.query.q.trim().slice(0, 120);
  const rows = await GovernmentScheme.findAll({
    where: {
      isPublished: true,
      isActive: true,
      [Op.or]: [
        { schemeName: { [Op.iLike]: `%${search}%` } },
        { shortDescription: { [Op.iLike]: `%${search}%` } },
        { department: { [Op.iLike]: `%${search}%` } },
      ],
    },
    include: [{ model: SchemeCategory, attributes: ['id', 'slug', 'name', 'translations', 'icon'] }],
    order: [['lastVerifiedAt', 'DESC']],
    limit: 30,
  });
  return res.json({ success: true, data: await Promise.all(rows.map((scheme) => schemeResponse(scheme, language))) });
}));

router.get('/recommended', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const where = { isPublished: true, isActive: true };
  if (req.user.profile.state) {
    const state = req.user.profile.state;
    where[Op.or] = [
      { governmentLevel: 'central' },
      { state: null },
      { state: { [Op.iLike]: String(state).slice(0, 120) } },
    ];
  }
  const rows = await GovernmentScheme.findAll({
    where,
    include: [{ model: SchemeCategory, attributes: ['id', 'slug', 'name', 'translations', 'icon'] }],
    order: [['lastVerifiedAt', 'DESC']],
    limit: 100,
  });
  const applicable = rows.filter((scheme) => applicableToFarmer(scheme, req.user.profile)).slice(0, 30);
  return res.json({ success: true, data: await Promise.all(applicable.map((scheme) => schemeResponse(scheme, language))) });
}));

router.get('/saved', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const saved = await FarmerSavedScheme.findAll({
    where: { userId: req.user.id },
    include: [{
      model: GovernmentScheme,
      where: { isPublished: true, isActive: true },
      include: [{ model: SchemeCategory, attributes: ['id', 'slug', 'name', 'translations', 'icon'] }],
    }],
    order: [['createdAt', 'DESC']],
    limit: 100,
  });
  const data = await Promise.all(saved.map(async (item) => ({
    savedId: item.id,
    savedAt: item.createdAt,
    scheme: await schemeResponse(item.GovernmentScheme, language),
  })));
  return res.json({ success: true, data });
}));

router.post('/saved', asyncHandler(async (req, res) => {
  assertUuid(req.body.schemeId);
  const scheme = await GovernmentScheme.findOne({ where: { id: req.body.schemeId, isPublished: true, isActive: true } });
  if (!scheme) throw new HttpError(404, 'Scheme not found.');
  const [saved] = await FarmerSavedScheme.findOrCreate({
    where: { userId: req.user.id, schemeId: scheme.id },
    defaults: { userId: req.user.id, schemeId: scheme.id },
  });
  return res.status(201).json({ success: true, data: { id: saved.id, schemeId: scheme.id } });
}));

router.delete('/saved/:id', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const deleted = await FarmerSavedScheme.destroy({ where: { id: req.params.id, userId: req.user.id } });
  if (!deleted) throw new HttpError(404, 'Saved scheme not found.');
  return res.json({ success: true, message: 'Saved scheme removed.' });
}));

router.get('/updates', asyncHandler(async (req, res) => {
  const language = languageFromRequest(req);
  const updates = await SchemeUpdate.findAll({
    include: [{
      model: GovernmentScheme,
      where: { isPublished: true, isActive: true },
      include: [{ model: SchemeCategory, attributes: ['id', 'slug', 'name', 'translations', 'icon'] }],
    }],
    order: [['verifiedAt', 'DESC']],
    limit: 50,
  });
  const data = await Promise.all(updates.map(async (update) => ({
    id: update.id,
    title: update.title,
    summary: update.summary,
    source: update.source,
    verifiedAt: update.verifiedAt,
    scheme: await schemeResponse(update.GovernmentScheme, language),
  })));
  return res.json({ success: true, data });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const language = languageFromRequest(req);
  const scheme = await GovernmentScheme.findOne({
    where: { id: req.params.id, isPublished: true, isActive: true },
    include: [{ model: SchemeCategory, attributes: ['id', 'slug', 'name', 'translations', 'icon'] }],
  });
  if (!scheme) throw new HttpError(404, 'Government scheme not found.');
  const saved = await FarmerSavedScheme.findOne({ where: { userId: req.user.id, schemeId: scheme.id }, attributes: ['id'] });
  return res.json({
    success: true,
    data: {
      ...(await schemeResponse(scheme, language)),
      isSaved: Boolean(saved),
      savedId: saved?.id || null,
      eligibilityNote: 'Eligibility assistance is preliminary and does not guarantee official approval or payment.',
    },
  });
}));

router.post('/:id/check-eligibility', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const scheme = await GovernmentScheme.findOne({
    where: { id: req.params.id, isPublished: true, isActive: true },
    attributes: ['id', 'eligibilityCriteria'],
  });
  if (!scheme) throw new HttpError(404, 'Government scheme not found.');
  if (req.body.answers !== undefined && (!req.body.answers || typeof req.body.answers !== 'object' || Array.isArray(req.body.answers))) {
    throw new HttpError(400, 'Eligibility answers must be an object.');
  }
  const answers = req.body.answers || {};
  for (const [field, value] of Object.entries(answers)) {
    if (!ELIGIBILITY_FIELDS.has(field)) throw new HttpError(400, 'Eligibility answers may include only fields requested by the scheme.');
    if (!(typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || (Array.isArray(value) && value.every((item) => typeof item === 'string')))) {
      throw new HttpError(400, 'Eligibility answers must be text, numbers, yes/no values, or text lists.');
    }
    if (typeof value === 'string' && value.length > 200) throw new HttpError(400, 'Eligibility answers must be no more than 200 characters.');
    if (Array.isArray(value) && value.length > 30) throw new HttpError(400, 'Provide no more than 30 values in an eligibility answer.');
  }
  const result = evaluateEligibility(scheme.eligibilityCriteria, req.user.profile, answers);
  return res.json({ success: true, data: result });
}));

module.exports = router;
