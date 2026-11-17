const express = require('express');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { sequelize } = require('../models');
const { requireAuth, requireFarmer, checkAccountStatus } = require('../middleware/auth');
const {
  User,
  FarmerProfile,
  UserPreference,
  FarmerFarm,
  FarmerCrop,
  Crop,
  AgriVideo,
  AgriVideoCategory,
  FarmerWeatherLocation,
} = require('../models');
const weather = require('../services/weatherService');
const land = require('../services/landMeasurementService');
const assertUuid = require('../utils/assertUuid');

const router = express.Router();
const areaUnits = new Set(['square_metre', 'square_foot', 'square_yard', 'acre', 'cent', 'hectare', 'are', 'guntha', 'bigha']);
const cropStatuses = new Set(['planned', 'active', 'harvested', 'cancelled']);
const languages = { en: 'en', te: 'te', hi: 'hi', English: 'en', తెలుగు: 'te', हिन्दी: 'hi' };

router.use(requireAuth, requireFarmer, checkAccountStatus);

function text(value, field, max = 500, required = false) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} is required.`);
    return null;
  }
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
    throw new HttpError(400, `${field} must be a text value of no more than ${max} characters.`);
  }
  return value.trim() || null;
}

function number(value, field, { required = false, min = 0, max = 10000000 } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} is required.`);
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new HttpError(400, `${field} must be a valid number from ${min} to ${max}.`);
  return parsed;
}

function list(value, field, max = 30) {
  if (value === undefined || value === null || value === '') return [];
  let items = value;
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch { items = [items]; }
  }
  if (!Array.isArray(items) || items.length > max) throw new HttpError(400, `${field} must be a list of no more than ${max} items.`);
  return items.map((item) => text(item, field, 120, true));
}

function language(value) {
  if (value === undefined || value === null || value === '') return 'en';
  if (typeof value !== 'string' || !languages[value]) throw new HttpError(400, 'Choose English, Telugu, or Hindi.');
  return languages[value];
}

function location(body, existing = {}) {
  const result = {};
  for (const field of ['state', 'district', 'mandal', 'village']) {
    if (body[field] !== undefined) result[field] = text(body[field], field, 120);
    else if (existing[field] !== undefined) result[field] = existing[field];
  }
  if (body.pinCode !== undefined) {
    result.pinCode = text(body.pinCode, 'PIN code', 10);
    if (result.pinCode && !/^\d{5,10}$/.test(result.pinCode)) throw new HttpError(400, 'PIN code must contain 5 to 10 digits.');
  } else if (existing.pinCode !== undefined) result.pinCode = existing.pinCode;
  return result;
}

function coordinates(body) {
  const hasLatitude = body.latitude !== undefined;
  const hasLongitude = body.longitude !== undefined;
  if (!hasLatitude && !hasLongitude) return {};
  if (!hasLatitude || !hasLongitude) throw new HttpError(400, 'Provide both latitude and longitude.');
  const isClearing = [body.latitude, body.longitude].every((value) => value === null || value === '');
  if (isClearing) return { latitude: null, longitude: null };
  if (body.latitude === null || body.longitude === null || body.latitude === '' || body.longitude === '') {
    throw new HttpError(400, 'Provide both latitude and longitude, or clear both values.');
  }
  return weather.coordinates(body.latitude, body.longitude);
}

