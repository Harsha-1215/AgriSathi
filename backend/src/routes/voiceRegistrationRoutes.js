const express = require('express');
const rateLimit = require('express-rate-limit');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const {
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
} = require('../services/voiceRegistrationService');

const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 6, standardHeaders: 'draft-7', legacyHeaders: false });

const languages = { en: 'en', te: 'te', hi: 'hi' };

function getSession(id) {
  return sessions.get(id);
}

function setSession(id, session) {
  sessions.set(id, session);
}

function nextFieldIndex(fields, currentIndex) {
  return currentIndex + 1;
}

function summarizeData(lang, data, role) {
  const labels = {
    te: {
      fullName: 'మీరు పేరు', mobile: 'మొబైల్ నంబర్', state: 'రాష్ట్రం', district: 'జిల్లా', mandal: 'మండలం', village: 'గ్రామం',
      landArea: 'భూమి విస్తీర్ణం', areaUnit: 'యూనిట్', primaryCrop: 'ప్రధాన పంట', businessName: 'వ్యాపార పేరు',
      serviceCategories: 'సేవా రకాలు', serviceCoverage: 'సేవా ఆవృత condamné', serviceDescription: 'సేవా వివరాలు',
      role: 'ఖాతా రకము',
    },
    en: {
      fullName: 'Full name', mobile: 'Mobile number', state: 'State', district: 'District', mandal: 'Mandal', village: 'Village',
      landArea: 'Land area', areaUnit: 'Area unit', primaryCrop: 'Primary crop', businessName: 'Business name',
      serviceCategories: 'Service categories', serviceCoverage: 'Service coverage', serviceDescription: 'Service description',
      role: 'Account type',
    },
    hi: {
      fullName: 'पूरा नाम', mobile: 'मोबाइल नंबर', state: 'राज्य', district: 'जिला', mandal: 'मंडल', village: 'गांव',
      landArea: 'भूमि क्षेत्रफल', areaUnit: 'इकाई', primaryCrop: 'मुख्य फसल', businessName: 'व्यवसाय नाम',
      serviceCategories: 'सेवा श्रेणियां', serviceCoverage: 'सेवा कवरेज', serviceDescription: 'सेवा विवरण',
      role: 'खाता प्रकार',
    },
  };
  const l = labels[lang] || labels.en;
  const lines = [`${l.role}: ${role === 'service_provider' ? (lang === 'te' ? 'సేవలందించేవారు' : lang === 'hi' ? 'सेवा प्रदाता' : 'Service Provider') : (lang === 'te' ? 'రైతు' : lang === 'hi' ? 'किसान' : 'Farmer')}`];
  const fieldOrder = role === 'service_provider' ? providerFields : farmerFields;
  for (const field of fieldOrder) {
    if (field === 'userType' || field === 'password') continue;
    const value = data[field];
    if (value === undefined || value === null || value === '') continue;
    let displayValue = value;
    if (Array.isArray(value)) displayValue = value.join(', ');
    if (field === 'landArea' && typeof value === 'number') displayValue = value + ' ఎకరాలు';
    lines.push(`${l[field] || field}: ${displayValue}`);
  }
  return lines.join('\n');
}

router.post('/start', limiter, asyncHandler(async (req, res) => {
  const language = req.body.language && languages[req.body.language] ? req.body.language : 'te';
  const sessionId = createSessionId();
  const session = {
    id: sessionId,
    language,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    role: null,
    fieldIndex: 0,
    fields: {},
    confirmed: false,
    otpSent: false,
    mobile: null,
    stage: 'asking',
  };
  setSession(sessionId, session);
  const firstField = getExpectedFields(null)[0];
  return res.json({
    success: true,
    data: {
      sessionId,
      language,
      field: firstField,
      question: getQuestion(language, firstField),
      stage: 'asking',
    },
  });
}));

