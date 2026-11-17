const test = require('node:test');
const assert = require('node:assert/strict');
const HttpError = require('../src/utils/httpError');
const otpService = require('../src/services/otpService');

test('OTP delivery rejects email recipients instead of sending email codes', async () => {
  await assert.rejects(
    otpService.deliver({ identifier: 'farmer@example.test', code: '123456', purpose: 'password_reset' }),
    (error) => error instanceof HttpError && error.status === 400 && /SMS to a registered mobile number/.test(error.message),
  );
});
