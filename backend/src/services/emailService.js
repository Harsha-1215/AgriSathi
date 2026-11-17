const nodemailer = require('nodemailer');
const HttpError = require('../utils/httpError');

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) {
    throw new HttpError(503, 'Email delivery is not configured on this server.');
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
}

async function sendEmail({ to, subject, text, html }) {
  const transport = createTransport();
  try {
    return await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });
  } catch {
    throw new HttpError(502, 'Email delivery is temporarily unavailable.');
  }
}

async function sendUnsubscribeLink(email, url) {
  return sendEmail({
    to: email,
    subject: 'AGRISATHI newsletter subscription',
    text: `You can unsubscribe from AGRISATHI updates using this one-time link: ${url}`,
  });
}

module.exports = { sendEmail, sendUnsubscribeLink };
