const crypto = require('node:crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const {
  User,
  UserRole,
  ExpertProfile,
  ServiceProviderProfile,
  Crop,
  CropKnowledge,
  AgriVideo,
  AgriVideoCategory,
  MarketplaceProduct,
  MarketplaceCategory,
  HomepageFeature,
  HomepageContent,
  PlatformAnnouncement,
  PlatformSetting,
  ContactMessage,
  NewsletterSubscriber,
} = require('../models');
const emailService = require('../services/emailService');

const router = express.Router();
const languageCodes = new Set(['en', 'te', 'hi']);
const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 6, standardHeaders: 'draft-7', legacyHeaders: false });
const newsletterLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false });
const publicSettings = new Set([
  'platformName', 'tagline', 'description', 'logoUrl', 'contactEmail',
  'supportPhone', 'supportedLanguages', 'socialLinks', 'publicSettings',
]);

function cleanText(value, field, max, required = true) {
  if (value === undefined || value === null || value === '') {
    if (!required) return null;
    throw new HttpError(400, `${field} is required.`);
  }
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be text.`);
  const clean = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!clean && required) throw new HttpError(400, `${field} is required.`);
  if (clean.length > max) throw new HttpError(400, `${field} must be no more than ${max} characters.`);
  return clean || null;
}

function email(value) {
  const result = cleanText(value, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new HttpError(400, 'Enter a valid email address.');
  return result;
}

function language(value) {
  const result = value || 'en';
  if (typeof result !== 'string' || !languageCodes.has(result)) throw new HttpError(400, 'Choose English, Telugu, or Hindi.');
  return result;
}

function tokenDigest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getServiceDescription(slug) {
  const descriptions = {
    seeds: 'విత్తనాలు మరియు నాటి పదార్థాలు.',
    fertilizers: 'ఎరువులు మరియు पोषక తత్వాలు.',
    'pesticides-crop-protection': 'పురుగుమందులు మరియు పంట రక్షణ.',
    'agricultural-equipment': 'వ్యవసాయ పరికరాలు మరియు యంత్రాలు.',
    'tractors-machinery': 'ట్రాక్టర్లు మరియు వ్యవసాయ యంత్రాల అద్దె.',
    'irrigation-equipment': 'నీటి పారుదల మరియు డ్రిప్ ఇరిగేషన్.',
    'organic-farming-products': 'సేంద్రియ వ్యవసాయ ఉత్పత్తులు.',
    fruits: 'పండ్లు మరియు తేయాలు.',
    vegetables: 'కూరగాయలు మరియు తర్కಾರಿ.',
    'paddy-rice': 'వరి మరియు బియ్యం.',
    cotton: 'పత్తి.',
    chilli: 'మిరప.',
    maize: 'మొక్కజొన్న.',
    groundnut: 'వేరుశెనగ.',
    'other-agricultural-products': 'ఇతర వ్యవసాయ ఉత్పత్తులు.',
  };
  return descriptions[slug] || 'వ్యవసాయ సేవ.';
}

function currentPublicSettings(rows) {
  const database = Object.fromEntries(rows.filter((item) => publicSettings.has(item.key)).map((item) => [item.key, item.value]));
  const env = {
    platformName: process.env.PLATFORM_NAME || 'AGRISATHI',
    tagline: process.env.PLATFORM_TAGLINE || null,
    description: process.env.PLATFORM_DESCRIPTION || null,
    logoUrl: process.env.PLATFORM_LOGO_URL || null,
    contactEmail: process.env.SUPPORT_EMAIL || null,
    supportPhone: process.env.SUPPORT_PHONE || null,
    supportedLanguages: ['en', 'te', 'hi'],
    socialLinks: {},
    publicSettings: {},
  };
  return { ...env, ...database };
}

function publishedContentWhere() {
  const now = new Date();
  return {
    status: 'approved',
    publishedAt: { [Op.lte]: now },
    [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }],
  };
}

router.get('/platform-info', asyncHandler(async (req, res) => {
  const settings = await PlatformSetting.findAll({ where: { isPublic: true }, attributes: ['key', 'value'] });
  return res.json({ success: true, data: currentPublicSettings(settings) });
}));

router.get('/features', asyncHandler(async (req, res) => {
  const features = await HomepageFeature.findAll({
    where: { isActive: true },
    order: [['displayOrder', 'ASC'], ['createdAt', 'ASC']],
    limit: 50,
  });
  return res.json({ success: true, data: features });
}));

router.get('/homepage-content', asyncHandler(async (req, res) => {
  const content = await HomepageContent.findAll({
    where: publishedContentWhere(),
    order: [['isFeatured', 'DESC'], ['publishedAt', 'DESC']],
    limit: 60,
  });
  return res.json({ success: true, data: content });
}));

router.get('/announcements', asyncHandler(async (req, res) => {
  const now = new Date();
  const announcements = await PlatformAnnouncement.findAll({
    where: {
      status: 'approved',
      [Op.and]: [
        { [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }] },
        { [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gt]: now } }] },
      ],
    },
    order: [['priority', 'DESC'], ['createdAt', 'DESC']],
    limit: 20,
  });
  return res.json({ success: true, data: announcements });
}));

router.get('/featured-crops', asyncHandler(async (req, res) => {
  const guides = await CropKnowledge.findAll({
    where: { isPublished: true },
    include: [{ model: Crop, where: { isActive: true }, required: true, attributes: ['id', 'name', 'translations', 'imageUrl'] }],
    attributes: ['id', 'cropId', 'sectionType', 'language', 'title', 'content', 'source', 'verifiedAt'],
    order: [['verifiedAt', 'DESC'], ['createdAt', 'DESC']],
    limit: 12,
  });
  return res.json({ success: true, data: guides });
}));

router.get('/featured-videos', asyncHandler(async (req, res) => {
  const videos = await AgriVideo.findAll({
    where: { status: 'approved', isFeatured: true, publishedAt: { [Op.lte]: new Date() } },
    include: [{ model: AgriVideoCategory, attributes: ['id', 'name', 'translations'], required: true }],
    attributes: ['id', 'title', 'description', 'videoUrl', 'thumbnailUrl', 'language', 'duration', 'publishedAt', 'viewCount'],
    order: [['publishedAt', 'DESC']],
    limit: 12,
  });
  return res.json({ success: true, data: videos });
}));

router.get('/featured-products', asyncHandler(async (req, res) => {
  const products = await MarketplaceProduct.findAll({
    where: { status: 'approved', availability: 'available', availableQuantity: { [Op.gt]: 0 } },
    include: [
      { model: MarketplaceCategory, attributes: ['id', 'name', 'translations'], required: true, where: { isActive: true } },
    ],
    attributes: ['id', 'productName', 'brand', 'description', 'unit', 'price', 'availableQuantity', 'state', 'district', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: 12,
  });
  return res.json({ success: true, data: products });
}));

router.get('/featured-services', asyncHandler(async (req, res) => {
  return res.json({
    success: true,
    status: 'coming_soon',
    data: [],
    message: 'Approved service-provider profiles are not yet available as service listings.',
  });
}));

router.get('/services', asyncHandler(async (req, res) => {
  const { marketplaceCategories } = require('../data/platformCatalogs');
  const services = marketplaceCategories.map((category) => ({
    slug: category.slug,
    name: category.name,
    telugu: category.translations?.te || category.name,
    hindi: category.translations?.hi || category.name,
    icon: category.icon,
    description: getServiceDescription(category.slug),
  }));
  return res.json({ success: true, data: services });
}));

router.get('/statistics', asyncHandler(async (req, res) => {
  const activeUsers = { status: 'active', isVerified: true };
  const [farmers, experts, cropGuides, services, videos] = await Promise.all([
    UserRole.count({
      where: { role: 'farmer' },
      include: [{ model: User, where: activeUsers, attributes: [], required: true }],
      distinct: true,
      col: 'userId',
    }),
    ExpertProfile.count({
      where: { approvalStatus: 'approved' },
      include: [{ model: User, where: activeUsers, attributes: [], required: true }],
    }),
    CropKnowledge.count({ where: { isPublished: true }, distinct: true, col: 'cropId' }),
    ServiceProviderProfile.count({
      where: { approvalStatus: 'approved' },
      include: [{ model: User, where: activeUsers, attributes: [], required: true }],
    }),
    AgriVideo.count({ where: { status: 'approved', publishedAt: { [Op.lte]: new Date() } } }),
  ]);
  return res.json({
    success: true,
    data: {
      registeredFarmers: farmers,
      approvedExperts: experts,
      publishedCropGuides: cropGuides,
      availableServices: services,
      publishedEducationalVideos: videos,
      source: 'AGRISATHI database records',
      generatedAt: new Date().toISOString(),
    },
  });
}));

router.post('/contact', contactLimiter, asyncHandler(async (req, res) => {
  if (req.body.website) return res.status(202).json({ success: true, message: 'Your message has been received.' });
  const name = cleanText(req.body.name, 'Name', 160);
  const senderEmail = email(req.body.email);
  const mobile = cleanText(req.body.mobile, 'Mobile number', 20, false);
  const subject = cleanText(req.body.subject, 'Subject', 200);
  const message = cleanText(req.body.message, 'Message', 5000);
  const preferredLanguage = language(req.body.preferredLanguage);
  if (mobile && !/^\+?[0-9 ()-]{8,18}$/.test(mobile)) throw new HttpError(400, 'Enter a valid mobile number.');
  const ipHash = req.ip ? crypto.createHash('sha256').update(req.ip).digest('hex') : null;
  await ContactMessage.create({ name, email: senderEmail, mobile, subject, message, preferredLanguage, ipHash });
  return res.status(201).json({ success: true, message: 'Your message has been received.' });
}));

router.post('/newsletter/subscribe', newsletterLimiter, asyncHandler(async (req, res) => {
  const subscriberEmail = email(req.body.email);
  const preferredLanguage = language(req.body.preferredLanguage);
  if (req.body.consent !== true && req.body.consent !== 'true') {
    throw new HttpError(400, 'Consent to receive platform updates is required.');
  }
  const existing = await NewsletterSubscriber.findOne({ where: { email: subscriberEmail } });
  if (existing?.isActive) return res.json({ success: true, message: 'This email is already subscribed.' });
  const token = crypto.randomBytes(32).toString('base64url');
  const publicUrl = (process.env.NEWSLETTER_PUBLIC_URL || process.env.FRONTEND_PUBLIC_URL || '').replace(/\/+$/, '');
  if (!publicUrl) throw new HttpError(503, 'Newsletter subscription links are not configured.');
  const unsubscribeUrl = `${publicUrl}/newsletter/unsubscribe?email=${encodeURIComponent(subscriberEmail)}&token=${encodeURIComponent(token)}`;
  await emailService.sendUnsubscribeLink(subscriberEmail, unsubscribeUrl);
  const values = {
    email: subscriberEmail,
    preferredLanguage,
    isActive: true,
    consentAt: new Date(),
    unsubscribeTokenHash: tokenDigest(token),
  };
  if (existing) await existing.update(values);
  else await NewsletterSubscriber.create(values);
  return res.status(201).json({ success: true, message: 'You are subscribed to AGRISATHI updates.' });
}));

router.post('/newsletter/unsubscribe', newsletterLimiter, asyncHandler(async (req, res) => {
  const subscriberEmail = email(req.body.email);
  const token = cleanText(req.body.token, 'Unsubscribe token', 128);
  const subscriber = await NewsletterSubscriber.findOne({ where: { email: subscriberEmail, isActive: true } });
  if (!subscriber || !crypto.timingSafeEqual(Buffer.from(subscriber.unsubscribeTokenHash), Buffer.from(tokenDigest(token)))) {
    throw new HttpError(400, 'The unsubscribe link is invalid or has already been used.');
  }
  await subscriber.update({ isActive: false, unsubscribeTokenHash: tokenDigest(crypto.randomBytes(32).toString('hex')) });
  return res.json({ success: true, message: 'You have been unsubscribed from AGRISATHI updates.' });
}));

module.exports = router;
