const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { Op, Transaction, literal } = require('sequelize');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const {
  sequelize,
  MarketplaceCategory,
  MarketplaceProduct,
  ProductImage,
  SellerProfile,
  ShoppingCart,
  CartItem,
  Wishlist,
  WishlistItem,
  MarketplaceAddress,
  MarketplaceOrder,
  MarketplaceOrderItem,
  OrderStatusHistory,
  MarketplacePayment,
  ProductEnquiry,
  ProductReview,
  ProductReport,
  ProductInventoryHistory,
} = require('../models');
const cloudinaryService = require('../services/cloudinaryService');
const {
  text,
  decimal,
  money,
  quantity,
  boolean,
  object,
  optionalDate,
  validateImageSignature,
  productView,
  paiseFor,
  rupeesFromPaise,
} = require('../services/marketplaceService');

const router = express.Router();
const buyerRoles = ['farmer', 'farmer_user', 'buyer', 'seller'];
const sellerRoles = ['farmer', 'farmer_user', 'seller'];
const configuredImageLimit = Number.parseInt(process.env.MARKETPLACE_PRODUCT_IMAGE_MAX_BYTES, 10);
const imageLimit = Math.max(1, Math.min(
  configuredImageLimit > 0 ? configuredImageLimit : 5 * 1024 * 1024,
  8 * 1024 * 1024,
));
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: imageLimit, files: 5 },
  fileFilter(req, file, callback) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(new HttpError(400, 'Use a JPEG, PNG, or WebP product image.'));
    }
    return callback(null, true);
  },
});
function uploadProductFiles(req, res, next) {
  imageUpload.array('images', 5)(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return next(new HttpError(status, error.code === 'LIMIT_FILE_SIZE'
        ? 'Each product image must be no larger than the configured upload limit.'
        : 'Upload no more than five product images at a time.'));
    }
    return next(error);
  });
}
const enquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many enquiries. Please try again later.' },
});

function validateUuid(value, field) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, `${field} must be a valid identifier.`);
  }
  return value;
}

['id', 'productId', 'imageId'].forEach((name) => {
  router.param(name, (req, res, next, value) => {
    try {
      validateUuid(value, name);
      next();
    } catch (error) {
      next(error);
    }
  });
});

router.post('/payments/webhook', (req, res) => res.status(503).json({
  success: false,
  message: 'Online payment processing is not configured. No payment was recorded.',
}));
router.use(requireAuth);

function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Your account cannot use this marketplace feature.' });
    }
    return next();
  };
}

function parsePage(req) {
  const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(48, Number.parseInt(req.query.limit, 10) || 24));
  return { page, limit, offset: (page - 1) * limit };
}

function productIncludes({ sellerAttributes, activeCategoryOnly = false } = {}) {
  return [
    {
      model: MarketplaceCategory,
      attributes: ['id', 'slug', 'name', 'translations', 'icon', 'isActive'],
      ...(activeCategoryOnly ? { where: { isActive: true }, required: true } : {}),
    },
    { model: ProductImage, attributes: ['id', 'imageUrl', 'position'], separate: true, order: [['position', 'ASC']] },
    {
      model: SellerProfile,
      attributes: sellerAttributes || ['businessName', 'description', 'verificationStatus', 'state', 'district', 'mandal', 'village', 'pinCode'],
      required: false,
    },
  ];
}

async function categoryIsActive(categoryId, transaction) {
  const category = await MarketplaceCategory.findOne({
    where: { id: categoryId, isActive: true },
    attributes: ['id'],
    transaction,
  });
  return Boolean(category);
}

async function addProductStats(rows, userId) {
  if (!rows.length) return rows;
  const ids = rows.map((row) => row.id);
  const reviews = await ProductReview.findAll({
    attributes: [
      'productId',
      [sequelize.fn('AVG', sequelize.col('rating')), 'averageRating'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'reviewCount'],
    ],
    where: { productId: { [Op.in]: ids }, status: 'approved' },
    group: ['productId'],
    raw: true,
  });
  const ratings = new Map(reviews.map((row) => [row.productId, {
    averageRating: Number(row.averageRating),
    reviewCount: Number(row.reviewCount),
  }]));
  const wished = userId
    ? await WishlistItem.findAll({ attributes: ['productId'], where: { wishlistId: await getWishlistId(userId), productId: { [Op.in]: ids } }, raw: true })
    : [];
  const wishedIds = new Set(wished.map((row) => row.productId));
  rows.forEach((row) => {
    const stats = ratings.get(row.id);
    row.setDataValue('averageRating', stats ? Math.round(stats.averageRating * 100) / 100 : null);
    row.setDataValue('reviewCount', stats ? stats.reviewCount : 0);
    row.setDataValue('isWishlisted', wishedIds.has(row.id));
  });
  return rows;
}

async function getWishlistId(userId) {
  const wishlist = await Wishlist.findOne({ where: { userId }, attributes: ['id'] });
  return wishlist ? wishlist.id : null;
}

