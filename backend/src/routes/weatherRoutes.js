const express = require('express');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { requireAuth, requireFarmer } = require('../middleware/auth');
const {
  FarmerWeatherLocation,
  WeatherNotificationPreference,
  Crop,
  CropKnowledge,
  AgriculturalRecommendation,
} = require('../models');
const weather = require('../services/weatherService');
const assertUuid = require('../utils/assertUuid');

const router = express.Router();
router.use(requireAuth, requireFarmer);

function validateLocationBody(body) {
  const locationName = typeof body.locationName === 'string' ? body.locationName.trim() : '';
  if (!locationName || locationName.length > 180) throw new HttpError(400, 'Enter a location name of up to 180 characters.');
  const point = weather.coordinates(body.latitude, body.longitude);
  if (body.isDefault !== undefined && typeof body.isDefault !== 'boolean') {
    throw new HttpError(400, 'isDefault must be true or false.');
  }
  const optionalText = (key, max) => {
    if (body[key] === undefined || body[key] === null || body[key] === '') return null;
    if (typeof body[key] !== 'string' || body[key].trim().length > max) {
      throw new HttpError(400, `${key} must be a text value of no more than ${max} characters.`);
    }
    return body[key].trim();
  };
  return {
    locationName,
    ...point,
    village: optionalText('village', 120),
    mandal: optionalText('mandal', 120),
    district: optionalText('district', 120),
    state: optionalText('state', 120),
    ...(body.isDefault === undefined ? {} : { isDefault: body.isDefault }),
  };
}

async function verifiedCropWeatherGuidance(req) {
  const requestedCropId = typeof req.query.cropId === 'string' ? req.query.cropId.trim().slice(0, 80) : '';
  const requestedCropName = typeof req.query.crop === 'string'
    ? req.query.crop.trim().slice(0, 120)
    : (typeof req.user.profile.primaryCrop === 'string' ? req.user.profile.primaryCrop.trim().slice(0, 120) : '');
  if (!requestedCropId && !requestedCropName) return null;

  const crop = await Crop.findOne({
    where: {
      isActive: true,
      ...(requestedCropId ? { id: requestedCropId } : { name: { [Op.iLike]: requestedCropName } }),
    },
    attributes: ['id', 'name'],
  });
  if (!crop) {
    if (requestedCropId) throw new HttpError(404, 'Crop not found in the active crop catalog.');
    return { crop: requestedCropName, references: [], note: 'No matching crop was found in the active catalog.' };
  }

  const aliases = { english: 'en', telugu: 'te', hindi: 'hi' };
  const requestedLanguage = String(req.query.language || req.user.profile.preferredLanguage || 'en').toLowerCase();
  const language = aliases[requestedLanguage] || requestedLanguage;
  if (!['en', 'te', 'hi'].includes(language)) throw new HttpError(400, 'Choose English, Telugu, or Hindi.');
  const state = typeof req.query.state === 'string'
    ? req.query.state.trim().slice(0, 120)
    : (typeof req.user.profile.state === 'string' ? req.user.profile.state.trim().slice(0, 120) : '');
  const knowledge = await CropKnowledge.findAll({
    where: {
      cropId: crop.id,
      language,
      isPublished: true,
      source: { [Op.ne]: null },
      sectionType: { [Op.in]: ['climate', 'irrigation'] },
    },
    attributes: ['id', 'sectionType', 'title', 'content', 'source', 'verifiedAt'],
    order: [['verifiedAt', 'DESC']],
    limit: 20,
  });
  const recommendationWhere = {
    cropId: crop.id,
    isPublished: true,
    recommendationType: 'irrigation',
    source: { [Op.ne]: null },
  };
  recommendationWhere[Op.or] = state
    ? [{ state: null }, { state: { [Op.iLike]: state } }]
    : [{ state: null }];
  const recommendations = await AgriculturalRecommendation.findAll({
    where: recommendationWhere,
    attributes: ['recommendationType', 'state', 'details', 'source', 'verifiedAt'],
    order: [['verifiedAt', 'DESC']],
    limit: 20,
  });
  return {
    crop: { id: crop.id, name: crop.name },
    references: [...knowledge, ...recommendations],
    note: 'These are published, source-attributed crop references, not weather-generated treatment instructions.',
  };
}

async function getLocation(req) {
  const savedLocationId = req.query.locationId;
  if (savedLocationId !== undefined) {
    if (req.query.latitude !== undefined || req.query.longitude !== undefined) {
      throw new HttpError(400, 'Use either locationId or latitude and longitude, not both.');
    }
    const saved = await FarmerWeatherLocation.findOne({
      where: { id: assertUuid(savedLocationId), userId: req.user.id },
    });
    if (!saved) throw new HttpError(404, 'Weather location not found.');
    return {
      latitude: Number(saved.latitude),
      longitude: Number(saved.longitude),
      name: saved.locationName,
      locationId: saved.id,
    };
  }

  const hasLatitude = req.query.latitude !== undefined;
  const hasLongitude = req.query.longitude !== undefined;
  if (hasLatitude || hasLongitude) {
    if (!hasLatitude || !hasLongitude) throw new HttpError(400, 'Provide both latitude and longitude.');
    return weather.locationFromRequest(req);
  }

  const profile = req.user.profile;
  if (profile.latitude !== undefined && profile.longitude !== undefined) {
    return weather.coordinates(profile.latitude, profile.longitude);
  }

  const saved = await FarmerWeatherLocation.findOne({
    where: { userId: req.user.id, isDefault: true },
  });
  if (saved) return { latitude: Number(saved.latitude), longitude: Number(saved.longitude), name: saved.locationName };
  throw new HttpError(400, 'Set a weather location or provide latitude and longitude.');
}

