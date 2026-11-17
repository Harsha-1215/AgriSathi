const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
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
  LivestockHealthRecord,
  LivestockVaccinationRecord,
  LivestockSellerProfile,
  LivestockWishlist,
  LivestockEnquiry,
  LivestockEnquiryMessage,
  LivestockReport,
  LivestockListingView,
} = require('../models');
const cloudinaryService = require('../services/cloudinaryService');
const { validateImageSignature } = require('../services/marketplaceService');
const {
  text,
  optionalNumber,
  requiredNumber,
  boolean,
  jsonField,
  date,
  uuid,
  pageValues,
  listingView,
} = require('../services/livestockService');

const router = express.Router();
const buyerRoles = ['farmer', 'farmer_user', 'buyer', 'seller'];
const sellerRoles = ['farmer', 'farmer_user', 'seller'];
const imageLimit = Math.min(8 * 1024 * 1024, Math.max(1, Number.parseInt(process.env.LIVESTOCK_IMAGE_MAX_BYTES, 10) || 5 * 1024 * 1024));
const videoLimit = Math.min(35 * 1024 * 1024, Math.max(1, Number.parseInt(process.env.LIVESTOCK_VIDEO_MAX_BYTES, 10) || 30 * 1024 * 1024));
const fieldSizeStorage = {
  _handleFile(req, file, callback) {
    const maxBytes = file.fieldname === 'video' ? videoLimit : imageLimit;
    const chunks = [];
    let size = 0;
    let completed = false;
    file.stream.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes && !completed) {
        completed = true;
        chunks.length = 0;
        file.stream.resume();
        callback(new multer.MulterError('LIMIT_FILE_SIZE', file.fieldname));
      } else if (!completed) {
        chunks.push(chunk);
      }
    });
    file.stream.on('end', () => {
      if (completed) return;
      completed = true;
      callback(null, { buffer: Buffer.concat(chunks), size });
    });
    file.stream.on('error', (error) => {
      if (completed) return;
      completed = true;
      callback(error);
    });
  },
  _removeFile(req, file, callback) {
    delete file.buffer;
    delete file.size;
    callback(null);
  },
};
const upload = multer({
  storage: fieldSizeStorage,
  limits: { fileSize: videoLimit, files: 8, fields: 40, fieldSize: 20000 },
  fileFilter(req, file, callback) {
    const imageField = ['images', 'healthCertificate'].includes(file.fieldname);
    const allowed = imageField
      ? ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      : file.fieldname === 'video' && ['video/mp4', 'video/quicktime', 'video/webm'].includes(file.mimetype);
    if (!allowed) return callback(new HttpError(415, 'Use JPEG, PNG, or WebP photos and MP4, MOV, or WebM videos.'));
    return callback(null, true);
  },
});
const enquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

function uploadListingFiles(req, res, next) {
  upload.fields([
    { name: 'images', maxCount: 6 },
    { name: 'video', maxCount: 1 },
    { name: 'healthCertificate', maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      return next(new HttpError(tooLarge ? 413 : 400, tooLarge
        ? 'An uploaded file exceeds the configured size limit.'
        : 'Upload up to six photos, one video, and one health certificate image.'));
    }
    return next(error);
  });
}

router.use(requireAuth);

function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Your account cannot use this livestock feature.' });
    return next();
  };
}

function requireActiveSeller(req, res, next) {
  LivestockSellerProfile.findByPk(req.user.id, { attributes: ['userId', 'isSuspended'] })
    .then((profile) => {
      if (profile?.isSuspended) return res.status(403).json({ success: false, message: 'Your livestock seller account is suspended. Contact AGRISATHI support.' });
      return next();
    })
    .catch(next);
}

['id', 'listingId', 'enquiryId', 'imageId'].forEach((name) => {
  router.param(name, (req, res, next, value) => {
    try {
      uuid(value, name);
      next();
    } catch (error) {
      next(error);
    }
  });
});

function listingIncludes({ details = false, admin = false, activeCategoryOnly = false } = {}) {
  return [
    {
      model: LivestockCategory,
      attributes: ['id', 'slug', 'name', 'translations', 'icon', 'isActive'],
      where: activeCategoryOnly ? { isActive: true } : undefined,
      required: true,
    },
    {
      model: LivestockBreed,
      attributes: ['id', 'slug', 'name', 'translations', 'isActive'],
      where: activeCategoryOnly ? { isActive: true } : undefined,
      required: false,
    },
    {
      model: LivestockSellerProfile,
      attributes: admin
        ? ['userId', 'sellerName', 'description', 'contactPhone', 'allowPhoneContact', 'state', 'district', 'mandal', 'village', 'pinCode', 'verificationStatus', 'verificationNote', 'verifiedAt']
        : ['userId', 'sellerName', 'description', 'contactPhone', 'allowPhoneContact', 'state', 'district', 'verificationStatus'],
      required: false,
    },
    { model: LivestockImage, attributes: ['id', 'assetType', 'url', 'format', 'durationSeconds', ...(admin ? ['publicId', 'bytes'] : [])], separate: true, order: [['position', 'ASC']] },
    ...(details ? [
      { model: LivestockHealthRecord, attributes: ['id', 'recordDate', 'note', 'veterinarianName', 'certificatePublicId', 'certificateFormat'], separate: true, order: [['recordDate', 'DESC']] },
      { model: LivestockVaccinationRecord, attributes: ['id', 'vaccineName', 'administeredAt', 'veterinarianName', 'certificatePublicId', 'certificateFormat'], separate: true, order: [['administeredAt', 'DESC']] },
    ] : []),
  ];
}