function parseProductBody(body, existing = {}) {
  const parseBoolean = (value, field, fallback) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return boolean(value, field, fallback);
  };
  const next = {
    productName: body.productName === undefined && existing.productName ? existing.productName : text(body.productName, 'Product name', 200),
    brand: body.brand === undefined && existing.brand ? existing.brand : text(body.brand, 'Brand', 160, false),
    description: body.description === undefined && existing.description ? existing.description : text(body.description, 'Description', 10000),
    unit: body.unit === undefined && existing.unit ? existing.unit : text(body.unit, 'Unit', 40),
    price: body.price === undefined && existing.price !== undefined ? existing.price : money(body.price, 'Price'),
    availableQuantity: body.availableQuantity === undefined && existing.availableQuantity !== undefined
      ? existing.availableQuantity : decimal(body.availableQuantity, 'Available quantity', { min: 0, max: 999999999, decimals: 3 }),
    minOrderQuantity: body.minOrderQuantity === undefined && existing.minOrderQuantity !== undefined
      ? existing.minOrderQuantity : quantity(body.minOrderQuantity, 'Minimum order quantity'),
    specifications: body.specifications === undefined && existing.specifications
      ? existing.specifications : object(body.specifications === undefined ? {} : body.specifications, 'Specifications'),
    condition: body.condition === undefined && existing.condition ? existing.condition : body.condition || 'new',
    deliveryAvailable: parseBoolean(body.deliveryAvailable, 'Delivery available', existing.deliveryAvailable || false),
    pickupAvailable: parseBoolean(body.pickupAvailable, 'Pickup available', existing.pickupAvailable === undefined ? true : existing.pickupAvailable),
    pickupLocation: body.pickupLocation === undefined && existing.pickupLocation
      ? existing.pickupLocation : text(body.pickupLocation, 'Pickup location', 500, false),
    isOrganic: parseBoolean(body.isOrganic, 'Organic status', existing.isOrganic || false),
    safetyInformation: body.safetyInformation === undefined && existing.safetyInformation
      ? existing.safetyInformation : text(body.safetyInformation, 'Safety information', 5000, false),
    manufacturer: body.manufacturer === undefined && existing.manufacturer
      ? existing.manufacturer : text(body.manufacturer, 'Manufacturer', 200, false),
    batchNumber: body.batchNumber === undefined && existing.batchNumber
      ? existing.batchNumber : text(body.batchNumber, 'Batch number', 100, false),
    manufacturedDate: body.manufacturedDate === undefined ? existing.manufacturedDate || null : optionalDate(body.manufacturedDate, 'Manufactured date'),
    expiryDate: body.expiryDate === undefined ? existing.expiryDate || null : optionalDate(body.expiryDate, 'Expiry date'),
  };
  if (!['new', 'used', 'refurbished'].includes(next.condition)) throw new HttpError(400, 'Choose a supported product condition.');
  if (!next.deliveryAvailable && !next.pickupAvailable) throw new HttpError(400, 'Select delivery or pickup availability.');
  if (Number(next.availableQuantity) < Number(next.minOrderQuantity) && Number(next.availableQuantity) !== 0) {
    throw new HttpError(400, 'Available quantity must be at least the minimum order quantity or zero.');
  }
  if (next.manufacturedDate && next.expiryDate && next.expiryDate < next.manufacturedDate) {
    throw new HttpError(400, 'Expiry date cannot be before the manufactured date.');
  }
  return next;
}

function locationFields(body, seller) {
  const values = {};
  ['state', 'district', 'mandal', 'village', 'pinCode'].forEach((key) => {
    const value = body[key] === undefined ? seller[key] : body[key];
    values[key] = text(value, key, key === 'pinCode' ? 10 : 120, key === 'state' || key === 'district');
    if (key === 'pinCode' && values[key] !== null && !/^\d{6}$/.test(values[key])) {
      throw new HttpError(400, 'PIN code must contain six digits.');
    }
  });
  return values;
}

async function getSeller(userId) {
  return SellerProfile.findByPk(userId);
}

async function uploadProductImages(files) {
  const uploaded = [];
  try {
    for (const file of files || []) {
      validateImageSignature(file);
      uploaded.push(await cloudinaryService.uploadPublicImage(file.buffer, 'agrisathi/marketplace'));
    }
    return uploaded;
  } catch (error) {
    await deleteUploadedImages(uploaded);
    throw error;
  }
}

async function deleteUploadedImages(images) {
  const results = await Promise.allSettled((images || []).map((image) => cloudinaryService.deletePublicImage(image.publicId)));
  if (results.some((result) => result.status === 'rejected')) {
    throw new HttpError(502, 'A temporary marketplace image could not be removed. Please contact support.');
  }
}

async function appendInventory(product, previous, next, reason, userId, transaction) {
  if (Number(previous) === Number(next)) return;
  await ProductInventoryHistory.create({
    productId: product.id,
    sellerId: product.sellerId,
    changedBy: userId,
    previousQuantity: previous,
    newQuantity: next,
    reason,
  }, { transaction });
}

async function getPublicProduct(id, userId) {
  const product = await MarketplaceProduct.findOne({
    where: { id, status: 'approved' },
    include: productIncludes({ activeCategoryOnly: true }),
  });
  if (!product) throw new HttpError(404, 'The product was not found or is no longer available.');
  await addProductStats([product], userId);
  return product;
}

function addressInput(body) {
  const result = {
    recipientName: text(body.recipientName, 'Recipient name', 160),
    phone: text(body.phone, 'Phone number', 30),
    addressLine1: text(body.addressLine1, 'Address', 240),
    addressLine2: text(body.addressLine2, 'Address line 2', 240, false),
    village: text(body.village, 'Village or town', 120),
    mandal: text(body.mandal, 'Mandal', 120, false),
    district: text(body.district, 'District', 120),
    state: text(body.state, 'State', 120),
    pinCode: text(body.pinCode, 'PIN code', 10),
  };
  const phone = result.phone.replace(/[()\s-]/g, '');
  if (!/^(?:\+?91)?[6-9]\d{9}$/.test(phone)) {
    throw new HttpError(400, 'Enter a valid phone number.');
  }
  if (!/^\d{6}$/.test(result.pinCode)) throw new HttpError(400, 'PIN code must contain six digits.');
  return result;
}

async function restoreOrderStock(order, userId, transaction) {
  const items = await MarketplaceOrderItem.findAll({ where: { orderId: order.id }, transaction });
  for (const item of items) {
    if (!item.productId) continue;
    const product = await MarketplaceProduct.findByPk(item.productId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!product) continue;
    const previous = Number(product.availableQuantity);
    const next = previous + Number(item.quantity);
    product.availableQuantity = next.toFixed(3);
    if (product.status === 'approved') product.availability = 'available';
    await product.save({ transaction });
    await appendInventory(product, previous, next, 'order_cancelled', userId, transaction);
  }
}

router.get('/languages', (req, res) => res.json({
  success: true,
  data: [
    { code: 'en', name: 'English' },
    { code: 'te', name: 'తెలుగు' },
    { code: 'hi', name: 'हिन्दी' },
  ],
}));