router.get('/search', asyncHandler(async (req, res) => {
  const results = await weather.searchLocations(req.query.q, req.query.language || 'en');
  return res.json({ success: true, data: results, source: 'Open-Meteo Geocoding' });
}));

router.get('/current', asyncHandler(async (req, res) => {
  const location = await getLocation(req);
  const result = await weather.fetchForecastResult(location, 1);
  if (result.cacheStatus !== 'hit') await weather.recordWeatherData(result.data, location);
  return res.json({
    success: true,
    data: weather.currentConditions(result.data, location.name),
    source: result.source,
    updatedAt: result.updatedAt,
    cacheStatus: result.cacheStatus,
    dataAvailability: 'available',
  });
}));

const forecastHandler = asyncHandler(async (req, res) => {
  const location = await getLocation(req);
  const requestedDays = req.path.endsWith('/7-days') ? '7' : (req.query.days || '7');
  if (!/^[1-7]$/.test(String(requestedDays))) throw new HttpError(400, 'Forecast days must be a whole number from 1 to 7.');
  const days = Number(requestedDays);
  const result = await weather.fetchForecastResult(location, days);
  if (result.cacheStatus !== 'hit') await weather.recordWeatherData(result.data, location);
  return res.json({
    success: true,
    data: {
      location: location.name || null,
      coordinates: { latitude: result.data.latitude, longitude: result.data.longitude },
      days: weather.dailyForecast(result.data).slice(0, days),
      source: result.source,
      updatedAt: result.updatedAt,
      cacheStatus: result.cacheStatus,
      dataAvailability: 'available',
    },
  });
});

router.get(['/forecast', '/forecast/7-days'], forecastHandler);

const hourlyHandler = asyncHandler(async (req, res) => {
  const location = await getLocation(req);
  const result = await weather.fetchForecastResult(location, 2);
  if (result.cacheStatus !== 'hit') await weather.recordWeatherData(result.data, location);
  return res.json({
    success: true,
    data: {
      location: location.name || null,
      hours: weather.hourlyForecast(result.data),
      source: result.source,
      updatedAt: result.updatedAt,
      cacheStatus: result.cacheStatus,
      dataAvailability: 'available',
    },
  });
});

router.get(['/hourly', '/forecast/hourly'], hourlyHandler);

const advisoryHandler = asyncHandler(async (req, res) => {
  const location = await getLocation(req);
  const result = await weather.fetchForecastResult(location, 1);
  if (result.cacheStatus !== 'hit') await weather.recordWeatherData(result.data, location);
  const advisories = weather.farmingAdvisories(result.data);
  return res.json({
    success: true,
    data: {
      location: location.name || null,
      generatedAt: result.data.current.time,
      source: result.source,
      cacheStatus: result.cacheStatus,
      advisories,
      cropGuidance: await verifiedCropWeatherGuidance(req),
      note: 'Weather-based reminders are general information. Confirm field conditions before changing farm operations.',
    },
  });
});

router.get(['/advisory', '/agricultural-advisory'], advisoryHandler);

router.get('/alerts', asyncHandler(async (req, res) => {
  const location = await getLocation(req);
  const result = await weather.fetchOfficialAlerts(location);
  return res.json({ success: true, data: result });
}));

router.get('/alerts/active', asyncHandler(async (req, res) => {
  const location = await getLocation(req);
  const result = await weather.fetchOfficialAlerts(location);
  const now = Date.now();
  const alerts = result.alerts.filter((alert) => (
    (!alert.startsAt || new Date(alert.startsAt).getTime() <= now)
    && (!alert.endsAt || new Date(alert.endsAt).getTime() >= now)
  ));
  return res.json({ success: true, data: { ...result, alerts } });
}));

router.get('/alerts/:id', asyncHandler(async (req, res) => {
  const location = await getLocation(req);
  const result = await weather.fetchOfficialAlerts(location);
  const alert = result.alerts.find((item) => item.id === req.params.id);
  if (!alert) throw new HttpError(404, 'Weather alert not found.');
  return res.json({ success: true, data: alert });
}));

const historyHandler = asyncHandler(async (req, res) => {
  const location = await getLocation(req);
  const limit = Number.parseInt(req.query.limit, 10) || 30;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new HttpError(400, 'History limit must be from 1 to 100.');
  let before;
  if (req.query.before !== undefined) {
    before = new Date(req.query.before);
    if (Number.isNaN(before.getTime())) throw new HttpError(400, 'Provide a valid history cursor timestamp.');
  }
  const observations = await weather.weatherHistory({ location, before, limit });
  return res.json({
    success: true,
    data: observations,
    source: 'Open-Meteo',
    dataAvailability: observations.length ? 'available' : 'no-stored-observations',
  });
});

