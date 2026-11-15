import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_MAX_MESSAGES,
  CHAT_MAX_MESSAGE_CHARS,
  DEV_CORS_ORIGINS,
  createLimiter,
  isSafeFileName,
  rateLimit,
  rejectIfLimited,
  resolveCorsOrigins,
  validateChatMessages,
} from '../src/security.js';

const fakeRes = () => {
  const res = {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return res;
};

test('chat messages: accepts a valid array', () => {
  assert.equal(validateChatMessages([{ role: 'user', content: 'hi' }]), null);
});

test('chat messages: rejects missing, empty, or non-array input', () => {
  assert.notEqual(validateChatMessages(undefined), null);
  assert.notEqual(validateChatMessages([]), null);
  assert.notEqual(validateChatMessages('hello'), null);
});

test('chat messages: rejects unknown roles and non-string content', () => {
  assert.notEqual(validateChatMessages([{ role: 'admin', content: 'x' }]), null);
  assert.notEqual(validateChatMessages([{ role: 'user', content: { a: 1 } }]), null);
  assert.notEqual(validateChatMessages([null]), null);
});

test('chat messages: enforces count and length caps', () => {
  const tooMany = Array.from({ length: CHAT_MAX_MESSAGES + 1 }, () => ({ role: 'user', content: 'x' }));
  assert.notEqual(validateChatMessages(tooMany), null);
  const tooLong = [{ role: 'user', content: 'x'.repeat(CHAT_MAX_MESSAGE_CHARS + 1) }];
  assert.notEqual(validateChatMessages(tooLong), null);
});

test('file names: accepts normal names', () => {
  assert.equal(isSafeFileName('report.pdf'), true);
  assert.equal(isSafeFileName('notes v2.docx'), true);
});

test('file names: rejects paths, control characters, and empty names', () => {
  assert.equal(isSafeFileName('../etc/passwd'), false);
  assert.equal(isSafeFileName('a\\b.txt'), false);
  assert.equal(isSafeFileName('bad\u0000.txt'), false);
  assert.equal(isSafeFileName('   '), false);
  assert.equal(isSafeFileName(42), false);
});

test('cors: explicit CORS_ORIGIN wins in every environment', () => {
  assert.deepEqual(
    resolveCorsOrigins({ corsOrigin: 'https://chat.askpico.app, https://auth.askpico.app', nodeEnv: 'production' }),
    ['https://chat.askpico.app', 'https://auth.askpico.app']
  );
});

test('cors: production without CORS_ORIGIN allows no origins (no localhost)', () => {
  assert.deepEqual(resolveCorsOrigins({ corsOrigin: undefined, nodeEnv: 'production' }), []);
});

test('cors: development without CORS_ORIGIN uses localhost dev origins', () => {
  assert.deepEqual(resolveCorsOrigins({ corsOrigin: '', nodeEnv: 'development' }), DEV_CORS_ORIGINS);
});

test('rate limit: allows up to max requests then returns 429 with Retry-After', () => {
  const limiter = rateLimit({ max: 2, windowMs: 60_000 });
  const req = { headers: {}, ip: '203.0.113.7' };
  let passed = 0;
  for (let i = 0; i < 3; i += 1) {
    const res = fakeRes();
    limiter(req, res, () => {
      passed += 1;
    });
    if (i === 2) {
      assert.equal(res.statusCode, 429);
      assert.ok(res.headers['Retry-After']);
    }
  }
  assert.equal(passed, 2);
});

test('rate limit: keyed limiter counts each key independently', () => {
  const limiter = createLimiter({ max: 1, windowMs: 60_000 });
  assert.equal(limiter.take('user:a').allowed, true);
  assert.equal(limiter.take('user:a').allowed, false);
  assert.equal(limiter.take('user:b').allowed, true);
});

test('rate limit: rejectIfLimited sends 429 and Retry-After for an over-limit key', () => {
  const limiter = createLimiter({ max: 1, windowMs: 60_000 });
  const first = fakeRes();
  assert.equal(rejectIfLimited(limiter, 'user:c', first), false);
  const second = fakeRes();
  assert.equal(rejectIfLimited(limiter, 'user:c', second), true);
  assert.equal(second.statusCode, 429);
  assert.ok(second.headers['Retry-After']);
});