router.get('/settings', (req, res) => res.json({
  success: true,
  data: {
    cashOnDeliveryEnabled: process.env.MARKETPLACE_COD_ENABLED === 'true',
    onlinePaymentsEnabled: false,
    supportedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maximumImageBytes: imageLimit,
  },
}));

router.get('/categories', asyncHandler(async (req, res) => {
  const categories = await MarketplaceCategory.findAll({
    where: { isActive: true },
    order: [['name', 'ASC']],
  });
  res.json({ success: true, data: categories });
}));

router.get('/products/suggestions', asyncHandler(async (req, res) => {
  const query = text(req.query.q, 'Search term', 100);
  const products = await MarketplaceProduct.findAll({
    attributes: ['id', 'productName', 'brand'],
    where: {
      status: 'approved',
      availability: 'available',
      productName: { [Op.iLike]: `%${query}%` },
    },
    include: [{ model: MarketplaceCategory, where: { isActive: true }, required: true, attributes: [] }],
    limit: 8,
    order: [['viewCount', 'DESC']],
  });
  res.json({ success: true, data: products });
}));

router.get('/products', asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req);
  const where = { status: 'approved' };
  const and = [];
  if (req.query.q) {
    const term = `%${text(req.query.q, 'Search term', 100)}%`;
    and.push({ [Op.or]: [
      { productName: { [Op.iLike]: term } },
      { brand: { [Op.iLike]: term } },
      { description: { [Op.iLike]: term } },
    ] });
  }
  ['state', 'district', 'mandal', 'village'].forEach((field) => {
    if (req.query[field]) where[field] = { [Op.iLike]: text(req.query[field], field, 120) };
  });
  if (req.query.organic !== undefined) {
    if (!['true', 'false'].includes(req.query.organic)) throw new HttpError(400, 'organic must be true or false.');
    where.isOrganic = req.query.organic === 'true';
  }
  if (req.query.condition) {
    if (!['new', 'used', 'refurbished'].includes(req.query.condition)) throw new HttpError(400, 'Choose a supported product condition.');
    where.condition = req.query.condition;
  }
  if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
    where.price = {};
    if (req.query.minPrice !== undefined) where.price[Op.gte] = decimal(req.query.minPrice, 'Minimum price', { max: 9999999999, decimals: 2 });
    if (req.query.maxPrice !== undefined) where.price[Op.lte] = decimal(req.query.maxPrice, 'Maximum price', { max: 9999999999, decimals: 2 });
    if (where.price[Op.gte] !== undefined && where.price[Op.lte] !== undefined && where.price[Op.gte] > where.price[Op.lte]) {
      throw new HttpError(400, 'Minimum price cannot exceed maximum price.');
    }
  }
  const categoryId = req.query.categoryId
    ? validateUuid(text(req.query.categoryId, 'Category ID', 60), 'Category ID')
    : null;
  if (categoryId) where.categoryId = categoryId;
  if (req.query.category) {
    const category = await MarketplaceCategory.findOne({ where: { slug: text(req.query.category, 'Category', 100), isActive: true } });
    if (!category) throw new HttpError(404, 'The selected category was not found.');
    where.categoryId = category.id;
  }
  if (and.length) where[Op.and] = and;
  const sort = String(req.query.sort || 'newest');
  const orderMap = {
    newest: [['createdAt', 'DESC']],
    price_asc: [['price', 'ASC'], ['createdAt', 'DESC']],
    price_desc: [['price', 'DESC'], ['createdAt', 'DESC']],
    popular: [['viewCount', 'DESC'], ['createdAt', 'DESC']],
    rating: [[literal('COALESCE((SELECT AVG("rating") FROM "marketplace_product_reviews" AS "marketplaceRating" WHERE "marketplaceRating"."productId" = "MarketplaceProduct"."id" AND "marketplaceRating"."status" = \'approved\'), 0)'), 'DESC']],
  };
  if (!orderMap[sort]) throw new HttpError(400, 'Choose a supported marketplace sort order.');
  const result = await MarketplaceProduct.findAndCountAll({
    where,
    include: productIncludes({ activeCategoryOnly: true }),
    distinct: true,
    limit,
    offset,
    order: orderMap[sort],
  });
  await addProductStats(result.rows, req.user.id);
  res.json({
    success: true,
    data: result.rows.map(productView),
    pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) },
  });
}));

router.get('/products/:id', asyncHandler(async (req, res) => {
  const product = await getPublicProduct(req.params.id, req.user.id);
  await product.increment('viewCount');
  product.setDataValue('viewCount', Number(product.viewCount) + 1);
  res.json({ success: true, data: productView(product) });
}));

router.get('/products/:id/reviews', asyncHandler(async (req, res) => {
  const product = await MarketplaceProduct.findOne({
    where: { id: req.params.id, status: 'approved' },
    include: [{ model: MarketplaceCategory, where: { isActive: true }, required: true, attributes: ['id'] }],
    attributes: ['id'],
  });
  if (!product) throw new HttpError(404, 'The product was not found.');
  const { page, limit, offset } = parsePage(req);
  const result = await ProductReview.findAndCountAll({
    where: { productId: product.id, status: 'approved' },
    attributes: ['id', 'rating', 'review', 'images', 'verifiedPurchase', 'createdAt'],
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });
  res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } });
}));

router.get('/seller/profile', requireRole(sellerRoles), asyncHandler(async (req, res) => {
  const profile = await getSeller(req.user.id);
  res.json({ success: true, data: profile });
}));

