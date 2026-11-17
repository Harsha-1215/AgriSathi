const express = require('express');
const { Op, literal } = require('sequelize');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const {
  sequelize,
  MarketplaceCategory,
  MarketplaceProduct,
  ProductImage,
  SellerProfile,
  MarketplaceOrder,
  MarketplaceOrderItem,
  MarketplacePayment,
  ProductEnquiry,
  ProductReview,
  ProductReport,
  ProductInventoryHistory,
  MarketplaceAdminAuditLog,
} = require('../models');
const { ORDER_STATUSES, text, productView } = require('../services/marketplaceService');

const router = express.Router();
router.param('id', (req, res, next, value) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return next(new HttpError(400, 'The marketplace record ID is invalid.'));
  }
  return next();
});
router.use(requireAuth, (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Administrator access is required.' });
  }
  return next();
});

function pageValues(req) {
  const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 30));
  return { page, limit, offset: (page - 1) * limit };
}

function productIncludes() {
  return [
    { model: MarketplaceCategory, attributes: ['id', 'slug', 'name', 'translations', 'icon', 'isActive'] },
    { model: ProductImage, attributes: ['id', 'imageUrl', 'publicId', 'position'], separate: true, order: [['position', 'ASC']] },
    {
      model: SellerProfile,
      attributes: ['businessName', 'verificationStatus', 'verificationNote', 'licenseNumber', 'state', 'district', 'mandal', 'village', 'pinCode'],
      required: false,
    },
  ];
}

async function audit(adminId, entityType, entityId, action, details, transaction) {
  await MarketplaceAdminAuditLog.create({
    adminId,
    entityType,
    entityId: entityId ? String(entityId) : null,
    action,
    details: details || {},
  }, { transaction });
}

router.get('/dashboard', asyncHandler(async (req, res) => {
  const [
    pendingListings,
    openReports,
    pendingReviews,
    pendingSellers,
    orders,
    verifiedPayments,
    deliveredOrders,
  ] = await Promise.all([
    MarketplaceProduct.count({ where: { status: 'pending' } }),
    ProductReport.count({ where: { status: 'open' } }),
    ProductReview.count({ where: { status: 'pending' } }),
    SellerProfile.count({ where: { verificationStatus: 'pending' } }),
    MarketplaceOrder.count(),
    MarketplacePayment.findOne({
      attributes: [[sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('amount')), 0), 'total']],
      where: { status: 'succeeded', signatureVerified: true },
      raw: true,
    }),
    MarketplaceOrder.findOne({
      attributes: [[sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('total')), 0), 'total']],
      where: { status: 'delivered' },
      raw: true,
    }),
  ]);
  res.json({
    success: true,
    data: {
      pendingListings,
      openReports,
      pendingReviews,
      pendingSellers,
      orders,
      verifiedOnlinePaymentTotal: Number(verifiedPayments.total || 0),
      deliveredOrderValue: Number(deliveredOrders.total || 0),
    },
  });
}));

router.get('/categories', asyncHandler(async (req, res) => {
  const categories = await MarketplaceCategory.findAll({ order: [['name', 'ASC']] });
  res.json({ success: true, data: categories });
}));

router.post('/categories', asyncHandler(async (req, res) => {
  const slug = text(req.body.slug, 'Category slug', 100).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new HttpError(400, 'Category slug may contain lowercase letters, numbers, and hyphens.');
  const translations = req.body.translations === undefined ? {} : req.body.translations;
  if (!translations || typeof translations !== 'object' || Array.isArray(translations) || Buffer.byteLength(JSON.stringify(translations), 'utf8') > 8000) {
    throw new HttpError(400, 'Category translations must be a small object.');
  }
  if (req.body.isActive !== undefined && typeof req.body.isActive !== 'boolean') {
    throw new HttpError(400, 'isActive must be true or false.');
  }
  const category = await sequelize.transaction(async (transaction) => {
    const created = await MarketplaceCategory.create({
      slug,
      name: text(req.body.name, 'Category name', 160),
      translations,
      icon: text(req.body.icon || 'package', 'Category icon', 60),
      isActive: req.body.isActive === undefined ? true : req.body.isActive,
    }, { transaction });
    await audit(req.user.id, 'category', created.id, 'created', { slug }, transaction);
    return created;
  });
  res.status(201).json({ success: true, data: category });
}));

