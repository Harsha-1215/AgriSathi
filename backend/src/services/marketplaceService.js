const HttpError = require('../utils/httpError');

const ORDER_STATUSES = new Set([
  'pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered',
  'cancelled', 'rejected', 'refund_pending', 'refunded',
]);

function text(value, field, max = 500, required = true) {
  if (value === undefined || value === null || value === '') {
    if (!required) return null;
    throw new HttpError(400, `${field} is required.`);
  }
  if (typeof value !== 'string' || value.trim().length > max || !value.trim()) {
    throw new HttpError(400, `${field} must be a non-empty value of no more than ${max} characters.`);
  }
  return value.trim();
}

function decimal(value, field, { min = 0, max = 999999999, decimals = 3 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new HttpError(400, `${field} must be a number from ${min} to ${max}.`);
  }
  const precision = 10 ** decimals;
  const rounded = Math.round(parsed * precision) / precision;
  if (Math.abs(parsed - rounded) > 1e-8) throw new HttpError(400, `${field} supports at most ${decimals} decimal places.`);
  return rounded;
}

function money(value, field = 'Price') {
  const amount = decimal(value, field, { min: 0.01, max: 9999999999, decimals: 2 });
  return amount.toFixed(2);
}

function quantity(value, field = 'Quantity') {
  return decimal(value, field, { min: 0.001, max: 999999999, decimals: 3 });
}

function boolean(value, field, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new HttpError(400, `${field} must be true or false.`);
  return value;
}

function object(value, field, { maxBytes = 12000 } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, `${field} must be an object.`);
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > maxBytes) throw new HttpError(400, `${field} is too large.`);
  return value;
}

function optionalDate(value, field) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, `${field} must use YYYY-MM-DD.`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new HttpError(400, `${field} is not a valid date.`);
  return value;
}

function validateImageSignature(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) throw new HttpError(400, 'Select one or more product images.');
  const buffer = file.buffer;
  const jpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!jpeg && !png && !webp) throw new HttpError(400, 'Use a valid JPEG, PNG, or WebP product image.');
}

function productView(product) {
  const row = product.toJSON ? product.toJSON() : product;
  const seller = row.SellerProfile;
  return {
    id: row.id,
    productName: row.productName,
    brand: row.brand,
    description: row.description,
    category: row.MarketplaceCategory ? {
      id: row.MarketplaceCategory.id,
      slug: row.MarketplaceCategory.slug,
      name: row.MarketplaceCategory.name,
      translations: row.MarketplaceCategory.translations,
      icon: row.MarketplaceCategory.icon,
    } : null,
    images: (row.ProductImages || []).map((image) => ({ id: image.id, imageUrl: image.imageUrl, position: image.position })),
    price: Number(row.price),
    unit: row.unit,
    availableQuantity: Number(row.availableQuantity),
    minOrderQuantity: Number(row.minOrderQuantity),
    specifications: row.specifications,
    condition: row.condition,
    deliveryAvailable: row.deliveryAvailable,
    pickupAvailable: row.pickupAvailable,
    location: {
      state: row.state,
      district: row.district,
    },
    isOrganic: row.isOrganic,
    regulatedProduct: row.regulatedProduct,
    safetyInformation: row.safetyInformation,
    manufacturer: row.manufacturer,
    batchNumber: row.batchNumber,
    manufacturedDate: row.manufacturedDate,
    expiryDate: row.expiryDate,
    availability: row.availability,
    status: row.status,
    rejectionReason: row.rejectionReason,
    viewCount: row.viewCount,
    seller: seller ? {
      businessName: seller.businessName,
      description: seller.description,
      isVerified: seller.verificationStatus === 'verified',
      verificationStatus: seller.verificationStatus,
      location: {
        state: seller.state,
        district: seller.district,
      },
    } : { businessName: 'Marketplace seller', isVerified: false, location: {} },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    averageRating: row.averageRating === undefined ? null : row.averageRating,
    reviewCount: row.reviewCount === undefined ? 0 : row.reviewCount,
    isWishlisted: Boolean(row.isWishlisted),
  };
}

function paiseFor(price, quantityValue) {
  return Math.round(Number(price) * 100 * Math.round(Number(quantityValue) * 1000) / 1000);
}

function rupeesFromPaise(paise) {
  return (paise / 100).toFixed(2);
}

module.exports = {
  ORDER_STATUSES,
  text,
  decimal,
  money,
  quantity,
  boolean,
  object,
  optionalDate,
  validateImageSignature,
  productView,
  paiseFor,
  rupeesFromPaise,
};