function profileInput(body, user) {
  const phone = text(body.contactPhone, 'Seller phone', 30, false);
  if (phone && !/^\+?[0-9][0-9\s()-]{7,24}$/.test(phone)) throw new HttpError(400, 'Enter a valid seller contact number.');
  const pinCode = text(body.pinCode, 'PIN code', 10, false);
  if (pinCode && !/^\d{6}$/.test(pinCode)) throw new HttpError(400, 'PIN code must contain six digits.');
  return {
    userId: user.id,
    sellerName: text(body.sellerName || user.profile.name, 'Seller name', 160),
    description: text(body.sellerDescription, 'Seller description', 1600, false),
    contactPhone: phone,
    allowPhoneContact: boolean(body.allowPhoneContact, 'Phone contact permission', false),
    state: text(body.state, 'State', 100),
    district: text(body.district, 'District', 100),
    mandal: text(body.mandal, 'Mandal', 100, false),
    village: text(body.village, 'Village', 120, false),
    pinCode,
  };
}

async function validateCategoryAndBreed(categoryId, breedId, transaction) {
  const category = await LivestockCategory.findOne({ where: { id: categoryId, isActive: true }, transaction });
  if (!category) throw new HttpError(400, 'Choose an active livestock category.');
  if (breedId) {
    const breed = await LivestockBreed.findOne({ where: { id: breedId, categoryId, isActive: true }, transaction });
    if (!breed) throw new HttpError(400, 'Choose an active breed from the selected category.');
  }
}

function parseRecords(body, field, kind) {
  const records = jsonField(body[field], field, []);
  if (!Array.isArray(records) || records.length > 12) throw new HttpError(400, `${field} must be a list of no more than 12 records.`);
  return records.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, `${field} item ${index + 1} must be an object.`);
    return kind === 'health'
      ? {
        recordDate: date(item.recordDate, 'Health record date', { required: true }),
        note: text(item.note, 'Health record', 1600),
        veterinarianName: text(item.veterinarianName, 'Veterinarian name', 160, false),
      }
      : {
        vaccineName: text(item.vaccineName, 'Vaccine name', 180),
        administeredAt: date(item.administeredAt, 'Vaccination date', { required: true }),
        veterinarianName: text(item.veterinarianName, 'Veterinarian name', 160, false),
      };
  });
}

function listingInput(body, { existing = null, profile = null } = {}) {
  const categories = ['seller_reports_healthy', 'needs_attention', 'unknown'];
  const vaccinationStatuses = ['vaccinated', 'partially_vaccinated', 'not_vaccinated', 'unknown'];
  const genders = ['female', 'male', 'unknown'];
  const healthCondition = body.healthCondition === undefined ? existing?.healthCondition || 'unknown' : body.healthCondition;
  const vaccinationStatus = body.vaccinationStatus === undefined ? existing?.vaccinationStatus || 'unknown' : body.vaccinationStatus;
  const gender = body.gender === undefined ? existing?.gender : body.gender;
  if (!categories.includes(healthCondition)) throw new HttpError(400, 'Choose a supported seller-reported health condition.');
  if (!vaccinationStatuses.includes(vaccinationStatus)) throw new HttpError(400, 'Choose a supported vaccination status.');
  if (!genders.includes(gender)) throw new HttpError(400, 'Choose a supported gender.');

  const categoryId = body.categoryId === undefined && existing ? existing.categoryId : uuid(body.categoryId, 'Category');
  const breedId = body.breedId === undefined && existing
    ? existing.breedId
    : (body.breedId ? uuid(body.breedId, 'Breed') : null);
  const state = body.state === undefined ? existing?.state || profile?.state : text(body.state, 'State', 100);
  const district = body.district === undefined ? existing?.district || profile?.district : text(body.district, 'District', 100);
  const pinCode = body.pinCode === undefined ? existing?.pinCode || profile?.pinCode : text(body.pinCode, 'PIN code', 10, false);
  if (pinCode && !/^\d{6}$/.test(pinCode)) throw new HttpError(400, 'PIN code must contain six digits.');
  const productionDetails = body.productionDetails === undefined && existing
    ? existing.productionDetails
    : jsonField(body.productionDetails, 'Production details', {});
  if (Array.isArray(productionDetails) || Object.keys(productionDetails).length > 20 || Buffer.byteLength(JSON.stringify(productionDetails), 'utf8') > 4000) {
    throw new HttpError(400, 'Production details must be a small object.');
  }
  if (productionDetails.milkLitresPerDay !== undefined) {
    optionalNumber(productionDetails.milkLitresPerDay, 'Daily milk production', { min: 0, max: 200, decimals: 2 });
  }

  const updates = {
    categoryId,
    breedId,
    listingName: body.listingName === undefined && existing ? existing.listingName : text(body.listingName, 'Animal name', 180),
    ageMonths: body.ageMonths === undefined && existing
      ? existing.ageMonths
      : requiredNumber(body.ageMonths, 'Age in months', { min: 0, max: 600, decimals: 0 }),
    gender,
    weightKg: body.weightKg === undefined && existing ? existing.weightKg : optionalNumber(body.weightKg, 'Weight in kilograms', { min: 0.1, max: 5000, decimals: 2 }),
    color: body.color === undefined && existing ? existing.color : text(body.color, 'Color', 100, false),
    healthCondition,
    vaccinationStatus,
    dewormingInformation: body.dewormingInformation === undefined && existing ? existing.dewormingInformation : text(body.dewormingInformation, 'Deworming information', 1000, false),
    veterinaryCheckupDate: body.veterinaryCheckupDate === undefined && existing ? existing.veterinaryCheckupDate : date(body.veterinaryCheckupDate, 'Veterinary checkup date'),
    medicalHistory: body.medicalHistory === undefined && existing ? existing.medicalHistory : text(body.medicalHistory, 'Medical history', 3000, false),
    productionDetails,
    feedingInformation: body.feedingInformation === undefined && existing ? existing.feedingInformation : text(body.feedingInformation, 'Feeding information', 3000, false),
    description: body.description === undefined && existing ? existing.description : text(body.description, 'Description', 5000),
    price: body.price === undefined && existing ? existing.price : requiredNumber(body.price, 'Asking price', { min: 1, max: 999999999, decimals: 2 }).toFixed(2),
    negotiable: boolean(body.negotiable, 'Negotiable price', existing?.negotiable || false),
    contactPreference: body.contactPreference === undefined ? existing?.contactPreference || 'platform' : body.contactPreference,
    locationPublic: boolean(body.locationPublic, 'Public village and mandal display', existing?.locationPublic ?? true),
    state: text(state, 'State', 100),
    district: text(district, 'District', 100),
    mandal: body.mandal === undefined ? existing?.mandal || profile?.mandal || null : text(body.mandal, 'Mandal', 100, false),
    village: body.village === undefined ? existing?.village || profile?.village || null : text(body.village, 'Village', 120, false),
    pinCode,
    pickupAvailable: boolean(body.pickupAvailable, 'Pickup availability', existing?.pickupAvailable ?? true),
  };
  if (!['platform', 'phone', 'both'].includes(updates.contactPreference)) throw new HttpError(400, 'Choose platform, phone, or both for contact preferences.');
  if (['phone', 'both'].includes(updates.contactPreference) && !(profile?.contactPhone && profile.allowPhoneContact)) {
    throw new HttpError(400, 'Set and explicitly allow a seller phone number before enabling phone contact.');
  }
  return updates;
}

