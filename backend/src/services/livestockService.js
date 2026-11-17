const HttpError = require('../utils/httpError');

function text(value, field, max = 500, required = true) {
  if (value === undefined || value === null || value === '') {
    if (!required) return null;
    throw new HttpError(400, `${field} is required.`);
  }
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, `${field} must be a non-empty value of no more than ${max} characters.`);
  }
  return value.trim();
}

function optionalNumber(value, field, { min = 0, max = 1000000, decimals = 2 } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  const factor = 10 ** decimals;
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || Math.abs(parsed * factor - Math.round(parsed * factor)) > 1e-7) {
    throw new HttpError(400, `${field} must be a number from ${min} to ${max} with at most ${decimals} decimal places.`);
  }
  return parsed;
}

function requiredNumber(value, field, options) {
  const parsed = optionalNumber(value, field, options);
  if (parsed === null) throw new HttpError(400, `${field} is required.`);
  return parsed;
}

function boolean(value, field, fallback) {
  if (value === undefined) return fallback;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new HttpError(400, `${field} must be true or false.`);
}

function jsonField(value, field, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new HttpError(400, `${field} must contain valid JSON.`);
    }
  }
  if (!parsed || typeof parsed !== 'object') throw new HttpError(400, `${field} must contain a JSON object or array.`);
  return parsed;
}

function date(value, field, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} is required.`);
    return null;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, `${field} must use YYYY-MM-DD.`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new HttpError(400, `${field} is not a valid date.`);
  return value;
}

function uuid(value, field = 'Record ID') {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, `${field} must be a valid identifier.`);
  }
  return value;
}

function pageValues(req, maxLimit = 48) {
  const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(maxLimit, Number.parseInt(req.query.limit, 10) || 24));
  return { page, limit, offset: (page - 1) * limit };
}

function listingView(listing, { includePrivate = false, profileId = null } = {}) {
  const row = listing.toJSON ? listing.toJSON() : listing;
  const seller = row.LivestockSellerProfile;
  const locationPublic = row.locationPublic !== false;
  const sellerPhoneAllowed = seller
    && seller.allowPhoneContact
    && ['phone', 'both'].includes(row.contactPreference)
    && profileId !== row.sellerId;
  const mapRecords = (records) => (records || []).map((record) => ({
    id: record.id,
    date: record.recordDate || record.administeredAt,
    note: record.note || record.vaccineName,
    veterinarianName: record.veterinarianName || null,
    certificateAvailable: Boolean(record.certificatePublicId),
    ...(includePrivate && record.certificatePublicId ? { certificateUrl: record.certificateUrl || null } : {}),
  }));
  return {
    id: row.id,
    listingName: row.listingName,
    category: row.LivestockCategory ? {
      id: row.LivestockCategory.id,
      slug: row.LivestockCategory.slug,
      name: row.LivestockCategory.name,
      translations: row.LivestockCategory.translations,
      icon: row.LivestockCategory.icon,
    } : null,
    breed: row.LivestockBreed ? {
      id: row.LivestockBreed.id,
      slug: row.LivestockBreed.slug,
      name: row.LivestockBreed.name,
      translations: row.LivestockBreed.translations,
    } : null,
    ageMonths: row.ageMonths,
    gender: row.gender,
    weightKg: row.weightKg === null ? null : Number(row.weightKg),
    color: row.color,
    healthCondition: row.healthCondition,
    vaccinationStatus: row.vaccinationStatus,
    dewormingInformation: row.dewormingInformation,
    veterinaryCheckupDate: row.veterinaryCheckupDate,
    medicalHistory: row.medicalHistory,
    productionDetails: row.productionDetails || {},
    feedingInformation: row.feedingInformation,
    description: row.description,
    images: (row.LivestockImages || []).map((image) => ({
      id: image.id,
      type: image.assetType,
      url: image.url,
      format: image.format,
      durationSeconds: image.durationSeconds,
    })),
    healthRecords: mapRecords(row.LivestockHealthRecords),
    vaccinationRecords: mapRecords(row.LivestockVaccinationRecords),
    price: Number(row.price),
    negotiable: row.negotiable,
    status: row.status,
    availability: row.availability,
    rejectionReason: row.status === 'rejected' && profileId === row.sellerId ? row.rejectionReason : null,
    contactPreference: row.contactPreference,
    pickupAvailable: row.pickupAvailable,
    location: {
      state: row.state,
      district: row.district,
      ...(locationPublic ? { mandal: row.mandal, village: row.village } : {}),
    },
    seller: seller ? {
      name: seller.sellerName,
      description: seller.description,
      isVerified: seller.verificationStatus === 'verified',
      phone: sellerPhoneAllowed ? seller.contactPhone : null,
      location: {
        state: seller.state,
        district: seller.district,
      },
    } : { name: 'Livestock seller', isVerified: false, location: {} },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(row.viewCount !== undefined ? { viewCount: Number(row.viewCount) } : {}),
    isWishlisted: Boolean(row.isWishlisted),
    isOwner: String(profileId) === String(row.sellerId),
  };
}

module.exports = {
  text,
  optionalNumber,
  requiredNumber,
  boolean,
  jsonField,
  date,
  uuid,
  pageValues,
  listingView,
};
