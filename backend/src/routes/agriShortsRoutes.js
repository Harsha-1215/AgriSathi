const express = require('express');
const rateLimit = require('express-rate-limit');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { requireAuth, requireFarmer } = require('../middleware/auth');
const {
  sequelize, AgriVideo, AgriVideoCategory, AgriVideoLike, AgriVideoBookmark,
  AgriVideoComment, AgriVideoCommentLike, AgriVideoView, AgriVideoReport, Crop,
} = require('../models');
const {
  createVideoUploadSignature, verifyUploadedVideo, deleteVideoAsset,
} = require('../services/cloudinaryService');
const assertUuid = require('../utils/assertUuid');

const router = express.Router();
router.use(requireAuth);

const commentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many community actions. Please try again later.' },
});
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
const creatorRoles = new Set(['expert', 'admin', 'approved_creator']);
const languages = new Set(['en', 'te', 'hi']);
const videoAttributes = [
  'id', 'creatorId', 'creatorDisplayName', 'title', 'description', 'videoUrl',
  'thumbnailUrl', 'categoryId', 'cropId', 'language', 'duration', 'tags',
  'captionsVtt', 'status', 'viewCount', 'likeCount', 'isFeatured',
  'sourceReference', 'publishedAt', 'createdAt',
];

function requireCreator(req, res, next) {
  if (!creatorRoles.has(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Video publishing is limited to approved creators and administrators.' });
  }
  return next();
}

function requiredText(value, field, max = 180) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, `${field} is required and must be no more than ${max} characters.`);
  }
  return value.trim();
}

function optionalText(value, field, max = 1000) {
  if (value === undefined || value === null || value === '') return null;
  return requiredText(value, field, max);
}

function language(value) {
  if (!languages.has(value)) throw new HttpError(400, 'Choose English, Telugu, or Hindi.');
  return value;
}

function parseTags(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 20) throw new HttpError(400, 'Provide no more than 20 video tags.');
  return [...new Set(value.map((tag) => requiredText(tag, 'Tag', 40)))];
}

function validateVtt(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 250000 || !value.trimStart().startsWith('WEBVTT')) {
    throw new HttpError(400, 'Captions must be a WebVTT document smaller than 250 KB.');
  }
  return value;
}

function videoInclude() {
  return [
    { model: AgriVideoCategory, attributes: ['id', 'slug', 'name', 'translations', 'icon'] },
    { model: Crop, attributes: ['id', 'name', 'translations'], required: false },
  ];
}

function publicVideo(video, interaction = {}) {
  const row = video.toJSON ? video.toJSON() : video;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    videoUrl: row.videoUrl,
    thumbnailUrl: row.thumbnailUrl,
    category: row.AgriVideoCategory ? {
      id: row.AgriVideoCategory.id,
      slug: row.AgriVideoCategory.slug,
      name: row.AgriVideoCategory.name,
      translations: row.AgriVideoCategory.translations,
      icon: row.AgriVideoCategory.icon,
    } : null,
    crop: row.Crop ? { id: row.Crop.id, name: row.Crop.name, translations: row.Crop.translations } : null,
    language: row.language,
    duration: row.duration,
    tags: row.tags,
    captionsVtt: row.captionsVtt,
    creator: { displayName: row.creatorDisplayName },
    viewCount: row.viewCount,
    likeCount: row.likeCount,
    isFeatured: row.isFeatured,
    sourceReference: row.sourceReference,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    isLiked: Boolean(interaction.liked),
    isSaved: Boolean(interaction.saved),
  };
}

async function addInteractions(videos, userId) {
  if (!videos.length) return [];
  const ids = videos.map((video) => video.id);
  const [likes, bookmarks] = await Promise.all([
    AgriVideoLike.findAll({ where: { userId, videoId: { [Op.in]: ids } }, attributes: ['videoId'] }),
    AgriVideoBookmark.findAll({ where: { userId, videoId: { [Op.in]: ids } }, attributes: ['videoId'] }),
  ]);
  const liked = new Set(likes.map((item) => item.videoId));
  const saved = new Set(bookmarks.map((item) => item.videoId));
  return videos.map((video) => publicVideo(video, { liked: liked.has(video.id), saved: saved.has(video.id) }));
}

