const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const HttpError = require('../src/utils/httpError');
const { sendOtp, formatSmsHorizonMobile, SMSHORIZON_ENDPOINT } = require('../src/services/smsService');

const configNames = [
  'SMS_PROVIDER',
  'SMSHORIZON_API_KEY',
  'SMSHORIZON_USERNAME',
  'SMSHORIZON_SENDER_ID',
  'SMSHORIZON_DLT_TEMPLATE_ID',
  'SMSHORIZON_OTP_MESSAGE_TEMPLATE',
  'SMSHORIZON_TYPE',
];

function withSmsConfig(run) {
  const previous = Object.fromEntries(configNames.map((name) => [name, process.env[name]]));
  Object.assign(process.env, {
    SMS_PROVIDER: 'smshorizon',
    SMSHORIZON_API_KEY: 'test-token',
    SMSHORIZON_USERNAME: 'test-account',
    SMSHORIZON_SENDER_ID: 'AGRI01',
    SMSHORIZON_DLT_TEMPLATE_ID: '1107160521253456789',
    SMSHORIZON_OTP_MESSAGE_TEMPLATE: 'AGRISATHI verification code: {code}',
    SMSHORIZON_TYPE: 'txt',
  });
  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const name of configNames) {
        if (previous[name] === undefined) delete process.env[name];
        else process.env[name] = previous[name];
      }
    });
}

test('SMS Horizon adapter formats Indian mobile numbers for the provider', () => {
  assert.equal(formatSmsHorizonMobile('+91 98765-43210'), '9876543210');
  assert.throws(() => formatSmsHorizonMobile('12345'), /10-digit Indian mobile/i);
});

test('SMS Horizon adapter sends the documented authenticated form without exposing the token', async () => {
  await withSmsConfig(async () => {
    const originalPost = axios.post;
    let captured;
    axios.post = async (url, body, options) => {
      captured = { url, body: new URLSearchParams(body), options };
      return { data: { msgid: 'provider-message-id', status: 'queued' } };
    };
    try {
      await sendOtp({ to: '+91 98765-43210', code: '123456', purpose: 'registration' });
    } finally {
      axios.post = originalPost;
    }

    assert.equal(captured.url, SMSHORIZON_ENDPOINT);
    assert.equal(captured.body.get('mobile'), '9876543210');
    assert.equal(captured.body.get('message'), 'AGRISATHI verification code: 123456');
    assert.equal(captured.body.get('tid'), '1107160521253456789');
    assert.equal(captured.options.headers.Authorization, 'Bearer test-token');
    assert.equal(captured.options.headers['Content-Type'], 'application/x-www-form-urlencoded');
  });
});

test('SMS Horizon adapter reports missing configuration clearly without making a request', async () => {
  await withSmsConfig(async () => {
    delete process.env.SMSHORIZON_USERNAME;
    await assert.rejects(
      sendOtp({ to: '9876543210', code: '123456', purpose: 'registration' }),
      (error) => error instanceof HttpError && error.status === 503 && /SMSHORIZON_USERNAME/.test(error.message),
    );
  });
});
