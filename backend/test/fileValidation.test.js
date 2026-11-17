const test = require('node:test');
const assert = require('node:assert/strict');
const { detectImageMime, detectAudioMime } = require('../src/utils/fileValidation');

test('image uploads are identified from file signatures rather than the browser MIME value', () => {
  assert.equal(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])), 'image/jpeg');
  assert.equal(detectImageMime(Buffer.from('<svg></svg>')), null);
  assert.equal(detectImageMime(Buffer.from('not an image')), null);
});

test('audio uploads accept supported media signatures only', () => {
  assert.equal(detectAudioMime(Buffer.from('OggS' + '00000000')), 'audio/ogg');
  assert.equal(detectAudioMime(Buffer.from('RIFF0000WAVE' + '00000000')), 'audio/wav');
  assert.equal(detectAudioMime(Buffer.from('random audio data')), null);
});
