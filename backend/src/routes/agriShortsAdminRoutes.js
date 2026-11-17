const express = require('express');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { requireAuth } = require('../middleware/auth');
const {
  AgriVideo, AgriVideoCategory, AgriVideoComment, AgriVideoReport,
  AgriShortsModerationLog,
} = require('../models');
const assertUuid = require('../utils/assertUuid');
const { deleteVideoAsset } = require('../services/cloudinaryService');

const router = express.Router();
router.use(requireAuth, (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Administrator access is required.' });
  return next();
});

function text(value, field, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, `${field} is required and must be no more than ${max} characters.`);
  }
  return value.trim();
}

function booleanValue(value, field) {
  if (typeof value !== 'boolean') throw new HttpError(400, `${field} must be true or false.`);
  return value;
}

async function logAction(req, videoId, action, reason, details = {}) {
  await AgriShortsModerationLog.create({
    videoId,
    adminId: req.user.id,
    action,
    reason: reason || null,
    details,
  });
}

function videoInclude() {
  return [{ model: AgriVideoCategory, attributes: ['id', 'slug', 'name'] }];
}

router.get('/videos', asyncHandler(async (req, res) => {
  const where = {};
  if (['pending', 'approved', 'rejected'].includes(req.query.status)) where.status = req.query.status;
  const videos = await AgriVideo.findAll({
    where,
    include: videoInclude(),
    order: [['createdAt', 'DESC']],
    limit: 200,
  });
  return res.json({ success: true, data: videos });
}));

router.put('/videos/:id/review', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  if (!['approved', 'rejected'].includes(req.body.status)) throw new HttpError(400, 'Choose approved or rejected moderation status.');
  const video = await AgriVideo.findByPk(req.params.id);
  if (!video) throw new HttpError(404, 'Video not found.');
  const reason = req.body.status === 'rejected' ? text(req.body.reason, 'Rejection reason', 1000) : null;
  await video.update({
    status: req.body.status,
    rejectionReason: reason,
    publishedAt: req.body.status === 'approved' ? (video.publishedAt || new Date()) : null,
  });
  await logAction(req, video.id, req.body.status, reason);
  return res.json({ success: true, data: { id: video.id, status: video.status, rejectionReason: video.rejectionReason, publishedAt: video.publishedAt } });
}));

router.patch('/videos/:id/feature', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  if (typeof req.body.isFeatured !== 'boolean') throw new HttpError(400, 'isFeatured must be true or false.');
  const video = await AgriVideo.findOne({ where: { id: req.params.id, status: 'approved' } });
  if (!video) throw new HttpError(404, 'Published video not found.');
  await video.update({ isFeatured: req.body.isFeatured });
  await logAction(req, video.id, req.body.isFeatured ? 'featured' : 'unfeatured');
  return res.json({ success: true, data: { id: video.id, isFeatured: video.isFeatured } });
}));

router.delete('/videos/:id', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const video = await AgriVideo.findByPk(req.params.id);
  if (!video) throw new HttpError(404, 'Video not found.');
  const reason = text(req.body.reason, 'Removal reason', 1000);
  const videoId = video.id;
  const details = { creatorId: video.creatorId, title: video.title };
  await deleteVideoAsset(video.cloudinaryPublicId);
  const transaction = await AgriShortsModerationLog.sequelize.transaction();
  try {
    await AgriShortsModerationLog.create({
      videoId: null,
      adminId: req.user.id,
      action: 'deleted',
      reason,
      details: { ...details, videoId },
    }, { transaction });
    await video.destroy({ transaction });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
  return res.json({ success: true, message: 'Video record removed.' });
}));

router.get('/reports', asyncHandler(async (req, res) => {
  const where = {};
  if (['open', 'reviewed', 'dismissed'].includes(req.query.status)) where.status = req.query.status;
  const reports = await AgriVideoReport.findAll({
    where,
    include: [
      { model: AgriVideo, attributes: ['id', 'title', 'status'], required: false },
      { model: AgriVideoComment, attributes: ['id', 'comment', 'status'], required: false },
    ],
    order: [['createdAt', 'DESC']],
    limit: 200,
  });
  return res.json({ success: true, data: reports });
}));

router.put('/reports/:id', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  if (!['reviewed', 'dismissed'].includes(req.body.status)) throw new HttpError(400, 'Choose reviewed or dismissed.');
  const report = await AgriVideoReport.findByPk(req.params.id);
  if (!report) throw new HttpError(404, 'Report not found.');
  const reason = req.body.reason === undefined ? null : text(req.body.reason, 'Review note', 1000);
  await report.update({ status: req.body.status, reviewedBy: req.user.id });
  await logAction(req, report.videoId, `report_${req.body.status}`, reason, { reportId: report.id, commentId: report.commentId });
  return res.json({ success: true, data: report });
}));

