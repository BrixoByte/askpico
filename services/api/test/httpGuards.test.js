import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import { apiNotFound, requireJsonBody } from '../src/httpGuards.js';

// Mirrors the server wiring: guard before body parsing and auth, JSON 404 last.
const app = express();
app.disable('x-powered-by');
app.use('/api', requireJsonBody);
app.use(express.json({ limit: '2mb' }));
app.post('/api/memory', (_req, res) => res.status(401).json({ error: 'sign-in session is required' }));
app.get('/api/usage', (_req, res) => res.status(401).json({ error: 'sign-in session is required' }));
app.use('/api', apiNotFound);

let server;
let base;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('a text/plain body is refused with 415 before the sign-in check runs', async () => {
  const res = await fetch(`${base}/api/memory`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hello' });
  assert.equal(res.status, 415);
});

test('a JSON body still gets the sign-in check (auth enforcement is unchanged)', async () => {
  const res = await fetch(`${base}/api/memory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [] }),
  });
  assert.equal(res.status, 401);
});

test('a request with no body is not blocked by the content-type check', async () => {
  const res = await fetch(`${base}/api/usage`);
  assert.equal(res.status, 401);
});

test('an unknown API route returns a JSON 404 that does not echo the path', async () => {
  const res = await fetch(`${base}/api/does-not-exist-xyz`);
  assert.equal(res.status, 404);
  assert.match(res.headers.get('content-type'), /application\/json/);
  const text = await res.text();
  assert.deepEqual(JSON.parse(text), { error: 'Not found' });
  assert.equal(text.includes('does-not-exist'), false);
});

test('responses do not advertise the framework', async () => {
  const res = await fetch(`${base}/api/usage`);
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('server.js disables x-powered-by and mounts the JSON 404 before listen', () => {
  const src = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  assert.match(src, /app\.disable\('x-powered-by'\)/);
  const notFound = src.indexOf("app.use('/api', apiNotFound)");
  assert.ok(notFound > 0, 'JSON 404 is mounted');
  assert.ok(notFound < src.indexOf('app.listen('), 'JSON 404 is mounted before app.listen');
  assert.ok(src.indexOf("app.use('/api', requireJsonBody)") < src.indexOf('defaultJson(req, res, next)'), 'body type check runs before body parsing');
});
