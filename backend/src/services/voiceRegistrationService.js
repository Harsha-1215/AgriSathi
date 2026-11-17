const crypto = require('node:crypto');
const HttpError = require('../utils/httpError');
const otp = require('./otpService');
const { User, UserRole, FarmerProfile, ServiceProviderProfile, UserPreference, OtpVerification, sequelize } = require('../models');
const bcrypt = require('bcryptjs');

const sessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000;

const roleAliases = {
  farmer: 'farmer',
  రైతు: 'farmer',
  service_provider: 'service_provider',
  సేవలందించేవారు: 'service_provider',
  సేవ: 'service_provider',
};

const fieldQuestions = {
  te: {
    userType: 'మీరు రైతుగా నమోదు చేసుకోవాలనుకోవచ్చు, లేదా వ్యవసాయ సేవలు అందించే వ్యక్తిగా నమోదు చేసుకోవాలనుకోవచ్చు?',
    fullName: 'ముందుగా మీ పూర్తి పేరు చెప్పండి.',
    mobile: 'మీ మొబైల్ నంబర్ చెప్పండి.',
    state: 'మీరు ఏ రాష్టానికి చెందినవారు?',
    district: 'మీ జిల్లా పేరు చెప్పండి.',
    mandal: 'మీ మండలం పేరు చెప్పండి.',
    village: 'మీ గ్రామం పేరు చెప్పండి.',
    landArea: 'మీ భూమి ఎంత ఉంది? ఎకరాల్లో చెప్పండి.',
    areaUnit: 'భూమి విస్తీర్ణం యొక్క యూనిట్ ఏమిటి?',
    primaryCrop: 'మీ ప్రధాన పంట ఏమిటి?',
    businessName: 'మీ వ్యాపార పేరు ఏమిటి?',
    serviceCategories: 'మీరు ఏ 값మైన వ్యవసాయ సేవలను అందిస్తున్నారు?',
    serviceCoverage: 'మీ సేవల శ్రేణి ఏమిటి?',
    serviceDescription: 'మీ సేవల గురించి సంక్షిప్తంగా చెప్పండి.',
    password: 'పాస్‌వర్డ్ టైప్ చేయండి (مند propriétaire అడగలేదు, టైప్ చేసేదేで敗య్).',
  },
  en: {
    userType: 'Do you want to register as a farmer or as a service provider?',
    fullName: 'Please tell me your full name.',
    mobile: 'Please tell me your mobile number.',
    state: 'Which state are you from?',
    district: 'Please tell me your district.',
    mandal: 'Please tell me your mandal.',
    village: 'Please tell me your village.',
    landArea: 'How much land do you have? Please tell in acres.',
    areaUnit: 'What is the land area unit?',
    primaryCrop: 'What is your primary crop?',
    businessName: 'What is your business name?',
    serviceCategories: 'Which agricultural services do you provide?',
    serviceCoverage: 'What is your service coverage area?',
    serviceDescription: 'Please describe your services briefly.',
    password: 'Type your password (do not say it aloud).',
  },
  hi: {
    userType: 'क्या आप किसान के रूप में पंजीकरण कराना चाहते हैं या कृषि सेवा प्रदाता के रूप में?',
    fullName: 'कृपया अपना पूरा नाम बताएं.',
    mobile: 'कृपया अपना मोबाइल नंबर बताएं.',
    state: 'आप किस राज्य से हैं?',
    district: 'कृपया अपना जिला बताएं.',
    mandal: 'कृपया अपना मंडल बताएं.',
    village: 'कृपया अपना गांव बताएं.',
    landArea: 'आपके पास कितनी जमीन है? कृपया एकड़ में बताएं.',
    areaUnit: 'भूमि क्षेत्रफल की इकाई क्या है?',
    primaryCrop: 'आपकी मुख्य फसल क्या है?',
    businessName: 'आपका व्यावसायिक नाम क्या है?',
    serviceCategories: 'आप कौन सी कृषि सेवाएं प्रदान करते हैं?',
    serviceCoverage: 'आपकी सेवा कवरेज क्षेत्र क्या है?',
    serviceDescription: 'कृपया अपनी सेवाओं का संक्षिप्त विवरण दें.',
    password: 'अपना पासवर्ड टाइप करें (बोल कर न बताएं).',
  },
};

const farmerFields = ['userType', 'fullName', 'mobile', 'state', 'district', 'mandal', 'village', 'landArea', 'areaUnit', 'primaryCrop', 'password'];
const providerFields = ['userType', 'fullName', 'mobile', 'state', 'district', 'mandal', 'village', 'businessName', 'serviceCategories', 'serviceCoverage', 'serviceDescription', 'password'];

