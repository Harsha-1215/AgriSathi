const express = require('express');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { requireAuth, checkAccountStatus } = require('../middleware/auth');
const { sequelize, ServiceBooking, ServiceProviderProfile } = require('../models');
const assertUuid = require('../utils/assertUuid');

const router = express.Router();
router.use(requireAuth, checkAccountStatus);
const serviceCategoryMatchers = {
  'tractor rental': /tractor|ట్రాక్టర్|ट्रैक्टर/i,
  'irrigation services': /irrigation|drip|నీటిపారుదల|డ్రిప్|सिंचाई/i,
  'drone spraying': /drone|డ్రోన్|ड्रोन/i,
  'agricultural labour': /labou?r|కూలి|मजदूर/i,
  'harvesting machines': /harvest|కోత|कटाई/i,
  'soil testing': /soil|నేల పరీక్ష|మట్టి పరీక్ష|मिट्टी जाँच|मिट्टी जांच/i,
  'veterinary services': /veterinary|vet|పశువైద్య|पशु चिकित्सा/i,
  'equipment rental': /equipment|పరికరాల అద్దె|उपकरण किराया/i,
  transportation: /transport|రవాణా|परिवहन/i,
};

function text(value, field, { required = false, max = 120 } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} is required.`);
    return null;
  }
  if (typeof value !== 'string' || value.trim().length > max) throw new HttpError(400, `${field} must be a text value of at most ${max} characters.`);
  const result = value.trim();
  if (required && !result) throw new HttpError(400, `${field} is required.`);
  return result || null;
}

function view(booking) {
  const result = booking.toJSON();
  if (result.ServiceProviderProfile) {
    result.provider = {
      businessName: result.ServiceProviderProfile.businessName,
      serviceCategories: result.ServiceProviderProfile.serviceCategories,
    };
    delete result.ServiceProviderProfile;
  }
  return result;
}

function indiaDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function bookingAccessWhere(user) {
  if (user.role === 'farmer') return { farmerId: user.id };
  if (user.role === 'provider') return { providerId: user.id };
  throw new HttpError(403, 'Only farmers and approved service providers can access bookings.');
}

router.get('/', asyncHandler(async (req, res) => {
  const where = bookingAccessWhere(req.user);
  if (req.user.role === 'provider') {
    const provider = await ServiceProviderProfile.findOne({ where: { userId: req.user.id, approvalStatus: 'approved' }, attributes: ['userId'] });
    if (!provider) throw new HttpError(403, 'Only approved service providers can access bookings.');
  }
  if (req.query.status) {
    const status = String(req.query.status);
    if (!['requested', 'accepted', 'rejected', 'cancelled', 'completed'].includes(status)) {
      throw new HttpError(400, 'Choose a supported booking status.');
    }
    where.status = status;
  }
  const bookings = await ServiceBooking.findAll({
    where,
    include: [{ model: ServiceProviderProfile, attributes: ['businessName', 'serviceCategories'] }],
    order: [['createdAt', 'DESC']],
    limit: 100,
  });
  return res.json({ success: true, data: bookings.map(view) });
}));

router.post('/', asyncHandler(async (req, res) => {
  if (req.user.role !== 'farmer') throw new HttpError(403, 'Only farmers can request a service booking.');
  if (req.body.confirm !== true) throw new HttpError(400, 'Explicitly confirm the provider, service, date, and location before booking.');
  const providerId = assertUuid(req.body.providerId);
  const serviceCategory = text(req.body.serviceCategory, 'Service category', { required: true, max: 160 });
  const requestedDate = text(req.body.requestedDate, 'Requested date', { required: true, max: 10 });
  const parsedDate = new Date(`${requestedDate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    || Number.isNaN(parsedDate.getTime())
    || parsedDate.toISOString().slice(0, 10) !== requestedDate) {
    throw new HttpError(400, 'Enter the requested date in YYYY-MM-DD format.');
  }
  if (requestedDate < indiaDate()) throw new HttpError(400, 'A service booking date cannot be in the past.');
  const district = text(req.body.district || req.user.profile.district, 'District', { required: true, max: 120 });
  const village = text(req.body.village || req.user.profile.village, 'Village', { required: true, max: 120 });
  const landArea = req.body.landArea === undefined || req.body.landArea === null || req.body.landArea === ''
    ? null
    : Number(req.body.landArea);
  if (landArea !== null && (!Number.isFinite(landArea) || landArea <= 0 || landArea > 100000)) {
    throw new HttpError(400, 'Land area must be a positive number no greater than 100,000.');
  }
  const transaction = await sequelize.transaction();
  let booking;
  try {
    const provider = await ServiceProviderProfile.findOne({
      where: { userId: providerId, approvalStatus: 'approved' },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!provider) throw new HttpError(404, 'The approved service provider was not found.');
    const categoryMatcher = serviceCategoryMatchers[serviceCategory.toLocaleLowerCase()];
    if (!categoryMatcher) throw new HttpError(400, 'Choose a supported service category.');
    const hasCategory = (provider.serviceCategories || []).some((item) => categoryMatcher.test(String(item)));
    if (!hasCategory) throw new HttpError(400, 'The selected provider does not offer that service category.');
    const existing = await ServiceBooking.findOne({
      where: {
        farmerId: req.user.id,
        providerId,
        serviceCategory,
        requestedDate,
        status: { [Op.in]: ['requested', 'accepted'] },
      },
      transaction,
    });
    if (existing) throw new HttpError(409, 'A booking request for this provider, service, and date already exists.');
    booking = await ServiceBooking.create({
      farmerId: req.user.id,
      providerId,
      serviceCategory,
      requestedDate,
      landArea,
      cropType: text(req.body.cropType, 'Crop type', { max: 120 }),
      state: text(req.body.state || req.user.profile.state, 'State', { max: 120 }),
      district,
      mandal: text(req.body.mandal || req.user.profile.mandal, 'Mandal', { max: 120 }),
      village,
      notes: text(req.body.notes, 'Notes', { max: 1500 }),
      status: 'requested',
      confirmedAt: new Date(),
    }, { transaction });
    await transaction.commit();
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
  return res.status(201).json({ success: true, message: 'Booking request created after your confirmation.', data: view(booking) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const id = assertUuid(req.params.id);
  const where = { id, ...bookingAccessWhere(req.user) };
  const booking = await ServiceBooking.findOne({
    where,
    include: [{ model: ServiceProviderProfile, attributes: ['businessName', 'serviceCategories'] }],
  });
  if (!booking) throw new HttpError(404, 'Booking not found.');
  return res.json({ success: true, data: view(booking) });
}));

router.put('/:id/status', asyncHandler(async (req, res) => {
  const id = assertUuid(req.params.id);
  const status = req.body.status;
  if (!['accepted', 'rejected', 'cancelled', 'completed'].includes(status)) {
    throw new HttpError(400, 'Choose an allowed next booking status.');
  }
  const transaction = await sequelize.transaction();
  let booking;
  try {
    booking = await ServiceBooking.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!booking) throw new HttpError(404, 'Booking not found.');
    if (req.user.role === 'farmer') {
      if (booking.farmerId !== req.user.id || status !== 'cancelled' || !['requested', 'accepted'].includes(booking.status)) {
        throw new HttpError(403, 'Farmers may cancel only their own active booking requests.');
      }
    } else if (req.user.role === 'provider') {
      if (booking.providerId !== req.user.id) throw new HttpError(403, 'You can only update bookings sent to your provider account.');
      const provider = await ServiceProviderProfile.findOne({
        where: { userId: req.user.id, approvalStatus: 'approved' },
        attributes: ['userId'],
        transaction,
      });
      if (!provider) throw new HttpError(403, 'Only approved service providers can update bookings.');
      const transitions = {
        requested: ['accepted', 'rejected'],
        accepted: ['completed', 'rejected'],
      };
      if (!(transitions[booking.status] || []).includes(status)) throw new HttpError(409, 'That booking status transition is not allowed.');
    } else {
      throw new HttpError(403, 'Only the booking farmer or provider can update this booking.');
    }
    await booking.update({ status }, { transaction });
    await transaction.commit();
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
  return res.json({ success: true, data: view(booking) });
}));

module.exports = router;