function validDate(value, field, required = false) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} is required.`);
    return null;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, `${field} must use YYYY-MM-DD.`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new HttpError(400, `${field} is not a valid date.`);
  return value;
}

function farmInput(body, existing = {}) {
  const farmName = text(body.farmName, 'Farm name', 160, !existing.id);
  const landArea = number(body.landArea, 'Land area', { required: !existing.id, min: 0.0001 });
  const region = body.state === undefined ? existing.state : body.state;
  const areaUnit = body.areaUnit === undefined
    ? existing.areaUnit || null
    : land.normalizeAreaUnit(text(body.areaUnit, 'Land unit', 40, true), region);
  if (!areaUnit) throw new HttpError(400, 'Choose a supported land area unit.');
  const latitudeLongitude = coordinates(body, existing);
  const boundaryCoordinates = body.boundaryCoordinates === undefined
    ? existing.boundaryCoordinates
    : body.boundaryCoordinates === null || body.boundaryCoordinates === '' ? null : land.normalizeBoundaryCoordinates(body.boundaryCoordinates);
  return {
    farmName: farmName === null ? existing.farmName : farmName,
    ...location(body, existing),
    ...latitudeLongitude,
    landArea: landArea === null ? existing.landArea : landArea,
    areaUnit,
    soilType: body.soilType === undefined ? existing.soilType : text(body.soilType, 'Soil type', 120),
    irrigationType: body.irrigationType === undefined ? existing.irrigationType : text(body.irrigationType, 'Irrigation type', 120),
    waterSource: body.waterSource === undefined ? existing.waterSource : text(body.waterSource, 'Water source', 120),
    mainCrops: body.mainCrops === undefined ? existing.mainCrops || [] : list(body.mainCrops, 'Main crops'),
    boundaryCoordinates,
  };
}

async function ownedFarm(userId, farmId) {
  const farm = await FarmerFarm.findOne({ where: { id: assertUuid(farmId), userId } });
  if (!farm) throw new HttpError(404, 'Farm not found.');
  return farm;
}

async function ownedCrop(userId, cropId) {
  const crop = await FarmerCrop.findOne({ where: { id: assertUuid(cropId), userId } });
  if (!crop) throw new HttpError(404, 'Crop record not found.');
  return crop;
}

function cropInput(body, existing = {}, region) {
  const cropName = text(body.cropName, 'Crop name', 120, !existing.id);
  const cropId = body.cropId === undefined ? existing.cropId : text(body.cropId, 'Crop identifier', 80);
  return {
    cropId: cropId || null,
    cropName: cropName === null ? existing.cropName : cropName,
    variety: body.variety === undefined ? existing.variety : text(body.variety, 'Crop variety', 160),
    farmId: body.farmId === undefined ? existing.farmId : body.farmId ? assertUuid(body.farmId, 'Farm ID') : null,
    cultivationArea: number(body.cultivationArea, 'Cultivation area', { required: !existing.id, min: 0.0001 }),
    areaUnit: body.areaUnit === undefined
      ? existing.areaUnit || null
      : land.normalizeAreaUnit(text(body.areaUnit, 'Area unit', 40, true), region),
    sowingDate: body.sowingDate === undefined ? existing.sowingDate : validDate(body.sowingDate, 'Sowing date'),
    expectedHarvestDate: body.expectedHarvestDate === undefined ? existing.expectedHarvestDate : validDate(body.expectedHarvestDate, 'Expected harvest date'),
    season: body.season === undefined ? existing.season : text(body.season, 'Season', 80),
    growthStage: body.growthStage === undefined ? existing.growthStage : text(body.growthStage, 'Growth stage', 120),
    status: body.status === undefined ? existing.status || 'active' : body.status,
  };
}

async function validateCropReferences(userId, values) {
  if (!areaUnits.has(values.areaUnit)) throw new HttpError(400, 'Choose a supported area unit.');
  if (!cropStatuses.has(values.status)) throw new HttpError(400, 'Choose a supported crop status.');
  if (values.farmId) await ownedFarm(userId, values.farmId);
  if (values.sowingDate && values.expectedHarvestDate && values.expectedHarvestDate < values.sowingDate) {
    throw new HttpError(400, 'Expected harvest date cannot be before sowing date.');
  }
  if (values.cropId) {
    const crop = await Crop.findOne({ where: { id: values.cropId, isActive: true } });
    if (!crop) throw new HttpError(400, 'Choose a crop from the active AGRISATHI crop catalog.');
    values.cropName = crop.name;
  }
}

function profileView(user, profile, preferences) {
  return {
    id: user.id,
    name: user.fullName,
    mobile: user.mobile,
    email: user.email,
    isVerified: user.isVerified,
    profileImageUrl: profile.profileImageUrl,
    preferredLanguage: preferences?.preferredLanguage || profile.preferredLanguage,
    notificationsEnabled: preferences?.notificationsEnabled || false,
    state: profile.state,
    district: profile.district,
    mandal: profile.mandal,
    village: profile.village,
    pinCode: profile.pinCode,
    farmingExperience: profile.experience,
    farmName: profile.farmName,
    landArea: profile.landArea === null ? null : Number(profile.landArea),
    areaUnit: profile.areaUnit,
    primaryCrop: profile.primaryCrop,
    otherCrops: profile.otherCrops,
    soilType: profile.soilType,
    irrigationType: profile.irrigationType,
    latitude: profile.latitude === null ? null : Number(profile.latitude),
    longitude: profile.longitude === null ? null : Number(profile.longitude),
  };
}

async function getFarmerProfile(userId) {
  const [user, profile, preferences] = await Promise.all([
    User.findByPk(userId, { attributes: ['id', 'fullName', 'mobile', 'email', 'isVerified', 'status'] }),
    FarmerProfile.findByPk(userId),
    UserPreference.findByPk(userId),
  ]);
  if (!user || user.status !== 'active' || !profile) throw new HttpError(404, 'Farmer profile not found.');
  return { user, profile, preferences };
}

async function getWeatherForFarmer(userId, profile, days = 1) {
  let locationData;
  if (profile.latitude !== null && profile.longitude !== null) {
    locationData = weather.coordinates(profile.latitude, profile.longitude);
    locationData.name = [profile.village, profile.district, profile.state].filter(Boolean).join(', ') || null;
  } else {
    const saved = await FarmerWeatherLocation.findOne({ where: { userId, isDefault: true } });
    if (!saved) return { status: 'unavailable', reason: 'location_missing', message: 'Set a weather location to view local conditions.' };
    locationData = { latitude: Number(saved.latitude), longitude: Number(saved.longitude), name: saved.locationName };
  }
  const forecast = await weather.fetchForecast(locationData, days);
  return {
    status: 'available',
    source: 'Open-Meteo',
    location: locationData.name || null,
    current: weather.currentConditions(forecast, locationData.name),
    forecast: weather.dailyForecast(forecast).slice(0, days),
    advisories: weather.farmingAdvisories(forecast),
    updatedAt: forecast.current.time,
  };
}

async function getActiveCrops(userId) {
  return FarmerCrop.findAll({
    where: { userId, status: { [Op.in]: ['planned', 'active'] } },
    include: [
      { model: FarmerFarm, attributes: ['id', 'farmName', 'district'], required: false },
      { model: Crop, attributes: ['id', 'name', 'translations', 'imageUrl'], required: false },
    ],
    order: [['sowingDate', 'DESC'], ['createdAt', 'DESC']],
    limit: 100,
  });
}

function cropResponse(record) {
  const value = record.toJSON();
  return {
    ...value,
    cultivationArea: Number(value.cultivationArea),
    catalogCrop: value.Crop || null,
    Crop: undefined,
    farm: value.FarmerFarm || null,
    FarmerFarm: undefined,
  };
}

function upcomingHarvests(crops) {
  const now = new Date();
  const through = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return crops.flatMap((crop) => {
    if (!crop.expectedHarvestDate || crop.status !== 'active') return [];
    const date = new Date(`${crop.expectedHarvestDate}T00:00:00Z`);
    if (date < new Date(now.toISOString().slice(0, 10)) || date > through) return [];
    return [{
      activityName: 'Expected harvest',
      crop: crop.cropName,
      cropId: crop.id,
      scheduledDate: crop.expectedHarvestDate,
      priority: null,
      completionStatus: 'planned',
    }];
  });
}

async function recommendedVideos(profile, crops) {
  const languagesToInclude = [profile.preferredLanguage || 'en', 'en'];
  const cropIds = [...new Set(crops.map((crop) => crop.cropId).filter(Boolean))];
  return AgriVideo.findAll({
    where: {
      status: 'approved',
      publishedAt: { [Op.lte]: new Date() },
      language: { [Op.in]: languagesToInclude },
      ...(cropIds.length ? { [Op.or]: [{ cropId: { [Op.in]: cropIds } }, { cropId: null }] } : {}),
    },
    include: [{ model: AgriVideoCategory, attributes: ['id', 'name', 'translations'], required: true }],
    attributes: ['id', 'title', 'description', 'videoUrl', 'thumbnailUrl', 'language', 'duration', 'publishedAt', 'viewCount'],
    order: [['isFeatured', 'DESC'], ['publishedAt', 'DESC']],
    limit: 8,
  });
}

async function dashboardSection(name, operation) {
  try {
    return await operation();
  } catch (error) {
    console.error(`Farmer dashboard ${name} section failed:`, error.message);
    return { status: 'unavailable', data: [], message: 'This information is temporarily unavailable.' };
  }
}

router.get('/profile', asyncHandler(async (req, res) => {
  const { user, profile, preferences } = await getFarmerProfile(req.user.id);
  return res.json({ success: true, data: profileView(user, profile, preferences) });
}));

router.put('/profile', asyncHandler(async (req, res) => {
  const { user, profile, preferences } = await getFarmerProfile(req.user.id);
  const profileFields = ['state', 'district', 'mandal', 'village', 'pinCode', 'farmName', 'farmLocation', 'landArea', 'areaUnit', 'primaryCrop', 'otherCrops', 'soilType', 'irrigationType', 'experience', 'preferredLanguage', 'latitude', 'longitude'];
  const fields = profileFields.filter((field) => req.body[field] !== undefined);
  const updates = {};
  const updatedName = req.body.fullName === undefined ? null : text(req.body.fullName, 'Full name', 160, true);
  for (const field of fields) {
    if (['latitude', 'longitude'].includes(field)) continue;
    if (field === 'landArea') updates.landArea = number(req.body.landArea, 'Land area', { min: 0.0001 });
    else if (field === 'otherCrops') updates.otherCrops = list(req.body.otherCrops, 'Other crops');
    else if (field === 'experience') {
      const experience = number(req.body.experience, 'Farming experience', { min: 0, max: 80 });
      if (experience !== null && !Number.isInteger(experience)) throw new HttpError(400, 'Farming experience must be a whole number of years.');
      updates.experience = experience;
    }
    else if (field === 'preferredLanguage') updates.preferredLanguage = language(req.body.preferredLanguage);
    else if (field === 'pinCode') {
      updates.pinCode = text(req.body.pinCode, 'PIN code', 10);
      if (updates.pinCode && !/^\d{5,10}$/.test(updates.pinCode)) throw new HttpError(400, 'PIN code must contain 5 to 10 digits.');
    }     else if (field === 'areaUnit') updates.areaUnit = land.normalizeAreaUnit(req.body.areaUnit, req.body.state || profile.state);
    else {
      const max = ['state', 'district', 'mandal', 'village', 'soilType', 'irrigationType'].includes(field)
        ? 120
        : field === 'farmName' ? 160
          : field === 'farmLocation' ? 500
            : field === 'primaryCrop' ? 120
              : 160;
      updates[field] = text(req.body[field], field, max);
    }
  }
  const coords = coordinates(req.body);
  Object.assign(updates, coords);
  const preferredLanguage = req.body.preferredLanguage === undefined ? undefined : language(req.body.preferredLanguage);
  let notificationsEnabled;
  if (req.body.notificationsEnabled !== undefined) {
    if (req.body.notificationsEnabled === true || req.body.notificationsEnabled === 'true') notificationsEnabled = true;
    else if (req.body.notificationsEnabled === false || req.body.notificationsEnabled === 'false') notificationsEnabled = false;
    else throw new HttpError(400, 'Notification preference must be true or false.');
  }
  await sequelize.transaction(async (transaction) => {
    if (updatedName !== null) await user.update({ fullName: updatedName }, { transaction });
    await profile.update(updates, { transaction });
    if (preferredLanguage || notificationsEnabled !== undefined) {
      await UserPreference.upsert({
        userId: req.user.id,
        preferredLanguage: preferredLanguage || preferences?.preferredLanguage || profile.preferredLanguage,
        notificationsEnabled: notificationsEnabled === undefined ? Boolean(preferences?.notificationsEnabled) : notificationsEnabled,
      }, { transaction });
    }
  });
  const refreshed = await getFarmerProfile(req.user.id);
  return res.json({ success: true, data: profileView(refreshed.user, refreshed.profile, refreshed.preferences) });
}));

router.get('/profile/completion', asyncHandler(async (req, res) => {
  const { user, profile } = await getFarmerProfile(req.user.id);
  const fields = [
    Boolean(user.fullName),
    Boolean(user.mobile),
    Boolean(profile.state && profile.district),
    Boolean(profile.village),
    profile.landArea !== null && Boolean(profile.areaUnit),
    Boolean(profile.primaryCrop),
    Boolean(profile.soilType),
    Boolean(profile.irrigationType),
  ];
  return res.json({ success: true, data: { completed: fields.filter(Boolean).length, total: fields.length, percentage: Math.round((fields.filter(Boolean).length / fields.length) * 100) } });
}));

router.get('/farms', asyncHandler(async (req, res) => {
  const farms = await FarmerFarm.findAll({ where: { userId: req.user.id }, order: [['updatedAt', 'DESC']] });
  return res.json({ success: true, data: farms });
}));

router.post('/farms', asyncHandler(async (req, res) => {
  const values = farmInput(req.body);
  const farm = await FarmerFarm.create({ ...values, userId: req.user.id });
  return res.status(201).json({ success: true, data: farm });
}));

router.get('/farms/:id', asyncHandler(async (req, res) => {
  const farm = await ownedFarm(req.user.id, req.params.id);
  return res.json({ success: true, data: farm });
}));

router.put('/farms/:id', asyncHandler(async (req, res) => {
  const farm = await ownedFarm(req.user.id, req.params.id);
  await farm.update(farmInput(req.body, farm.toJSON()));
  return res.json({ success: true, data: farm });
}));

router.delete('/farms/:id', asyncHandler(async (req, res) => {
  const farm = await ownedFarm(req.user.id, req.params.id);
  const activeCrops = await FarmerCrop.count({ where: { farmId: farm.id, status: { [Op.in]: ['planned', 'active'] } } });
  if (activeCrops) throw new HttpError(409, 'Move or complete the farm crop records before deleting this farm.');
  await farm.destroy();
  return res.json({ success: true, message: 'Farm deleted.' });
}));

router.get('/crops', asyncHandler(async (req, res) => {
  const crops = await FarmerCrop.findAll({
    where: { userId: req.user.id },
    include: [
      { model: FarmerFarm, attributes: ['id', 'farmName'], required: false },
      { model: Crop, attributes: ['id', 'name', 'translations'], required: false },
    ],
    order: [['updatedAt', 'DESC']],
    limit: 100,
  });
  return res.json({ success: true, data: crops.map(cropResponse) });
}));

router.post('/crops', asyncHandler(async (req, res) => {
  const values = cropInput(req.body, {}, req.user.profile.state);
  await validateCropReferences(req.user.id, values);
  const record = await FarmerCrop.create({ ...values, userId: req.user.id });
  return res.status(201).json({ success: true, data: record });
}));

router.get('/crops/:id', asyncHandler(async (req, res) => {
  const crop = await ownedCrop(req.user.id, req.params.id);
  return res.json({ success: true, data: cropResponse(crop) });
}));

router.put('/crops/:id', asyncHandler(async (req, res) => {
  const crop = await ownedCrop(req.user.id, req.params.id);
  const values = cropInput(req.body, crop.toJSON(), req.user.profile.state);
  await validateCropReferences(req.user.id, values);
  await crop.update(values);
  return res.json({ success: true, data: cropResponse(crop) });
}));

router.delete('/crops/:id', asyncHandler(async (req, res) => {
  const crop = await ownedCrop(req.user.id, req.params.id);
  await crop.destroy();
  return res.json({ success: true, message: 'Crop record deleted.' });
}));

router.get('/dashboard/weather', asyncHandler(async (req, res) => {
  const profile = await FarmerProfile.findByPk(req.user.id);
  if (!profile) throw new HttpError(404, 'Farmer profile not found.');
  return res.json({ success: true, data: await getWeatherForFarmer(req.user.id, profile, 7) });
}));

router.get('/dashboard/market-highlights', (req, res) => res.json({
  success: true,
  data: { status: 'unavailable', source: null, items: [], message: 'Verified market-price data is not connected on this server.' },
}));

router.get('/dashboard/upcoming-activities', asyncHandler(async (req, res) => {
  const crops = await FarmerCrop.findAll({ where: { userId: req.user.id, status: 'active' }, order: [['expectedHarvestDate', 'ASC']], limit: 100 });
  return res.json({ success: true, data: upcomingHarvests(crops) });
}));

router.get('/dashboard/expense-summary', (req, res) => res.json({
  success: true,
  data: { status: 'unavailable', totalInvestment: null, cropWise: [], monthly: [], revenue: null, profitOrLoss: null },
}));

router.get('/dashboard/nearby-services', (req, res) => res.json({
  success: true,
  data: { status: 'coming_soon', items: [] },
}));

router.get('/dashboard/notifications', (req, res) => res.json({
  success: true,
  data: { status: 'unavailable', items: [] },
}));

router.get('/dashboard/recommended-videos', asyncHandler(async (req, res) => {
  const profile = await FarmerProfile.findByPk(req.user.id);
  if (!profile) throw new HttpError(404, 'Farmer profile not found.');
  const crops = await FarmerCrop.findAll({ where: { userId: req.user.id, status: 'active' }, attributes: ['cropId'], limit: 30 });
  return res.json({ success: true, data: await recommendedVideos(profile, crops) });
}));

router.get('/dashboard', asyncHandler(async (req, res) => {
  const [profileData, farms, cropRecords] = await Promise.all([
    getFarmerProfile(req.user.id),
    FarmerFarm.findAll({ where: { userId: req.user.id }, order: [['updatedAt', 'DESC']], limit: 20 }),
    FarmerCrop.findAll({
      where: { userId: req.user.id, status: { [Op.in]: ['planned', 'active'] } },
      include: [{ model: FarmerFarm, attributes: ['id', 'farmName'], required: false }, { model: Crop, attributes: ['id', 'name', 'translations'], required: false }],
      order: [['sowingDate', 'DESC']],
      limit: 20,
    }),
  ]);
  const crops = cropRecords.map(cropResponse);
  const [weatherData, videos] = await Promise.all([
    dashboardSection('weather', () => getWeatherForFarmer(req.user.id, profileData.profile, 7)),
    dashboardSection('videos', () => recommendedVideos(profileData.profile, cropRecords)),
  ]);
  const areaByUnit = farms.reduce((summary, farm) => {
    const unit = farm.areaUnit;
    summary[unit] = (summary[unit] || 0) + Number(farm.landArea);
    return summary;
  }, {});
  const alertData = weatherData.status === 'available' ? weatherData.advisories || [] : [];
  return res.json({
    success: true,
    data: {
      farmer: profileView(profileData.user, profileData.profile, profileData.preferences),
      farmSummary: { count: farms.length, areaByUnit },
      farms,
      crops,
      weather: weatherData,
      marketHighlights: { status: 'unavailable', data: [] },
      alerts: alertData,
      upcomingActivities: upcomingHarvests(cropRecords),
      expenseSummary: { status: 'unavailable', totalInvestment: null, cropWise: [], monthly: [], revenue: null, profitOrLoss: null },
      notifications: { status: 'unavailable', data: [] },
      recommendedVideos: Array.isArray(videos) ? { status: 'available', data: videos } : videos,
      nearbyServices: { status: 'coming_soon', data: [] },
      assistant: { available: Boolean(process.env.GEMINI_API_KEY), endpoint: '/api/assistant/ask' },
    },
  });
}));

module.exports = router;
