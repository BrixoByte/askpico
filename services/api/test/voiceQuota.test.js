import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HEARTBEAT_SECONDS,
  dailyVoiceLimitSeconds,
  quotaFromRpc,
  voicePlan,
} from '../src/voiceQuotaPolicy.js';

test('guest plan gets 2 minutes (120 seconds) of voice', () => {
  assert.equal(dailyVoiceLimitSeconds('guest'), 120);
});

test('anonymous users are mapped to the guest plan, signed-in users keep theirs', () => {
  assert.equal(voicePlan({ is_anonymous: true }, 'monthly'), 'guest');
  assert.equal(voicePlan({ is_anonymous: false }, 'monthly'), 'monthly');
  assert.equal(voicePlan(null, 'free'), 'free');
});

test('free plan gets 30 minutes of voice per day', () => {
  assert.equal(dailyVoiceLimitSeconds('free'), 30 * 60);
});

test('weekly and monthly plans get 2 hours of voice per day', () => {
  assert.equal(dailyVoiceLimitSeconds('weekly'), 2 * 60 * 60);
  assert.equal(dailyVoiceLimitSeconds('monthly'), 2 * 60 * 60);
});

test('ultra plan has no daily voice limit', () => {
  assert.equal(dailyVoiceLimitSeconds('ultra'), null);
});

test('unknown plan falls back to the free limit', () => {
  assert.equal(dailyVoiceLimitSeconds('something-new'), 30 * 60);
  assert.equal(dailyVoiceLimitSeconds(undefined), 30 * 60);
});

test('heartbeat interval is 30 seconds', () => {
  assert.equal(HEARTBEAT_SECONDS, 30);
});

test('quotaFromRpc reports exhausted when the RPC says so', () => {
  const result = quotaFromRpc({ status: 'exhausted', used: 1800, allowed: 1800 });
  assert.equal(result.exhausted, true);
  assert.equal(result.remainingSeconds, 0);
});

test('quotaFromRpc reports remaining seconds for an allowed call', () => {
  const result = quotaFromRpc({ status: 'ok', used: 600, allowed: 2400, remaining: 1800 });
  assert.equal(result.exhausted, false);
  assert.equal(result.remainingSeconds, 1800);
  assert.equal(result.usedSeconds, 600);
});

test('quotaFromRpc treats unlimited plans as never exhausted', () => {
  const result = quotaFromRpc({ status: 'ok', used: 9000, allowed: null, remaining: null });
  assert.equal(result.exhausted, false);
  assert.equal(result.remainingSeconds, null);
});

test('quotaFromRpc treats a missing profile as exhausted (fail closed)', () => {
  const result = quotaFromRpc({ status: 'no_profile' });
  assert.equal(result.exhausted, true);
});
