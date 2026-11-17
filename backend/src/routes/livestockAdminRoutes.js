const express = require('express');
const { Op } = require('sequelize');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const {
  sequelize,
  LivestockCategory,
  LivestockBreed,
  LivestockListing,
  LivestockImage,
  LivestockSellerProfile,
  LivestockReport,
  LivestockEnquiry,
  LivestockAdminAuditLog,
} = require('../models');
const cloudinaryService = require('../services/cloudinaryService');
const { text, uuid, pageValues, listingView } = require('../services/livestockService');

const router = express.Router();
router.use(requireAuth, (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Administrator access is required.' });
  return next();
});

['id', 'breedId', 'reportId', 'imageId'].forEach((name) => {
  router.param(name, (req, res, next, value) => {
    try {
      uuid(value, name);
      next();
    } catch (error) {
      next(error);
    }
  });
});

function translations(value, field = 'Translations') {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Buffer.byteLength(JSON.stringify(value), 'utf8') > 8000) {
    throw new HttpError(400, `${field} must be a small language-to-text object.`);
  }
  const allowed = ['en', 'te', 'hi'];
  for (const [language, phrase] of Object.entries(value)) {
    if (!allowed.includes(language) || typeof phrase !== 'string' || phrase.trim().length > 160) {
      throw new HttpError(400, `${field} may include only short English, Telugu, or Hindi text.`);
    }
  }
  return value;
}

function slug(value, field) {
  const result = text(value, field, 100).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result)) throw new HttpError(400, `${field} may contain lowercase letters, numbers, and hyphens.`);
  return result;
}

async function audit(adminId, entityType, entityId, action, details, transaction) {
  await LivestockAdminAuditLog.create({
    adminId,
    entityType,
    entityId: entityId ? String(entityId) : null,
    action,
    details: details || {},
  }, { transaction });
}

function listingIncludes() {
  return [
    { model: LivestockCategory, attributes: ['id', 'slug', 'name', 'translations', 'isActive'], required: false },
    { model: LivestockBreed, attributes: ['id', 'slug', 'name', 'translations', 'isActive'], required: false },
    {
      model: LivestockSellerProfile,
      attributes: ['userId', 'sellerName', 'description', 'contactPhone', 'allowPhoneContact', 'isSuspended', 'state', 'district', 'mandal', 'village', 'pinCode', 'verificationStatus', 'verificationNote', 'verifiedAt'],
      required: false,
    },
    { model: LivestockImage, attributes: ['id', 'assetType', 'url', 'publicId', 'format', 'bytes', 'durationSeconds', 'position'], separate: true, order: [['position', 'ASC']] },
  ];
}

router.get('/dashboard', asyncHandler(async (req, res) => {
  const [pendingListings, activeListings, openReports, pendingSellers, totalListings, enquiries] = await Promise.all([
    LivestockListing.count({ where: { status: 'pending' } }),
    LivestockListing.count({ where: { status: 'approved', availability: 'available' } }),
    LivestockReport.count({ where: { status: 'open' } }),
    LivestockSellerProfile.count({ where: { verificationStatus: 'pending', isSuspended: false } }),
    LivestockListing.count(),
    LivestockEnquiry.count(),
  ]);
  res.json({ success: true, data: { pendingListings, activeListings, openReports, pendingSellers, totalListings, enquiries } });
}));

router.get('/categories', asyncHandler(async (req, res) => {
  const categories = await LivestockCategory.findAll({
    include: [{ model: LivestockBreed, attributes: ['id', 'slug', 'name', 'translations', 'isActive'], required: false }],
    order: [['name', 'ASC'], [LivestockBreed, 'name', 'ASC']],
  });
  res.json({ success: true, data: categories });
}));

