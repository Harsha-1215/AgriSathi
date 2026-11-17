const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { generateText } = require('../src/services/geminiService');
const { analyzeCropImage } = require('../src/services/geminiService');
const { transcribe, synthesize } = require('../src/services/speechService');

test('AI question answering fails clearly when Gemini is not configured', async () => {
  const previous = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    await assert.rejects(
      generateText({ question: 'How do I care for paddy?', language: 'en', profile: {}, history: [] }),
      (error) => error.status === 503 && /not configured/i.test(error.message)
    );
  } finally {
    if (previous !== undefined) process.env.GEMINI_API_KEY = previous;
  }
});

test('assistant keeps provider instructions separate and sends verified context without putting keys in URLs', async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const originalPost = axios.post;
  process.env.GEMINI_API_KEY = 'test-provider-key';
  let request;
  axios.post = async (...args) => {
    request = args;
    return { data: { candidates: [{ content: { parts: [{ text: 'Use the supplied crop guide.' }] } }] } };
  };
  try {
    const answer = await generateText({
      question: 'What should I do?',
      language: 'en',
      history: [{ role: 'user', message: 'Previous question' }],
      contextData: { verifiedKnowledge: [{ source: 'Test guide' }] },
    });
    assert.equal(answer, 'Use the supplied crop guide.');
    assert.equal(request[0].includes('?key='), false);
    assert.equal(request[2].headers['x-goog-api-key'], 'test-provider-key');
    assert.match(request[1].systemInstruction.parts[0].text, /untrusted data/i);
    assert.equal(request[1].contents.at(-1).parts[0].text.includes('Test guide'), true);
  } finally {
    axios.post = originalPost;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test('crop image assessments return explicit uncertainty and never expose confidence scores', async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const originalPost = axios.post;
  process.env.GEMINI_API_KEY = 'test-provider-key';
  axios.post = async () => ({
    data: {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              status: 'possible_issue',
              possibleConditions: [{ name: 'Possible leaf spot', description: 'A tentative visual comparison.' }],
              observedSymptoms: ['Small dark spots'],
              alternativeExplanations: ['Physical damage'],
              severity: 'low',
              explanation: 'A preliminary visual assessment.',
              recommendations: ['Ask a local agricultural expert to inspect the crop.'],
              confidenceScore: 0.99,
            }),
          }],
        },
      }],
    },
  });
  try {
    const assessment = await analyzeCropImage({
      imageBuffer: Buffer.from('image'),
      mimeType: 'image/png',
      cropName: 'Paddy',
      language: 'en',
      symptoms: 'spots on leaves',
      verifiedDiseaseKnowledge: [{ name: 'Reference disease', source: 'Verified guide' }],
    });
    assert.equal(assessment.analysisStatus, 'possible_issue');
    assert.equal(assessment.possibleDisease, 'Possible leaf spot');
    assert.equal(assessment.reportedSymptoms[0], 'spots on leaves');
    assert.equal(Object.prototype.hasOwnProperty.call(assessment, 'confidenceScore'), false);
    assert.match(assessment.limitations.join(' '), /preliminary/i);
  } finally {
    axios.post = originalPost;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test('server speech providers report unavailable instead of returning fabricated content', async () => {
  const previousSpeech = process.env.GOOGLE_SPEECH_API_KEY;
  const previousTts = process.env.GOOGLE_TTS_API_KEY;
  delete process.env.GOOGLE_SPEECH_API_KEY;
  delete process.env.GOOGLE_TTS_API_KEY;
  try {
    await assert.rejects(transcribe(Buffer.from('audio'), 'audio/webm', 'en'), (error) => error.status === 503);
    await assert.rejects(synthesize('Hello', 'en'), (error) => error.status === 503);
  } finally {
    if (previousSpeech !== undefined) process.env.GOOGLE_SPEECH_API_KEY = previousSpeech;
    if (previousTts !== undefined) process.env.GOOGLE_TTS_API_KEY = previousTts;
  }
});