router.put('/seller/profile', requireRole(sellerRoles), asyncHandler(async (req, res) => {
  const updates = {
    businessName: text(req.body.businessName, 'Business name', 180),
    description: text(req.body.description, 'Business description', 1500, false),
    state: text(req.body.state, 'State', 120, false),
    district: text(req.body.district, 'District', 120, false),
    mandal: text(req.body.mandal, 'Mandal', 120, false),
    village: text(req.body.village, 'Village', 120, false),
    pinCode: text(req.body.pinCode, 'PIN code', 10, false),
  };
  if (updates.pinCode !== null && !/^\d{6}$/.test(updates.pinCode)) {
    throw new HttpError(400, 'PIN code must contain six digits.');
  }
  if (req.body.licenseNumber !== undefined) updates.licenseNumber = text(req.body.licenseNumber, 'License number', 180, false);
  const saved = await sequelize.transaction(async (transaction) => {
    const profile = await SellerProfile.findByPk(req.user.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!profile) return SellerProfile.create({ userId: req.user.id, ...updates }, { transaction });
    const licenseChanged = Object.prototype.hasOwnProperty.call(updates, 'licenseNumber')
      && updates.licenseNumber !== profile.licenseNumber;
    if (licenseChanged) {
      updates.verificationStatus = 'pending';
      updates.verificationNote = null;
    }
    await profile.update(updates, { transaction });
    if (licenseChanged) {
      await MarketplaceProduct.update(
        { status: 'pending', rejectionReason: 'Seller license information changed; administrator review is required.' },
        { where: { sellerId: req.user.id, regulatedProduct: true, status: 'approved' }, transaction },
      );
    }
    return profile;
  });
  res.json({ success: true, data: saved });
}));

router.get('/seller/dashboard', requireRole(sellerRoles), asyncHandler(async (req, res) => {
  const [products, pendingProducts, orders, openEnquiries] = await Promise.all([
    MarketplaceProduct.count({ where: { sellerId: req.user.id } }),
    MarketplaceProduct.count({ where: { sellerId: req.user.id, status: 'pending' } }),
    MarketplaceOrder.count({ where: { sellerId: req.user.id } }),
    ProductEnquiry.count({ where: { sellerId: req.user.id, status: 'open' } }),
  ]);
  res.json({ success: true, data: { products, pendingProducts, orders, openEnquiries } });
}));

router.get('/seller/products', requireRole(sellerRoles), asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req);
  const where = { sellerId: req.user.id };
  if (req.query.status) {
    if (!['pending', 'approved', 'rejected', 'archived'].includes(req.query.status)) throw new HttpError(400, 'Choose a supported listing status.');
    where.status = req.query.status;
  }
  const result = await MarketplaceProduct.findAndCountAll({
    where,
    include: productIncludes({ sellerAttributes: ['businessName', 'verificationStatus'] }),
    distinct: true,
    limit,
    offset,
    order: [['updatedAt', 'DESC']],
  });
  await addProductStats(result.rows, req.user.id);
  res.json({
    success: true,
    data: result.rows.map((product) => ({ ...productView(product), pickupLocation: product.pickupLocation })),
    pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) },
  });
}));

router.post('/seller/products', requireRole(sellerRoles), uploadProductFiles, asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) throw new HttpError(400, 'Upload at least one product image.');
  const categoryId = validateUuid(text(req.body.categoryId, 'Category', 60), 'Category');
  const category = await MarketplaceCategory.findOne({ where: { id: categoryId, isActive: true } });
  if (!category) throw new HttpError(400, 'Select an active marketplace category.');
  const seller = await getSeller(req.user.id);
  if (!seller) throw new HttpError(409, 'Complete your seller profile before creating a listing.');
  const fields = parseProductBody(req.body);
  if (Number(fields.availableQuantity) === 0) throw new HttpError(400, 'A new listing must have available stock.');
  Object.assign(fields, locationFields(req.body, seller));
  fields.categoryId = category.id;
  fields.sellerId = req.user.id;
  fields.regulatedProduct = ['pesticides', 'crop-protection', 'pesticides-crop-protection', 'veterinary-medicines'].includes(category.slug);
  const images = await uploadProductImages(req.files);
  let product;
  try {
    product = await sequelize.transaction(async (transaction) => {
      const created = await MarketplaceProduct.create(fields, { transaction });
      await ProductImage.bulkCreate(images.map((image, index) => ({
        productId: created.id,
        imageUrl: image.secureUrl,
        publicId: image.publicId,
        position: index,
      })), { transaction });
      await appendInventory(created, 0, fields.availableQuantity, 'listing_created', req.user.id, transaction);
      return created;
    });
  } catch (error) {
    await deleteUploadedImages(images);
    throw error;
  }
  const result = await MarketplaceProduct.findByPk(product.id, { include: productIncludes() });
  res.status(201).json({ success: true, message: 'Your listing was submitted for review.', data: { ...productView(result), pickupLocation: result.pickupLocation } });
}));

