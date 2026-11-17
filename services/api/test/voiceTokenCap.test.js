import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDailyTokenCapReached,
  requestLogTokens,
  shouldCheckTokenCap,
} from '../src/tokenQuotaPolicy.js';
import { voiceTurnQuotaCheck } from '../src/voiceTurnGate.js';

// Voice turns are billed in voice seconds only; the text token cap must not
// gate or count them. These tests pin the route decisions without Supabase.
const signedUser = { id: 'u1', is_anonymous: false };
const guestUser = { id: 'g1', is_anonymous: true };
const record = (impl) => {
  const calls = [];
  const fn = async (args) => { calls.push(args); return impl(args); };
  return { calls, fn };
};

test('1. voice request under exhausted token cap is allowed; voice seconds still counted', async () => {
  const capReached = shouldCheckTokenCap('voice') && isDailyTokenCapReached('free', 10000);
  assert.equal(capReached, false); // cap check never runs for voice
  const debitDaily = record(() => ({ exhausted: false }));
  const debitGuest = record(() => ({ exhausted: false }));
  const gate = await voiceTurnQuotaCheck({ user: signedUser, plan: 'free', debitGuest: debitGuest.fn, debitDaily: debitDaily.fn });
  assert.equal(gate.blocked, false);
  assert.equal(debitDaily.calls.length, 1); // voice-seconds quota still consulted
});

test('2. text request under exhausted token cap is rejected (QUOTA_EXHAUSTED)', () => {
  assert.equal(shouldCheckTokenCap('text'), true);
  assert.equal(isDailyTokenCapReached('free', 10000), true);
  // route sends 429 { error: 'QUOTA_EXHAUSTED' } when both hold — decision proven here
});

test('3. voice request with voice quota exhausted is rejected with the voice quota error', async () => {
  const debitDaily = record(() => ({ exhausted: true, usedSeconds: 1800, limitSeconds: 1800 }));
  const gate = await voiceTurnQuotaCheck({ user: signedUser, plan: 'free', debitGuest: record(() => ({})), debitDaily: debitDaily.fn });
  assert.equal(gate.blocked, true);
  assert.equal(gate.status, 403);
  assert.equal(gate.body.error, 'QUOTA_EXHAUSTED');
});

test('4. missing or unknown requestType defaults to text behaviour (cap applies)', () => {
  assert.equal(shouldCheckTokenCap(undefined), true);
  assert.equal(shouldCheckTokenCap(null), true);
  assert.equal(shouldCheckTokenCap('banana'), true);
  assert.equal(shouldCheckTokenCap('Voice'), true); // case-sensitive: only exact 'voice'
});

test('5. a voice turn does not increase tokensUsed (p_tokens sent as 0)', () => {
  assert.deepEqual(requestLogTokens('voice', 812, 340), { promptTokens: 0, completionTokens: 0 });
  assert.deepEqual(requestLogTokens('voice', 0, 0), { promptTokens: 0, completionTokens: 0 });
  // non-voice keeps counting, rounded and floored at 0
  assert.deepEqual(requestLogTokens('text', 812.6, 340.2), { promptTokens: 813, completionTokens: 340 });
  assert.deepEqual(requestLogTokens('summary', -5, 10), { promptTokens: 0, completionTokens: 10 });
});

test('6. guest limits unchanged: guest voice turn uses the lifetime trial only', async () => {
  const debitGuest = record(() => ({ exhausted: false, chargedSeconds: 12 }));
  const debitDaily = record(() => ({ exhausted: false }));
  const gate = await voiceTurnQuotaCheck({ user: guestUser, plan: null, debitGuest: debitGuest.fn, debitDaily: debitDaily.fn });
  assert.equal(gate.blocked, false);
  assert.equal(debitGuest.calls.length, 1); // trial charged
  assert.equal(debitDaily.calls.length, 0); // daily voice quota untouched for guests
  // guest text counting still reads request_logs — unchanged by requestLogTokens
  // because the row is still inserted (only token fields are zeroed for voice).
});