router.post('/categories', asyncHandler(async (req, res) => {
  const name = text(req.body.name, 'Category name', 160);
  const category = await sequelize.transaction(async (transaction) => {
    const created = await LivestockCategory.create({
      slug: slug(req.body.slug, 'Category slug'),
      name,
      translations: translations(req.body.translations || { en: name }),
      icon: text(req.body.icon || 'beef', 'Category icon', 60),
      isActive: req.body.isActive === undefined ? true : req.body.isActive,
    }, { transaction });
    if (typeof created.isActive !== 'boolean') throw new HttpError(400, 'isActive must be true or false.');
    await audit(req.user.id, 'category', created.id, 'created', { slug: created.slug }, transaction);
    return created;
  });
  res.status(201).json({ success: true, data: category });
}));

router.put('/categories/:id', asyncHandler(async (req, res) => {
  const category = await LivestockCategory.findByPk(req.params.id);
  if (!category) throw new HttpError(404, 'The livestock category was not found.');
  const updates = {};
  if (req.body.name !== undefined) updates.name = text(req.body.name, 'Category name', 160);
  if (req.body.slug !== undefined) updates.slug = slug(req.body.slug, 'Category slug');
  if (req.body.icon !== undefined) updates.icon = text(req.body.icon, 'Category icon', 60);
  if (req.body.translations !== undefined) updates.translations = translations(req.body.translations);
  if (req.body.isActive !== undefined) {
    if (typeof req.body.isActive !== 'boolean') throw new HttpError(400, 'isActive must be true or false.');
    updates.isActive = req.body.isActive;
  }
  await sequelize.transaction(async (transaction) => {
    await category.update(updates, { transaction });
    await audit(req.user.id, 'category', category.id, 'updated', updates, transaction);
  });
  res.json({ success: true, data: category });
}));

router.get('/breeds', asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.categoryId) where.categoryId = uuid(req.query.categoryId, 'Category');
  const breeds = await LivestockBreed.findAll({
    where,
    include: [{ model: LivestockCategory, attributes: ['id', 'name', 'slug'], required: true }],
    order: [['name', 'ASC']],
  });
  res.json({ success: true, data: breeds });
}));

router.post('/breeds', asyncHandler(async (req, res) => {
  const categoryId = uuid(req.body.categoryId, 'Category');
  const category = await LivestockCategory.findOne({ where: { id: categoryId, isActive: true } });
  if (!category) throw new HttpError(400, 'Choose an active livestock category.');
  const name = text(req.body.name, 'Breed name', 160);
  const breed = await LivestockBreed.create({
    categoryId,
    slug: slug(req.body.slug, 'Breed slug'),
    name,
    translations: translations(req.body.translations || { en: name }, 'Breed translations'),
    isActive: req.body.isActive === undefined ? true : req.body.isActive,
  });
  if (typeof breed.isActive !== 'boolean') throw new HttpError(400, 'isActive must be true or false.');
  await audit(req.user.id, 'breed', breed.id, 'created', { categoryId, slug: breed.slug });
  res.status(201).json({ success: true, data: breed });
}));

router.put('/breeds/:breedId', asyncHandler(async (req, res) => {
  const breed = await LivestockBreed.findByPk(req.params.breedId);
  if (!breed) throw new HttpError(404, 'The livestock breed was not found.');
  const updates = {};
  if (req.body.name !== undefined) updates.name = text(req.body.name, 'Breed name', 160);
  if (req.body.slug !== undefined) updates.slug = slug(req.body.slug, 'Breed slug');
  if (req.body.translations !== undefined) updates.translations = translations(req.body.translations, 'Breed translations');
  if (req.body.isActive !== undefined) {
    if (typeof req.body.isActive !== 'boolean') throw new HttpError(400, 'isActive must be true or false.');
    updates.isActive = req.body.isActive;
  }
  await sequelize.transaction(async (transaction) => {
    await breed.update(updates, { transaction });
    await audit(req.user.id, 'breed', breed.id, 'updated', updates, transaction);
  });
  res.json({ success: true, data: breed });
}));