async function publishedVideo(id) {
  assertUuid(id);
  const video = await AgriVideo.findOne({ where: { id, status: 'approved' }, include: videoInclude() });
  if (!video) throw new HttpError(404, 'Video not found.');
  return video;
}

function listFilters(query) {
  const where = { status: 'approved' };
  if (query.language) where.language = language(query.language);
  if (query.cropId) where.cropId = String(query.cropId).slice(0, 80);
  if (query.category) return AgriVideoCategory.findOne({ where: { slug: String(query.category).slice(0, 80), isActive: true } })
    .then((category) => {
      if (!category) throw new HttpError(400, 'Choose an existing video category.');
      where.categoryId = category.id;
      return where;
    });
  return Promise.resolve(where);
}

async function searchVideos(query, userId, { limit: requestedLimit = 20, offset: requestedOffset = 0, order } = {}) {
  const where = await listFilters(query);
  if (query.q) {
    const term = String(query.q).trim().slice(0, 120);
    if (term) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${term}%` } },
        { description: { [Op.iLike]: `%${term}%` } },
        { creatorDisplayName: { [Op.iLike]: `%${term}%` } },
        { '$AgriVideoCategory.name$': { [Op.iLike]: `%${term}%` } },
        { '$Crop.name$': { [Op.iLike]: `%${term}%` } },
        sequelize.where(sequelize.cast(sequelize.col('AgriVideoCategory.translations'), 'text'), { [Op.iLike]: `%${term}%` }),
        sequelize.where(sequelize.cast(sequelize.col('Crop.translations'), 'text'), { [Op.iLike]: `%${term}%` }),
        sequelize.where(sequelize.cast(sequelize.col('AgriVideo.tags'), 'text'), { [Op.iLike]: `%${term}%` }),
      ];
    }
  }
  const limit = Math.max(1, Math.min(50, Number.parseInt(requestedLimit, 10) || 20));
  const offset = Math.max(0, Math.min(10000, Number.parseInt(requestedOffset, 10) || 0));
  const sort = order || query.sort;
  const orderBy = sort === 'popular' || sort === 'views'
    ? [['viewCount', 'DESC'], ['likeCount', 'DESC'], ['publishedAt', 'DESC']]
    : sort === 'likes'
      ? [['likeCount', 'DESC'], ['publishedAt', 'DESC']]
      : [['publishedAt', 'DESC']];
  const result = await AgriVideo.findAndCountAll({
    where, include: videoInclude(), distinct: true, order: orderBy, limit, offset,
  });
  return {
    items: await addInteractions(result.rows, userId),
    pagination: { offset, limit, total: result.count },
  };
}

router.get('/categories', asyncHandler(async (req, res) => {
  const categories = await AgriVideoCategory.findAll({ where: { isActive: true }, order: [['name', 'ASC']] });
  const counts = await AgriVideo.count({
    where: { status: 'approved' },
    attributes: ['categoryId'],
    group: ['categoryId'],
  });
  const countById = new Map(counts.map((row) => [row.categoryId, Number(row.count)]));
  return res.json({
    success: true,
    data: categories.map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      translations: item.translations,
      description: item.description,
      icon: item.icon,
      publishedVideoCount: countById.get(item.id) || 0,
    })),
  });
}));

router.get('/crops', requireCreator, asyncHandler(async (req, res) => {
  const crops = await Crop.findAll({
    where: { isActive: true },
    attributes: ['id', 'name', 'translations'],
    order: [['name', 'ASC']],
    limit: 200,
  });
  return res.json({ success: true, data: crops });
}));

router.get('/videos', requireFarmer, asyncHandler(async (req, res) => {
  const data = await searchVideos(req.query, req.user.id);
  return res.json({ success: true, data });
}));

router.get('/videos/:id', requireFarmer, asyncHandler(async (req, res) => {
  const video = await publishedVideo(req.params.id);
  const [item] = await addInteractions([video], req.user.id);
  const related = await AgriVideo.findAll({
    where: {
      status: 'approved',
      id: { [Op.ne]: video.id },
      [Op.or]: [
        { categoryId: video.categoryId },
        ...(video.cropId ? [{ cropId: video.cropId }] : []),
      ],
    },
    include: videoInclude(),
    order: [['viewCount', 'DESC'], ['publishedAt', 'DESC']],
    limit: 8,
  });
  return res.json({ success: true, data: { ...item, related: await addInteractions(related, req.user.id) } });
}));

router.get('/search', requireFarmer, asyncHandler(async (req, res) => {
  if (typeof req.query.q !== 'string' || req.query.q.trim().length < 2) throw new HttpError(400, 'Enter at least two characters to search.');
  const data = await searchVideos(req.query, req.user.id);
  return res.json({ success: true, data });
}));

router.get('/search/suggestions', requireFarmer, asyncHandler(async (req, res) => {
  const term = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  if (term.length < 2) return res.json({ success: true, data: [] });
  const rows = await AgriVideo.findAll({
    where: { status: 'approved', title: { [Op.iLike]: `%${term}%` } },
    attributes: ['id', 'title'],
    order: [['viewCount', 'DESC']],
    limit: 8,
  });
  return res.json({ success: true, data: rows });
}));

router.get('/trending-searches', requireFarmer, asyncHandler(async (req, res) => {
  const videos = await AgriVideo.findAll({
    where: { status: 'approved' },
    attributes: ['tags'],
    order: [['viewCount', 'DESC']],
    limit: 50,
  });
  const counts = new Map();
  videos.forEach(({ tags }) => (Array.isArray(tags) ? tags : []).forEach((tag) => {
    const key = String(tag).trim();
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }));
  const items = [...counts.entries()].sort((first, second) => second[1] - first[1]).slice(0, 10).map(([term, count]) => ({ term, count }));
  return res.json({ success: true, data: items });
}));

router.get('/trending', requireFarmer, asyncHandler(async (req, res) => {
  const data = await searchVideos(req.query, req.user.id, { limit: 20, order: 'popular' });
  return res.json({ success: true, data });
}));

router.get('/recommended', requireFarmer, asyncHandler(async (req, res) => {
  const viewed = await AgriVideoView.findAll({ where: { userId: req.user.id }, attributes: ['videoId'], order: [['createdAt', 'DESC']], limit: 40 });
  const saved = await AgriVideoBookmark.findAll({ where: { userId: req.user.id }, attributes: ['videoId'], order: [['createdAt', 'DESC']], limit: 40 });
  const seedIds = [...new Set([...viewed, ...saved].map((item) => item.videoId))];
  const history = seedIds.length ? await AgriVideo.findAll({
    where: { id: { [Op.in]: seedIds }, status: 'approved' },
    attributes: ['categoryId', 'cropId'],
  }) : [];
  const cropValues = Array.isArray(req.user.profile.currentCrops)
    ? req.user.profile.currentCrops
    : typeof req.user.profile.currentCrops === 'string' ? req.user.profile.currentCrops.split(',') : [];
  const cropRows = cropValues.length ? await Crop.findAll({ attributes: ['id', 'name', 'translations'] }) : [];
  const normalized = (value) => String(value).trim().toLocaleLowerCase();
  const cropIds = cropRows.filter((crop) => cropValues.some((value) => (
    normalized(value) === normalized(crop.id)
    || normalized(value) === normalized(crop.name)
    || Object.values(crop.translations || {}).some((name) => normalized(value) === normalized(name))
  ))).map((crop) => crop.id);
  const categoryIds = [...new Set(history.map((item) => item.categoryId))];
  const historyCropIds = history.map((item) => item.cropId).filter(Boolean);
  const relevantCropIds = [...new Set([...cropIds, ...historyCropIds])];
  const where = { status: 'approved' };
  const interestFilters = [
    ...(relevantCropIds.length ? [{ cropId: { [Op.in]: relevantCropIds } }] : []),
    ...(categoryIds.length ? [{ categoryId: { [Op.in]: categoryIds } }] : []),
  ];
  if (interestFilters.length) where[Op.or] = interestFilters;
  if (req.query.language) where.language = language(req.query.language);
  const rows = await AgriVideo.findAll({
    where, include: videoInclude(), order: [['isFeatured', 'DESC'], ['viewCount', 'DESC'], ['publishedAt', 'DESC']], limit: 20,
  });
  return res.json({ success: true, data: await addInteractions(rows, req.user.id) });
}));

router.post('/videos/:id/view', requireFarmer, asyncHandler(async (req, res) => {
  const video = await publishedVideo(req.params.id);
  const watchedDuration = Number(req.body.watchedDuration);
  if (!Number.isInteger(watchedDuration) || watchedDuration < 0 || watchedDuration > video.duration) {
    throw new HttpError(400, 'Provide the number of seconds watched (0 to the video duration).');
  }
  const threshold = Math.min(video.duration, Math.max(3, Math.ceil(video.duration * 0.25)));
  if (watchedDuration < threshold) return res.json({ success: true, data: { counted: false, viewCount: video.viewCount } });
  const transaction = await sequelize.transaction();
  try {
    const [, created] = await AgriVideoView.findOrCreate({
      where: { videoId: video.id, userId: req.user.id },
      defaults: { videoId: video.id, userId: req.user.id, watchedDuration },
      transaction,
    });
    if (created) await video.increment('viewCount', { by: 1, transaction });
    await transaction.commit();
    return res.json({ success: true, data: { counted: created, viewCount: video.viewCount + (created ? 1 : 0) } });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}));

router.post('/videos/:id/like', requireFarmer, asyncHandler(async (req, res) => {
  const video = await publishedVideo(req.params.id);
  const transaction = await sequelize.transaction();
  try {
    const [, created] = await AgriVideoLike.findOrCreate({
      where: { videoId: video.id, userId: req.user.id },
      defaults: { videoId: video.id, userId: req.user.id },
      transaction,
    });
    if (created) await video.increment('likeCount', { by: 1, transaction });
    await transaction.commit();
    return res.status(201).json({ success: true, data: { liked: true, likeCount: video.likeCount + (created ? 1 : 0) } });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}));

router.delete('/videos/:id/like', requireFarmer, asyncHandler(async (req, res) => {
  const video = await publishedVideo(req.params.id);
  const transaction = await sequelize.transaction();
  try {
    const removed = await AgriVideoLike.destroy({ where: { videoId: video.id, userId: req.user.id }, transaction });
    if (removed) await video.decrement('likeCount', { by: 1, transaction });
    await transaction.commit();
    return res.json({ success: true, data: { liked: false, likeCount: Math.max(0, video.likeCount - (removed ? 1 : 0)) } });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}));

router.post('/videos/:id/save', requireFarmer, asyncHandler(async (req, res) => {
  const video = await publishedVideo(req.params.id);
  await AgriVideoBookmark.findOrCreate({
    where: { videoId: video.id, userId: req.user.id },
    defaults: { videoId: video.id, userId: req.user.id },
  });
  return res.status(201).json({ success: true, message: 'Video saved.' });
}));

router.delete('/videos/:id/save', requireFarmer, asyncHandler(async (req, res) => {
  const video = await publishedVideo(req.params.id);
  await AgriVideoBookmark.destroy({ where: { videoId: video.id, userId: req.user.id } });
  return res.json({ success: true, message: 'Saved video removed.' });
}));

router.post('/videos/:id/share', requireFarmer, asyncHandler(async (req, res) => {
  const video = await publishedVideo(req.params.id);
  const origin = (process.env.FRONTEND_PUBLIC_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return res.json({ success: true, data: { url: `${origin}/farmer/agri-shorts/${video.id}` } });
}));

router.get('/saved', requireFarmer, asyncHandler(async (req, res) => {
  const bookmarks = await AgriVideoBookmark.findAll({
    where: { userId: req.user.id },
    include: [{ model: AgriVideo, where: { status: 'approved' }, include: videoInclude() }],
    order: [['createdAt', 'DESC']],
    limit: 100,
  });
  const videos = bookmarks.map((item) => item.AgriVideo).filter(Boolean);
  const data = await addInteractions(videos, req.user.id);
  return res.json({ success: true, data });
}));

router.get('/videos/:id/comments', requireFarmer, asyncHandler(async (req, res) => {
  await publishedVideo(req.params.id);
  const comments = await AgriVideoComment.findAll({
    where: { videoId: req.params.id, parentCommentId: null, status: 'published' },
    include: [{
      model: AgriVideoComment,
      as: 'replies',
      where: { status: 'published' },
      required: false,
      separate: true,
      order: [['createdAt', 'ASC']],
    }],
    order: [['createdAt', 'ASC']],
    limit: 100,
  });
  const commentIds = comments.flatMap((comment) => [comment.id, ...(comment.replies || []).map((reply) => reply.id)]);
  const userLikes = commentIds.length ? await AgriVideoCommentLike.findAll({
    where: { userId: req.user.id, commentId: { [Op.in]: commentIds } },
    attributes: ['commentId'],
  }) : [];
  const likedIds = new Set(userLikes.map((like) => like.commentId));
  const format = (comment) => ({
    id: comment.id,
    comment: comment.comment,
    createdAt: comment.createdAt,
    isMine: comment.userId === req.user.id,
    likeCount: comment.likeCount,
    isLiked: likedIds.has(comment.id),
    replies: (comment.replies || []).map((reply) => ({
      id: reply.id,
      comment: reply.comment,
      createdAt: reply.createdAt,
      isMine: reply.userId === req.user.id,
      likeCount: reply.likeCount,
      isLiked: likedIds.has(reply.id),
    })),
  });
  return res.json({ success: true, data: comments.map(format) });
}));

router.post('/videos/:id/comments', requireFarmer, commentLimiter, asyncHandler(async (req, res) => {
  const video = await publishedVideo(req.params.id);
  const comment = requiredText(req.body.comment, 'Comment', 1200);
  const item = await AgriVideoComment.create({ videoId: video.id, userId: req.user.id, comment, status: 'published' });
  return res.status(201).json({ success: true, data: { id: item.id, comment: item.comment, createdAt: item.createdAt, isMine: true, replies: [] } });
}));

router.post('/comments/:id/replies', requireFarmer, commentLimiter, asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const parent = await AgriVideoComment.findOne({ where: { id: req.params.id, parentCommentId: null, status: 'published' } });
  if (!parent) throw new HttpError(404, 'Comment not found.');
  await publishedVideo(parent.videoId);
  const comment = requiredText(req.body.comment, 'Reply', 1200);
  const reply = await AgriVideoComment.create({
    videoId: parent.videoId,
    userId: req.user.id,
    parentCommentId: parent.id,
    comment,
    status: 'published',
  });
  return res.status(201).json({ success: true, data: { id: reply.id, comment: reply.comment, createdAt: reply.createdAt, isMine: true, likeCount: 0, isLiked: false } });
}));

router.post('/comments/:id/like', requireFarmer, commentLimiter, asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const comment = await AgriVideoComment.findOne({ where: { id: req.params.id, status: 'published' } });
  if (!comment) throw new HttpError(404, 'Comment not found.');
  await publishedVideo(comment.videoId);
  const transaction = await sequelize.transaction();
  try {
    const [, created] = await AgriVideoCommentLike.findOrCreate({
      where: { commentId: comment.id, userId: req.user.id },
      defaults: { commentId: comment.id, userId: req.user.id },
      transaction,
    });
    if (created) await comment.increment('likeCount', { by: 1, transaction });
    await transaction.commit();
    return res.status(201).json({ success: true, data: { liked: true, likeCount: comment.likeCount + (created ? 1 : 0) } });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}));

router.delete('/comments/:id/like', requireFarmer, commentLimiter, asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const comment = await AgriVideoComment.findOne({ where: { id: req.params.id, status: 'published' } });
  if (!comment) throw new HttpError(404, 'Comment not found.');
  await publishedVideo(comment.videoId);
  const transaction = await sequelize.transaction();
  try {
    const removed = await AgriVideoCommentLike.destroy({ where: { commentId: comment.id, userId: req.user.id }, transaction });
    if (removed) await comment.decrement('likeCount', { by: 1, transaction });
    await transaction.commit();
    return res.json({ success: true, data: { liked: false, likeCount: Math.max(0, comment.likeCount - (removed ? 1 : 0)) } });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}));

router.delete('/comments/:id', requireFarmer, commentLimiter, asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const comment = await AgriVideoComment.findByPk(req.params.id);
  if (!comment) throw new HttpError(404, 'Comment not found.');
  if (comment.userId !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'You can delete only your own comment.');
  await comment.destroy();
  return res.json({ success: true, message: 'Comment deleted.' });
}));

router.post('/comments/:id/report', requireFarmer, commentLimiter, asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const comment = await AgriVideoComment.findOne({ where: { id: req.params.id, status: 'published' } });
  if (!comment) throw new HttpError(404, 'Comment not found.');
  await publishedVideo(comment.videoId);
  const reason = ['misinformation', 'unsafe_advice', 'spam', 'copyright', 'other'].includes(req.body.reason) ? req.body.reason : null;
  if (!reason) throw new HttpError(400, 'Choose a supported report reason.');
  const report = await AgriVideoReport.findOrCreate({
    where: { commentId: comment.id, reportedBy: req.user.id },
    defaults: { videoId: comment.videoId, commentId: comment.id, reportedBy: req.user.id, reason, description: optionalText(req.body.description, 'Description', 1000) },
  });
  return res.status(201).json({ success: true, message: report[1] ? 'Report submitted for review.' : 'You have already reported this comment.' });
}));

router.post('/videos/:id/report', requireFarmer, commentLimiter, asyncHandler(async (req, res) => {
  const video = await publishedVideo(req.params.id);
  const reason = ['misinformation', 'unsafe_advice', 'spam', 'copyright', 'other'].includes(req.body.reason) ? req.body.reason : null;
  if (!reason) throw new HttpError(400, 'Choose a supported report reason.');
  const [, created] = await AgriVideoReport.findOrCreate({
    where: { videoId: video.id, reportedBy: req.user.id },
    defaults: { videoId: video.id, reportedBy: req.user.id, reason, description: optionalText(req.body.description, 'Description', 1000) },
  });
  return res.status(201).json({ success: true, message: created ? 'Report submitted for review.' : 'You have already reported this video.' });
}));

router.get('/my-videos', requireCreator, asyncHandler(async (req, res) => {
  const videos = await AgriVideo.findAll({
    where: { creatorId: req.user.id },
    include: videoInclude(),
    order: [['createdAt', 'DESC']],
  });
  return res.json({ success: true, data: videos.map((video) => ({
    ...publicVideo(video),
    status: video.status,
    rejectionReason: video.rejectionReason,
  })) });
}));

router.get('/analytics', requireCreator, asyncHandler(async (req, res) => {
  const videos = await AgriVideo.findAll({
    where: { creatorId: req.user.id },
    attributes: ['id', 'title', 'status', 'viewCount', 'likeCount', 'createdAt', 'publishedAt'],
    order: [['createdAt', 'DESC']],
  });
  return res.json({
    success: true,
    data: {
      publishedVideos: videos.filter((video) => video.status === 'approved').length,
      totalViews: videos.reduce((total, video) => total + video.viewCount, 0),
      totalLikes: videos.reduce((total, video) => total + video.likeCount, 0),
      videos,
    },
  });
}));

router.post('/upload/signature', requireCreator, uploadLimiter, (req, res, next) => {
  try {
    return res.json({ success: true, data: createVideoUploadSignature(req.user.id) });
  } catch (error) {
    return next(error);
  }
});

router.post('/upload', requireCreator, uploadLimiter, asyncHandler(async (req, res) => {
  const title = requiredText(req.body.title, 'Title');
  const description = requiredText(req.body.description, 'Description', 5000);
  const category = await AgriVideoCategory.findOne({ where: { id: req.body.categoryId, isActive: true } });
  if (!category) throw new HttpError(400, 'Choose a video category.');
  const selectedLanguage = language(req.body.language);
  const cropId = optionalText(req.body.cropId, 'Crop ID', 80);
  if (cropId && !await Crop.findOne({ where: { id: cropId, isActive: true }, attributes: ['id'] })) {
    throw new HttpError(400, 'Choose a crop from the catalog or leave it blank.');
  }
  const tags = parseTags(req.body.tags);
  const captionsVtt = validateVtt(req.body.captionsVtt);
  const sourceReference = optionalText(req.body.sourceReference, 'Source/reference', 1000);
  const media = await verifyUploadedVideo(req.body.publicId, req.user.id);
  let video;
  try {
    video = await AgriVideo.create({
      creatorId: req.user.id,
      creatorDisplayName: req.user.profile.name || 'AGRISATHI Creator',
      title,
      description,
      videoUrl: media.secureUrl,
      cloudinaryPublicId: media.publicId,
      thumbnailUrl: media.thumbnailUrl,
      categoryId: category.id,
      cropId,
      language: selectedLanguage,
      duration: media.duration,
      tags,
      captionsVtt,
      sourceReference,
      status: 'pending',
    });
  } catch (error) {
    await deleteVideoAsset(media.publicId);
    throw error;
  }
  return res.status(201).json({
    success: true,
    data: { id: video.id, title: video.title, status: video.status, message: 'Video submitted for administrator review.' },
  });
}));

router.put('/videos/:id', requireCreator, asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const video = await AgriVideo.findOne({ where: { id: req.params.id, creatorId: req.user.id } });
  if (!video) throw new HttpError(404, 'Your video was not found.');
  if (video.status === 'approved') throw new HttpError(409, 'Published videos cannot be edited in place. Contact an administrator for a review.');
  const updates = {};
  if (req.body.title !== undefined) updates.title = requiredText(req.body.title, 'Title');
  if (req.body.description !== undefined) updates.description = requiredText(req.body.description, 'Description', 5000);
  if (req.body.language !== undefined) updates.language = language(req.body.language);
  if (req.body.tags !== undefined) updates.tags = parseTags(req.body.tags);
  if (req.body.captionsVtt !== undefined) updates.captionsVtt = validateVtt(req.body.captionsVtt);
  if (req.body.sourceReference !== undefined) updates.sourceReference = optionalText(req.body.sourceReference, 'Source/reference', 1000);
  if (req.body.categoryId !== undefined) {
    const category = await AgriVideoCategory.findOne({ where: { id: req.body.categoryId, isActive: true } });
    if (!category) throw new HttpError(400, 'Choose a video category.');
    updates.categoryId = category.id;
  }
  if (req.body.cropId !== undefined) {
    const cropId = optionalText(req.body.cropId, 'Crop ID', 80);
    if (cropId && !await Crop.findOne({ where: { id: cropId, isActive: true }, attributes: ['id'] })) throw new HttpError(400, 'Choose a crop from the catalog or leave it blank.');
    updates.cropId = cropId;
  }
  updates.status = 'pending';
  updates.rejectionReason = null;
  await video.update(updates);
  return res.json({ success: true, data: { id: video.id, status: video.status } });
}));

router.delete('/videos/:id', requireCreator, asyncHandler(async (req, res) => {
  assertUuid(req.params.id);
  const video = await AgriVideo.findOne({ where: { id: req.params.id, creatorId: req.user.id } });
  if (!video) throw new HttpError(404, 'Your video was not found.');
  await deleteVideoAsset(video.cloudinaryPublicId);
  await video.destroy();
  return res.json({ success: true, message: 'Video deleted.' });
}));

module.exports = router;