router.put('/comments/:id/moderate', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  if (!['published', 'hidden'].includes(req.body.status)) throw new HttpError(400, 'Choose published or hidden.');
  const comment = await AgriVideoComment.findByPk(req.params.id);
  if (!comment) throw new HttpError(404, 'Comment not found.');
  const reason = req.body.status === 'hidden' ? text(req.body.reason, 'Moderation reason', 1000) : null;
  await comment.update({ status: req.body.status });
  await logAction(req, comment.videoId, `comment_${req.body.status}`, reason, { commentId: comment.id });
  return res.json({ success: true, data: { id: comment.id, status: comment.status } });
}));

router.get('/categories', asyncHandler(async (req, res) => {
  const rows = await AgriVideoCategory.findAll({ order: [['name', 'ASC']] });
  return res.json({ success: true, data: rows });
}));

router.post('/categories', asyncHandler(async (req, res) => {
  const slug = text(req.body.slug, 'Category slug', 80).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new HttpError(400, 'Category slug must be a lowercase URL-safe value.');
  const translations = req.body.translations === undefined ? {} : req.body.translations;
  const description = req.body.description === undefined ? {} : req.body.description;
  if (req.body.isActive !== undefined) booleanValue(req.body.isActive, 'isActive');
  if (!translations || typeof translations !== 'object' || Array.isArray(translations)) throw new HttpError(400, 'Translations must be an object.');
  if (!description || typeof description !== 'object' || Array.isArray(description)) throw new HttpError(400, 'Description must be an object.');
  for (const [language, name] of Object.entries(translations)) {
    if (!['en', 'te', 'hi'].includes(language) || typeof name !== 'string' || !name.trim()) throw new HttpError(400, 'Category translations must use en, te, or hi language keys and non-empty text.');
  }
  const category = await AgriVideoCategory.create({
    slug,
    name: text(req.body.name, 'Category name', 120),
    translations,
    description,
    icon: req.body.icon ? text(req.body.icon, 'Category icon', 60) : 'leaf',
    isActive: req.body.isActive !== false,
  });
  await logAction(req, null, 'category_created', null, { categoryId: category.id, slug });
  return res.status(201).json({ success: true, data: category });
}));

router.put('/categories/:id', asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const category = await AgriVideoCategory.findByPk(req.params.id);
  if (!category) throw new HttpError(404, 'Video category not found.');
  const updates = {};
  if (req.body.isActive !== undefined) updates.isActive = booleanValue(req.body.isActive, 'isActive');
  if (req.body.name !== undefined) updates.name = text(req.body.name, 'Category name', 120);
  if (req.body.slug !== undefined) {
    updates.slug = text(req.body.slug, 'Category slug', 80).toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(updates.slug)) throw new HttpError(400, 'Category slug must be a lowercase URL-safe value.');
  }
  if (req.body.translations !== undefined) {
    if (!req.body.translations || typeof req.body.translations !== 'object' || Array.isArray(req.body.translations)) throw new HttpError(400, 'Translations must be an object.');
    for (const [language, name] of Object.entries(req.body.translations)) {
      if (!['en', 'te', 'hi'].includes(language) || typeof name !== 'string' || !name.trim()) throw new HttpError(400, 'Category translations must use en, te, or hi language keys and non-empty text.');
    }
    updates.translations = req.body.translations;
  }
  if (req.body.description !== undefined) {
    if (!req.body.description || typeof req.body.description !== 'object' || Array.isArray(req.body.description)) throw new HttpError(400, 'Description must be an object.');
    updates.description = req.body.description;
  }
  if (req.body.icon !== undefined) updates.icon = text(req.body.icon, 'Category icon', 60);
  await category.update(updates);
  await logAction(req, null, 'category_updated', null, { categoryId: category.id, fields: Object.keys(updates) });
  return res.json({ success: true, data: category });
}));

router.get('/moderation-log', asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.videoId) {
    assertUuid(req.query.videoId);
    where[Op.or] = [{ videoId: req.query.videoId }, { videoId: null }];
  }
  const rows = await AgriShortsModerationLog.findAll({
    where,
    include: [{ model: AgriVideo, attributes: ['id', 'title'], required: false }],
    order: [['createdAt', 'DESC']],
    limit: 200,
  });
  return res.json({ success: true, data: rows });
}));

module.exports = router;