router.put('/categories/:id', asyncHandler(async (req, res) => {
  const category = await MarketplaceCategory.findByPk(req.params.id);
  if (!category) throw new HttpError(404, 'The marketplace category was not found.');
  const updates = {};
  if (req.body.name !== undefined) updates.name = text(req.body.name, 'Category name', 160);
  if (req.body.icon !== undefined) updates.icon = text(req.body.icon, 'Category icon', 60);
  if (req.body.translations !== undefined) {
    if (!req.body.translations || typeof req.body.translations !== 'object' || Array.isArray(req.body.translations) || Buffer.byteLength(JSON.stringify(req.body.translations), 'utf8') > 8000) {
      throw new HttpError(400, 'Category translations must be a small object.');
    }
    updates.translations = req.body.translations;
  }
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

router.get('/products', asyncHandler(async (req, res) => {
  const { page, limit, offset } = pageValues(req);
  const where = {};
  if (req.query.status) {
    if (!['pending', 'approved', 'rejected', 'archived'].includes(req.query.status)) throw new HttpError(400, 'Choose a supported listing status.');
    where.status = req.query.status;
  }
  if (req.query.q) where.productName = { [Op.iLike]: `%${text(req.query.q, 'Search term', 100)}%` };
  const result = await MarketplaceProduct.findAndCountAll({
    where,
    include: productIncludes(),
    distinct: true,
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });
  const rows = result.rows.map((row) => {
    const data = productView(row);
    data.seller.licenseNumber = row.SellerProfile ? row.SellerProfile.licenseNumber : null;
    data.seller.verificationNote = row.SellerProfile ? row.SellerProfile.verificationNote : null;
    return data;
  });
  res.json({ success: true, data: rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } });
}));

router.put('/products/:id/moderation', asyncHandler(async (req, res) => {
  const status = text(req.body.status, 'Moderation status', 20);
  if (!['approved', 'rejected'].includes(status)) throw new HttpError(400, 'Choose approved or rejected.');
  const reason = status === 'rejected' ? text(req.body.reason, 'Rejection reason', 1000) : null;
  await sequelize.transaction(async (transaction) => {
    const product = await MarketplaceProduct.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!product) throw new HttpError(404, 'The marketplace listing was not found.');
    if (product.status === 'archived') throw new HttpError(409, 'An archived listing cannot be moderated.');
    if (status === 'approved' && product.regulatedProduct) {
      const seller = await SellerProfile.findByPk(product.sellerId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!seller || seller.verificationStatus !== 'verified' || !seller.licenseNumber || !product.safetyInformation) {
        throw new HttpError(409, 'Regulated products require a verified seller, seller license, and safety information before approval.');
      }
    }
    await product.update({
      status,
      rejectionReason: reason,
      availability: status === 'approved'
        ? Number(product.availableQuantity) > 0 ? 'available' : 'out_of_stock'
        : 'unavailable',
    }, { transaction });
    await audit(req.user.id, 'product', product.id, status, { reason }, transaction);
  });
  res.json({ success: true, message: `The listing was ${status}.` });
}));

router.get('/sellers', asyncHandler(async (req, res) => {
  const { page, limit, offset } = pageValues(req);
  const where = {};
  if (req.query.status) {
    if (!['pending', 'verified', 'rejected'].includes(req.query.status)) throw new HttpError(400, 'Choose a supported seller verification status.');
    where.verificationStatus = req.query.status;
  }
  const result = await SellerProfile.findAndCountAll({
    where,
    limit,
    offset,
    order: [['updatedAt', 'DESC']],
  });
  res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } });
}));

router.put('/sellers/:userId/verification', asyncHandler(async (req, res) => {
  const status = text(req.body.status, 'Verification status', 20);
  if (!['verified', 'rejected', 'pending'].includes(status)) throw new HttpError(400, 'Choose a supported seller verification status.');
  const note = text(req.body.note, 'Verification note', 1000, false);
  const profile = await sequelize.transaction(async (transaction) => {
    const locked = await SellerProfile.findByPk(req.params.userId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!locked) throw new HttpError(404, 'The seller profile was not found.');
    if (status === 'verified' && !locked.licenseNumber) throw new HttpError(409, 'Add and review the seller license before verifying this seller.');
    await locked.update({ verificationStatus: status, verificationNote: note }, { transaction });
    if (status !== 'verified') {
      await MarketplaceProduct.update(
        { status: 'pending', rejectionReason: 'Seller verification status changed; administrator review is required.' },
        { where: { sellerId: locked.userId, regulatedProduct: true, status: 'approved' }, transaction },
      );
    }
    await audit(req.user.id, 'seller', locked.userId, `verification_${status}`, { note }, transaction);
    return locked;
  });
  res.json({ success: true, data: profile });
}));