router.get('/history', historyHandler);
router.get('/history/:locationId', asyncHandler(async (req, res) => {
  const location = await FarmerWeatherLocation.findOne({
    where: { id: assertUuid(req.params.locationId), userId: req.user.id },
  });
  if (!location) throw new HttpError(404, 'Weather location not found.');
  req.query.locationId = location.id;
  return historyHandler(req, res);
}));

router.get('/locations', asyncHandler(async (req, res) => {
  const locations = await FarmerWeatherLocation.findAll({
    where: { userId: req.user.id },
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
  });
  return res.json({ success: true, data: locations });
}));

router.put('/locations/:id', asyncHandler(async (req, res) => {
  const location = await FarmerWeatherLocation.findOne({
    where: { id: assertUuid(req.params.id), userId: req.user.id },
  });
  if (!location) throw new HttpError(404, 'Weather location not found.');
  const updates = validateLocationBody({
    locationName: req.body.locationName === undefined ? location.locationName : req.body.locationName,
    latitude: req.body.latitude === undefined ? Number(location.latitude) : req.body.latitude,
    longitude: req.body.longitude === undefined ? Number(location.longitude) : req.body.longitude,
    village: req.body.village === undefined ? location.village : req.body.village,
    mandal: req.body.mandal === undefined ? location.mandal : req.body.mandal,
    district: req.body.district === undefined ? location.district : req.body.district,
    state: req.body.state === undefined ? location.state : req.body.state,
    isDefault: req.body.isDefault,
  });
  const transaction = await FarmerWeatherLocation.sequelize.transaction();
  try {
    if (updates.isDefault === true) {
      await FarmerWeatherLocation.update({ isDefault: false }, { where: { userId: req.user.id }, transaction });
    }
    delete updates.isDefault;
    await location.update({ ...updates, ...(req.body.isDefault === undefined ? {} : { isDefault: req.body.isDefault }) }, { transaction });
    await transaction.commit();
    return res.json({ success: true, data: location });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}));

router.post('/locations', asyncHandler(async (req, res) => {
  const data = validateLocationBody(req.body);
  const count = await FarmerWeatherLocation.count({ where: { userId: req.user.id } });
  if (count >= 10) throw new HttpError(400, 'You can save up to 10 weather locations.');
  const isDefault = req.body.isDefault === true || count === 0;
  const transaction = await FarmerWeatherLocation.sequelize.transaction();
  try {
    if (isDefault) {
      await FarmerWeatherLocation.update({ isDefault: false }, { where: { userId: req.user.id }, transaction });
    }
    const location = await FarmerWeatherLocation.create({ ...data, userId: req.user.id, isDefault }, { transaction });
    await transaction.commit();
    return res.status(201).json({ success: true, data: location });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}));

router.patch('/locations/:id/default', asyncHandler(async (req, res) => {
  const location = await FarmerWeatherLocation.findOne({ where: { id: assertUuid(req.params.id), userId: req.user.id } });
  if (!location) throw new HttpError(404, 'Weather location not found.');
  const transaction = await FarmerWeatherLocation.sequelize.transaction();
  try {
    await FarmerWeatherLocation.update({ isDefault: false }, { where: { userId: req.user.id }, transaction });
    await location.update({ isDefault: true }, { transaction });
    await transaction.commit();
    return res.json({ success: true, data: location });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}));

router.delete('/locations/:id', asyncHandler(async (req, res) => {
  const location = await FarmerWeatherLocation.findOne({ where: { id: assertUuid(req.params.id), userId: req.user.id } });
  if (!location) throw new HttpError(404, 'Weather location not found.');
  const transaction = await FarmerWeatherLocation.sequelize.transaction();
  try {
    await location.destroy({ transaction });
    if (location.isDefault) {
      const nextLocation = await FarmerWeatherLocation.findOne({
        where: { userId: req.user.id },
        order: [['createdAt', 'ASC']],
        transaction,
      });
      if (nextLocation) await nextLocation.update({ isDefault: true }, { transaction });
    }
    await transaction.commit();
    return res.json({ success: true, message: 'Weather location deleted.' });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}));

router.get('/preferences', asyncHandler(async (req, res) => {
  const [preferences] = await WeatherNotificationPreference.findOrCreate({
    where: { userId: req.user.id },
  });
  return res.json({ success: true, data: preferences });
}));

router.put('/preferences', asyncHandler(async (req, res) => {
  const fields = ['rainfallAlerts', 'windAlerts', 'temperatureAlerts', 'severeWeatherAlerts', 'enabled'];
  const values = {};
  for (const field of fields) {
    if (typeof req.body[field] !== 'boolean') throw new HttpError(400, `${field} must be true or false.`);
    values[field] = req.body[field];
  }
  const [preferences] = await WeatherNotificationPreference.findOrCreate({
    where: { userId: req.user.id },
    defaults: values,
  });
  await preferences.update(values);
  return res.json({ success: true, data: preferences });
}));

module.exports = router;