function videoInfo(file) {
  const buffer = file.buffer;
  const webm = buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  const mp4 = buffer.length > 12 && buffer.toString('ascii', 4, 8) === 'ftyp';
  if (!webm && !mp4) throw new HttpError(415, 'The video content is not a supported WebM, MP4, or MOV file.');
}

async function uploadMedia(req, { requireImage = false } = {}) {
  const files = req.files || {};
  const imageFiles = files.images || [];
  const certificates = files.healthCertificate || [];
  if (requireImage && !imageFiles.length) throw new HttpError(400, 'Add at least one clear animal photo.');
  if ([...imageFiles, ...certificates].some((file) => file.size > imageLimit)) {
    throw new HttpError(413, 'Each animal photo and certificate image must be no larger than the configured image limit.');
  }
  imageFiles.forEach(validateImageSignature);
  certificates.forEach(validateImageSignature);
  const video = (files.video || [])[0];
  if (video) videoInfo(video);
  const assets = [];
  try {
    for (let position = 0; position < imageFiles.length; position += 1) {
      const result = await cloudinaryService.uploadPublicImage(imageFiles[position].buffer, 'agrisathi/livestock');
      assets.push({ type: 'image', result, position });
    }
    if (video) {
      const result = await cloudinaryService.uploadPublicVideo(video.buffer, 'agrisathi/livestock');
      if (!Number.isFinite(Number(result.duration)) || Number(result.duration) < 1 || Number(result.duration) > 30) {
        await cloudinaryService.deletePublicVideo(result.publicId);
        throw new HttpError(400, 'Livestock videos must be no longer than 30 seconds.');
      }
      assets.push({ type: 'video', result, position: imageFiles.length });
    }
    let certificate = null;
    if (certificates[0]) certificate = await cloudinaryService.uploadPrivateImage(certificates[0].buffer, 'agrisathi/livestock-certificates');
    return { assets, certificate };
  } catch (error) {
    await Promise.all(assets.map((asset) => asset.type === 'video'
      ? cloudinaryService.deletePublicVideo(asset.result.publicId)
      : cloudinaryService.deletePublicImage(asset.result.publicId)));
    throw error;
  }
}

async function cleanupAssets(assets, certificate) {
  await Promise.all(assets.map((asset) => asset.type === 'video'
    ? cloudinaryService.deletePublicVideo(asset.result.publicId)
    : cloudinaryService.deletePublicImage(asset.result.publicId)));
  if (certificate?.publicId) await cloudinaryService.deletePrivateImage(certificate.publicId);
}

async function addCertificateUrls(records, ownerOrAdmin) {
  if (!ownerOrAdmin) return records;
  return Promise.all(records.map(async (record) => ({
    ...record.toJSON(),
    certificateUrl: record.certificatePublicId
      ? cloudinaryService.getPrivateImageUrl(record.certificatePublicId, record.certificateFormat)
      : null,
  })));
}

