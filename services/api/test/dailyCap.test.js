import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkDailyCap, quotaCapBody } from '../src/dailyCap.js';

const deps = (plan, used, calls = []) => ({
  userId: 'u1',
  getPlan: async () => {
    calls.push('getPlan');
    return plan;
  },
  rollTokens: async () => {
    calls.push('rollTokens');
    return used;
  },
});

test('free user over the cap gets 429 QUOTA_EXHAUSTED with the same shape as /api/chat', async () => {
  const result = await checkDailyCap(deps('free', 10500));
  assert.equal(result.status, 429);
  assert.equal(result.body.error, 'QUOTA_EXHAUSTED');
  assert.equal(result.body.tokensUsed, 10500);
  assert.equal(result.body.tokenLimit, 10000);
});

test('free user is blocked exactly at the cap and allowed just below it', async () => {
  assert.equal(await checkDailyCap(deps('free', 9999)), null);
  assert.equal((await checkDailyCap(deps('free', 10000))).status, 429);
});

test('paid plans without a cap are never blocked by this check', async () => {
  assert.equal(await checkDailyCap(deps('monthly', 10_000_000)), null);
});

test('a blocked check only reads: it reads the plan and the counter once and writes nothing', async () => {
  const calls = [];
  await checkDailyCap(deps('free', 10500, calls));
  assert.deepEqual(calls, ['getPlan', 'rollTokens']);
});

test('a counter lookup failure throws so the route can fail closed', async () => {
  await assert.rejects(
    checkDailyCap({
      userId: 'u1',
      getPlan: async () => 'free',
      rollTokens: async () => {
        throw new Error('rpc down');
      },
    }),
    /rpc down/
  );
});

test('the three tool-path routes run the cap check before their first LLM call', () => {
  const src = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  const routes = [
    ['/api/agent/route', 'planDataTool('],
    ['/api/chat/verify', 'verifyReply('],
    ['/api/agent/chat', 'runSpecialist('],
  ];
  for (const [path, llmCall] of routes) {
    const start = src.indexOf(`app.post('${path}'`);
    assert.ok(start >= 0, `route ${path} exists`);
    const end = src.indexOf('\napp.', start + 10);
    const body = src.slice(start, end < 0 ? undefined : end);
    const guard = body.indexOf('checkDailyCap({');
    const llm = body.indexOf(llmCall);
    assert.ok(guard > 0, `${path} calls checkDailyCap`);
    assert.ok(llm > guard, `${path} checks the cap before ${llmCall}`);
  }
});

test('non-ledger cap bodies carry the QUOTA_EXHAUSTED code and keep their message', () => {
  const body = quotaCapBody('Daily token cap reached. Your quota resets at midnight UTC.', {
    tokensUsed: 5,
    tokenLimit: 3,
  });
  assert.equal(body.error, 'QUOTA_EXHAUSTED');
  assert.equal(body.message, 'Daily token cap reached. Your quota resets at midnight UTC.');
  assert.equal(body.tokensUsed, 5);
  assert.equal(body.tokenLimit, 3);
  assert.equal(quotaCapBody('Free guest limit reached for today. Sign in to keep chatting.').message,
    'Free guest limit reached for today. Sign in to keep chatting.');
});

test('every 429 cap response on /api/chat sends the QUOTA_EXHAUSTED code', () => {
  const src = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  const start = src.indexOf("app.post('/api/chat'");
  assert.ok(start >= 0, '/api/chat route exists');
  const end = src.indexOf('\napp.', start + 10);
  const body = src.slice(start, end < 0 ? undefined : end);
  const capMessages = [
    'Daily token cap reached. Your quota resets at midnight UTC.',
    'Free guest limit reached for today. Sign in to keep chatting.',
    'Daily request cap reached. Your quota resets at midnight UTC.',
  ];
  for (const message of capMessages) {
    const site = `res.status(429).json(quotaCapBody('${message}'`;
    assert.ok(body.includes(site), `cap response for "${message}" uses quotaCapBody`);
  }
});

test('the rate-limit 429 keeps LIMITED_MESSAGE and never carries QUOTA_EXHAUSTED', () => {
  const src = readFileSync(new URL('../src/security.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('QUOTA_EXHAUSTED'), 'security.js must not send the quota code');
  assert.ok(src.includes('res.status(429).json({ error: LIMITED_MESSAGE })'));
});