router.get('/sellers', asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) {
    if (!['pending', 'verified', 'rejected'].includes(req.query.status)) throw new HttpError(400, 'Choose a supported seller verification status.');
    where.verificationStatus = req.query.status;
  }
  if (req.query.suspended !== undefined) {
    if (!['true', 'false'].includes(req.query.suspended)) throw new HttpError(400, 'suspended must be true or false.');
    where.isSuspended = req.query.suspended === 'true';
  }
  const { page, limit, offset } = pageValues(req, 100);
  const result = await LivestockSellerProfile.findAndCountAll({
    where,
    limit,
    offset,
    order: [['updatedAt', 'DESC']],
  });
  res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } });
}));

router.put('/sellers/:sellerId/status', asyncHandler(async (req, res) => {
  const profile = await LivestockSellerProfile.findByPk(req.params.sellerId);
  if (!profile) throw new HttpError(404, 'The livestock seller profile was not found.');
  const verificationStatus = req.body.verificationStatus === undefined ? profile.verificationStatus : req.body.verificationStatus;
  if (!['pending', 'verified', 'rejected'].includes(verificationStatus)) throw new HttpError(400, 'Choose pending, verified, or rejected for seller verification.');
  if (req.body.isSuspended !== undefined && typeof req.body.isSuspended !== 'boolean') throw new HttpError(400, 'isSuspended must be true or false.');
  const verificationNote = req.body.verificationNote === undefined
    ? profile.verificationNote
    : text(req.body.verificationNote, 'Verification note', 500, false);
  await sequelize.transaction(async (transaction) => {
    await profile.update({
      verificationStatus,
      verificationNote,
      verifiedAt: verificationStatus === 'verified' ? new Date() : null,
      ...(req.body.isSuspended === undefined ? {} : { isSuspended: req.body.isSuspended }),
    }, { transaction });
    await audit(req.user.id, 'seller', profile.userId, req.body.isSuspended ? 'suspended' : 'verification_updated', {
      verificationStatus,
      isSuspended: profile.isSuspended,
      verificationNote,
    }, transaction);
  });
  res.json({ success: true, data: profile });
}));

router.get('/reports', asyncHandler(async (req, res) => {
  const { page, limit, offset } = pageValues(req, 100);
  const where = {};
  if (req.query.status) {
    if (!['open', 'reviewed', 'dismissed', 'action_taken'].includes(req.query.status)) throw new HttpError(400, 'Choose a supported report status.');
    where.status = req.query.status;
  }
  const result = await LivestockReport.findAndCountAll({
    where,
    include: [{ model: LivestockListing, include: listingIncludes(), required: false }],
    distinct: true,
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });
  res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } });
}));

router.put('/reports/:reportId', asyncHandler(async (req, res) => {
  const status = text(req.body.status, 'Report status', 30);
  if (!['reviewed', 'dismissed', 'action_taken'].includes(status)) throw new HttpError(400, 'Choose reviewed, dismissed, or action_taken.');
  const adminNote = text(req.body.adminNote, 'Admin note', 1000, false);
  await sequelize.transaction(async (transaction) => {
    const report = await LivestockReport.findByPk(req.params.reportId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!report) throw new HttpError(404, 'The livestock report was not found.');
    await report.update({ status, adminNote, reviewedBy: req.user.id, reviewedAt: new Date() }, { transaction });
    if (status === 'action_taken') {
      await LivestockListing.update(
        { status: 'rejected', availability: 'paused', rejectionReason: adminNote || 'This listing was removed after a report review.' },
        { where: { id: report.listingId }, transaction },
      );
    }
    await audit(req.user.id, 'report', report.id, status, { listingId: report.listingId, adminNote }, transaction);
  });
  res.json({ success: true, message: 'The report review was saved.' });
}));

