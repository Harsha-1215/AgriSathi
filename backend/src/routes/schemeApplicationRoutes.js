const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { requireAuth, requireFarmer } = require('../middleware/auth');
const { FarmerSchemeApplication, GovernmentScheme, SchemeCategory } = require('../models');
const assertUuid = require('../utils/assertUuid');

const router = express.Router();
router.use(requireAuth, requireFarmer);
const statuses = new Set(['draft', 'submitted', 'under_review', 'additional_information_required', 'approved', 'rejected', 'completed']);

function optionalText(value, field, max = 2000) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > max) throw new HttpError(400, `${field} must be no more than ${max} characters.`);
  return value.trim();
}

function validateDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00Z`)
    : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, 'Submission date must use YYYY-MM-DD.');
  }
  return value;
}

router.get('/', asyncHandler(async (req, res) => {
  const applications = await FarmerSchemeApplication.findAll({
    where: { userId: req.user.id },
    include: [{
      model: GovernmentScheme,
      attributes: ['id', 'schemeName', 'department', 'governmentLevel', 'state'],
      include: [{ model: SchemeCategory, attributes: ['name', 'slug'] }],
    }],
    order: [['updatedAt', 'DESC']],
    limit: 100,
  });
  return res.json({
    success: true,
    data: applications.map((item) => ({
      id: item.id,
      scheme: item.GovernmentScheme,
      applicationReference: item.applicationReference,
      submissionDate: item.submissionDate,
      status: item.status,
      statusSource: item.statusSource,
      notes: item.notes,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  assertUuid(req.body.schemeId);
  const scheme = await GovernmentScheme.findOne({ where: { id: req.body.schemeId, isPublished: true, isActive: true }, attributes: ['id'] });
  if (!scheme) throw new HttpError(404, 'Published scheme not found.');
  const status = req.body.status || 'draft';
  if (!statuses.has(status)) throw new HttpError(400, 'Choose a supported application tracking status.');
  const application = await FarmerSchemeApplication.create({
    userId: req.user.id,
    schemeId: scheme.id,
    applicationReference: optionalText(req.body.applicationReference, 'Application reference', 180),
    submissionDate: validateDate(req.body.submissionDate),
    status,
    statusSource: 'farmer_entered',
    notes: optionalText(req.body.notes, 'Notes'),
  });
  return res.status(201).json({ success: true, data: application });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const application = await FarmerSchemeApplication.findOne({
    where: { id: req.params.id, userId: req.user.id },
    include: [{ model: GovernmentScheme, attributes: ['id', 'schemeName', 'department', 'officialWebsite'] }],
  });
  if (!application) throw new HttpError(404, 'Application record not found.');
  return res.json({ success: true, data: application });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const application = await FarmerSchemeApplication.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!application) throw new HttpError(404, 'Application record not found.');
  const updates = {};
  if (req.body.applicationReference !== undefined) updates.applicationReference = optionalText(req.body.applicationReference, 'Application reference', 180);
  if (req.body.submissionDate !== undefined) updates.submissionDate = validateDate(req.body.submissionDate);
  if (req.body.notes !== undefined) updates.notes = optionalText(req.body.notes, 'Notes');
  if (req.body.status !== undefined) {
    if (!statuses.has(req.body.status)) throw new HttpError(400, 'Choose a supported application tracking status.');
    updates.status = req.body.status;
  }
  updates.statusSource = 'farmer_entered';
  await application.update(updates);
  return res.json({ success: true, data: application });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const deleted = await FarmerSchemeApplication.destroy({ where: { id: req.params.id, userId: req.user.id } });
  if (!deleted) throw new HttpError(404, 'Application record not found.');
  return res.json({ success: true, message: 'Application tracking record deleted.' });
}));

module.exports = router;