async function detailResponse(listing, viewerId, admin = false) {
  const ownerOrAdmin = admin || String(listing.sellerId) === String(viewerId);
  const healthRecords = await addCertificateUrls(listing.LivestockHealthRecords || [], ownerOrAdmin);
  const vaccinationRecords = await addCertificateUrls(listing.LivestockVaccinationRecords || [], ownerOrAdmin);
  const data = listingView({
    ...listing.toJSON(),
    LivestockHealthRecords: healthRecords,
    LivestockVaccinationRecords: vaccinationRecords,
  }, { includePrivate: ownerOrAdmin, profileId: viewerId });
  return data;
}

function enquiryView(enquiry, viewerId, withMessages = false) {
  const row = enquiry.toJSON ? enquiry.toJSON() : enquiry;
  return {
    id: row.id,
    subject: row.subject,
    status: row.status,
    isSeller: String(row.sellerId) === String(viewerId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    LivestockListing: row.LivestockListing ? {
      id: row.LivestockListing.id,
      listingName: row.LivestockListing.listingName,
      price: row.LivestockListing.price,
      status: row.LivestockListing.status,
      availability: row.LivestockListing.availability,
    } : null,
    ...(withMessages ? {
      LivestockEnquiryMessages: (row.LivestockEnquiryMessages || []).map((message) => ({
        id: message.id,
        message: message.message,
        isMine: String(message.senderId) === String(viewerId),
        createdAt: message.createdAt,
      })),
    } : {}),
  };
}

async function recordView(listingId, userId) {
  const [view, created] = await LivestockListingView.findOrCreate({
    where: { listingId, userId },
    defaults: { listingId, userId, viewedAt: new Date() },
  });
  if (!created) await view.update({ viewedAt: new Date() });
}

router.get('/categories', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const categories = await LivestockCategory.findAll({
    where: { isActive: true },
    include: [{ model: LivestockBreed, where: { isActive: true }, required: false, attributes: ['id', 'slug', 'name', 'translations'] }],
    order: [['name', 'ASC'], [LivestockBreed, 'name', 'ASC']],
  });
  res.json({ success: true, data: categories });
}));

router.get('/breeds', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const where = { isActive: true };
  if (req.query.categoryId) where.categoryId = uuid(req.query.categoryId, 'Category');
  const breeds = await LivestockBreed.findAll({
    where,
    include: [{ model: LivestockCategory, where: { isActive: true }, required: true, attributes: ['id', 'name', 'translations'] }],
    order: [['name', 'ASC']],
  });
  res.json({ success: true, data: breeds });
}));

router.get('/', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const { page, limit, offset } = pageValues(req);
  const where = { status: 'approved', availability: 'available' };
  if (req.query.categoryId) where.categoryId = uuid(req.query.categoryId, 'Category');
  if (req.query.breedId) where.breedId = uuid(req.query.breedId, 'Breed');
  if (req.query.gender) {
    if (!['female', 'male', 'unknown'].includes(req.query.gender)) throw new HttpError(400, 'Choose a supported gender.');
    where.gender = req.query.gender;
  }
  if (req.query.minAge !== undefined) where.ageMonths = { ...(where.ageMonths || {}), [Op.gte]: requiredNumber(req.query.minAge, 'Minimum age', { min: 0, max: 600, decimals: 0 }) };
  if (req.query.maxAge !== undefined) where.ageMonths = { ...(where.ageMonths || {}), [Op.lte]: requiredNumber(req.query.maxAge, 'Maximum age', { min: 0, max: 600, decimals: 0 }) };
  if (where.ageMonths && where.ageMonths[Op.gte] > where.ageMonths[Op.lte]) throw new HttpError(400, 'Minimum age cannot exceed maximum age.');
  if (req.query.minPrice !== undefined) where.price = { ...(where.price || {}), [Op.gte]: requiredNumber(req.query.minPrice, 'Minimum price', { min: 0, max: 999999999, decimals: 2 }) };
  if (req.query.maxPrice !== undefined) where.price = { ...(where.price || {}), [Op.lte]: requiredNumber(req.query.maxPrice, 'Maximum price', { min: 0, max: 999999999, decimals: 2 }) };
  if (where.price && where.price[Op.gte] > where.price[Op.lte]) throw new HttpError(400, 'Minimum price cannot exceed maximum price.');
  if (req.query.healthCondition) {
    if (!['seller_reports_healthy', 'needs_attention', 'unknown'].includes(req.query.healthCondition)) throw new HttpError(400, 'Choose a supported health filter.');
    where.healthCondition = req.query.healthCondition;
  }
  if (req.query.vaccinationStatus) {
    if (!['vaccinated', 'partially_vaccinated', 'not_vaccinated', 'unknown'].includes(req.query.vaccinationStatus)) throw new HttpError(400, 'Choose a supported vaccination filter.');
    where.vaccinationStatus = req.query.vaccinationStatus;
  }
  for (const field of ['district', 'mandal', 'village']) {
    if (req.query[field]) where[field] = { [Op.iLike]: text(req.query[field], field, 100) };
  }
  const includes = listingIncludes({ activeCategoryOnly: true });
  if (req.query.verifiedSeller === 'true') {
    includes[2].where = { verificationStatus: 'verified' };
    includes[2].required = true;
  } else if (req.query.verifiedSeller !== undefined && req.query.verifiedSeller !== 'false') {
    throw new HttpError(400, 'verifiedSeller must be true or false.');
  }
  const query = text(req.query.q, 'Search term', 100, false);
  if (query) {
    where[Op.or] = [
      { listingName: { [Op.iLike]: `%${query}%` } },
      { color: { [Op.iLike]: `%${query}%` } },
      { '$LivestockBreed.name$': { [Op.iLike]: `%${query}%` } },
      { '$LivestockCategory.name$': { [Op.iLike]: `%${query}%` } },
    ];
  }
  const sorts = {
    newest: [['createdAt', 'DESC']],
    price_asc: [['price', 'ASC'], ['createdAt', 'DESC']],
    price_desc: [['price', 'DESC'], ['createdAt', 'DESC']],
    age_asc: [['ageMonths', 'ASC'], ['createdAt', 'DESC']],
    age_desc: [['ageMonths', 'DESC'], ['createdAt', 'DESC']],
  };
  const sort = req.query.sort || 'newest';
  if (!sorts[sort]) throw new HttpError(400, 'Choose a supported sort order.');
  const result = await LivestockListing.findAndCountAll({
    where,
    include: includes,
    distinct: true,
    limit,
    offset,
    order: sorts[sort],
  });
  const savedIds = result.rows.length
    ? new Set((await LivestockWishlist.findAll({
      attributes: ['listingId'],
      where: { userId: req.user.id, listingId: { [Op.in]: result.rows.map((listing) => listing.id) } },
      raw: true,
    })).map((entry) => entry.listingId))
    : new Set();
  result.rows.forEach((listing) => listing.setDataValue('isWishlisted', savedIds.has(listing.id)));
  res.json({
    success: true,
    data: result.rows.map((listing) => listingView(listing, { profileId: req.user.id })),
    pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) },
  });
}));

