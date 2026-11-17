const axios = require('axios');
const HttpError = require('../utils/httpError');

const languageCodes = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' };

function getGoogleKey() {
  if (!process.env.GOOGLE_SPEECH_API_KEY) {
    throw new HttpError(503, 'Server speech recognition is not configured. You can use text input instead.');
  }
  return process.env.GOOGLE_SPEECH_API_KEY;
}

async function transcribe(buffer, mimeType, language) {
  const key = getGoogleKey();
  const encoding = {
    'audio/webm': 'WEBM_OPUS',
    'video/webm': 'WEBM_OPUS',
    'audio/ogg': 'OGG_OPUS',
    'audio/wav': 'LINEAR16',
    'audio/x-wav': 'LINEAR16',
    'audio/mpeg': 'MP3',
  }[mimeType];
  if (!encoding) throw new HttpError(415, 'Use a supported WAV, MP3, OGG, or WebM audio recording.');

  try {
    const response = await axios.post(
      'https://speech.googleapis.com/v1/speech:recognize',
      {
        config: { encoding, languageCode: languageCodes[language], enableAutomaticPunctuation: true },
        audio: { content: buffer.toString('base64') },
      },
      { timeout: 30000, headers: { 'x-goog-api-key': key } }
    );
    const text = response.data.results
      ? response.data.results.map((item) => item.alternatives && item.alternatives[0] && item.alternatives[0].transcript || '').join(' ').trim()
      : '';
    if (!text) throw new HttpError(422, 'No speech could be recognized. Please try again or type your question.');
    return text;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error.code === 'ECONNABORTED') throw new HttpError(504, 'Speech recognition timed out. Please try again.');
    if (error.response?.status === 429) throw new HttpError(503, 'Speech recognition is receiving too many requests. Please retry shortly.');
    throw new HttpError(502, 'Speech recognition is temporarily unavailable. You can use text input instead.');
  }
}

async function synthesize(text, language) {
  if (!process.env.GOOGLE_TTS_API_KEY) {
    throw new HttpError(503, 'Server speech playback is not configured. Use your device speech playback if available.');
  }
  try {
    const response = await axios.post(
      'https://texttospeech.googleapis.com/v1/text:synthesize',
      {
        input: { text },
        voice: { languageCode: languageCodes[language], ssmlGender: 'NEUTRAL' },
        audioConfig: { audioEncoding: 'MP3' },
      },
      { timeout: 30000, headers: { 'x-goog-api-key': process.env.GOOGLE_TTS_API_KEY } }
    );
    if (!response.data.audioContent) throw new HttpError(502, 'Speech playback could not be generated.');
    return Buffer.from(response.data.audioContent, 'base64');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error.code === 'ECONNABORTED') throw new HttpError(504, 'Speech playback timed out. Please retry.');
    if (error.response?.status === 429) throw new HttpError(503, 'Speech playback is receiving too many requests. Please retry shortly.');
    throw new HttpError(502, 'Speech playback is temporarily unavailable.');
  }
}

module.exports = { transcribe, synthesize, languageCodes };
