const multer = require('multer');
const HttpError = require('../utils/httpError');

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
}).single('image');
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
}).single('audio');

function handleUpload(upload) {
  return (req, res, next) => upload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpError(413, 'The uploaded file exceeds the allowed size.'));
    }
    if (error instanceof multer.MulterError) return next(new HttpError(400, 'Upload one supported file at a time.'));
    return next(error);
  });
}

module.exports = { imageUpload: handleUpload(imageUpload), audioUpload: handleUpload(audioUpload) };
