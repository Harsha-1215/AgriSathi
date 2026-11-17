const express = require('express');
const { Op } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { requireAuth, requireFarmer, checkAccountStatus } = require('../middleware/auth');
const { audioUpload } = require('../middleware/upload');
const { AssistantConversation, AssistantMessage, AssistantFeedback } = require('../models');
const { transcribe, synthesize, languageCodes } = require('../services/speechService');
const assistantService = require('../services/assistantService');
const { detectAudioMime } = require('../utils/fileValidation');
const assertUuid = require('../utils/assertUuid');

const router = express.Router();
const languageNames = { en: 'English', te: 'Telugu', hi: 'Hindi' };
const askLimiter = require('express-rate-limit')({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
const speechLimiter = require('express-rate-limit')({
  windowMs: 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

router.use(requireAuth, requireFarmer, checkAccountStatus);

router.get('/languages', (req, res) => {
  res.json({
    success: true,
    data: Object.entries(languageNames).map(([code, name]) => ({
      code,
      name,
      speechRecognitionSupport: Boolean(process.env.GOOGLE_SPEECH_API_KEY),
      speechSynthesisSupport: Boolean(process.env.GOOGLE_TTS_API_KEY),
      textResponseSupport: Boolean(process.env.GEMINI_API_KEY),
    })),
  });
});

router.get('/settings', (req, res) => {
  res.json({
    success: true,
    data: {
      supportedLanguages: Object.keys(languageNames),
      speechRecognitionProvider: process.env.GOOGLE_SPEECH_API_KEY ? 'google-cloud-speech' : 'unavailable',
      textToSpeechProvider: process.env.GOOGLE_TTS_API_KEY ? 'google-cloud-tts' : 'unavailable',
      aiAvailable: Boolean(process.env.GEMINI_API_KEY),
    },
  });
});

router.post('/ask', askLimiter, asyncHandler(async (req, res) => {
  const question = typeof req.body.message === 'string'
    ? req.body.message.trim()
    : typeof req.body.question === 'string' ? req.body.question.trim() : '';
  const language = req.body.language || 'en';
  const conversationId = req.body.conversationId ? assertUuid(req.body.conversationId) : null;
  if (!question || question.length > 2000) throw new HttpError(400, 'Enter a question of 1 to 2000 characters.');
  if (!Object.prototype.hasOwnProperty.call(languageNames, language)) throw new HttpError(400, 'Choose English, Telugu, or Hindi.');
  const context = req.body.context === undefined ? {} : req.body.context;
  if (!context || typeof context !== 'object' || Array.isArray(context)) throw new HttpError(400, 'Context must be an object.');
  const data = await assistantService.ask({ user: req.user, question, language, context, conversationId });
  return res.json({ success: true, data });
}));

router.post('/transcribe', speechLimiter, audioUpload, asyncHandler(async (req, res) => {
  const language = req.body.language || 'en';
  if (!Object.prototype.hasOwnProperty.call(languageNames, language)) throw new HttpError(400, 'Choose English, Telugu, or Hindi.');
  if (!req.file) throw new HttpError(400, 'Attach an audio recording to transcribe.');
  const allowed = ['audio/webm', 'video/webm', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mpeg'];
  const mimeType = detectAudioMime(req.file.buffer);
  if (!mimeType || !allowed.includes(mimeType)) {
    throw new HttpError(415, 'Use a supported WAV, MP3, OGG, or WebM audio recording.');
  }
  const text = await transcribe(req.file.buffer, mimeType, language);
  return res.json({ success: true, data: { text, language } });
}));

router.post('/speech', speechLimiter, asyncHandler(async (req, res) => {
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
  const language = req.body.language || 'en';
  if (!text || text.length > 3000) throw new HttpError(400, 'Text to speak must be between 1 and 3000 characters.');
  if (!Object.prototype.hasOwnProperty.call(languageCodes, language)) throw new HttpError(400, 'Choose English, Telugu, or Hindi.');
  const audio = await synthesize(text, language);
  res.set('Content-Type', 'audio/mpeg');
  res.set('Cache-Control', 'no-store');
  return res.send(audio);
}));

router.post('/conversations', asyncHandler(async (req, res) => {
  const language = req.body.language || 'en';
  if (!Object.prototype.hasOwnProperty.call(languageNames, language)) throw new HttpError(400, 'Choose English, Telugu, or Hindi.');
  const title = typeof req.body.title === 'string' ? req.body.title.trim().slice(0, 180) : 'New conversation';
  const conversation = await AssistantConversation.create({ userId: req.user.id, title: title || 'New conversation', language });
  return res.status(201).json({ success: true, data: conversation });
}));

router.get('/conversations', asyncHandler(async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  const page = Math.max(1, Math.min(1000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 20));
  const where = { userId: req.user.id };
  if (query) {
    const matches = await AssistantMessage.findAll({
      attributes: ['conversationId'],
      where: { message: { [Op.iLike]: `%${query}%` } },
      include: [{
        model: AssistantConversation,
        attributes: [],
        where: { userId: req.user.id },
        required: true,
      }],
      group: ['conversationId'],
      raw: true,
    });
    where[Op.or] = [
      { title: { [Op.iLike]: `%${query}%` } },
      { id: { [Op.in]: matches.map((item) => item.conversationId) } },
    ];
  }
  const result = await AssistantConversation.findAndCountAll({
    where,
    order: [['updatedAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });
  return res.json({
    success: true,
    data: {
      items: result.rows,
      page,
      limit,
      total: result.count,
    },
  });
}));

router.get('/conversations/:id', asyncHandler(async (req, res) => {
  const id = assertUuid(req.params.id);
  const conversation = await AssistantConversation.findOne({
    where: { id, userId: req.user.id },
  });
  if (!conversation) throw new HttpError(404, 'Conversation not found.');
  return res.json({ success: true, data: conversation });
}));

router.get('/conversations/:id/messages', asyncHandler(async (req, res) => {
  const id = assertUuid(req.params.id);
  const conversation = await AssistantConversation.findOne({ where: { id, userId: req.user.id }, attributes: ['id'] });
  if (!conversation) throw new HttpError(404, 'Conversation not found.');
  const page = Math.max(1, Math.min(1000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 30));
  const result = await AssistantMessage.findAndCountAll({
    where: { conversationId: id },
    order: [['createdAt', 'ASC']],
    limit,
    offset: (page - 1) * limit,
  });
  return res.json({ success: true, data: { items: result.rows, page, limit, total: result.count } });
}));

router.post('/conversations/:id/messages', askLimiter, asyncHandler(async (req, res) => {
  const id = assertUuid(req.params.id);
  const question = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  if (!question || question.length > 2000) throw new HttpError(400, 'Enter a message of 1 to 2000 characters.');
  const conversation = await AssistantConversation.findOne({ where: { id, userId: req.user.id } });
  if (!conversation) throw new HttpError(404, 'Conversation not found.');
  const language = req.body.language || conversation.language;
  if (!Object.prototype.hasOwnProperty.call(languageNames, language)) throw new HttpError(400, 'Choose English, Telugu, or Hindi.');
  const context = req.body.context === undefined ? {} : req.body.context;
  if (!context || typeof context !== 'object' || Array.isArray(context)) throw new HttpError(400, 'Context must be an object.');
  const data = await assistantService.ask({ user: req.user, question, language, context, conversationId: id });
  return res.json({ success: true, data });
}));

router.delete('/conversations/:id', asyncHandler(async (req, res) => {
  const id = assertUuid(req.params.id);
  const deleted = await AssistantConversation.destroy({ where: { id, userId: req.user.id } });
  if (!deleted) throw new HttpError(404, 'Conversation not found.');
  return res.json({ success: true, message: 'Conversation deleted.' });
}));

router.post('/conversations/:conversationId/messages/:messageId/feedback', asyncHandler(async (req, res) => {
  const conversationId = assertUuid(req.params.conversationId);
  const messageId = assertUuid(req.params.messageId);
  const rating = req.body.rating;
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : null;
  if (!['helpful', 'not_helpful'].includes(rating)) throw new HttpError(400, 'Feedback must be marked helpful or not helpful.');
  if (comment && comment.length > 1000) throw new HttpError(400, 'Feedback comments are limited to 1000 characters.');
  const message = await AssistantMessage.findOne({
    where: { id: messageId, conversationId },
    include: [{ model: AssistantConversation, where: { userId: req.user.id }, attributes: ['id'] }],
  });
  if (!message) throw new HttpError(404, 'Message not found.');
  const [feedback] = await AssistantFeedback.upsert({
    userId: req.user.id,
    messageId: message.id,
    rating,
    comment: comment || null,
  }, { returning: true });
  return res.json({ success: true, data: feedback });
}));

module.exports = router;
