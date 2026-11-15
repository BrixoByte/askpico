import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseMode,
  capModeForPlan,
  downgradeFrom,
  publicMode,
  modelsForMode,
  estimateComplexity,
  grantMode,
} from '../src/routing.js';

const originalEnv = { ...process.env };

beforeEach(() => {
  delete process.env.ROUTE_MODELS_QUICK;
  delete process.env.ROUTE_MODELS_SMART;
  delete process.env.ROUTE_MODELS_DEEP_FAST;
  delete process.env.ROUTE_MODELS_DEEP_PRO;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

const longDoc = 'Please analyse this document and write a detailed summary. '.repeat(20);

test('a short plain question auto-routes to quick', () => {
  assert.equal(chooseMode({ message: 'what is photosynthesis?' }), 'quick');
});

test('a long attached document auto-routes to deep_fast', () => {
  assert.equal(chooseMode({ message: longDoc, attachmentCount: 1 }), 'deep_fast');
});

test('a multi-file app request with a long message auto-routes to deep_pro', () => {
  const message = `Build a full app with multi-file structure. ${'x'.repeat(1600)}`;
  assert.equal(chooseMode({ message, attachmentCount: 1 }), 'deep_pro');
});

test('explicit quick and smart are honoured', () => {
  assert.equal(chooseMode({ requested: 'quick', message: longDoc }), 'quick');
  assert.equal(chooseMode({ requested: 'smart', message: 'hi' }), 'smart');
});

test('explicit deep picks deep_fast for simple tasks and deep_pro for complex ones', () => {
  assert.equal(chooseMode({ requested: 'deep', message: 'hi' }), 'deep_fast');
  assert.equal(chooseMode({ requested: 'deep', message: longDoc, attachmentCount: 2 }), 'deep_pro');
});

test('unknown requested value falls back to auto', () => {
  assert.equal(chooseMode({ requested: 'gpt-4', message: 'hi' }), 'quick');
});

test('voice turns never go above smart for latency', () => {
  assert.equal(chooseMode({ requestType: 'voice', requested: 'deep', message: 'hi' }), 'smart');
  assert.equal(chooseMode({ requestType: 'voice', message: longDoc, attachmentCount: 1 }), 'smart');
});

test('complexity score counts length, attachments and complex keywords', () => {
  assert.equal(estimateComplexity('hi'), 0);
  assert.equal(estimateComplexity('x'.repeat(500)), 1);
  assert.equal(estimateComplexity('x'.repeat(1600)), 2);
  assert.equal(estimateComplexity('hi', 1), 1);
  assert.equal(estimateComplexity('make a complete app'), 1);
});

test('free plan cannot reach deep_pro even when requested', () => {
  assert.equal(capModeForPlan('deep_pro', 'free'), 'deep_fast');
  assert.equal(capModeForPlan('deep_pro', 'monthly'), 'deep_pro');
  assert.equal(capModeForPlan('smart', 'free'), 'smart');
});

test('missing or unknown plan is treated as free', () => {
  assert.equal(capModeForPlan('deep_pro', undefined), 'deep_fast');
  assert.equal(capModeForPlan('deep_pro', 'enterprise'), 'deep_fast');
});

test('downgrade chain follows deep_pro -> deep_fast -> smart -> quick', () => {
  assert.equal(downgradeFrom('deep_pro'), 'deep_fast');
  assert.equal(downgradeFrom('deep_fast'), 'smart');
  assert.equal(downgradeFrom('smart'), 'quick');
  assert.equal(downgradeFrom('quick'), null);
});

test('public mode never exposes deep_fast or deep_pro separately', () => {
  assert.equal(publicMode('quick'), 'quick');
  assert.equal(publicMode('smart'), 'smart');
  assert.equal(publicMode('deep_fast'), 'deep');
  assert.equal(publicMode('deep_pro'), 'deep');
});

test('modelsForMode returns configured models and honours env overrides', () => {
  assert.ok(modelsForMode('quick').length > 0);
  process.env.ROUTE_MODELS_SMART = 'model-a, model-b';
  assert.deepEqual(modelsForMode('smart'), ['model-a', 'model-b']);
});

test('grantMode returns the requested mode when quota allows', async () => {
  const rpc = async () => ({ data: true, error: null });
  assert.equal(await grantMode({ rpc, userId: 'u1', plan: 'free', startMode: 'deep_pro' }), 'deep_fast');
});

test('grantMode downgrades step by step when quota is exhausted', async () => {
  const allowed = new Set(['smart']);
  const rpc = async (_name, args) => ({ data: allowed.has(args.p_mode), error: null });
  assert.equal(await grantMode({ rpc, userId: 'u1', plan: 'monthly', startMode: 'deep_pro' }), 'smart');
});

test('grantMode passes the plan limits and circuit breaker cap to the database', async () => {
  const calls = [];
  const rpc = async (name, args) => {
    calls.push({ name, args });
    return { data: true, error: null };
  };
  await grantMode({ rpc, userId: 'u1', plan: 'free', startMode: 'deep_fast' });
  assert.deepEqual(calls[0], {
    name: 'consume_routing_mode',
    args: { p_user_id: 'u1', p_mode: 'deep_fast', p_user_limit: 5, p_global_cap: 300 },
  });
});

test('grantMode throws when the database call fails', async () => {
  const rpc = async () => ({ data: null, error: { message: 'db down' } });
  await assert.rejects(grantMode({ rpc, userId: 'u1', plan: 'free', startMode: 'smart' }), /db down/);
});