router.post('/respond', limiter, asyncHandler(async (req, res) => {
  const { sessionId, response, field } = req.body;
  if (!sessionId || !response) throw new HttpError(400, 'Session ID and response are required.');
  const session = getSession(sessionId);
  if (!session) throw new HttpError(404, 'Registration session not found or expired.');
  if (Date.now() - session.updatedAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    throw new HttpError(410, 'Registration session expired. Please start again.');
  }
  session.updatedAt = Date.now();
  const lang = session.language;

  let currentField = field || Object.keys(session.fields).length === 0 ? getExpectedFields(null)[0] : null;

  if (currentField === 'userType') {
    const role = interpretUserType(response);
    if (!role) {
      return res.json({
        success: true,
        data: {
          field: 'userType',
          question: getQuestion(lang, 'userType'),
          stage: 'asking',
          error: 'Please say either "farmer" or "service provider" in your language.',
        },
      });
    }
    session.role = role;
    session.fields.userType = role;
    currentField = nextFieldIndex(getExpectedFields(role), 0) < getExpectedFields(role).length ? getExpectedFields(role)[1] : null;
  } else if (currentField === 'fullName') {
    session.fields.fullName = response.trim();
    currentField = getExpectedFields(session.role)[getExpectedFields(session.role).indexOf('fullName') + 1];
  } else if (currentField === 'mobile') {
    const mobile = extractMobile(response);
    if (!mobile) {
      return res.json({
        success: true,
        data: { field: 'mobile', question: getQuestion(lang, 'mobile'), stage: 'asking', error: 'Please speak a valid 10-digit mobile number.' },
      });
    }
    session.fields.mobile = mobile;
    session.mobile = mobile;
    currentField = getExpectedFields(session.role)[getExpectedFields(session.role).indexOf('mobile') + 1];
  } else if (currentField === 'state') {
    session.fields.state = response.trim();
    currentField = getExpectedFields(session.role)[getExpectedFields(session.role).indexOf('state') + 1];
  } else if (currentField === 'district') {
    session.fields.district = response.trim();
    currentField = getExpectedFields(session.role)[getExpectedFields(session.role).indexOf('district') + 1];
  } else if (currentField === 'mandal') {
    session.fields.mandal = response.trim();
    currentField = getExpectedFields(session.role)[getExpectedFields(session.role).indexOf('mandal') + 1];
  } else if (currentField === 'village') {
    session.fields.village = response.trim();
    currentField = getExpectedFields(session.role)[getExpectedFields(session.role).indexOf('village') + 1];
  } else if (currentField === 'landArea') {
    const area = extractLandArea(response);
    if (area === null) {
      return res.json({ success: true, data: { field: 'landArea', question: getQuestion(lang, 'landArea'), stage: 'asking', error: 'Please tell the land area in acres.' } });
    }
    session.fields.landArea = area;
    currentField = getExpectedFields(session.role)[getExpectedFields(session.role).indexOf('landArea') + 1];
  } else if (currentField === 'areaUnit') {
    session.fields.areaUnit = response.trim();
    currentField = getExpectedFields(session.role)[getExpectedFields(session.role).indexOf('areaUnit') + 1];
  } else if (currentField === 'primaryCrop') {
    session.fields.primaryCrop = response.trim();
    currentField = getExpectedFields(session.role)[getExpectedFields(session.role).indexOf('primaryCrop') + 1];
  } else if (currentField === 'businessName') {
    session.fields.businessName = response.trim();
    currentField = getExpectedFields(session.role)[getExpectedFields(session.role).indexOf('businessName') + 1];
  } else if (currentField === 'serviceCategories') {
    const cats = extractServiceCategories(response);
    if (cats.length === 0) {
      return res.json({ success: true, data: { field: 'serviceCategories', question: getQuestion(lang, 'serviceCategories'), stage: 'asking', error: 'Please mention at least one service category like tractor, irrigation, fertilizer, or pesticides.' } });
    }
    session.fields.serviceCategories = cats;
    currentField = getExpectedFields(session.role)[getExpectedFields(session.role).indexOf('serviceCategories') + 1];
  } else if (currentField === 'serviceCoverage') {
    session.fields.serviceCoverage = [response.trim()];
    currentField = getExpectedFields(session.role)[getExpectedFields(session.role).indexOf('serviceCoverage') + 1];
  } else if (currentField === 'serviceDescription') {
    session.fields.serviceDescription = response.trim();
    currentField = getExpectedFields(session.role)[getExpectedFields(session.role).indexOf('serviceDescription') + 1];
  } else if (currentField === 'password') {
    session.fields.password = response;
    currentField = null;
  }

  setSession(sessionId, session);

  if (!currentField) {
    const errors = validateCollectedData(session.fields, session.role);
    if (errors.length > 0) {
      return res.json({ success: true, data: { field: currentField, question: errors.join(' '), stage: 'validation_error' } });
    }
    const summary = summarizeData(lang, session.fields, session.role);
    return res.json({
      success: true,
      data: {
        field: null,
        question: summary + '\n\n' + (lang === 'te' ? 'ఈ వివరాలు సరైనవేనా?స్పష్టంగా "అవును" లేదా "కాదు" అని చెప్పండి.' : lang === 'hi' ? 'क्या ये विवरण सही हैं? स्पष्ट रूप से "हां" या "नहीं" कहें.' : 'Are these details correct? Please say clearly "yes" or "no".'),
        stage: 'confirming',
        summary,
      },
    });
  }

  return res.json({
    success: true,
    data: {
      field: currentField,
      question: getQuestion(lang, currentField),
      stage: 'asking',
    },
  });
}));