router.get('/seller/dashboard', requireRole(sellerRoles), asyncHandler(async (req, res) => {
  const where = { sellerId: req.user.id };
  const [profile, total, active, pending, sold, enquiries, views] = await Promise.all([
    LivestockSellerProfile.findByPk(req.user.id),
    LivestockListing.count({ where }),
    LivestockListing.count({ where: { ...where, status: 'approved', availability: 'available' } }),
    LivestockListing.count({ where: { ...where, status: 'pending' } }),
    LivestockListing.count({ where: { ...where, availability: 'sold' } }),
    LivestockEnquiry.count({ where: { sellerId: req.user.id, status: { [Op.ne]: 'closed' } } }),
    LivestockListingView.count({ include: [{ model: LivestockListing, where: { sellerId: req.user.id }, attributes: [] }] }),
  ]);
  res.json({ success: true, data: { profile, total, active, pending, sold, openEnquiries: enquiries, views } });
}));

router.get('/seller/listings', requireRole(sellerRoles), asyncHandler(async (req, res) => {
  const { page, limit, offset } = pageValues(req);
  const where = { sellerId: req.user.id };
  if (req.query.status) {
    if (!['pending', 'approved', 'rejected', 'archived'].includes(req.query.status)) throw new HttpError(400, 'Choose a supported listing status.');
    where.status = req.query.status;
  }
  const result = await LivestockListing.findAndCountAll({
    where,
    include: listingIncludes({ details: true }),
    distinct: true,
    limit,
    offset,
    order: [['updatedAt', 'DESC']],
  });
  res.json({
    success: true,
    data: await Promise.all(result.rows.map((listing) => detailResponse(listing, req.user.id))),
    pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) },
  });
}));

router.get('/recently-viewed', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const views = await LivestockListingView.findAll({
    where: { userId: req.user.id },
    include: [{
      model: LivestockListing,
      where: { status: 'approved' },
      required: true,
      include: listingIncludes({ activeCategoryOnly: true }),
    }],
    order: [['viewedAt', 'DESC']],
    limit: 30,
  });
  const savedIds = views.length
    ? new Set((await LivestockWishlist.findAll({
      attributes: ['listingId'],
      where: { userId: req.user.id, listingId: { [Op.in]: views.map((view) => view.listingId) } },
      raw: true,
    })).map((entry) => entry.listingId))
    : new Set();
  views.forEach((view) => view.LivestockListing.setDataValue('isWishlisted', savedIds.has(view.listingId)));
  res.json({
    success: true,
    data: views.map((view) => ({ ...listingView(view.LivestockListing, { profileId: req.user.id }), viewedAt: view.viewedAt })),
  });
}));

