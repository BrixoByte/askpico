import { test } from 'node:test';
import assert from 'node:assert/strict';
import { debitGuestVoice } from '../src/guestVoice.js';
import {
  GUEST_VOICE_LIMIT_SECONDS,
  guestClaimSeconds,
  guestDebitStep,
  guestQuotaFromRpc,
  guestVoiceLimitBody,
  usesGuestVoiceTrial,
} from '../src/voiceQuotaPolicy.js';

// Fake guest_voice_debit RPC implementing the Round 25 watermark semantics from
// migration 0013: last_touch_at is a "billed through" point that advances only by
// the charged seconds, so unbilled time stays claimable for later calls.
const fakeClient = (usedSeconds = 0) => {
  // A row that already has billed seconds has an established watermark (at t=0 here).
  const state = { used: usedSeconds, watermark: usedSeconds > 0 ? 0 : null, now: 0, calls: [] };
  state.advance = (seconds) => {
    state.now += seconds;
  };
  state.client = {
    rpc: async (name, args) => {
      state.calls.push({ name, args });
      const remaining = GUEST_VOICE_LIMIT_SECONDS - state.used;
      if (!args.p_touch && args.p_claimed <= 0) {
        return { data: { status: 'ok', used: state.used, remaining, charged: 0 }, error: null };
      }
      if (state.used >= GUEST_VOICE_LIMIT_SECONDS) {
        return { data: { status: 'exhausted', used: state.used, remaining: 0, charged: 0 }, error: null };
      }
      const anchor = state.watermark ?? state.now;
      const step = guestDebitStep({
        claimed: args.p_claimed,
        elapsedSeconds: state.now - anchor,
        usedSeconds: state.used,
        maxStep: args.p_max_step,
      }).charged;
      state.used += step;
      if (args.p_touch) state.watermark = anchor + step;
      return { data: { status: 'ok', used: state.used, remaining: GUEST_VOICE_LIMIT_SECONDS - state.used, charged: step }, error: null };
    },
  };
  return state;
};

