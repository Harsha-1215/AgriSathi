const test = require('node:test');
const assert = require('node:assert/strict');
const weather = require('../src/services/weatherService');
const HttpError = require('../src/utils/httpError');

test('weather coordinates are validated before provider requests', () => {
  assert.deepEqual(weather.coordinates('16.5', '80.6'), { latitude: 16.5, longitude: 80.6 });
  assert.throws(() => weather.coordinates('north', '80'), (error) => error instanceof HttpError && error.status === 400);
  assert.throws(() => weather.coordinates('91', '80'), (error) => error.status === 400);
});

test('farming reminders are derived only from supplied forecast conditions', () => {
  assert.deepEqual(weather.farmingAdvisories({
    current: { wind_speed_10m: 8, temperature_2m: 28 },
    daily: { precipitation_probability_max: [20], precipitation_sum: [0] },
  }), []);

  const reminders = weather.farmingAdvisories({
    current: { wind_speed_10m: 30, temperature_2m: 39 },
    daily: { precipitation_probability_max: [75], precipitation_sum: [2] },
  });
  assert.deepEqual(reminders.map((item) => item.type), ['rain', 'wind', 'heat']);
  assert.ok(reminders.every((item) => item.basedOn));
});

test('official alerts fail explicitly when no alert provider is configured', async () => {
  const previous = process.env.WEATHER_ALERTS_URL;
  delete process.env.WEATHER_ALERTS_URL;
  try {
    await assert.rejects(weather.fetchOfficialAlerts({ latitude: 16, longitude: 80 }), (error) => error.status === 503);
  } finally {
    if (previous !== undefined) process.env.WEATHER_ALERTS_URL = previous;
  }
});