router.put('/seller/products/:id', requireRole(sellerRoles), uploadProductFiles, asyncHandler(async (req, res) => {
  const product = await MarketplaceProduct.findOne({ where: { id: req.params.id, sellerId: req.user.id } });
  if (!product) throw new HttpError(404, 'Your listing was not found.');
  if (product.status === 'archived') throw new HttpError(409, 'Archived listings cannot be edited.');
  const categoryId = validateUuid(req.body.categoryId || product.categoryId, 'Category');
  const category = await MarketplaceCategory.findOne({ where: { id: categoryId, isActive: true } });
  if (!category) throw new HttpError(400, 'Select an active marketplace category.');
  const seller = await getSeller(req.user.id);
  const images = await uploadProductImages(req.files);
  try {
    await sequelize.transaction(async (transaction) => {
      const lockedProduct = await MarketplaceProduct.findOne({
        where: { id: product.id, sellerId: req.user.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!lockedProduct) throw new HttpError(404, 'Your listing was not found.');
      if (lockedProduct.status === 'archived') throw new HttpError(409, 'Archived listings cannot be edited.');
      const fields = parseProductBody(req.body, lockedProduct.toJSON());
      Object.assign(fields, locationFields(req.body, seller || {}));
      fields.categoryId = category.id;
      fields.regulatedProduct = ['pesticides', 'crop-protection', 'pesticides-crop-protection', 'veterinary-medicines'].includes(category.slug);
      const previous = Number(lockedProduct.availableQuantity);
      await lockedProduct.update({
        ...fields,
        availability: Number(fields.availableQuantity) > 0 ? 'available' : 'out_of_stock',
        status: 'pending',
        rejectionReason: null,
      }, { transaction });
      if (Number(fields.availableQuantity) !== previous) {
        await appendInventory(lockedProduct, previous, fields.availableQuantity, 'listing_updated', req.user.id, transaction);
      }
      if (images.length) {
        const count = await ProductImage.count({ where: { productId: lockedProduct.id }, transaction });
        if (count + images.length > 10) throw new HttpError(400, 'A listing can have no more than 10 images.');
        await ProductImage.bulkCreate(images.map((image, index) => ({
          productId: lockedProduct.id,
          imageUrl: image.secureUrl,
          publicId: image.publicId,
          position: count + index,
        })), { transaction });
      }
    });
  } catch (error) {
    await deleteUploadedImages(images);
    throw error;
  }
  const result = await MarketplaceProduct.findByPk(product.id, { include: productIncludes() });
  res.json({ success: true, message: 'The updated listing was submitted for review.', data: { ...productView(result), pickupLocation: result.pickupLocation } });
}));

router.delete('/seller/products/:id', requireRole(sellerRoles), asyncHandler(async (req, res) => {
  await sequelize.transaction(async (transaction) => {
    const product = await MarketplaceProduct.findOne({
      where: { id: req.params.id, sellerId: req.user.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!product) throw new HttpError(404, 'Your listing was not found.');
    await product.update({ status: 'archived', availability: 'unavailable' }, { transaction });
  });
  res.json({ success: true, message: 'The listing has been archived.' });
}));

router.delete('/seller/products/:id/images/:imageId', requireRole(sellerRoles), asyncHandler(async (req, res) => {
  let removedImage;
  await sequelize.transaction(async (transaction) => {
    const product = await MarketplaceProduct.findOne({
      where: { id: req.params.id, sellerId: req.user.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!product) throw new HttpError(404, 'Your listing was not found.');
    const images = await ProductImage.findAll({
      where: { productId: product.id },
      order: [['position', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    removedImage = images.find((entry) => entry.id === req.params.imageId);
    if (!removedImage) throw new HttpError(404, 'The product image was not found.');
    if (images.length < 2) throw new HttpError(409, 'A listing must keep at least one product image.');
    await removedImage.destroy({ transaction });
    await ProductImage.update(
      { position: literal('"position" - 1') },
      { where: { productId: product.id, position: { [Op.gt]: removedImage.position } }, transaction },
    );
    if (product.status === 'approved') {
      await product.update({ status: 'pending', rejectionReason: null }, { transaction });
    }
  });
  await cloudinaryService.deletePublicImage(removedImage.publicId);
  res.json({ success: true, message: 'The image was removed. The listing may require review again.' });
}));

router.get('/seller/orders', requireRole(sellerRoles), asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req);
  const result = await MarketplaceOrder.findAndCountAll({
    where: { sellerId: req.user.id },
    include: [
      { model: MarketplaceOrderItem, attributes: ['id', 'productId', 'productName', 'unit', 'fulfillmentMethod', 'pickupLocation', 'quantity', 'unitPrice', 'lineTotal'] },
      { model: MarketplaceAddress },
    ],
    distinct: true,
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });
  res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } });
}));

router.put('/seller/orders/:id/status', requireRole(sellerRoles), asyncHandler(async (req, res) => {
  const next = text(req.body.status, 'Order status', 30);
  const allowed = {
    pending: ['confirmed', 'rejected'],
    confirmed: ['processing', 'rejected'],
    processing: ['packed'],
    packed: ['shipped'],
    shipped: [],
  };
  const order = await MarketplaceOrder.findOne({ where: { id: req.params.id, sellerId: req.user.id } });
  if (!order) throw new HttpError(404, 'The order was not found.');
  if (!(allowed[order.status] || []).includes(next)) throw new HttpError(409, 'That order status change is not allowed.');
  await sequelize.transaction(async (transaction) => {
    const locked = await MarketplaceOrder.findOne({ where: { id: order.id }, transaction, lock: transaction.LOCK.UPDATE });
    const previous = locked.status;
    if (!(allowed[previous] || []).includes(next)) throw new HttpError(409, 'The order has changed. Refresh and try again.');
    if (next === 'rejected') await restoreOrderStock(locked, req.user.id, transaction);
    locked.status = next;
    if (next === 'rejected') locked.paymentStatus = 'cancelled';
    await locked.save({ transaction });
    await OrderStatusHistory.create({
      orderId: locked.id,
      changedBy: req.user.id,
      fromStatus: previous,
      toStatus: next,
      note: text(req.body.note, 'Status note', 500, false),
    }, { transaction });
    if (next === 'rejected') {
      await MarketplacePayment.update(
        { status: 'cancelled' },
        { where: { orderId: locked.id, provider: 'cod', status: 'pending' }, transaction },
      );
    }
  });
  res.json({ success: true, message: 'The order status was updated.' });
}));

router.get('/seller/enquiries', requireRole(sellerRoles), asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req);
  const result = await ProductEnquiry.findAndCountAll({
    where: { sellerId: req.user.id },
    include: [{ model: MarketplaceProduct, attributes: ['id', 'productName'], required: false }],
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });
  res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } });
}));

router.put('/seller/enquiries/:id/reply', requireRole(sellerRoles), asyncHandler(async (req, res) => {
  const enquiry = await ProductEnquiry.findOne({ where: { id: req.params.id, sellerId: req.user.id } });
  if (!enquiry) throw new HttpError(404, 'The enquiry was not found.');
  if (enquiry.status === 'closed') throw new HttpError(409, 'This enquiry is closed.');
  await enquiry.update({
    reply: text(req.body.reply, 'Reply', 2000),
    status: 'answered',
    respondedAt: new Date(),
  });
  res.json({ success: true, data: enquiry });
}));

