const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth, requireFarmer, checkAccountStatus } = require('../middleware/auth');
const { audioUpload } = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const assertUuid = require('../utils/assertUuid');
const { AssistantConversation, AssistantMessage, UserPreference } = require('../models');
const { transcribe, synthesize, languageCodes } = require('../services/speechService');
const assistantService = require('../services/assistantService');
const voiceCommandService = require('../services/voiceCommandService');
const { detectAudioMime } = require('../utils/fileValidation');

const router = express.Router();
const languages = new Set(Object.keys(languageCodes));
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

router.use(requireAuth, requireFarmer, checkAccountStatus);

router.get('/settings', asyncHandler(async (req, res) => {
  const preference = await UserPreference.findByPk(req.user.id, { attributes: ['interactionMode'] });
  return res.json({
    success: true,
    data: {
      supportedLanguages: ['en', 'te', 'hi'],
      speechRecognitionAvailable: Boolean(process.env.GOOGLE_SPEECH_API_KEY),
      speechSynthesisAvailable: Boolean(process.env.GOOGLE_TTS_API_KEY),
      assistantAvailable: Boolean(process.env.GEMINI_API_KEY),
      interactionMode: preference?.interactionMode || 'normal',
    },
  });
}));

router.post('/speech-to-text', limiter, audioUpload, asyncHandler(async (req, res) => {
  const language = req.body.language || 'te';
  if (!languages.has(language)) throw new HttpError(400, 'Choose English, Telugu, or Hindi.');
  if (!req.file) throw new HttpError(400, 'Attach an audio recording to transcribe.');
  const mimeType = detectAudioMime(req.file.buffer);
  if (!mimeType) throw new HttpError(415, 'Use a supported WAV, MP3, OGG, or WebM audio recording.');
  const text = await transcribe(req.file.buffer, mimeType, language);
  return res.json({ success: true, data: { text, language } });
}));

router.post('/text-to-speech', limiter, asyncHandler(async (req, res) => {
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
  const language = req.body.language || 'te';
  if (!text || text.length > 3000) throw new HttpError(400, 'Text to speak must be between 1 and 3000 characters.');
  if (!languages.has(language)) throw new HttpError(400, 'Choose English, Telugu, or Hindi.');
  const audio = await synthesize(text, language);
  res.set('Content-Type', 'audio/mpeg');
  res.set('Cache-Control', 'no-store');
  return res.send(audio);
}));

router.post('/session', asyncHandler(async (req, res) => {
  const language = req.body.language || 'te';
  if (!languages.has(language)) throw new HttpError(400, 'Choose English, Telugu, or Hindi.');
  const title = typeof req.body.title === 'string' ? req.body.title.trim().slice(0, 180) : 'Voice conversation';
  const conversation = await AssistantConversation.create({
    userId: req.user.id,
    title: title || 'Voice conversation',
    language,
  });
  return res.status(201).json({ success: true, data: conversation });
}));

router.get('/session/:id', asyncHandler(async (req, res) => {
  const id = assertUuid(req.params.id);
  const conversation = await AssistantConversation.findOne({
    where: { id, userId: req.user.id },
  });
  if (!conversation) throw new HttpError(404, 'Voice conversation not found.');
  const messages = await AssistantMessage.findAll({
    where: { conversationId: id },
    order: [['createdAt', 'ASC']],
  });
  return res.json({ success: true, data: { ...conversation.toJSON(), messages } });
}));

router.post('/process-command', limiter, asyncHandler(async (req, res) => {
  const command = typeof req.body.command === 'string' ? req.body.command.trim() : '';
  const language = req.body.language || 'te';
  const conversationId = req.body.conversationId ? assertUuid(req.body.conversationId) : null;
  if (!command || command.length > 2000) throw new HttpError(400, 'Enter a command of 1 to 2000 characters.');
  if (!languages.has(language)) throw new HttpError(400, 'Choose English, Telugu, or Hindi.');
  const classified = voiceCommandService.classifyCommand(command);
  if (['general_question', 'livestock_search'].includes(classified.intent)) {
    const data = await assistantService.ask({
      user: req.user,
      question: command,
      language,
      conversationId,
    });
    return res.json({ success: true, data: { ...data, intent: classified.intent, entities: classified.entities } });
  }
  const result = await voiceCommandService.processCommand({ command, user: req.user, language, classified });
  const data = await assistantService.recordExchange({
    userId: req.user.id,
    question: command,
    answer: result.answer,
    language,
    conversationId,
  });
  return res.json({
    success: true,
    data: {
      ...data,
      intent: result.intent,
      entities: result.entities,
      results: result.results,
      requiresConfirmation: result.requiresConfirmation,
    },
  });
}));

module.exports = router;