router.post('/', requireRole(sellerRoles), requireActiveSeller, uploadListingFiles, asyncHandler(async (req, res) => {
  const profileData = profileInput(req.body, req.user);
  const existingProfile = await LivestockSellerProfile.findByPk(req.user.id);
  const values = listingInput(req.body, { profile: profileData });
  const healthRecords = parseRecords(req.body, 'healthRecords', 'health');
  const vaccinationRecords = parseRecords(req.body, 'vaccinationRecords', 'vaccination');
  const uploaded = await uploadMedia(req, { requireImage: true });
  let listing;
  try {
    listing = await sequelize.transaction(async (transaction) => {
      await validateCategoryAndBreed(values.categoryId, values.breedId, transaction);
      if (existingProfile) await existingProfile.update(profileData, { transaction });
      else await LivestockSellerProfile.create(profileData, { transaction });
      const created = await LivestockListing.create({ ...values, sellerId: req.user.id }, { transaction });
      if (uploaded.assets.length) {
        await LivestockImage.bulkCreate(uploaded.assets.map(({ type, result, position }) => ({
          listingId: created.id,
          assetType: type,
          publicId: result.publicId,
          url: result.secureUrl,
          format: result.format,
          bytes: Number(result.bytes || 0),
          durationSeconds: result.duration ? Math.ceil(result.duration) : null,
          position,
        })), { transaction });
      }
      if (healthRecords.length || uploaded.certificate) {
        const records = healthRecords.length ? healthRecords : [{
          recordDate: req.body.veterinaryCheckupDate || new Date().toISOString().slice(0, 10),
          note: text(req.body.healthCertificateNote || 'Seller-provided veterinary certificate image.', 'Certificate note', 1000),
          veterinarianName: text(req.body.veterinarianName, 'Veterinarian name', 160, false),
        }];
        await LivestockHealthRecord.bulkCreate(records.map((record, index) => ({
          listingId: created.id,
          ...record,
          certificatePublicId: index === 0 && uploaded.certificate ? uploaded.certificate.publicId : null,
          certificateFormat: index === 0 && uploaded.certificate ? uploaded.certificate.format : null,
        })), { transaction });
      }
      if (vaccinationRecords.length) {
        await LivestockVaccinationRecord.bulkCreate(vaccinationRecords.map((record) => ({ listingId: created.id, ...record })), { transaction });
      }
      return created;
    });
  } catch (error) {
    await cleanupAssets(uploaded.assets, uploaded.certificate);
    throw error;
  }
  const result = await LivestockListing.findByPk(listing.id, { include: listingIncludes({ details: true }) });
  res.status(201).json({ success: true, data: await detailResponse(result, req.user.id), message: 'Your livestock listing was submitted for review.' });
}));

router.put('/:id', requireRole(sellerRoles), requireActiveSeller, uploadListingFiles, asyncHandler(async (req, res) => {
  const listing = await LivestockListing.findOne({ where: { id: req.params.id, sellerId: req.user.id } });
  if (!listing) throw new HttpError(404, 'The livestock listing was not found.');
  if (listing.status === 'archived' || listing.availability === 'sold') throw new HttpError(409, 'Sold or archived listings cannot be edited.');
  const profile = await LivestockSellerProfile.findByPk(req.user.id);
  const updates = listingInput(req.body, { existing: listing, profile });
  const healthRecords = req.body.healthRecords === undefined ? null : parseRecords(req.body, 'healthRecords', 'health');
  const vaccinationRecords = req.body.vaccinationRecords === undefined ? null : parseRecords(req.body, 'vaccinationRecords', 'vaccination');
  const uploaded = await uploadMedia(req);
  try {
    await sequelize.transaction(async (transaction) => {
      await validateCategoryAndBreed(updates.categoryId, updates.breedId, transaction);
      const currentImageCount = await LivestockImage.count({ where: { listingId: listing.id, assetType: 'image' }, transaction });
      if (currentImageCount + uploaded.assets.filter((asset) => asset.type === 'image').length > 6) {
        throw new HttpError(400, 'A livestock listing can have no more than six photos.');
      }
      listing.set({ ...updates, status: 'pending', rejectionReason: null });
      await listing.save({ transaction });
      if (uploaded.assets.length) {
        await LivestockImage.bulkCreate(uploaded.assets.map(({ type, result, position }) => ({
          listingId: listing.id,
          assetType: type,
          publicId: result.publicId,
          url: result.secureUrl,
          format: result.format,
          bytes: Number(result.bytes || 0),
          durationSeconds: result.duration ? Math.ceil(result.duration) : null,
          position: currentImageCount + position,
        })), { transaction });
      }
      if (healthRecords) {
        await LivestockHealthRecord.destroy({ where: { listingId: listing.id }, transaction });
        await LivestockHealthRecord.bulkCreate(healthRecords.map((record) => ({ listingId: listing.id, ...record })), { transaction });
      } else if (uploaded.certificate) {
        await LivestockHealthRecord.create({
          listingId: listing.id,
          recordDate: req.body.veterinaryCheckupDate || new Date().toISOString().slice(0, 10),
          note: text(req.body.healthCertificateNote || 'Seller-provided veterinary certificate image.', 'Certificate note', 1000),
          veterinarianName: text(req.body.veterinarianName, 'Veterinarian name', 160, false),
          certificatePublicId: uploaded.certificate.publicId,
          certificateFormat: uploaded.certificate.format,
        }, { transaction });
      }
      if (vaccinationRecords) {
        await LivestockVaccinationRecord.destroy({ where: { listingId: listing.id }, transaction });
        await LivestockVaccinationRecord.bulkCreate(vaccinationRecords.map((record) => ({ listingId: listing.id, ...record })), { transaction });
      }
    });
  } catch (error) {
    await cleanupAssets(uploaded.assets, uploaded.certificate);
    throw error;
  }
  const result = await LivestockListing.findByPk(listing.id, { include: listingIncludes({ details: true }) });
  res.json({ success: true, data: await detailResponse(result, req.user.id), message: 'The listing was updated and submitted for review.' });
}));