const mobileDigitMap = {
  sunya: '0', bindu: '0', shoonya: '0',
  okati: '1', oka: '1', ek: '1', one: '1',
  rendu: '2', two: '2', do: '2',
  moodu: '3', three: '3', teen: '3',
  naalugu: '4', four: '4', char: '4',
  aidu: '5', five: '5', panch: '5',
  aru: '6', six: '6', cheh: '6',
  edu: '7', seven: '7', saat: '7',
  enimid: '8', eight: '8', aath: '8',
  tommidu: '9', nine: '9', nau: '9',
};

const serviceCategoryAliases = {
  tractor: 'Tractor rental',
  ట్రాక్టర్: 'Tractor rental',
  ट्रैक्टर: 'Tractor rental',
  drip: 'Irrigation services',
  డ్రిప్: 'Irrigation Services',
  ड्रिप: 'Irrigation Services',
  నీరు: 'Irrigation Services',
 फ़: 'Irrigation Services',
  fertilizer: 'Fertilizers',
  ఎరువులు: 'Fertilizers',
  खाद: 'Fertilizers',
  pesticide: 'Pesticides',
  పురుగుమందు: 'Pesticides',
  कीटनाशक: 'Pesticides',
  equipment: 'Agricultural equipment',
  పరికరాలు: 'Agricultural equipment',
  उपकरण: 'Agricultural equipment',
};

function extractMobile(text) {
  const cleaned = text.toLowerCase().replace(/[.,!?;:]/g, ' ');
  let digits = '';
  const words = cleaned.split(/\s+/);
  for (const word of words) {
    if (mobileDigitMap[word]) digits += mobileDigitMap[word];
    else if (/\d/.test(word)) digits += word.replace(/\D/g, '');
  }
  if (digits.length === 10) return digits;
  const digitOnly = text.replace(/\D/g, '');
  if (digitOnly.length === 10) return digitOnly;
  return null;
}

function extractLandArea(text) {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:acres?|ఎకరాలు?|एकड़)/i);
  if (match) return Number(match[1]);
  const areaWords = { one: 1, two: 2, three: 3, four: 4, five: 5, rendu: 2, moodu: 3, naalugu: 4, aidu: 5, okati: 1 };
  const lower = text.toLowerCase();
  for (const [word, val] of Object.entries(areaWords)) {
    if (lower.includes(word)) return val;
  }
  return null;
}

function extractServiceCategories(text) {
  const lower = text.toLowerCase();
  const found = [];
  for (const [alias, category] of Object.entries(serviceCategoryAliases)) {
    if (lower.includes(alias.toLowerCase()) && !found.includes(category)) {
      found.push(category);
    }
  }
  return found;
}

function interpretUserType(text) {
  const lower = text.toLowerCase();
  for (const [alias, role] of Object.entries(roleAliases)) {
    if (lower.includes(alias.toLowerCase())) return role;
  }
  if (/tractor|drone|irrigation|fertilizer|pesticide|equipment|service|సేవ|सेवा/i.test(lower)) return 'service_provider';
  if (/farmer|crop|field|rain|ఈవూరు|खेती|किसान/i.test(lower)) return 'farmer';
  return null;
}

function getQuestion(lang, field) {
  return fieldQuestions[lang][field] || fieldQuestions.en[field] || 'Please continue.';
}

function getExpectedFields(role) {
  return role === 'service_provider' ? providerFields : farmerFields;
}

function validateCollectedData(data, role) {
  const errors = [];
  if (!data.fullName || data.fullName.trim().length < 2) errors.push('Full name is required.');
  if (!data.mobile || !/^[0-9]{10}$/.test(data.mobile)) errors.push('Valid 10-digit mobile number is required.');
  if (!data.district) errors.push('District is required.');
  if (!data.village) errors.push('Village is required.');
  if (role === 'farmer') {
    if (!data.landArea || data.landArea <= 0) errors.push('Land area must be greater than zero.');
    if (!data.areaUnit) errors.push('Land area unit is required.');
    if (!data.primaryCrop) errors.push('Primary crop is required.');
  }
  if (role === 'service_provider') {
    if (!data.businessName) errors.push('Business name is required.');
    if (!data.serviceCategories || data.serviceCategories.length === 0) errors.push('At least one service category is required.');
    if (!data.serviceCoverage || data.serviceCoverage.length === 0) errors.push('At least one service area is required.');
    if (!data.serviceDescription) errors.push('Service description is required.');
  }
  if (!data.password || data.password.length < 8) errors.push('Password must be at least 8 characters.');
  return errors;
}

function createSessionId() {
  return crypto.randomUUID();
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) sessions.delete(id);
  }
}
setInterval(cleanupExpiredSessions, 10 * 60 * 1000);

module.exports = {
  sessions,
  SESSION_TTL_MS,
  fieldQuestions,
  farmerFields,
  providerFields,
  extractMobile,
  extractLandArea,
  extractServiceCategories,
  interpretUserType,
  getQuestion,
  getExpectedFields,
  validateCollectedData,
  createSessionId,
  otp,
  bcrypt,
  User,
  UserRole,
  FarmerProfile,
  ServiceProviderProfile,
  UserPreference,
  OtpVerification,
  sequelize,
};