const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const {
  sequelize,
  User,
  UserRole,
  FarmerProfile,
  ExpertProfile,
  ServiceProviderProfile,
  BuyerProfile,
  SellerProfile,
  UserPreference,
  OtpVerification,
  RefreshToken,
  UserSession,
  PasswordReset,
} = require('../models');
const cloudinaryService = require('../services/cloudinaryService');
const otp = require('../services/otpService');
const land = require('../services/landMeasurementService');
const { detectImageMime } = require('../utils/fileValidation');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const roles = new Set(['farmer', 'expert', 'provider', 'buyer', 'seller']);
const registrationRoles = new Set(['farmer', 'provider', 'buyer', 'seller']);
const languages = { English: 'en', తెలుగు: 'te', हिन्दी: 'hi', en: 'en', te: 'te', hi: 'hi' };
const registrationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 6, standardHeaders: 'draft-7', legacyHeaders: false });
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter(req, file, callback) {
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)) {
      return callback(new HttpError(415, 'Upload a PDF, JPEG, or PNG verification document.'));
    }
    return callback(null, true);
  },
});

function handleDocuments(req, res, next) {
  upload.fields([{ name: 'certificate', maxCount: 1 }, { name: 'businessDocuments', maxCount: 1 }])(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'Each verification document must be no larger than 5 MB.'));
    if (error instanceof multer.MulterError) return next(new HttpError(400, 'Upload one certificate and one business document at most.'));
    return next(error);
  });
}