router.delete('/:id', requireRole(sellerRoles), requireActiveSeller, asyncHandler(async (req, res) => {
  const listing = await LivestockListing.findOne({ where: { id: req.params.id, sellerId: req.user.id } });
  if (!listing) throw new HttpError(404, 'The livestock listing was not found.');
  await listing.update({ status: 'archived', availability: 'paused', rejectionReason: null });
  res.json({ success: true, message: 'The listing was removed from the marketplace.' });
}));

router.put('/seller/listings/:listingId/status', requireRole(sellerRoles), requireActiveSeller, asyncHandler(async (req, res) => {
  const availability = text(req.body.availability, 'Availability', 20);
  if (!['available', 'paused', 'sold'].includes(availability)) throw new HttpError(400, 'Choose available, paused, or sold.');
  const listing = await LivestockListing.findOne({ where: { id: req.params.listingId, sellerId: req.user.id } });
  if (!listing) throw new HttpError(404, 'The livestock listing was not found.');
  if (listing.status !== 'approved') throw new HttpError(409, 'A listing must be approved before its availability can be changed.');
  await listing.update({ availability });
  res.json({ success: true, data: { id: listing.id, availability }, message: 'Listing availability updated.' });
}));

router.delete('/seller/listings/:listingId/images/:imageId', requireRole(sellerRoles), requireActiveSeller, asyncHandler(async (req, res) => {
  const listing = await LivestockListing.findOne({ where: { id: req.params.listingId, sellerId: req.user.id } });
  if (!listing) throw new HttpError(404, 'The livestock listing was not found.');
  const image = await LivestockImage.findOne({ where: { id: req.params.imageId, listingId: listing.id } });
  if (!image) throw new HttpError(404, 'The listing media was not found.');
  if (image.assetType === 'image' && await LivestockImage.count({ where: { listingId: listing.id, assetType: 'image' } }) <= 1) {
    throw new HttpError(409, 'A listing must keep at least one animal photo.');
  }
  await sequelize.transaction(async (transaction) => {
    await image.destroy({ transaction });
    if (listing.status === 'approved') await listing.update({ status: 'pending', rejectionReason: null }, { transaction });
  });
  if (image.assetType === 'video') await cloudinaryService.deletePublicVideo(image.publicId);
  else await cloudinaryService.deletePublicImage(image.publicId);
  res.json({ success: true, message: 'Media removed. The listing may require review again.' });
}));

router.get('/wishlist', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const result = await LivestockWishlist.findAll({
    where: { userId: req.user.id },
    include: [{ model: LivestockListing, where: { status: 'approved' }, required: true, include: listingIncludes({ activeCategoryOnly: true }) }],
    order: [['createdAt', 'DESC']],
  });
  result.forEach((entry) => entry.LivestockListing.setDataValue('isWishlisted', true));
  res.json({ success: true, data: result.map((entry) => listingView(entry.LivestockListing, { profileId: req.user.id })) });
}));

router.post('/wishlist/:listingId', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const listing = await LivestockListing.findOne({
    where: { id: req.params.listingId, status: 'approved', availability: 'available' },
    include: [{ model: LivestockCategory, where: { isActive: true }, required: true, attributes: ['id'] }],
    attributes: ['id'],
  });
  if (!listing) throw new HttpError(404, 'The livestock listing is not available.');
  await LivestockWishlist.findOrCreate({
    where: { userId: req.user.id, listingId: listing.id },
    defaults: { userId: req.user.id, listingId: listing.id },
  });
  res.status(201).json({ success: true, message: 'Listing saved to your wishlist.' });
}));

router.delete('/wishlist/:listingId', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const deleted = await LivestockWishlist.destroy({ where: { userId: req.user.id, listingId: req.params.listingId } });
  if (!deleted) throw new HttpError(404, 'The saved livestock listing was not found.');
  res.json({ success: true, message: 'Listing removed from your wishlist.' });
}));

router.post('/enquiries', requireRole(buyerRoles), enquiryLimiter, asyncHandler(async (req, res) => {
  const listingId = uuid(req.body.listingId, 'Listing');
  const listing = await LivestockListing.findOne({
    where: { id: listingId, status: 'approved', availability: 'available' },
    include: [{ model: LivestockCategory, where: { isActive: true }, required: true, attributes: ['id'] }],
  });
  if (!listing) throw new HttpError(404, 'The livestock listing is not available.');
  if (String(listing.sellerId) === String(req.user.id)) throw new HttpError(400, 'You cannot enquire about your own listing.');
  const enquiry = await sequelize.transaction(async (transaction) => {
    const created = await LivestockEnquiry.create({
      listingId,
      buyerId: req.user.id,
      sellerId: listing.sellerId,
      subject: text(req.body.subject || 'Livestock enquiry', 'Enquiry subject', 180),
      status: 'open',
    }, { transaction });
    await LivestockEnquiryMessage.create({
      enquiryId: created.id,
      senderId: req.user.id,
      message: text(req.body.message, 'Message', 3000),
    }, { transaction });
    return created;
  });
  res.status(201).json({ success: true, data: enquiry, message: 'Your enquiry was sent to the seller.' });
}));

