const HttpError = require('./httpError');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

module.exports = (value) => {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new HttpError(400, 'The requested ID is invalid.');
  return value;
};
