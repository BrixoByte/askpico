import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithFallback, sanitizeCompletion, PUBLIC_MODEL_NAME, isFallbackStatus } from '../src/llmClient.js';

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENROUTER_API_KEY;

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const scripted = (responses) => {
  const calls = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body.model);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return calls;
};

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = 'test-key';
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.OPENROUTER_API_KEY = originalKey;
});

test('429 and 5xx responses are fallback-eligible, other 4xx are not', () => {
  assert.equal(isFallbackStatus(429), true);
  assert.equal(isFallbackStatus(503), true);
  assert.equal(isFallbackStatus(500), true);
  assert.equal(isFallbackStatus(400), false);
  assert.equal(isFallbackStatus(401), false);
});

test('falls back to the next model on 429', async () => {
  const calls = scripted([jsonResponse(429, { error: 'busy' }), jsonResponse(200, { choices: [] })]);
  const result = await fetchWithFallback(['model-a', 'model-b'], { messages: [] }, undefined, 'req1');
  assert.deepEqual(calls, ['model-a', 'model-b']);
  assert.equal(result.upstream.status, 200);
});

test('falls back to the next model on a 5xx response', async () => {
  const calls = scripted([jsonResponse(502, {}), jsonResponse(200, {})]);
  const result = await fetchWithFallback(['model-a', 'model-b'], { messages: [] }, undefined, 'req2');
  assert.deepEqual(calls, ['model-a', 'model-b']);
  assert.equal(result.upstream.status, 200);
});

test('falls back when the attempt times out or the network fails', async () => {
  const calls = scripted([new Error('timeout'), jsonResponse(200, {})]);
  const result = await fetchWithFallback(['model-a', 'model-b'], { messages: [] }, undefined, 'req3');
  assert.deepEqual(calls, ['model-a', 'model-b']);
  assert.equal(result.upstream.status, 200);
});

test('a non-fallback 400 is returned immediately without trying other models', async () => {
  const calls = scripted([jsonResponse(400, { error: 'bad' })]);
  const result = await fetchWithFallback(['model-a', 'model-b'], { messages: [] }, undefined, 'req4');
  assert.deepEqual(calls, ['model-a']);
  assert.equal(result.upstream.status, 400);
});

test('when every model is busy the result carries the last status and no upstream body', async () => {
  scripted([jsonResponse(429, {}), jsonResponse(503, {})]);
  const result = await fetchWithFallback(['model-a', 'model-b'], { messages: [] }, undefined, 'req5');
  assert.equal(result.upstream, null);
  assert.equal(result.status, 503);
});

test('completion responses expose only the public model name', () => {
  const clean = sanitizeCompletion({ id: 'x', model: 'openai/gpt-oss-20b', choices: [] });
  assert.equal(clean.model, PUBLIC_MODEL_NAME);
  assert.equal(JSON.stringify(clean).includes('gpt-oss'), false);
});
