const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyCommand } = require('../src/services/voiceCommandService');

test('Telugu tractor requests extract service type and land area', () => {
  assert.deepEqual(classifyCommand('నాకు రెండు ఎకరాలకు ట్రాక్టర్ కావాలి.'), {
    intent: 'service_search',
    entities: { serviceCategory: 'Tractor rental', landArea: 2 },
  });
});

test('tractor booking requests stay confirmation-gated', () => {
  assert.equal(classifyCommand('Book a tractor for two acres tomorrow.').intent, 'service_booking');
});

test('voice search recognizes the existing service catalog', () => {
  assert.equal(classifyCommand('Find soil testing near me').entities.serviceCategory, 'Soil testing');
  assert.equal(classifyCommand('నాకు డ్రిప్ సేవలు కావాలి').entities.serviceCategory, 'Irrigation services');
  assert.equal(classifyCommand('Book veterinary services').intent, 'service_booking');
});

test('Telugu paddy sale requests create a draft instead of publishing a listing', () => {
  assert.deepEqual(classifyCommand('నా దగ్గర 20 క్వింటాళ్ల వరి ఉంది, అమ్మాలి.'), {
    intent: 'listing_draft',
    entities: { product: 'paddy', quantity: 20, unit: 'క్వింటాళ్ల' },
  });
});

test('paddy price and Hindi order-status requests map to read-only intents', () => {
  assert.equal(classifyCommand('వరి మార్కెట్ ధరలు చెప్పండి').intent, 'market_prices');
  assert.equal(classifyCommand('मेरे ऑर्डर की स्थिति बताओ').intent, 'order_status');
});