router.get('/reports', asyncHandler(async (req, res) => {
  const { page, limit, offset } = pageValues(req);
  const where = {};
  if (req.query.status) {
    if (!['open', 'reviewed', 'dismissed'].includes(req.query.status)) throw new HttpError(400, 'Choose a supported report status.');
    where.status = req.query.status;
  }
  const result = await ProductReport.findAndCountAll({
    where,
    include: [{ model: MarketplaceProduct, attributes: ['id', 'productName', 'status'], required: false }],
    limit,
    offset,
    order: [['createdAt', 'ASC']],
  });
  res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } });
}));

router.put('/reports/:id', asyncHandler(async (req, res) => {
  const status = text(req.body.status, 'Report status', 20);
  if (!['reviewed', 'dismissed'].includes(status)) throw new HttpError(400, 'Choose reviewed or dismissed.');
  const report = await ProductReport.findByPk(req.params.id);
  if (!report) throw new HttpError(404, 'The product report was not found.');
  const hideProduct = req.body.hideProduct === true;
  await sequelize.transaction(async (transaction) => {
    await report.update({ status, reviewedBy: req.user.id }, { transaction });
    if (hideProduct && status === 'reviewed') {
      await MarketplaceProduct.update(
        { status: 'rejected', availability: 'unavailable', rejectionReason: 'Listing hidden after administrator review.' },
        { where: { id: report.productId }, transaction },
      );
    }
    await audit(req.user.id, 'report', report.id, status, { hideProduct }, transaction);
  });
  res.json({ success: true, message: 'The report was reviewed.' });
}));

router.get('/reviews', asyncHandler(async (req, res) => {
  const { page, limit, offset } = pageValues(req);
  const where = {};
  if (req.query.status) {
    if (!['pending', 'approved', 'hidden'].includes(req.query.status)) throw new HttpError(400, 'Choose a supported review status.');
    where.status = req.query.status;
  }
  const result = await ProductReview.findAndCountAll({
    where,
    include: [{ model: MarketplaceProduct, attributes: ['id', 'productName'], required: false }],
    limit,
    offset,
    order: [['createdAt', 'ASC']],
  });
  res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } });
}));

router.put('/reviews/:id/moderation', asyncHandler(async (req, res) => {
  const status = text(req.body.status, 'Review status', 20);
  if (!['approved', 'hidden'].includes(status)) throw new HttpError(400, 'Choose approved or hidden.');
  const review = await ProductReview.findByPk(req.params.id);
  if (!review) throw new HttpError(404, 'The product review was not found.');
  const moderationNote = text(req.body.note, 'Moderation note', 1000, false);
  await sequelize.transaction(async (transaction) => {
    await review.update({ status, moderationNote }, { transaction });
    await audit(req.user.id, 'review', review.id, status, { moderationNote }, transaction);
  });
  res.json({ success: true, message: `The review was ${status}.` });
}));

router.get('/orders', asyncHandler(async (req, res) => {
  const { page, limit, offset } = pageValues(req);
  const where = {};
  if (req.query.status) {
    const status = text(req.query.status, 'Order status', 40);
    if (!ORDER_STATUSES.has(status)) throw new HttpError(400, 'Choose a supported order status.');
    where.status = status;
  }
  const result = await MarketplaceOrder.findAndCountAll({
    where,
    include: [{ model: MarketplaceOrderItem }, { model: MarketplacePayment, attributes: ['id', 'provider', 'amount', 'status', 'signatureVerified'] }],
    distinct: true,
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });
  res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } });
}));

router.get('/audit-logs', asyncHandler(async (req, res) => {
  const { page, limit, offset } = pageValues(req);
  const result = await MarketplaceAdminAuditLog.findAndCountAll({
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });
  res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } });
}));

module.exports = router;