router.get('/cart', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const [cart] = await ShoppingCart.findOrCreate({ where: { buyerId: req.user.id }, defaults: { buyerId: req.user.id } });
  const items = await CartItem.findAll({
    where: { cartId: cart.id },
    include: [{ model: MarketplaceProduct, include: productIncludes({ activeCategoryOnly: true }) }],
    order: [['createdAt', 'ASC']],
  });
  const products = items.map((item) => item.MarketplaceProduct).filter(Boolean);
  await addProductStats(products, req.user.id);
  res.json({
    success: true,
    data: {
      id: cart.id,
      items: items.map((item) => ({
        id: item.id,
        quantity: Number(item.quantity),
        product: item.MarketplaceProduct ? productView(item.MarketplaceProduct) : null,
        available: Boolean(item.MarketplaceProduct && item.MarketplaceProduct.status === 'approved' && item.MarketplaceProduct.availability === 'available'),
      })),
    },
  });
}));

router.post('/cart/items', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const productId = validateUuid(text(req.body.productId, 'Product', 60), 'Product');
  const requested = quantity(req.body.quantity, 'Quantity');
  await sequelize.transaction(async (transaction) => {
    const product = await MarketplaceProduct.findOne({
      where: { id: productId, status: 'approved', availability: 'available' },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!product) throw new HttpError(404, 'The product is not available.');
    if (!(await categoryIsActive(product.categoryId, transaction))) throw new HttpError(404, 'The product is not available.');
    if (String(product.sellerId) === String(req.user.id)) throw new HttpError(400, 'You cannot add your own listing to the cart.');
    const [cart] = await ShoppingCart.findOrCreate({
      where: { buyerId: req.user.id },
      defaults: { buyerId: req.user.id },
      transaction,
    });
    const [item, created] = await CartItem.findOrCreate({
      where: { cartId: cart.id, productId },
      defaults: { cartId: cart.id, productId, quantity: requested },
      transaction,
    });
    const total = created ? requested : Number(item.quantity) + requested;
    if (total < Number(product.minOrderQuantity) || total > Number(product.availableQuantity)) {
      throw new HttpError(400, `The quantity must be between ${product.minOrderQuantity} and ${product.availableQuantity} ${product.unit}.`);
    }
    if (!created) await item.update({ quantity: total.toFixed(3) }, { transaction });
  });
  res.status(201).json({ success: true, message: 'Product added to cart.' });
}));

router.put('/cart/items/:id', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const requested = quantity(req.body.quantity, 'Quantity');
  await sequelize.transaction(async (transaction) => {
    const [cart] = await ShoppingCart.findOrCreate({ where: { buyerId: req.user.id }, defaults: { buyerId: req.user.id }, transaction });
    const item = await CartItem.findOne({ where: { id: req.params.id, cartId: cart.id }, transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw new HttpError(404, 'The cart item was not found.');
    const product = await MarketplaceProduct.findOne({
      where: { id: item.productId, status: 'approved', availability: 'available' },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!product) throw new HttpError(409, 'This product is no longer available.');
    if (!(await categoryIsActive(product.categoryId, transaction))) throw new HttpError(409, 'This product is no longer available.');
    if (requested < Number(product.minOrderQuantity) || requested > Number(product.availableQuantity)) {
      throw new HttpError(400, `The quantity must be between ${product.minOrderQuantity} and ${product.availableQuantity} ${product.unit}.`);
    }
    await item.update({ quantity: requested.toFixed(3) }, { transaction });
  });
  res.json({ success: true, message: 'Cart quantity updated.' });
}));

router.delete('/cart/items/:id', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const [cart] = await ShoppingCart.findOrCreate({ where: { buyerId: req.user.id }, defaults: { buyerId: req.user.id } });
  const deleted = await CartItem.destroy({ where: { id: req.params.id, cartId: cart.id } });
  if (!deleted) throw new HttpError(404, 'The cart item was not found.');
  res.json({ success: true, message: 'Product removed from cart.' });
}));

router.get('/wishlist', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const [wishlist] = await Wishlist.findOrCreate({ where: { userId: req.user.id }, defaults: { userId: req.user.id } });
  const items = await WishlistItem.findAll({
    where: { wishlistId: wishlist.id },
    include: [{ model: MarketplaceProduct, where: { status: 'approved' }, required: false, include: productIncludes({ activeCategoryOnly: true }) }],
    order: [['createdAt', 'DESC']],
  });
  const products = items.map((item) => item.MarketplaceProduct).filter(Boolean);
  await addProductStats(products, req.user.id);
  res.json({ success: true, data: items.filter((item) => item.MarketplaceProduct).map((item) => productView(item.MarketplaceProduct)) });
}));

router.post('/wishlist/:productId', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const product = await MarketplaceProduct.findOne({
    where: { id: req.params.productId, status: 'approved' },
    include: [{ model: MarketplaceCategory, where: { isActive: true }, required: true, attributes: ['id'] }],
    attributes: ['id'],
  });
  if (!product) throw new HttpError(404, 'The product was not found.');
  const [wishlist] = await Wishlist.findOrCreate({ where: { userId: req.user.id }, defaults: { userId: req.user.id } });
  await WishlistItem.findOrCreate({ where: { wishlistId: wishlist.id, productId: product.id }, defaults: { wishlistId: wishlist.id, productId: product.id } });
  res.status(201).json({ success: true, message: 'Product saved to your wishlist.' });
}));

router.delete('/wishlist/:productId', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.findOne({ where: { userId: req.user.id }, attributes: ['id'] });
  if (wishlist) await WishlistItem.destroy({ where: { wishlistId: wishlist.id, productId: req.params.productId } });
  res.json({ success: true, message: 'Product removed from your wishlist.' });
}));

router.post('/enquiries', requireRole(buyerRoles), enquiryLimiter, asyncHandler(async (req, res) => {
  const product = await MarketplaceProduct.findOne({
    where: { id: validateUuid(text(req.body.productId, 'Product', 60), 'Product'), status: 'approved' },
    include: [{ model: MarketplaceCategory, where: { isActive: true }, required: true, attributes: ['id'] }],
  });
  if (!product) throw new HttpError(404, 'The product was not found.');
  if (String(product.sellerId) === String(req.user.id)) throw new HttpError(400, 'You cannot enquire about your own listing.');
  const enquiry = await ProductEnquiry.create({
    productId: product.id,
    buyerId: req.user.id,
    sellerId: product.sellerId,
    question: text(req.body.question, 'Question', 2000),
    requestedQuantity: req.body.requestedQuantity === undefined ? null : quantity(req.body.requestedQuantity, 'Requested quantity').toFixed(3),
  });
  res.status(201).json({ success: true, data: enquiry });
}));

