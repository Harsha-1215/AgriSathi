function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
  const message = status === 500 ? 'An unexpected server error occurred.' : error.message;
  if (status >= 500) console.error(error);
  return res.status(status).json({ success: false, message });
}

module.exports = errorHandler;