function string(value, field, { required = false, max = 500 } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} is required.`);
    return null;
  }
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > max) {
    throw new HttpError(400, `${field} must be a non-empty value of no more than ${max} characters.`);
  }
  return value.trim();
}

function normalizeEmail(value) {
  const email = string(value, 'Email', { max: 254 });
  if (!email) return null;
  const normalized = email.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new HttpError(400, 'Enter a valid email address.');
  return normalized;
}

function normalizeMobile(value) {
  const mobile = string(value, 'Mobile number', { required: true, max: 20 });
  if (!/^\+?[0-9 ()-]{8,18}$/.test(mobile)) throw new HttpError(400, 'Enter a valid mobile number.');
  const normalized = mobile.replace(/[ ()-]/g, '');
  if (normalized.replace(/\D/g, '').length < 8) throw new HttpError(400, 'Enter a valid mobile number.');
  return normalized;
}

function bool(value, field, fallback = false) {
  if (value === undefined) return fallback;
  if (value === true || value === 'true' || value === 'on' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  throw new HttpError(400, `${field} must be true or false.`);
}

function list(value, field, max = 30) {
  if (value === undefined || value === null || value === '') return [];
  let items = value;
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch { items = [items]; }
  }
  if (!Array.isArray(items) || items.length > max) throw new HttpError(400, `${field} must be a list of no more than ${max} values.`);
  return items.map((item) => string(item, field, { required: true, max: 120 }));
}

function integer(value, field, { min = 0, max = 100 } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new HttpError(400, `${field} must be a whole number from ${min} to ${max}.`);
  return parsed;
}

function area(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10000000) throw new HttpError(400, 'Land area must be a valid non-negative number.');
  return parsed;
}

function requiredArea(value) {
  const parsed = area(value);
  if (parsed === null || parsed === 0) throw new HttpError(400, 'Land area must be greater than zero.');
  return parsed;
}

function pin(value) {
  const result = string(value, 'PIN code', { max: 10 });
  if (result && !/^\d{5,10}$/.test(result)) throw new HttpError(400, 'PIN code must contain 5 to 10 digits.');
  return result;
}

function mapLanguage(value) {
  if (value === undefined || value === null || value === '') return 'en';
  const result = languages[value];
  if (!result) throw new HttpError(400, 'Choose English, Telugu, or Hindi as the preferred language.');
  return result;
}

function normalizeRole(value) {
  const role = typeof value === 'string' ? value.trim().toLowerCase().replace(/[\s-]+/g, '_') : '';
  const aliases = { agricultural_expert: 'expert', service_provider: 'provider', farmer_user: 'farmer' };
  const normalized = aliases[role] || role;
  if (!roles.has(normalized)) throw new HttpError(400, 'Choose a supported public account role.');
  return normalized;
}

function documentMime(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) throw new HttpError(400, 'The verification document is empty.');
  const imageMime = detectImageMime(file.buffer);
  if (imageMime === 'image/jpeg' || imageMime === 'image/png') return imageMime;
  if (file.buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  throw new HttpError(415, 'The verification document content must be a PDF, JPEG, or PNG.');
}

function identifier(value) {
  const raw = string(value, 'Email or mobile number', { required: true, max: 254 });
  return raw.includes('@') ? normalizeEmail(raw) : normalizeMobile(raw);
}

function recoveryIdentifier(value) {
  const target = identifier(value);
  if (target.includes('@')) throw new HttpError(400, 'Password recovery codes can only be sent by SMS to a registered mobile number.');
  return target;
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function cookieOptions(kind) {
  const sameSite = process.env.AUTH_COOKIE_SAME_SITE || 'lax';
  const secure = process.env.NODE_ENV === 'production' || sameSite.toLowerCase() === 'none';
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: kind === 'refresh' ? '/api/auth' : '/',
  };
}

function setSessionCookies(res, accessToken, refreshToken, refreshExpiry) {
  res.cookie(process.env.AUTH_COOKIE_NAME || 'accessToken', accessToken, {
    ...cookieOptions('access'),
    maxAge: 15 * 60 * 1000,
  });
  res.cookie(process.env.AUTH_REFRESH_COOKIE_NAME || 'refreshToken', refreshToken, {
    ...cookieOptions('refresh'),
    expires: refreshExpiry,
  });
}

function clearSessionCookies(res) {
  res.clearCookie(process.env.AUTH_COOKIE_NAME || 'accessToken', cookieOptions('access'));
  res.clearCookie(process.env.AUTH_REFRESH_COOKIE_NAME || 'refreshToken', cookieOptions('refresh'));
}

function getRefreshToken(req) {
  return req.cookies && req.cookies[process.env.AUTH_REFRESH_COOKIE_NAME || 'refreshToken'];
}

function safeUser(user, roleNames, activeRole, profile = {}) {
  return {
    id: user.id,
    name: user.fullName,
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    role: activeRole,
    activeRole,
    roles: roleNames,
    isVerified: user.isVerified,
    preferredLanguage: profile.preferredLanguage || 'en',
    interactionMode: profile.interactionMode || 'normal',
    profile,
  };
}

async function roleNames(userId, transaction) {
  const rows = await UserRole.findAll({ where: { userId }, attributes: ['role'], transaction });
  return rows.map((row) => row.role);
}

async function profileFor(userId, role, transaction) {
  if (role === 'farmer') {
    const profile = await FarmerProfile.findByPk(userId, { transaction });
    if (!profile) return {};
    return profile.toJSON();
  }
  if (role === 'expert') return (await ExpertProfile.findByPk(userId, { transaction }))?.toJSON() || {};
  if (role === 'provider') return (await ServiceProviderProfile.findByPk(userId, { transaction }))?.toJSON() || {};
  if (role === 'buyer') return (await BuyerProfile.findByPk(userId, { transaction }))?.toJSON() || {};
  if (role === 'seller') return (await SellerProfile.findByPk(userId, { transaction }))?.toJSON() || {};
  return {};
}

function jwtProfile(profile, user) {
  return {
    name: user.fullName,
    location: [profile.village, profile.mandal, profile.district, profile.state].filter(Boolean).join(', ') || undefined,
    state: profile.state,
    district: profile.district,
    village: profile.village,
    landArea: profile.landArea,
    landAreaUnit: profile.areaUnit,
    farmName: profile.farmName,
    primaryCrop: profile.primaryCrop,
    currentCrops: [profile.primaryCrop, ...(profile.otherCrops || [])].filter(Boolean),
    soilType: profile.soilType,
    irrigationMethod: profile.irrigationType,
    preferredLanguage: profile.preferredLanguage,
    latitude: profile.latitude,
    longitude: profile.longitude,
  };
}

async function makeAccessToken(user, rolesForUser, activeRole, profile) {
  const jwt = require('jsonwebtoken');
  if (!process.env.JWT_SECRET) throw new HttpError(503, 'Authentication is not configured on this server.');
  const claims = {
    sub: String(user.id),
    role: activeRole,
    roles: rolesForUser,
    profile: jwtProfile(profile, user),
  };
  return jwt.sign(claims, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
}

async function createSession(req, res, user, selectedRole) {
  const rolesForUser = await roleNames(user.id);
  if (!rolesForUser.length) throw new HttpError(403, 'This account has no permitted roles.');
  const activeRole = selectedRole ? normalizeRole(selectedRole) : rolesForUser[0];
  if (!rolesForUser.includes(activeRole)) throw new HttpError(403, 'This account is not permitted to use the selected role.');
  const [profile, preferences] = await Promise.all([
    profileFor(user.id, activeRole),
    UserPreference.findByPk(user.id),
  ]);
  const userProfile = { ...profile, preferredLanguage: preferences?.preferredLanguage, interactionMode: preferences?.interactionMode };
  const accessToken = await makeAccessToken(user, rolesForUser, activeRole, profile);
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const clientIp = req.ip ? crypto.createHash('sha256').update(req.ip).digest('hex') : null;
  await sequelize.transaction(async (transaction) => {
    const stored = await RefreshToken.create({
      userId: user.id,
      tokenHash: tokenHash(refreshToken),
      expiresAt,
    }, { transaction });
    await UserSession.create({
      userId: user.id,
      refreshTokenId: stored.id,
      userAgent: string(req.get('user-agent'), 'User agent', { max: 500 }) || null,
      ipHash: clientIp,
      lastSeenAt: new Date(),
    }, { transaction });
    await user.update({ lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null }, { transaction });
  });
  setSessionCookies(res, accessToken, refreshToken, expiresAt);
  return { user: safeUser(user, rolesForUser, activeRole, userProfile), accessToken };
}

function profileInput(body, userId, role, document) {
  const location = {
    state: string(body.state, 'State', { max: 120 }),
    district: string(body.district, 'District', { max: 120 }),
    mandal: string(body.mandal, 'Mandal', { max: 120 }),
    village: string(body.village, 'Village', { max: 120 }),
    pinCode: pin(body.pinCode),
  };
  const experience = integer(body.experience, 'Experience', { max: 80 });
  if (role === 'farmer') {
    const landArea = requiredArea(body.landArea);
    return FarmerProfile.build({
      userId,
      state: string(body.state, 'State', { required: true, max: 120 }),
      district: string(body.district, 'District', { required: true, max: 120 }),
      mandal: location.mandal,
      village: location.village,
      pinCode: location.pinCode,
      farmName: string(body.farmName, 'Farm name', { max: 160 }),
      farmLocation: string(body.farmLocation, 'Farm location', { max: 500 }),
      landArea,
      areaUnit: land.normalizeAreaUnit(string(body.areaUnit, 'Land unit', { required: true, max: 40 }), body.state),
      primaryCrop: string(body.primaryCrop, 'Primary crop', { required: true, max: 120 }),
      otherCrops: list(body.otherCrops, 'Other crops'),
      soilType: string(body.soilType, 'Soil type', { max: 120 }),
      irrigationType: string(body.irrigationType, 'Irrigation type', { max: 120 }),
      experience,
      preferredLanguage: mapLanguage(body.preferredLanguage),
    });
  }
  if (role === 'expert') {
    return ExpertProfile.build({
      userId,
      qualification: string(body.qualification, 'Qualification', { required: true, max: 180 }),
      specialization: string(body.specialization, 'Specialization', { required: true, max: 180 }),
      organization: string(body.organization, 'Organization', { max: 180 }),
      experience,
      languages: list(body.languages, 'Languages', 10),
      ...location,
      certificatePublicId: document?.publicId || null,
      certificateFormat: document?.format || null,
      approvalStatus: 'pending',
    });
  }
  if (role === 'provider') {
    const serviceCategories = list(body.serviceCategories, 'Service categories');
    const serviceCoverage = list(body.serviceCoverage, 'Service coverage');
    if (!serviceCategories.length || !serviceCoverage.length) throw new HttpError(400, 'Choose at least one service category and service area.');
    return ServiceProviderProfile.build({
      userId,
      businessName: string(body.businessName, 'Business name', { required: true, max: 180 }),
      contactPerson: string(body.contactPerson, 'Contact person', { required: true, max: 160 }),
      serviceCategories,
      serviceCoverage,
      serviceDescription: string(body.serviceDescription, 'Service description', { required: true, max: 3000 }),
      pricing: string(body.pricing, 'Pricing information', { max: 1000 }),
      workingHours: string(body.workingHours, 'Working hours', { max: 500 }),
      state: location.state,
      district: location.district,
      village: location.village,
      pinCode: location.pinCode,
      documentPublicId: document?.publicId || null,
      documentFormat: document?.format || null,
      approvalStatus: 'pending',
    });
  }
  if (role === 'buyer') {
    const productInterests = list(body.productInterests, 'Product interests');
    if (!productInterests.length) throw new HttpError(400, 'Choose at least one product interest.');
    return BuyerProfile.build({
      userId,
      buyerCategory: string(body.buyerCategory, 'Buyer category', { required: true, max: 120 }),
      productInterests,
      organization: string(body.organization, 'Organization', { max: 180 }),
      description: string(body.description, 'Description', { max: 1500 }),
      ...location,
    });
  }
  const organization = string(body.organization, 'Business name', { max: 180 });
  const productCategories = list(body.productCategories, 'Product categories');
  if (!productCategories.length) throw new HttpError(400, 'Choose at least one product category.');
  return SellerProfile.build({
    userId,
    businessName: organization || string(body.fullName, 'Business name', { required: true, max: 180 }),
    description: string(body.description, 'Description', { max: 1500 }),
    verificationStatus: 'pending',
    sellerCategory: string(body.sellerCategory, 'Seller category', { required: true, max: 120 }),
    productCategories,
    state: location.state,
    district: location.district,
    mandal: location.mandal,
    village: location.village,
    pinCode: location.pinCode,
  });
}

async function storeDocument(file) {
  if (!file) return null;
  const mimeType = documentMime(file);
  return cloudinaryService.uploadPrivateDocument(file.buffer, mimeType);
}

async function removeDocuments(documents) {
  const remove = documents.filter(Boolean).map((document) => cloudinaryService.deletePrivateDocument(document.publicId, document.resourceType));
  const results = await Promise.allSettled(remove);
  results.forEach((result) => {
    if (result.status === 'rejected') console.error('A private registration document could not be removed:', result.reason.message);
  });
}

function roleProfileData(profile) {
  return profile.get({ plain: true });
}

router.post('/register', registrationLimiter, handleDocuments, asyncHandler(async (req, res) => {
  const name = string(req.body.fullName, 'Full name', { required: true, max: 160 });
  const mobile = normalizeMobile(req.body.mobile);
  const email = normalizeEmail(req.body.email);
  const password = string(req.body.password, 'Password', { required: true, max: 128 });
  const role = normalizeRole(req.body.role);
  if (!registrationRoles.has(role)) throw new HttpError(400, 'Agricultural expert accounts are no longer available for registration.');
  const acceptedTerms = bool(req.body.agreeTerms, 'Terms agreement');
  if (!acceptedTerms) throw new HttpError(400, 'Accept the terms before creating an account.');
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters long.');
  if (!process.env.JWT_SECRET) throw new HttpError(503, 'Authentication is not configured on this server.');
  if (await User.findOne({ where: { [Op.or]: [{ mobile }, ...(email ? [{ email }] : [])] }, attributes: ['id'] })) {
    throw new HttpError(409, 'An account already uses this email or mobile number. Try signing in or recovering access.');
  }

  const files = req.files || {};
  const file = role === 'expert' ? files.certificate?.[0] : role === 'provider' ? files.businessDocuments?.[0] : null;
  const unusedFile = role === 'expert' ? files.businessDocuments?.[0] : role === 'provider' ? files.certificate?.[0] : files.certificate?.[0] || files.businessDocuments?.[0];
  if (unusedFile) throw new HttpError(400, 'A verification document is only accepted for its matching account role.');
  let uploadedDocument = null;
  try {
    uploadedDocument = await storeDocument(file);
    const transaction = await sequelize.transaction();
    try {
      const user = await User.create({
        fullName: name,
        mobile,
        email,
        passwordHash: await bcrypt.hash(password, 12),
        status: 'active',
        isVerified: true,
      }, { transaction });
      await UserRole.create({ userId: user.id, role }, { transaction });
      const profile = profileInput(req.body, user.id, role, uploadedDocument);
      await profile.save({ transaction });
      const preferredLanguage = mapLanguage(req.body.preferredLanguage);
      await UserPreference.create({
        userId: user.id,
        preferredLanguage,
        notificationsEnabled: bool(req.body.notifications, 'Notification preference'),
      }, { transaction });
      await transaction.commit();
      const pendingApproval = ['expert', 'provider'].includes(role);
      return res.status(201).json({
        success: true,
        message: 'Account created. You can now sign in.',
        data: { userId: user.id, role, pendingApproval },
      });
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
      throw error;
    }
  } catch (error) {
    if (uploadedDocument) await removeDocuments([uploadedDocument]);
    if (error.name === 'SequelizeUniqueConstraintError') throw new HttpError(409, 'An account already uses this email or mobile number.');
    throw error;
  }
}));

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const loginId = identifier(req.body.identifier || req.body.email || req.body.mobile);
  const password = string(req.body.password, 'Password', { required: true, max: 128 });
  const where = loginId.includes('@') ? { email: loginId } : { mobile: loginId };
  const user = await User.findOne({ where });
  if (!user) {
    await bcrypt.hash(password, 10);
    throw new HttpError(401, 'Invalid credentials.');
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) throw new HttpError(423, 'This account is temporarily locked after repeated sign-in failures.');
  if (!await bcrypt.compare(password, user.passwordHash)) {
    const attempts = user.failedLoginAttempts + 1;
    await user.update({
      failedLoginAttempts: attempts >= 5 ? 0 : attempts,
      lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
    });
    throw new HttpError(attempts >= 5 ? 423 : 401, attempts >= 5 ? 'This account is temporarily locked after repeated sign-in failures.' : 'Invalid credentials.');
  }
  if (user.status === 'suspended' || user.status === 'deleted') throw new HttpError(403, 'This account is not available. Contact AGRISATHI support.');
  if (user.status === 'pending_verification' && !user.isVerified) {
    await user.update({ isVerified: true, status: 'active' });
  } else if (!user.isVerified || user.status !== 'active') {
    throw new HttpError(403, 'This account is not available. Contact AGRISATHI support.');
  }
  const session = await createSession(req, res, user, req.body.activeRole || req.body.role);
  return res.json({ success: true, message: 'Login successful.', data: session });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const refresh = getRefreshToken(req);
  if (refresh) {
    await RefreshToken.update({ revokedAt: new Date() }, { where: { tokenHash: tokenHash(refresh), revokedAt: null } });
  }
  clearSessionCookies(res);
  return res.json({ success: true, message: 'Logout successful.' });
}));

router.post('/refresh-token', asyncHandler(async (req, res) => {
  const currentToken = getRefreshToken(req);
  if (!currentToken) {
    clearSessionCookies(res);
    throw new HttpError(401, 'A valid refresh session is required.');
  }
  const transaction = await sequelize.transaction();
  try {
    const stored = await RefreshToken.findOne({
      where: { tokenHash: tokenHash(currentToken) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!stored) throw new HttpError(401, 'The refresh session is invalid or expired.');
    if (stored.revokedAt) {
      await RefreshToken.update({ revokedAt: new Date() }, { where: { userId: stored.userId, revokedAt: null }, transaction });
      await transaction.commit();
      clearSessionCookies(res);
      return res.status(401).json({ success: false, message: 'The refresh session has already been used.' });
    }
    if (stored.expiresAt <= new Date()) {
      await stored.update({ revokedAt: new Date() }, { transaction });
      throw new HttpError(401, 'The refresh session is invalid or expired.');
    }
    const user = await User.findByPk(stored.userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.status !== 'active' || !user.isVerified) throw new HttpError(401, 'The account is no longer available.');
    const rolesForUser = await roleNames(user.id, transaction);
    if (!rolesForUser.length) throw new HttpError(403, 'This account has no permitted roles.');
    const sessionRow = await UserSession.findOne({ where: { refreshTokenId: stored.id }, transaction });
    const oldSession = sessionRow;
    const activeRole = rolesForUser.includes(req.body.activeRole) ? req.body.activeRole : rolesForUser[0];
    const profile = await profileFor(user.id, activeRole, transaction);
    const preference = await UserPreference.findByPk(user.id, { transaction });
    const accessToken = await makeAccessToken(user, rolesForUser, activeRole, profile);
    const refreshToken = crypto.randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const replacement = await RefreshToken.create({
      userId: user.id,
      tokenHash: tokenHash(refreshToken),
      expiresAt,
    }, { transaction });
    await stored.update({ revokedAt: new Date(), replacedById: replacement.id }, { transaction });
    if (oldSession) {
      await oldSession.update({ refreshTokenId: replacement.id, lastSeenAt: new Date() }, { transaction });
    } else {
      await UserSession.create({
        userId: user.id,
        refreshTokenId: replacement.id,
        lastSeenAt: new Date(),
      }, { transaction });
    }
    await transaction.commit();
    setSessionCookies(res, accessToken, refreshToken, expiresAt);
    const userProfile = { ...profile, preferredLanguage: preference?.preferredLanguage, interactionMode: preference?.interactionMode };
    return res.json({ success: true, data: { user: safeUser(user, rolesForUser, activeRole, userProfile), accessToken } });
  } catch (error) {
    await transaction.rollback();
    if (error instanceof HttpError) {
      clearSessionCookies(res);
      throw error;
    }
    throw error;
  }
}));

router.get('/me', asyncHandler(async (req, res) => {
  const { requireAuth } = require('../middleware/auth');
  return requireAuth(req, res, async () => {
    const user = await User.findOne({
      where: { id: req.user.id, status: 'active', isVerified: true },
      include: [
        { model: UserRole, attributes: ['role'] },
        { model: FarmerProfile, required: false },
        { model: ExpertProfile, required: false },
        { model: ServiceProviderProfile, required: false },
        { model: BuyerProfile, required: false },
        { model: UserPreference, required: false },
      ],
    });
    if (!user) throw new HttpError(401, 'The account is not available.');
    const rolesForUser = user.UserRoles.map((entry) => entry.role);
    const activeRole = rolesForUser.includes(req.user.role) ? req.user.role : rolesForUser[0];
    const profile = await profileFor(user.id, activeRole);
    const preference = user.UserPreference;
    const result = safeUser(user, rolesForUser, activeRole, profile);
    result.preferredLanguage = preference?.preferredLanguage || 'en';
    result.interactionMode = preference?.interactionMode || 'normal';
    return res.json({ success: true, data: { user: result } });
  });
}));

router.put('/interaction-mode', requireAuth, asyncHandler(async (req, res) => {
  const interactionMode = req.body.interactionMode;
  if (!['normal', 'voice'].includes(interactionMode)) {
    throw new HttpError(400, 'Choose normal or voice interaction mode.');
  }
  const user = await User.findByPk(req.user.id, { attributes: ['id', 'status', 'isVerified'] });
  if (!user || user.status !== 'active' || !user.isVerified) throw new HttpError(401, 'The account is not available.');
  const existing = await UserPreference.findByPk(req.user.id);
  const preference = await UserPreference.upsert({
    userId: req.user.id,
    preferredLanguage: existing?.preferredLanguage || req.user.profile.preferredLanguage || 'en',
    notificationsEnabled: existing?.notificationsEnabled || false,
    notificationSettings: existing?.notificationSettings || {},
    interactionMode,
  }, { returning: true });
  return res.json({ success: true, data: { interactionMode: preference[0].interactionMode } });
}));

router.post('/voice/register', registrationLimiter, asyncHandler(async (req, res) => {
  const fullName = string(req.body.fullName, 'Full name', { required: true, max: 160 });
  const mobile = normalizeMobile(req.body.mobile);
  const password = string(req.body.password, 'Password', { required: true, max: 128 });
  const district = string(req.body.district, 'District', { required: true, max: 120 });
  const village = string(req.body.village, 'Village', { required: true, max: 120 });
  const state = string(req.body.state, 'State', { max: 120 });
  const mandal = string(req.body.mandal, 'Mandal', { max: 120 });
  const role = normalizeRole(req.body.role || 'farmer');
  const preferredLanguage = req.body.preferredLanguage ? mapLanguage(req.body.preferredLanguage) : 'te';
  if (req.body.agreeTerms !== true && req.body.agreeTerms !== 'true') {
    throw new HttpError(400, 'Accept the terms before creating an account.');
  }
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters long.');
  if (!process.env.JWT_SECRET) throw new HttpError(503, 'Authentication is not configured on this server.');
  if (await User.findOne({ where: { mobile }, attributes: ['id'] })) {
    throw new HttpError(409, 'An account already uses this mobile number. Try signing in or recovering access.');
  }
  const latest = await OtpVerification.findOne({
    where: { identifier: mobile, purpose: 'registration', consumedAt: null },
    order: [['sentAt', 'DESC']],
  });
  if (latest && Date.now() - latest.sentAt.getTime() < otp.resendCooldownMs) {
    throw new HttpError(429, 'Wait before requesting another verification code.');
  }
  await OtpVerification.update({
    consumedAt: new Date(),
    pendingData: null,
  }, {
    where: { identifier: mobile, purpose: 'registration', consumedAt: null },
  });
  const code = otp.createCode();
  const pendingData = {
    fullName,
    mobile,
    passwordHash: await bcrypt.hash(password, 12),
    state,
    district,
    mandal,
    village,
    preferredLanguage,
    role,
    interactionMode: 'voice',
  };
  if (role === 'service_provider') {
    pendingData.businessName = string(req.body.businessName, 'Business name', { required: true, max: 180 });
    pendingData.serviceCategories = list(req.body.serviceCategories, 'Service categories');
    pendingData.serviceCoverage = list(req.body.serviceCoverage, 'Service coverage');
    pendingData.serviceDescription = string(req.body.serviceDescription, 'Service description', { required: true, max: 3000 });
  }
  const record = await OtpVerification.create({
    userId: null,
    identifier: mobile,
    purpose: 'registration',
    pendingData,
    codeHash: otp.digest(`${mobile}:registration:${code}`),
    expiresAt: new Date(Date.now() + otp.otpLifetimeMs),
    sentAt: new Date(),
  });
  try {
    if (!otp.devCodeEnabled()) await otp.deliver({ identifier: mobile, code, purpose: 'registration' });
  } catch (error) {
    await record.update({ consumedAt: new Date(), pendingData: null });
    throw error;
  }
  return res.status(202).json({
    success: true,
    message: 'A registration verification code was sent by SMS.',
    data: { mobile, expiresInSeconds: Math.floor(otp.otpLifetimeMs / 1000) },
    ...(otp.devCodeEnabled() ? { developmentCode: code } : {}),
  });
}));

router.post('/voice/verify-registration', otpLimiter, asyncHandler(async (req, res) => {
  const mobile = normalizeMobile(req.body.mobile);
  const code = string(req.body.code || req.body.otp, 'Verification code', { required: true, max: 6 });
  if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter a valid six-digit registration code.');
  const transaction = await sequelize.transaction();
  let user;
  try {
    const record = await OtpVerification.findOne({
      where: { identifier: mobile, purpose: 'registration', consumedAt: null },
      order: [['sentAt', 'DESC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!record || record.expiresAt <= new Date() || record.attempts >= otp.maxAttempts || !record.pendingData) {
      throw new HttpError(400, 'The code is invalid or expired. Request a new code.');
    }
    if (!otp.safeCompare(record.codeHash, otp.digest(`${mobile}:registration:${code}`))) {
      await record.increment('attempts', { transaction });
      await transaction.commit();
      throw new HttpError(400, 'The code is invalid or expired. Request a new code.');
    }
    const pending = record.pendingData;
    if (pending.mobile !== mobile) {
      throw new HttpError(400, 'The registration request is invalid. Start again.');
    }
    user = await User.create({
      fullName: pending.fullName,
      mobile,
      passwordHash: pending.passwordHash,
      status: 'active',
      isVerified: true,
    }, { transaction });
    await UserRole.create({ userId: user.id, role: pending.role || 'farmer' }, { transaction });
    if (pending.role === 'service_provider') {
      await ServiceProviderProfile.create({
        userId: user.id,
        businessName: pending.businessName || pending.fullName,
        contactPerson: pending.fullName,
        serviceCategories: pending.serviceCategories || [],
        serviceCoverage: pending.serviceCoverage || [],
        serviceDescription: pending.serviceDescription || '',
        state: pending.state || null,
        district: pending.district,
        mandal: pending.mandal || null,
        village: pending.village,
        approvalStatus: 'pending',
      }, { transaction });
    } else {
      await FarmerProfile.create({
        userId: user.id,
        state: pending.state || null,
        district: pending.district,
        mandal: pending.mandal || null,
        village: pending.village,
        landArea: pending.landArea || null,
        areaUnit: pending.areaUnit || null,
        primaryCrop: pending.primaryCrop || null,
        preferredLanguage: pending.preferredLanguage,
      }, { transaction });
    }
    await UserPreference.create({
      userId: user.id,
      preferredLanguage: pending.preferredLanguage,
      interactionMode: 'voice',
      notificationsEnabled: false,
    }, { transaction });
    await record.update({ consumedAt: new Date(), userId: user.id, pendingData: null }, { transaction });
    await transaction.commit();
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new HttpError(409, 'An account already uses this mobile number. Try signing in or recovering access.');
    }
    throw error;
  }
  const session = await createSession(req, res, user, 'farmer');
  return res.status(201).json({ success: true, message: 'Voice account verified and created.', data: session });
}));

router.post('/send-otp', otpLimiter, asyncHandler(async (req, res) => {
  const target = recoveryIdentifier(req.body.identifier);
  const purpose = req.body.purpose;
  if (purpose !== 'password_reset') throw new HttpError(400, 'Verification codes are only available for password recovery.');
  const user = await User.findOne({ where: target.includes('@') ? { email: target } : { mobile: target } });
  if (!user || user.status === 'suspended' || user.status === 'deleted') {
    return res.json({ success: true, message: 'If the account is eligible, a verification code will be sent.' });
  }
  const activeAccount = user.status === 'active' && user.isVerified;
  const legacyUnverifiedAccount = user.status === 'pending_verification' && !user.isVerified;
  if (!activeAccount && !legacyUnverifiedAccount) {
    return res.json({ success: true, message: 'If the account is eligible, a verification code will be sent.' });
  }
  const latest = await OtpVerification.findOne({
    where: { identifier: target, purpose, consumedAt: null },
    order: [['sentAt', 'DESC']],
  });
  if (latest && Date.now() - latest.sentAt.getTime() < otp.resendCooldownMs) {
    throw new HttpError(429, 'Wait before requesting another verification code.');
  }
  const code = otp.createCode();
  if (!otp.devCodeEnabled()) await otp.deliver({ identifier: target, code, purpose });
  await OtpVerification.update({ consumedAt: new Date() }, { where: { identifier: target, purpose, consumedAt: null } });
  await OtpVerification.create({
    userId: user.id,
    identifier: target,
    purpose,
    codeHash: otp.digest(`${target}:${purpose}:${code}`),
    expiresAt: new Date(Date.now() + otp.otpLifetimeMs),
    sentAt: new Date(),
  });
  return res.json({
    success: true,
    message: 'If the account is eligible, a verification code will be sent.',
    ...(otp.devCodeEnabled() ? { developmentCode: code } : {}),
  });
}));

async function verifyOtpCode(target, purpose, code) {
  if (purpose !== 'password_reset' || !/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter a valid six-digit password recovery code.');
  const record = await OtpVerification.findOne({
    where: { identifier: target, purpose, consumedAt: null },
    order: [['sentAt', 'DESC']],
  });
  if (!record || record.expiresAt <= new Date() || record.attempts >= otp.maxAttempts) throw new HttpError(400, 'The code is invalid or expired. Request a new code.');
  if (!otp.safeCompare(record.codeHash, otp.digest(`${target}:${purpose}:${code}`))) {
    await record.increment('attempts');
    throw new HttpError(400, 'The code is invalid or expired. Request a new code.');
  }
  await record.update({ consumedAt: new Date() });
  const user = await User.findByPk(record.userId);
  if (!user) throw new HttpError(400, 'The account could not be verified.');
  if (user.status === 'pending_verification' && !user.isVerified) {
    await user.update({ isVerified: true, status: 'active' });
  } else if (user.status !== 'active' || !user.isVerified) {
    throw new HttpError(403, 'The account is not available for recovery sign-in.');
  }
  return { loginUser: user };
}

router.post('/verify-otp', otpLimiter, asyncHandler(async (req, res) => {
  const target = recoveryIdentifier(req.body.identifier);
  const purpose = req.body.purpose || 'password_reset';
  if (purpose !== 'password_reset') throw new HttpError(400, 'Verification codes are only available for password recovery.');
  const code = string(req.body.code || req.body.otp, 'Verification code', { required: true, max: 6 });
  const result = await verifyOtpCode(target, purpose, code);
  const data = await createSession(req, res, result.loginUser, req.body.activeRole || req.body.role);
  return res.json({ success: true, message: 'Login successful.', data });
}));

router.post('/forgot-password', resetLimiter, asyncHandler(async (req, res) => {
  const target = recoveryIdentifier(req.body.identifier || req.body.mobile || req.body.email);
  const user = await User.findOne({ where: target.includes('@') ? { email: target } : { mobile: target } });
  let developmentCode;
  const activeAccount = user && user.status === 'active' && user.isVerified;
  const legacyUnverifiedAccount = user && user.status === 'pending_verification' && !user.isVerified;
  if (activeAccount || legacyUnverifiedAccount) {
    try {
      const latest = await OtpVerification.findOne({
        where: { identifier: target, purpose: 'password_reset', consumedAt: null },
        order: [['sentAt', 'DESC']],
      });
      if (!latest || Date.now() - latest.sentAt.getTime() >= otp.resendCooldownMs) {
        const code = otp.createCode();
        if (otp.devCodeEnabled()) developmentCode = code;
        if (!otp.devCodeEnabled()) await otp.deliver({ identifier: target, code, purpose: 'password_reset' });
        await OtpVerification.update({ consumedAt: new Date() }, { where: { identifier: target, purpose: 'password_reset', consumedAt: null } });
        await OtpVerification.create({
          userId: user.id,
          identifier: target,
          purpose: 'password_reset',
          codeHash: otp.digest(`${target}:password_reset:${code}`),
          expiresAt: new Date(Date.now() + otp.otpLifetimeMs),
          sentAt: new Date(),
        });
      }
    } catch (error) {
      console.error('Password recovery delivery failed:', error.message);
    }
  }
  return res.json({
    success: true,
    message: 'If the account is eligible, password recovery instructions will be sent.',
    ...(developmentCode ? { developmentCode } : {}),
  });
}));

router.post('/verify-reset-otp', otpLimiter, asyncHandler(async (req, res) => {
  const target = recoveryIdentifier(req.body.identifier);
  const code = string(req.body.code || req.body.otp, 'Verification code', { required: true, max: 6 });
  const result = await verifyOtpCode(target, 'password_reset', code);
  const data = await createSession(req, res, result.loginUser, req.body.activeRole || req.body.role);
  return res.json({ success: true, message: 'Login successful.', data });
}));

router.post('/reset-password', resetLimiter, asyncHandler(async (req, res) => {
  const resetToken = string(req.body.resetToken, 'Reset token', { required: true, max: 256 });
  const password = string(req.body.password || req.body.newPassword, 'New password', { required: true, max: 128 });
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters long.');
  const reset = await PasswordReset.findOne({ where: { tokenHash: tokenHash(resetToken), consumedAt: null } });
  if (!reset || reset.expiresAt <= new Date()) throw new HttpError(400, 'The reset link is invalid or expired. Request a new one.');
  const transaction = await sequelize.transaction();
  try {
    const user = await User.findByPk(reset.userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.status !== 'active') throw new HttpError(400, 'The reset link is invalid or expired.');
    await user.update({ passwordHash: await bcrypt.hash(password, 12), failedLoginAttempts: 0, lockedUntil: null }, { transaction });
    await reset.update({ consumedAt: new Date() }, { transaction });
    await RefreshToken.update({ revokedAt: new Date() }, { where: { userId: user.id, revokedAt: null }, transaction });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
  clearSessionCookies(res);
  return res.json({ success: true, message: 'Password reset successful. Sign in with your new password.' });
}));

router.post('/change-password', require('../middleware/auth').requireAuth, asyncHandler(async (req, res) => {
  const currentPassword = string(req.body.currentPassword, 'Current password', { required: true, max: 128 });
  const newPassword = string(req.body.newPassword, 'New password', { required: true, max: 128 });
  if (newPassword.length < 8) throw new HttpError(400, 'New password must be at least 8 characters long.');
  if (currentPassword === newPassword) throw new HttpError(400, 'Choose a new password different from your current password.');
  const user = await User.findOne({ where: { id: req.user.id, status: 'active', isVerified: true } });
  if (!user || !await bcrypt.compare(currentPassword, user.passwordHash)) throw new HttpError(400, 'The current password is incorrect.');
  const transaction = await sequelize.transaction();
  try {
    await user.update({ passwordHash: await bcrypt.hash(newPassword, 12) }, { transaction });
    await RefreshToken.update({ revokedAt: new Date() }, { where: { userId: user.id, revokedAt: null }, transaction });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
  clearSessionCookies(res);
  return res.json({ success: true, message: 'Password changed. Sign in again on your devices.' });
}));

module.exports = router;
