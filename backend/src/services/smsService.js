const axios = require('axios');
const HttpError = require('../utils/httpError');

const SMSHORIZON_ENDPOINT = 'https://smshorizon.co.in/api/v2/sendsms.php';

function smsHorizonConfiguration() {
  const required = [
    'SMSHORIZON_API_KEY',
    'SMSHORIZON_USERNAME',
    'SMSHORIZON_SENDER_ID',
    'SMSHORIZON_DLT_TEMPLATE_ID',
    'SMSHORIZON_OTP_MESSAGE_TEMPLATE',
  ];
  const missing = required.filter((name) => !String(process.env[name] || '').trim());
  if (missing.length) {
    throw new HttpError(503, `SMS delivery is not configured. Set the required SMS Horizon settings: ${missing.join(', ')}.`);
  }
  const senderId = process.env.SMSHORIZON_SENDER_ID.trim();
  if (!/^[A-Z0-9]{6}$/.test(senderId)) {
    throw new HttpError(503, 'SMSHORIZON_SENDER_ID must be the registered 6-character sender ID.');
  }
  const template = process.env.SMSHORIZON_OTP_MESSAGE_TEMPLATE.trim();
  if (!template.includes('{code}') && !template.includes('{#var#}')) {
    throw new HttpError(503, 'SMSHORIZON_OTP_MESSAGE_TEMPLATE must include the approved DLT OTP placeholder {code} or {#var#}.');
  }
  const type = (process.env.SMSHORIZON_TYPE || 'txt').toLowerCase();
  if (!['txt', 'uni'].includes(type)) {
    throw new HttpError(503, 'SMSHORIZON_TYPE must be txt or uni.');
  }
  return {
    apiKey: process.env.SMSHORIZON_API_KEY.trim(),
    username: process.env.SMSHORIZON_USERNAME.trim(),
    senderId,
    templateId: process.env.SMSHORIZON_DLT_TEMPLATE_ID.trim(),
    template,
    type,
  };
}

function formatSmsHorizonMobile(to) {
  let mobile = String(to || '').replace(/\D/g, '');
  if (mobile.length === 12 && mobile.startsWith('91')) mobile = mobile.slice(2);
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    throw new HttpError(400, 'SMS Horizon requires a valid 10-digit Indian mobile number.');
  }
  return mobile;
}

async function sendSmsHorizonOtp({ to, code }) {
  const config = smsHorizonConfiguration();
  const message = config.template
    .replace(/\{code\}|\{#var#\}/g, code);
  const payload = new URLSearchParams({
    user: config.username,
    mobile: formatSmsHorizonMobile(to),
    senderid: config.senderId,
    message,
    tid: config.templateId,
    type: config.type,
  });
  let response;
  try {
    response = await axios.post(SMSHORIZON_ENDPOINT, payload.toString(), {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      timeout: 10000,
    });
  } catch (error) {
    if (error.code === 'ECONNABORTED') throw new HttpError(504, 'SMS delivery timed out. Please retry.');
    throw new HttpError(502, 'SMS Horizon could not accept the OTP message. Check the SMS account and DLT settings.');
  }
  if (!response.data || typeof response.data !== 'object'
    || !response.data.msgid
    || !['queued', 'sent', 'success', 'accepted'].includes(String(response.data.status || '').toLowerCase())) {
    throw new HttpError(502, 'SMS Horizon returned an unsuccessful or unrecognized delivery response.');
  }
}

async function sendOtp({ to, code, purpose }) {
  if ((process.env.SMS_PROVIDER || '').toLowerCase() === 'smshorizon') {
    return sendSmsHorizonOtp({ to, code });
  }
  const { SMS_PROVIDER_URL, SMS_PROVIDER_TOKEN } = process.env;
  if (!SMS_PROVIDER_URL || !SMS_PROVIDER_TOKEN) {
    throw new HttpError(503, 'SMS delivery is not configured on this server.');
  }
  try {
    const action = purpose === 'registration' ? 'verification' : 'password reset';
    await axios.post(SMS_PROVIDER_URL, {
      to,
      message: `AGRISATHI ${action} code: ${code}`,
    }, {
      headers: { Authorization: `Bearer ${SMS_PROVIDER_TOKEN}` },
      timeout: 10000,
    });
  } catch (error) {
    if (error.code === 'ECONNABORTED') throw new HttpError(504, 'SMS delivery timed out. Please retry.');
    throw new HttpError(502, 'SMS delivery is temporarily unavailable.');
  }
}

module.exports = {
  sendOtp,
  smsHorizonConfiguration,
  formatSmsHorizonMobile,
  sendSmsHorizonOtp,
  SMSHORIZON_ENDPOINT,
};