router.get('/enquiries', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req);
  const result = await ProductEnquiry.findAndCountAll({
    where: { buyerId: req.user.id },
    include: [{ model: MarketplaceProduct, attributes: ['id', 'productName'], required: false }],
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });
  res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } });
}));

router.post('/products/:id/report', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const product = await MarketplaceProduct.findOne({
    where: { id: req.params.id, status: 'approved' },
    include: [{ model: MarketplaceCategory, where: { isActive: true }, required: true, attributes: ['id'] }],
    attributes: ['id'],
  });
  if (!product) throw new HttpError(404, 'The product was not found.');
  const existing = await ProductReport.findOne({ where: { productId: product.id, reporterId: req.user.id }, attributes: ['id'] });
  if (existing) throw new HttpError(409, 'You have already reported this listing.');
  const reason = text(req.body.reason, 'Report reason', 30);
  if (!['misleading', 'unsafe', 'prohibited', 'counterfeit', 'spam', 'other'].includes(reason)) throw new HttpError(400, 'Choose a supported report reason.');
  let report;
  try {
    report = await ProductReport.create({
      productId: product.id,
      reporterId: req.user.id,
      reason,
      description: text(req.body.description, 'Description', 1500, false),
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') throw new HttpError(409, 'You have already reported this listing.');
    throw error;
  }
  res.status(201).json({ success: true, message: 'The report was sent to marketplace administrators.', data: { id: report.id, status: report.status } });
}));

router.post('/products/:id/reviews', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Rating must be a whole number from 1 to 5.');
  const orderItemId = validateUuid(text(req.body.orderItemId, 'Order item', 60), 'Order item');
  const item = await MarketplaceOrderItem.findOne({
    where: { id: orderItemId, productId: req.params.id },
    include: [{ model: MarketplaceOrder, where: { buyerId: req.user.id, status: 'delivered' }, required: true }],
  });
  if (!item) throw new HttpError(403, 'A review is available only for a product delivered to your account.');
  const existing = await ProductReview.findOne({ where: { orderItemId: item.id }, attributes: ['id'] });
  if (existing) throw new HttpError(409, 'You have already reviewed this purchase.');
  let review;
  try {
    review = await ProductReview.create({
      productId: item.productId,
      buyerId: req.user.id,
      orderItemId: item.id,
      rating,
      review: text(req.body.review, 'Review', 2000, false),
      verifiedPurchase: true,
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') throw new HttpError(409, 'You have already reviewed this purchase.');
    throw error;
  }
  res.status(201).json({ success: true, message: 'Your review was submitted for moderation.', data: review });
}));

router.get('/orders', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePage(req);
  const result = await MarketplaceOrder.findAndCountAll({
    where: { buyerId: req.user.id },
    include: [
      { model: MarketplaceOrderItem, attributes: ['id', 'productId', 'sellerId', 'productName', 'unit', 'fulfillmentMethod', 'pickupLocation', 'quantity', 'unitPrice', 'lineTotal'] },
      { model: OrderStatusHistory, attributes: ['id', 'fromStatus', 'toStatus', 'note', 'createdAt'], separate: true, order: [['createdAt', 'ASC']] },
    ],
    distinct: true,
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });
  res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } });
}));

router.get('/orders/:id', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const order = await MarketplaceOrder.findOne({
    where: { id: req.params.id, buyerId: req.user.id },
    include: [
      { model: MarketplaceOrderItem },
      { model: MarketplaceAddress },
      { model: OrderStatusHistory, separate: true, order: [['createdAt', 'ASC']] },
    ],
  });
  if (!order) throw new HttpError(404, 'The order was not found.');
  res.json({ success: true, data: order });
}));

