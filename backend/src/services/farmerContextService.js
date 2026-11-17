const { Op } = require('sequelize');
const HttpError = require('../utils/httpError');
const {
  FarmerProfile,
  FarmerCrop,
  Crop,
  CropKnowledge,
  FarmerWeatherLocation,
} = require('../models');
const weather = require('./weatherService');

async function getSelectedCrop(userId, cropId) {
  if (!cropId) return null;
  if (typeof cropId !== 'string' || cropId.length > 80) throw new HttpError(400, 'The selected crop identifier is invalid.');
  const record = await FarmerCrop.findOne({
    where: { id: cropId, userId, status: { [Op.in]: ['planned', 'active'] } },
    include: [{ model: Crop, attributes: ['id', 'name'], required: false }],
  });
  if (!record) throw new HttpError(404, 'The selected crop was not found in your farm records.');
  return {
    cropRecordId: record.id,
    cropId: record.cropId,
    name: record.Crop?.name || record.cropName,
    variety: record.variety,
    growthStage: record.growthStage,
    season: record.season,
    sowingDate: record.sowingDate,
    expectedHarvestDate: record.expectedHarvestDate,
  };
}

async function getWeatherContext(userId, profile) {
  let location;
  if (profile.latitude !== null && profile.longitude !== null) {
    location = weather.coordinates(profile.latitude, profile.longitude);
  } else {
    const saved = await FarmerWeatherLocation.findOne({ where: { userId, isDefault: true } });
    if (!saved) return { status: 'unavailable', reason: 'location_missing' };
    location = { latitude: Number(saved.latitude), longitude: Number(saved.longitude) };
  }
  const data = await weather.fetchForecast(location, 1);
  return {
    source: 'Open-Meteo',
    observedAt: data.current.time,
    temperatureC: data.current.temperature_2m,
    humidityPercent: data.current.relative_humidity_2m,
    precipitationMm: data.current.precipitation,
    windSpeedKph: data.current.wind_speed_10m,
    forecast: weather.dailyForecast(data).slice(0, 1),
  };
}

async function getFarmerContext(userId, requestContext = {}, question = '') {
  const profile = await FarmerProfile.findByPk(userId, {
    attributes: ['state', 'district', 'village', 'soilType', 'irrigationType', 'primaryCrop', 'otherCrops', 'latitude', 'longitude', 'preferredLanguage'],
  });
  const crops = await FarmerCrop.findAll({
    where: { userId, status: { [Op.in]: ['planned', 'active'] } },
    include: [{ model: Crop, attributes: ['id', 'name'], required: false }],
    attributes: ['id', 'cropId', 'cropName', 'variety', 'growthStage', 'season', 'sowingDate', 'expectedHarvestDate'],
    order: [['updatedAt', 'DESC']],
    limit: 12,
  });
  const selectedCrop = await getSelectedCrop(userId, requestContext.cropId);
  const cropNames = [...new Set([
    ...(crops.map((record) => record.Crop?.name || record.cropName)),
    profile?.primaryCrop,
    ...(profile?.otherCrops || []),
    selectedCrop?.name,
  ].filter(Boolean))].slice(0, 15);
  const masterCrops = cropNames.length
    ? await Crop.findAll({
      where: { name: { [Op.in]: cropNames }, isActive: true },
      attributes: ['id', 'name'],
    })
    : [];
  const cropIds = [...new Set([
    ...crops.map((record) => record.cropId).filter(Boolean),
    selectedCrop?.cropId,
    ...masterCrops.map((crop) => crop.id),
  ].filter(Boolean))];
  const knowledge = cropNames.length
    ? await CropKnowledge.findAll({
      where: {
        isPublished: true,
        cropId: { [Op.in]: cropIds },
        language: requestContext.language || profile?.preferredLanguage || 'en',
      },
      attributes: ['cropId', 'sectionType', 'title', 'content', 'source', 'verifiedAt'],
      order: [['verifiedAt', 'DESC']],
      limit: 8,
    })
    : [];
  let weatherData = null;
  if (/\b(weather|rain|rainfall|temperature|wind|forecast)\b|వాతావరణ|వర్షం|मौसम|बारिश|तापमान/i.test(question)) {
    try {
      weatherData = await getWeatherContext(userId, profile || {});
    } catch (error) {
      console.error('Assistant weather context is unavailable:', error.message);
      weatherData = { status: 'unavailable' };
    }
  }
  return {
    location: profile ? { state: profile.state, district: profile.district } : null,
    crops: crops.map((record) => ({
      name: record.Crop?.name || record.cropName,
      variety: record.variety,
      growthStage: record.growthStage,
      season: record.season,
      sowingDate: record.sowingDate,
      expectedHarvestDate: record.expectedHarvestDate,
    })),
    selectedCrop,
    soilType: profile?.soilType || null,
    irrigationType: profile?.irrigationType || null,
    verifiedKnowledge: knowledge.map((item) => ({
      cropId: item.cropId,
      section: item.sectionType,
      title: item.title,
      content: JSON.stringify(item.content).slice(0, 4000),
      source: item.source,
      verifiedAt: item.verifiedAt,
    })),
    weather: weatherData,
    marketPrices: { status: 'unavailable', reason: 'No verified live market-price source is connected.' },
  };
}

module.exports = { getFarmerContext };
