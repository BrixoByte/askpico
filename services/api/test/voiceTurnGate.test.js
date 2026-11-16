import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voiceTurnQuotaCheck } from '../src/voiceTurnGate.js';
import { GUEST_VOICE_MAX_STEP_SECONDS } from '../src/voiceQuotaPolicy.js';

// The gate shared by /api/chat and /api/agent/chat voice turns. Deps are faked:
// debitGuest = the lifetime trial RPC, debitDaily = the signed-in daily quota RPC.
const guestUser = { id: 'g1', is_anonymous: true };
const signedUser = { id: 'u1', is_anonymous: false };

const record = (impl) => {
  const calls = [];
  const fn = async (args) => {
    calls.push(args);
    return impl(args);
  };
  return { calls, fn };
};

test('a guest voice turn is charged against the lifetime trial and allowed under it', async () => {
  const debitGuest = record(() => ({ exhausted: false, chargedSeconds: 12 }));
  const debitDaily = record(() => ({ exhausted: false }));
  const result = await voiceTurnQuotaCheck({ user: guestUser, plan: null, debitGuest: debitGuest.fn, debitDaily: debitDaily.fn });
  assert.equal(result.blocked, false);
  assert.equal(result.chargedSeconds, 12);
  assert.equal(debitGuest.calls[0].claimed, GUEST_VOICE_MAX_STEP_SECONDS);
  assert.equal(debitDaily.calls.length, 0); // guests never touch the daily quota
});

test('a guest over the lifetime trial is blocked with GUEST_VOICE_LIMIT', async () => {
  const debitGuest = record(() => ({ exhausted: true, chargedSeconds: 0 }));
  const result = await voiceTurnQuotaCheck({ user: guestUser, plan: null, debitGuest: debitGuest.fn, debitDaily: async () => ({}) });
  assert.equal(result.blocked, true);
  assert.equal(result.status, 403);
  assert.equal(result.body.error, 'GUEST_VOICE_LIMIT');
});

test('a signed-in voice turn under the daily limit is allowed (read-only check)', async () => {
  const debitGuest = record(() => ({}));
  const debitDaily = record(() => ({ exhausted: false, remainingSeconds: 1700 }));
  const result = await voiceTurnQuotaCheck({ user: signedUser, plan: 'free', debitGuest: debitGuest.fn, debitDaily: debitDaily.fn });
  assert.equal(result.blocked, false);
  assert.equal(debitDaily.calls[0].increment, 0); // turns never bill; the heartbeat does
  assert.equal(debitGuest.calls.length, 0); // signed-in users never touch the guest trial
});

test('a signed-in voice turn at the daily limit is blocked with QUOTA_EXHAUSTED', async () => {
  const debitDaily = record(() => ({ exhausted: true, remainingSeconds: 0, usedSeconds: 1800 }));
  const result = await voiceTurnQuotaCheck({ user: signedUser, plan: 'free', debitGuest: async () => ({}), debitDaily: debitDaily.fn });
  assert.equal(result.blocked, true);
  assert.equal(result.status, 403);
  assert.equal(result.body.error, 'QUOTA_EXHAUSTED');
  assert.match(result.body.message, /Daily voice limit/);
});

test('a signed-in turn the next day (quota row reset by the RPC) is allowed again', async () => {
  // The SQL function rolls the counter at a new UTC day; the API only sees a fresh "ok" row.
  const debitDaily = record(() => ({ exhausted: false, remainingSeconds: 1800, usedSeconds: 0 }));
  const result = await voiceTurnQuotaCheck({ user: signedUser, plan: 'free', debitGuest: async () => ({}), debitDaily: debitDaily.fn });
  assert.equal(result.blocked, false);
});

test('an ultra plan (no daily limit) is never blocked by the turn gate', async () => {
  const debitDaily = record(() => ({ exhausted: false, remainingSeconds: null }));
  const result = await voiceTurnQuotaCheck({ user: signedUser, plan: 'ultra', debitGuest: async () => ({}), debitDaily: debitDaily.fn });
  assert.equal(result.blocked, false);
});
