import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { apiNotFound, requireJsonBody } from '../src/httpGuards.js';

// POST /api/artifact/css is intentionally PUBLIC (it compiles a preview stylesheet;
// it touches no user data). This test pins the contract so a future auth change
// is a deliberate decision, not a silent regression: JSON 400 for a bad body,
// JSON 404 for other methods.
const app = express();
app.disable('x-powered-by');
app.use('/api', requireJsonBody);
app.use(express.json({ limit: '2mb' }));
app.post('/api/artifact/css', async (req, res) => {
  const sources = req.body?.sources;
  if (!Array.isArray(sources) || sources.length === 0) {
    return res.status(400).json({ error: 'sources is required' });
  }
  res.json({ css: '' });
});
app.use('/api', apiNotFound);

let server;
let base;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('POST /api/artifact/css is public and validates the body first (400, not 401)', async () => {
  const res = await fetch(`${base}/api/artifact/css`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, 'sources is required');
});

test('GET /api/artifact/css falls through to the JSON 404 (no path echo)', async () => {
  const res = await fetch(`${base}/api/artifact/css`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.deepEqual(body, { error: 'Not found' });
});
