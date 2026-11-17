const test = require('node:test');
const assert = require('node:assert/strict');
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'development';
if (!previousDatabaseUrl) process.env.DATABASE_URL = 'postgres://farmer:local-only@127.0.0.1:5432/agrisathi_test';
const app = require('../src/app');
if (!previousDatabaseUrl) delete process.env.DATABASE_URL;
if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = previousNodeEnv;

async function withServer(run) {
  const server = app.listen(0);
  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('Modules 2 through 5 protect account, farmer, assistant, and crop-doctor operations', async () => {
  await withServer(async (baseUrl) => {
    const requests = [
      fetch(`${baseUrl}/api/auth/me`),
      fetch(`${baseUrl}/api/farmers/profile`),
      fetch(`${baseUrl}/api/farmers/farms`, { method: 'POST' }),
      fetch(`${baseUrl}/api/assistant/languages`),
      fetch(`${baseUrl}/api/assistant/ask`, { method: 'POST' }),
      fetch(`${baseUrl}/api/crop-doctor/crops`),
      fetch(`${baseUrl}/api/crop-doctor/analyze`, { method: 'POST' }),
    ];
    const responses = await Promise.all(requests);
    assert.deepEqual(responses.map((response) => response.status), requests.map(() => 401));
  });
});

test('local Vite origins can make credentialed interaction-mode requests', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/interaction-mode`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://127.0.0.1:5173',
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  });
});