test('a guest under the 120 s lifetime limit is allowed and charged', async () => {
  const fake = fakeClient(60);
  fake.advance(35);
  const quota = await debitGuestVoice({ userId: 'g1', claimed: 30, touch: true, client: fake.client });
  assert.equal(quota.exhausted, false);
  assert.equal(quota.remainingSeconds, 30);
  assert.equal(quota.chargedSeconds, 30);
  assert.equal(fake.calls[0].name, 'guest_voice_debit');
  assert.equal(fake.calls[0].args.p_limit_seconds, 120);
  assert.equal(fake.calls[0].args.p_max_step, GUEST_VOICE_LIMIT_SECONDS);
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

test('client claims are clamped to the trial limit and never negative', () => {
  assert.equal(guestClaimSeconds(0, { seconds: 25 }), 0);
  assert.equal(guestClaimSeconds(30, { seconds: 25 }), 25);
  assert.equal(guestClaimSeconds(30, { seconds: 999 }), GUEST_VOICE_LIMIT_SECONDS);
  assert.equal(guestClaimSeconds(30, { seconds: -5 }), 0);
  assert.equal(guestClaimSeconds(30, { seconds: 'abc' }), 0);
  assert.equal(guestClaimSeconds(30, undefined), 0);
});

test('RPC rows map to the quota shape; anything but ok is exhausted', () => {
  assert.deepEqual(guestQuotaFromRpc({ status: 'ok', used: 10, remaining: 110, charged: 10 }), {
    exhausted: false,
    remainingSeconds: 110,
    usedSeconds: 10,
    chargedSeconds: 10,
  });
  assert.equal(guestQuotaFromRpc({ status: 'exhausted', used: 120, remaining: 0 }).exhausted, true);
  assert.equal(guestQuotaFromRpc(null).exhausted, true);
});

test('only anonymous users use the guest trial; signed-in accounts never do', () => {
  assert.equal(usesGuestVoiceTrial({ is_anonymous: true }), true);
  assert.equal(usesGuestVoiceTrial({ is_anonymous: false }), false);
  assert.equal(usesGuestVoiceTrial(null), false);
});

// --- Round 25 regression tests: the missed-heartbeat billing bug ---
// Round 24 observed a first session billed 6 s for ~35 s of voice: one heartbeat
// request never landed, its locally-claimed seconds were never billed, and the old
// SQL discarded the unbilled gap on the next touch. The watermark keeps that gap.

test('a dropped heartbeat is fully billed by the next claim (the 6 s for 35 s bug)', async () => {
  const fake = fakeClient();
  // Session start at t=0 establishes the watermark.
  const start = await debitGuestVoice({ userId: 'g1', claimed: 0, touch: true, client: fake.client });
  assert.equal(start.chargedSeconds, 0);
  // t=30 heartbeat would claim 29-30 s but never reaches the server (dropped request —
  // no rpc call happens at all). The client refunds the claim locally.
  fake.advance(35);
  // The next successful call claims the whole unbilled stretch and is charged for it.
  const flush = await debitGuestVoice({ userId: 'g1', claimed: 35, touch: true, client: fake.client });
  assert.equal(flush.chargedSeconds, 35);
  assert.equal(fake.used, 35);
});

test('first session and later sessions bill the same for the same wall-clock time', async () => {
  const bill = async (advanceBeforeStart) => {
    const fake = fakeClient();
    if (advanceBeforeStart) fake.advance(advanceBeforeStart);
    await debitGuestVoice({ userId: 'g1', claimed: 0, touch: true, client: fake.client });
    fake.advance(30);
    const beat = await debitGuestVoice({ userId: 'g1', claimed: 30, touch: true, client: fake.client });
    return beat.chargedSeconds;
  };
  assert.equal(await bill(0), 30);
  assert.equal(await bill(3600), 30); // a re-opened session is not cold-start special
});

test('a re-opened session (second session-start) does not discard unbilled time', async () => {
  const fake = fakeClient();
  await debitGuestVoice({ userId: 'g1', claimed: 0, touch: true, client: fake.client });
  fake.advance(60); // voice ran 60 s, heartbeats were all dropped
  // App relaunch calls session-start again: it charges nothing and must NOT move the
  // watermark, so the following claim can still bill the 60 s the client reports.
  const restart = await debitGuestVoice({ userId: 'g1', claimed: 0, touch: true, client: fake.client });
  assert.equal(restart.chargedSeconds, 0);
  const claim = await debitGuestVoice({ userId: 'g1', claimed: 60, touch: true, client: fake.client });
  assert.equal(claim.chargedSeconds, 60);
  assert.equal(fake.used, 60);
});

test('an abrupt disconnect without an end event never over-bills', async () => {
  const fake = fakeClient();
  await debitGuestVoice({ userId: 'g1', claimed: 0, touch: true, client: fake.client });
  fake.advance(35);
  // The app was killed before any claim landed: nothing is billed (conservative),
  // and the unbilled window stays open for the next session's claims.
  assert.equal(fake.used, 0);
  fake.advance(3600);
  const next = await debitGuestVoice({ userId: 'g1', claimed: 20, touch: true, client: fake.client });
  assert.equal(next.chargedSeconds, 20); // client claims bound the charge; elapsed only caps it
});

test('a claim larger than the real elapsed time cannot over-bill', async () => {
  const fake = fakeClient();
  await debitGuestVoice({ userId: 'g1', claimed: 0, touch: true, client: fake.client });
  fake.advance(5);
  const quota = await debitGuestVoice({ userId: 'g1', claimed: GUEST_VOICE_LIMIT_SECONDS, touch: true, client: fake.client });
  assert.equal(quota.chargedSeconds, 5);
});

// guestDebitStep is the executable spec of the SQL math; keep it aligned with 0013.
test('guestDebitStep mirrors the SQL watermark math', () => {
  assert.deepEqual(guestDebitStep({ claimed: 30, elapsedSeconds: 35, usedSeconds: 0 }), {
    status: 'ok',
    charged: 30,
    used: 30,
    remaining: 90,
  });
  assert.equal(guestDebitStep({ claimed: 200, elapsedSeconds: 10, usedSeconds: 0 }).charged, 10);
  assert.equal(guestDebitStep({ claimed: 200, elapsedSeconds: 200, usedSeconds: 100 }).charged, 20);
  assert.equal(guestDebitStep({ claimed: 30, elapsedSeconds: 35, usedSeconds: 120 }).status, 'exhausted');
});
