const cloudinary = require('cloudinary').v2;
const HttpError = require('../utils/httpError');

function configure() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new HttpError(503, 'Secure image storage is not configured. Please try again later.');
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

function createVideoUploadSignature(creatorId) {
  const client = configure();
  const params = {
    allowed_formats: 'mp4,mov,webm',
    context: `creatorId=${creatorId}|app=agrisathi-shorts`,
    folder: 'agrisathi/agri-shorts',
    timestamp: Math.floor(Date.now() / 1000),
  };
  return {
    ...params,
    signature: client.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET),
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
  };
}

async function verifyUploadedVideo(publicId, creatorId) {
  const client = configure();
  if (typeof publicId !== 'string' || !/^agrisathi\/agri-shorts\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(publicId)) {
    throw new HttpError(400, 'The uploaded video identifier is invalid.');
  }
  let asset;
  try {
    asset = await client.api.resource(publicId, { resource_type: 'video', type: 'upload', context: true });
  } catch (error) {
    if (Number(error.http_code) === 404) {
      throw new HttpError(400, 'The uploaded video could not be verified. Finish the upload and try again.');
    }
    throw new HttpError(502, 'The video storage service could not verify the upload. Please try again.');
  }
  const maxBytes = Number.parseInt(process.env.AGRI_SHORTS_MAX_VIDEO_BYTES, 10) || 100 * 1024 * 1024;
  const context = asset.context && (asset.context.custom || asset.context);
  if (
    asset.resource_type !== 'video'
    || !publicId.startsWith('agrisathi/agri-shorts/')
    || !context
    || String(context.creatorId) !== String(creatorId)
    || !['mp4', 'mov', 'webm'].includes(String(asset.format).toLowerCase())
    || !Number.isFinite(Number(asset.bytes))
    || Number(asset.bytes) > maxBytes
    || !Number.isFinite(Number(asset.duration))
    || Number(asset.duration) < 3
    || Number(asset.duration) > 180
  ) {
    throw new HttpError(400, 'The video must be an MP4, MOV, or WebM, at most 100 MB, and no longer than 180 seconds.');
  }
  return {
    publicId,
    secureUrl: asset.secure_url,
    format: asset.format,
    bytes: Number(asset.bytes),
    duration: Math.ceil(Number(asset.duration)),
    thumbnailUrl: client.url(publicId, {
      resource_type: 'video',
      secure: true,
      format: 'jpg',
      transformation: [{ start_offset: 0 }],
    }),
  };
}

async function deleteVideoAsset(publicId) {
  const client = configure();
  const result = await client.uploader.destroy(publicId, { resource_type: 'video', invalidate: true });
  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new HttpError(502, 'The stored video could not be removed.');
  }
}

function uploadPrivateImage(buffer, folder = process.env.CLOUDINARY_FOLDER || 'agrisathi/crop-diagnoses') {
  const client = configure();
  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream({
      resource_type: 'image',
      type: 'authenticated',
      folder,
      use_filename: false,
      unique_filename: true,
      overwrite: false,
    }, (error, result) => {
      if (error) return reject(new HttpError(502, 'The image could not be stored securely.'));
      return resolve({
        publicId: result.public_id,
        format: result.format,
        secureUrl: result.secure_url,
      });
    });
    stream.end(buffer);
  });
}

function uploadPublicImage(buffer, folder = 'agrisathi/crop-library') {
  const client = configure();
  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream({
      resource_type: 'image',
      folder,
      use_filename: false,
      unique_filename: true,
      overwrite: false,
    }, (error, result) => {
      if (error) return reject(new HttpError(502, 'The image could not be stored securely.'));
      return resolve({ publicId: result.public_id, format: result.format, secureUrl: result.secure_url, bytes: result.bytes });
    });
    stream.end(buffer);
  });
}

function uploadPublicVideo(buffer, folder = 'agrisathi/livestock') {
  const client = configure();
  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream({
      resource_type: 'video',
      folder,
      use_filename: false,
      unique_filename: true,
      overwrite: false,
    }, (error, result) => {
      if (error) return reject(new HttpError(502, 'The video could not be stored securely.'));
      return resolve({
        publicId: result.public_id,
        format: result.format,
        secureUrl: result.secure_url,
        bytes: result.bytes,
        duration: result.duration,
      });
    });
    stream.end(buffer);
  });
}

function uploadPrivateDocument(buffer, mimeType) {
  const client = configure();
  const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType);
  const resourceType = isImage ? 'image' : 'raw';
  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream({
      resource_type: resourceType,
      type: 'authenticated',
      folder: 'agrisathi/private-documents',
      use_filename: false,
      unique_filename: true,
      overwrite: false,
    }, (error, result) => {
      if (error) return reject(new HttpError(502, 'The verification document could not be stored securely.'));
      return resolve({
        publicId: result.public_id,
        format: result.format,
        resourceType,
      });
    });
    stream.end(buffer);
  });
}

async function deletePublicImage(publicId) {
  const client = configure();
  const result = await client.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new HttpError(502, 'The stored product image could not be removed.');
  }
}

async function deletePublicVideo(publicId) {
  const client = configure();
  const result = await client.uploader.destroy(publicId, { resource_type: 'video', invalidate: true });
  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new HttpError(502, 'The stored video could not be removed.');
  }
}

function getPrivateDocumentUrl(publicId, format, resourceType) {
  const client = configure();
  return client.utils.private_download_url(publicId, format, {
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    resource_type: resourceType,
    type: 'authenticated',
  });
}

async function deletePrivateDocument(publicId, resourceType) {
  const client = configure();
  const result = await client.uploader.destroy(publicId, {
    resource_type: resourceType,
    type: 'authenticated',
    invalidate: true,
  });
  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new HttpError(502, 'The stored verification document could not be removed.');
  }
}

function getPrivateImageUrl(publicId, format) {
  const client = configure();
  return client.utils.private_download_url(publicId, format, {
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    resource_type: 'image',
    type: 'authenticated',
  });
}

async function deletePrivateImage(publicId) {
  const client = configure();
  const result = await client.uploader.destroy(publicId, {
    resource_type: 'image',
    type: 'authenticated',
    invalidate: true,
  });
  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new HttpError(502, 'The stored image could not be removed.');
  }
}

module.exports = {
  uploadPrivateImage,
  uploadPublicImage,
  createVideoUploadSignature,
  verifyUploadedVideo,
  deleteVideoAsset,
  deletePublicImage,
  uploadPublicVideo,
  uploadPrivateDocument,
  getPrivateDocumentUrl,
  deletePrivateDocument,
  deletePublicVideo,
  getPrivateImageUrl,
  deletePrivateImage,
};
