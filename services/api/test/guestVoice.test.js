import { test } from 'node:test';
import assert from 'node:assert/strict';
import { debitGuestVoice } from '../src/guestVoice.js';
import {
  GUEST_VOICE_LIMIT_SECONDS,
  GUEST_VOICE_MAX_STEP_SECONDS,
  guestClaimSeconds,
  guestQuotaFromRpc,
  guestVoiceLimitBody,
  usesGuestVoiceTrial,
} from '../src/voiceQuotaPolicy.js';

// Fake guest_voice_debit RPC: keeps a per-user balance like the SQL function does (no clock logic here).
const fakeClient = (usedSeconds) => {
  const state = { used: usedSeconds, calls: [] };
  state.client = {
    rpc: async (name, args) => {
      state.calls.push({ name, args });
      const remaining = GUEST_VOICE_LIMIT_SECONDS - state.used;
      if (!args.p_touch && args.p_claimed <= 0) return { data: { status: 'ok', used: state.used, remaining }, error: null };
      if (state.used >= GUEST_VOICE_LIMIT_SECONDS) return { data: { status: 'exhausted', used: state.used, remaining: 0 }, error: null };
      const step = Math.min(args.p_claimed, args.p_max_step, remaining);
      state.used += step;
      return { data: { status: 'ok', used: state.used, remaining: remaining - step }, error: null };
    },
  };
  return state;
};

test('a guest under the 120 s lifetime limit is allowed and charged', async () => {
  const fake = fakeClient(60);
  const quota = await debitGuestVoice({ userId: 'g1', claimed: 30, touch: true, client: fake.client });
  assert.equal(quota.exhausted, false);
  assert.equal(quota.remainingSeconds, 30);
  assert.equal(fake.calls[0].name, 'guest_voice_debit');
  assert.equal(fake.calls[0].args.p_limit_seconds, 120);
  assert.equal(fake.calls[0].args.p_max_step, GUEST_VOICE_MAX_STEP_SECONDS);
});

test('a guest at or over the limit is rejected', async () => {
  const quota = await debitGuestVoice({ userId: 'g1', claimed: 30, touch: true, client: fakeClient(120).client });
  assert.equal(quota.exhausted, true);
  assert.equal(quota.remainingSeconds, 0);
  assert.equal(guestVoiceLimitBody().error, 'GUEST_VOICE_LIMIT');
});

test('a read-only balance check never charges', async () => {
  const fake = fakeClient(45);
  const quota = await debitGuestVoice({ userId: 'g1', claimed: 0, touch: false, client: fake.client });
  assert.equal(quota.remainingSeconds, 75);
  assert.equal(fake.used, 45);
});

test('an RPC error surfaces instead of allowing voice', async () => {
  const client = { rpc: async () => ({ data: null, error: { message: 'boom' } }) };
  await assert.rejects(debitGuestVoice({ userId: 'g1', claimed: 0, touch: true, client }), /guest voice check failed: boom/);
});

test('client claims are clamped to one heartbeat interval and never negative', () => {
  assert.equal(guestClaimSeconds(0, { seconds: 25 }), 0);
  assert.equal(guestClaimSeconds(30, { seconds: 25 }), 25);
  assert.equal(guestClaimSeconds(30, { seconds: 999 }), GUEST_VOICE_MAX_STEP_SECONDS);
  assert.equal(guestClaimSeconds(30, { seconds: -5 }), 0);
  assert.equal(guestClaimSeconds(30, { seconds: 'abc' }), 0);
  assert.equal(guestClaimSeconds(30, undefined), 0);
});

test('RPC rows map to the quota shape; anything but ok is exhausted', () => {
  assert.deepEqual(guestQuotaFromRpc({ status: 'ok', used: 10, remaining: 110 }), { exhausted: false, remainingSeconds: 110, usedSeconds: 10 });
  assert.equal(guestQuotaFromRpc({ status: 'exhausted', used: 120, remaining: 0 }).exhausted, true);
  assert.equal(guestQuotaFromRpc(null).exhausted, true);
});

test('only anonymous users use the guest trial; signed-in accounts never do', () => {
  assert.equal(usesGuestVoiceTrial({ is_anonymous: true }), true);
  assert.equal(usesGuestVoiceTrial({ is_anonymous: false }), false);
  assert.equal(usesGuestVoiceTrial(null), false);
});