router.post('/confirm', otpLimiter, asyncHandler(async (req, res) => {
  const { sessionId, confirmed } = req.body;
  if (!sessionId) throw new HttpError(400, 'Session ID is required.');
  const session = getSession(sessionId);
  if (!session) throw new HttpError(404, 'Registration session not found or expired.');
  if (Date.now() - session.updatedAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    throw new HttpError(410, 'Registration session expired. Please start again.');
  }

  if (confirmed === false || confirmed === 'false') {
    return res.json({ success: true, data: { stage: 'restart', message: 'Please start again from the beginning.' } });
  }
  if (confirmed !== true && confirmed !== 'true') {
    throw new HttpError(400, 'Please confirm whether the details are correct.');
  }

  const { mobile } = session.fields;
  if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
    throw new HttpError(400, 'A valid mobile number is required before sending OTP.');
  }

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

  await OtpVerification.update({ consumedAt: new Date(), pendingData: null }, { where: { identifier: mobile, purpose: 'registration', consumedAt: null } });
  const code = otp.createCode();
  const pendingData = {
    ...session.fields,
    role: session.role,
    interactionMode: 'voice',
    preferredLanguage: session.language,
  };
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
  session.otpSent = true;
  session.otpMobile = mobile;
  setSession(sessionId, session);
  return res.status(202).json({
    success: true,
    message: 'A registration verification code was sent by SMS.',
    data: { mobile, expiresInSeconds: Math.floor(otp.otpLifetimeMs / 1000), ...(otp.devCodeEnabled() ? { developmentCode: code } : {}) },
  });
}));

router.post('/verify-otp', otpLimiter, asyncHandler(async (req, res) => {
  const { sessionId, code } = req.body;
  if (!sessionId || !code) throw new HttpError(400, 'Session ID and code are required.');
  if (!/^\d{6}$/.test(String(code))) throw new HttpError(400, 'Enter a valid six-digit verification code.');
  const session = getSession(sessionId);
  if (!session) throw new HttpError(404, 'Registration session not found or expired.');
  if (Date.now() - session.updatedAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    throw new HttpError(410, 'Registration session expired. Please start again.');
  }
  const mobile = session.otpMobile || session.fields.mobile;
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
    user = await User.create({
      fullName: pending.fullName,
      mobile,
      passwordHash: pending.passwordHash || await bcrypt.hash(pending.password, 12),
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
        preferredLanguage: pending.preferredLanguage || 'te',
      }, { transaction });
    }
    await UserPreference.create({
      userId: user.id,
      preferredLanguage: pending.preferredLanguage || 'te',
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
  sessions.delete(sessionId);
  return res.status(201).json({ success: true, message: 'Voice account verified and created.', data: { userId: user.id, role: user.role || 'farmer' } });
}));

router.post('/resend-otp', otpLimiter, asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) throw new HttpError(400, 'Session ID is required.');
  const session = getSession(sessionId);
  if (!session) throw new HttpError(404, 'Registration session not found or expired.');
  const mobile = session.otpMobile || session.fields.mobile;
  if (!mobile) throw new HttpError(400, 'Mobile number not found in session.');
  const latest = await OtpVerification.findOne({
    where: { identifier: mobile, purpose: 'registration', consumedAt: null },
    order: [['sentAt', 'DESC']],
  });
  if (latest && Date.now() - latest.sentAt.getTime() < otp.resendCooldownMs) {
    throw new HttpError(429, 'Wait before requesting another verification code.');
  }
  await OtpVerification.update({ consumedAt: new Date(), pendingData: null }, { where: { identifier: mobile, purpose: 'registration', consumedAt: null } });
  const code = otp.createCode();
  const record = await OtpVerification.create({
    userId: null,
    identifier: mobile,
    purpose: 'registration',
    pendingData: { ...session.fields, role: session.role, interactionMode: 'voice', preferredLanguage: session.language },
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
  return res.json({ success: true, message: 'A new verification code was sent by SMS.', data: { mobile, ...(otp.devCodeEnabled() ? { developmentCode: code } : {}) } });
}));

router.get('/session/:id', asyncHandler(async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) throw new HttpError(404, 'Registration session not found.');
  return res.json({ success: true, data: { sessionId: session.id, language: session.language, role: session.role, fieldIndex: session.fieldIndex, fields: session.fields, stage: session.stage, otpSent: session.otpSent } });
}));

module.exports = router;