router.get('/audit', asyncHandler(async (req, res) => {
  const { page, limit, offset } = pageValues(req, 100);
  const result = await LivestockAdminAuditLog.findAndCountAll({
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });
  res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } });
}));

router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, offset } = pageValues(req, 100);
  const where = {};
  if (req.query.status) {
    if (!['pending', 'approved', 'rejected', 'archived'].includes(req.query.status)) throw new HttpError(400, 'Choose a supported listing status.');
    where.status = req.query.status;
  }
  if (req.query.q) where.listingName = { [Op.iLike]: `%${text(req.query.q, 'Search term', 100)}%` };
  const result = await LivestockListing.findAndCountAll({
    where,
    include: listingIncludes(),
    distinct: true,
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });
  res.json({ success: true, data: result.rows.map((listing) => listingView(listing, { profileId: req.user.id })), pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const listing = await LivestockListing.findByPk(req.params.id, { include: listingIncludes() });
  if (!listing) throw new HttpError(404, 'The livestock listing was not found.');
  res.json({ success: true, data: listingView(listing, { profileId: req.user.id }) });
}));

router.put('/:id/approve', asyncHandler(async (req, res) => {
  await sequelize.transaction(async (transaction) => {
    const listing = await LivestockListing.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!listing) throw new HttpError(404, 'The livestock listing was not found.');
    if (listing.status === 'archived') throw new HttpError(409, 'An archived listing cannot be approved.');
    const [category, profile, imageCount] = await Promise.all([
      LivestockCategory.findOne({ where: { id: listing.categoryId, isActive: true }, transaction }),
      LivestockSellerProfile.findByPk(listing.sellerId, { transaction }),
      LivestockImage.count({ where: { listingId: listing.id, assetType: 'image' }, transaction }),
    ]);
    if (!category) throw new HttpError(409, 'Activate the listing category before approval.');
    if (!profile || profile.isSuspended) throw new HttpError(409, 'A suspended or missing seller cannot have an approved listing.');
    if (!imageCount) throw new HttpError(409, 'A listing needs at least one animal photo before approval.');
    await listing.update({ status: 'approved', rejectionReason: null, availability: listing.availability === 'sold' ? 'sold' : 'available' }, { transaction });
    await audit(req.user.id, 'listing', listing.id, 'approved', {}, transaction);
  });
  res.json({ success: true, message: 'Livestock listing approved.' });
}));

router.put('/:id/reject', asyncHandler(async (req, res) => {
  const reason = text(req.body.reason, 'Rejection reason', 1000);
  await sequelize.transaction(async (transaction) => {
    const listing = await LivestockListing.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!listing) throw new HttpError(404, 'The livestock listing was not found.');
    if (listing.status === 'archived') throw new HttpError(409, 'An archived listing cannot be rejected.');
    await listing.update({ status: 'rejected', availability: 'paused', rejectionReason: reason }, { transaction });
    await audit(req.user.id, 'listing', listing.id, 'rejected', { reason }, transaction);
  });
  res.json({ success: true, message: 'Livestock listing rejected.' });
}));

router.delete('/media/:imageId', asyncHandler(async (req, res) => {
  const image = await LivestockImage.findByPk(req.params.imageId);
  if (!image) throw new HttpError(404, 'Livestock media was not found.');
  const listing = await LivestockListing.findByPk(image.listingId);
  if (!listing) throw new HttpError(404, 'The livestock listing was not found.');
  await sequelize.transaction(async (transaction) => {
    await image.destroy({ transaction });
    if (listing.status === 'approved') await listing.update({ status: 'pending', rejectionReason: null }, { transaction });
    await audit(req.user.id, 'media', image.id, 'removed', { listingId: listing.id }, transaction);
  });
  if (image.assetType === 'video') await cloudinaryService.deletePublicVideo(image.publicId);
  else await cloudinaryService.deletePublicImage(image.publicId);
  res.json({ success: true, message: 'Livestock media removed.' });
}));

module.exports = router;
