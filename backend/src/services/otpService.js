const crypto = require('node:crypto');
const HttpError = require('../utils/httpError');
const smsService = require('./smsService');

const otpLifetimeMs = Math.max(60, Number.parseInt(process.env.OTP_TTL_SECONDS, 10) || 600) * 1000;
const resendCooldownMs = Math.max(30, Number.parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 10) || 60) * 1000;
const maxAttempts = 5;

function digest(value) {
  const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new HttpError(503, 'Verification is not configured on this server.');
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex');
}

function safeCompare(first, second) {
  const a = Buffer.from(first || '', 'hex');
  const b = Buffer.from(second || '', 'hex');
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function createCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

async function deliver({ identifier, code, purpose }) {
  if (identifier.includes('@')) {
    throw new HttpError(400, 'OTP delivery is only available by SMS to a registered mobile number.');
  }
  return smsService.sendOtp({ to: identifier, code, purpose });
}

function devCodeEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.AUTH_TEST_OTP_ENABLED === 'true';
}

module.exports = {
  otpLifetimeMs,
  resendCooldownMs,
  maxAttempts,
  digest,
  safeCompare,
  createCode,
  deliver,
  devCodeEnabled,
};