router.get('/enquiries', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const { page, limit, offset } = pageValues(req);
  const where = { [Op.or]: [{ buyerId: req.user.id }, { sellerId: req.user.id }] };
  if (req.query.status) {
    if (!['open', 'responded', 'closed'].includes(req.query.status)) throw new HttpError(400, 'Choose a supported enquiry status.');
    where.status = req.query.status;
  }
  const result = await LivestockEnquiry.findAndCountAll({
    where,
    include: [{ model: LivestockListing, attributes: ['id', 'listingName', 'price', 'status', 'availability'], required: false }],
    distinct: true,
    limit,
    offset,
    order: [['updatedAt', 'DESC']],
  });
  res.json({ success: true, data: result.rows.map((enquiry) => enquiryView(enquiry, req.user.id)), pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } });
}));

router.get('/enquiries/:enquiryId', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const enquiry = await LivestockEnquiry.findOne({
    where: { id: req.params.enquiryId, [Op.or]: [{ buyerId: req.user.id }, { sellerId: req.user.id }] },
    include: [
      { model: LivestockListing, attributes: ['id', 'listingName', 'status', 'availability'], required: false },
      { model: LivestockEnquiryMessage, separate: true, order: [['createdAt', 'ASC']] },
    ],
  });
  if (!enquiry) throw new HttpError(404, 'The enquiry was not found.');
  res.json({ success: true, data: enquiryView(enquiry, req.user.id, true) });
}));

router.post('/enquiries/:enquiryId/messages', requireRole(buyerRoles), enquiryLimiter, asyncHandler(async (req, res) => {
  const enquiry = await LivestockEnquiry.findOne({
    where: { id: req.params.enquiryId, [Op.or]: [{ buyerId: req.user.id }, { sellerId: req.user.id }] },
  });
  if (!enquiry) throw new HttpError(404, 'The enquiry was not found.');
  if (enquiry.status === 'closed') throw new HttpError(409, 'This enquiry is closed.');
  const message = await sequelize.transaction(async (transaction) => {
    const created = await LivestockEnquiryMessage.create({
      enquiryId: enquiry.id,
      senderId: req.user.id,
      message: text(req.body.message, 'Message', 3000),
    }, { transaction });
    await enquiry.update({ status: String(enquiry.sellerId) === String(req.user.id) ? 'responded' : 'open' }, { transaction });
    return created;
  });
  res.status(201).json({ success: true, data: { id: message.id, message: message.message, isMine: true, createdAt: message.createdAt }, message: 'Your message was sent.' });
}));

router.put('/enquiries/:enquiryId/status', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const status = text(req.body.status, 'Enquiry status', 20);
  if (!['open', 'closed'].includes(status)) throw new HttpError(400, 'Choose open or closed.');
  const enquiry = await LivestockEnquiry.findOne({
    where: { id: req.params.enquiryId, [Op.or]: [{ buyerId: req.user.id }, { sellerId: req.user.id }] },
  });
  if (!enquiry) throw new HttpError(404, 'The enquiry was not found.');
  await enquiry.update({ status });
  res.json({ success: true, data: { id: enquiry.id, status } });
}));

router.post('/reports', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const listing = await LivestockListing.findOne({
    where: { id: uuid(req.body.listingId, 'Listing'), status: 'approved' },
    include: [{ model: LivestockCategory, where: { isActive: true }, required: true, attributes: ['id'] }],
    attributes: ['id', 'sellerId'],
  });
  if (!listing) throw new HttpError(404, 'The livestock listing was not found.');
  if (String(listing.sellerId) === String(req.user.id)) throw new HttpError(400, 'You cannot report your own listing.');
  const reason = text(req.body.reason, 'Report reason', 30);
  if (!['misleading', 'unsafe', 'fraud', 'prohibited', 'other'].includes(reason)) throw new HttpError(400, 'Choose a supported report reason.');
  try {
    const report = await LivestockReport.create({
      listingId: listing.id,
      reporterId: req.user.id,
      reason,
      description: text(req.body.description, 'Description', 1600, false),
    });
    res.status(201).json({ success: true, data: report, message: 'The listing was reported for review.' });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') throw new HttpError(409, 'You have already reported this listing.');
    throw error;
  }
}));

router.get('/:id', requireRole(buyerRoles), asyncHandler(async (req, res) => {
  const listing = await LivestockListing.findByPk(req.params.id, { include: listingIncludes({ details: true }) });
  const owner = listing && String(listing.sellerId) === String(req.user.id);
  if (!listing || (listing.status !== 'approved' && !owner) || (!listing.LivestockCategory.isActive && !owner)) {
    throw new HttpError(404, 'The livestock listing was not found.');
  }
  if (listing.status === 'approved' && !owner && listing.availability === 'available') await recordView(listing.id, req.user.id);
  const saved = await LivestockWishlist.findOne({ where: { listingId: listing.id, userId: req.user.id }, attributes: ['id'] });
  listing.setDataValue('isWishlisted', Boolean(saved));
  const views = owner ? await LivestockListingView.count({ where: { listingId: listing.id } }) : undefined;
  if (views !== undefined) listing.setDataValue('viewCount', views);
  res.json({ success: true, data: await detailResponse(listing, req.user.id) });
}));

module.exports = router;