router.post('/orders', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  if (req.body.paymentMethod === 'razorpay') {
    throw new HttpError(503, 'Online payment is not available yet. No payment was initiated.');
  }
  if (req.body.paymentMethod !== 'cod') throw new HttpError(400, 'Choose cash on delivery.');
  if (process.env.MARKETPLACE_COD_ENABLED !== 'true') {
    throw new HttpError(503, 'Cash on delivery is not enabled for this marketplace.');
  }
  if (req.body.fulfillmentMethods !== undefined) object(req.body.fulfillmentMethods, 'Fulfillment methods', { maxBytes: 12000 });
  const createdIds = await sequelize.transaction({
    isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
  }, async (transaction) => {
    const [cart] = await ShoppingCart.findOrCreate({
      where: { buyerId: req.user.id },
      defaults: { buyerId: req.user.id },
      transaction,
    });
    const cartItems = await CartItem.findAll({
      where: { cartId: cart.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!cartItems.length) throw new HttpError(400, 'Your cart is empty.');
    cartItems.sort((left, right) => left.productId.localeCompare(right.productId));

    const grouped = new Map();
    let deliveryRequired = false;
    for (const cartItem of cartItems) {
      const product = await MarketplaceProduct.findOne({
        where: { id: cartItem.productId, status: 'approved', availability: 'available' },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!product) throw new HttpError(409, 'A cart product is no longer available. Review your cart and try again.');
      if (!(await categoryIsActive(product.categoryId, transaction))) throw new HttpError(409, 'A cart product category is no longer active. Review your cart and try again.');
      const orderedQuantity = quantity(cartItem.quantity, 'Cart quantity');
      if (orderedQuantity < Number(product.minOrderQuantity) || orderedQuantity > Number(product.availableQuantity)) {
        throw new HttpError(409, `${product.productName} does not have enough stock for the requested quantity.`);
      }
      const linePaise = paiseFor(product.price, orderedQuantity);
      if (!Number.isSafeInteger(linePaise) || linePaise <= 0 || linePaise > 999999999999) {
        throw new HttpError(400, 'An order line exceeds the supported total value.');
      }
      const sellerLines = grouped.get(product.sellerId) || [];
      const requestedFulfillment = req.body.fulfillmentMethods && req.body.fulfillmentMethods[product.id];
      const fulfillmentMethod = requestedFulfillment || (product.deliveryAvailable ? 'delivery' : 'pickup');
      if (!['delivery', 'pickup'].includes(fulfillmentMethod)) throw new HttpError(400, 'Choose delivery or pickup for each product.');
      if (fulfillmentMethod === 'delivery' && !product.deliveryAvailable) throw new HttpError(400, `${product.productName} does not offer delivery.`);
      if (fulfillmentMethod === 'pickup' && !product.pickupAvailable) throw new HttpError(400, `${product.productName} does not offer pickup.`);
      if (fulfillmentMethod === 'delivery') deliveryRequired = true;
      sellerLines.push({ product, quantity: orderedQuantity, linePaise, fulfillmentMethod });
      grouped.set(product.sellerId, sellerLines);

      const previous = Number(product.availableQuantity);
      const remaining = previous - orderedQuantity;
      product.availableQuantity = remaining.toFixed(3);
      if (remaining === 0) product.availability = 'out_of_stock';
      await product.save({ transaction });
      await appendInventory(product, previous, remaining, 'order_reserved', req.user.id, transaction);
    }

    let savedAddress = null;
    if (deliveryRequired) {
      savedAddress = await MarketplaceAddress.create({
        buyerId: req.user.id,
        ...addressInput(req.body.address || {}),
      }, { transaction });
    }

    const orderIds = [];
    for (const [sellerId, lines] of grouped.entries()) {
      const subtotalPaise = lines.reduce((sum, line) => sum + line.linePaise, 0);
      if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise > 999999999999) {
        throw new HttpError(400, 'A seller order exceeds the supported total value.');
      }
      const subtotal = rupeesFromPaise(subtotalPaise);
      const order = await MarketplaceOrder.create({
        buyerId: req.user.id,
        sellerId,
        addressId: savedAddress ? savedAddress.id : null,
        status: 'pending',
        paymentMethod: 'cod',
        paymentStatus: 'cod_due',
        subtotal,
        deliveryCharge: '0.00',
        total: subtotal,
      }, { transaction });
      await MarketplaceOrderItem.bulkCreate(lines.map((line) => ({
        orderId: order.id,
        productId: line.product.id,
        sellerId,
        productName: line.product.productName,
        unit: line.product.unit,
        fulfillmentMethod: line.fulfillmentMethod,
        pickupLocation: line.fulfillmentMethod === 'pickup' ? line.product.pickupLocation : null,
        quantity: line.quantity.toFixed(3),
        unitPrice: money(line.product.price, 'Price'),
        lineTotal: rupeesFromPaise(line.linePaise),
      })), { transaction });
      await OrderStatusHistory.create({
        orderId: order.id,
        changedBy: req.user.id,
        fromStatus: null,
        toStatus: 'pending',
        note: 'Order placed.',
      }, { transaction });
      await MarketplacePayment.create({
        orderId: order.id,
        provider: 'cod',
        amount: subtotal,
        status: 'pending',
        signatureVerified: false,
      }, { transaction });
      orderIds.push(order.id);
    }
    await CartItem.destroy({ where: { cartId: cart.id }, transaction });
    return orderIds;
  });
  const orders = await MarketplaceOrder.findAll({
    where: { id: { [Op.in]: createdIds }, buyerId: req.user.id },
    include: [{ model: MarketplaceOrderItem }],
    order: [['createdAt', 'ASC']],
  });
  res.status(201).json({ success: true, message: 'Your cash-on-delivery order was placed.', data: orders });
}));

router.put('/orders/:id/cancel', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const reason = text(req.body.reason, 'Cancellation reason', 500, false);
  await sequelize.transaction(async (transaction) => {
    const order = await MarketplaceOrder.findOne({
      where: { id: req.params.id, buyerId: req.user.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!order) throw new HttpError(404, 'The order was not found.');
    if (!['pending', 'confirmed'].includes(order.status)) throw new HttpError(409, 'This order can no longer be cancelled online.');
    const previous = order.status;
    await restoreOrderStock(order, req.user.id, transaction);
    order.status = 'cancelled';
    order.paymentStatus = 'cancelled';
    order.cancellationReason = reason;
    await order.save({ transaction });
    await OrderStatusHistory.create({
      orderId: order.id,
      changedBy: req.user.id,
      fromStatus: previous,
      toStatus: 'cancelled',
      note: reason,
    }, { transaction });
    await MarketplacePayment.update({ status: 'cancelled' }, { where: { orderId: order.id, provider: 'cod', status: 'pending' }, transaction });
  });
  res.json({ success: true, message: 'The order was cancelled and reserved stock was released.' });
}));

router.post('/orders/:id/confirm-delivery', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  await sequelize.transaction(async (transaction) => {
    const order = await MarketplaceOrder.findOne({
      where: { id: req.params.id, buyerId: req.user.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!order) throw new HttpError(404, 'The order was not found.');
    if (order.status !== 'shipped') throw new HttpError(409, 'Only a shipped order can be confirmed as delivered.');
    order.status = 'delivered';
    await order.save({ transaction });
    await OrderStatusHistory.create({
      orderId: order.id,
      changedBy: req.user.id,
      fromStatus: 'shipped',
      toStatus: 'delivered',
      note: 'Delivery confirmed by buyer.',
    }, { transaction });
  });
  res.json({ success: true, message: 'Delivery confirmed. COD payment is still not marked as collected.' });
}));

router.post('/payments/create', requireRole(buyerRoles), (req, res) => res.status(503).json({
  success: false,
  message: 'Online payment is not available yet. No payment was initiated.',
}));

router.post('/payments/verify', requireRole(buyerRoles), (req, res) => res.status(503).json({
  success: false,
  message: 'Online payment verification is not configured. No payment was recorded.',
}));

module.exports = router;
