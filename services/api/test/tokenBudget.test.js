import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSettler, reserveTokens, settleTokens } from '../src/tokenBudget.js';

// Fake of the reserve/reconcile RPCs. The reserve step is a synchronous
// check-and-add, mirroring the single UPDATE in migration 0019.
const fakeSupabase = (start = 0) => {
  const state = { used: start, calls: [], reservations: new Map(), nextId: 1 };
  state.supabase = {
    rpc: async (name, args) => {
      state.calls.push({ name, args });
      if (name === 'reserve_daily_tokens') {
        const amount = Math.max(args.p_amount ?? 0, 0);
        if (args.p_limit === null || state.used + amount <= args.p_limit) {
          state.used += amount;
          const id = `r${state.nextId++}`;
          state.reservations.set(id, amount);
          return { data: [{ allowed: true, used: state.used, reservation_id: id }], error: null };
        }
        return { data: [{ allowed: false, used: state.used, reservation_id: null }], error: null };
      }
      if (name === 'reconcile_daily_tokens') {
        const amount = state.reservations.get(args.p_reservation);
        if (amount === undefined) return { data: null, error: null };
        state.reservations.delete(args.p_reservation);
        state.used = Math.max(state.used + (Math.max(args.p_actual, 0) - amount), 0);
        return { data: null, error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    },
  };
  return state;
};

test('a refused reservation returns the QUOTA_EXHAUSTED 429 body used by the client', async () => {
  const s = fakeSupabase(9999);
  const result = await reserveTokens({ supabase: s.supabase, userId: 'u1', plan: 'free', amount: 500 });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 429);
  assert.equal(result.body.error, 'QUOTA_EXHAUSTED');
  assert.equal(result.body.tokensUsed, 9999);
  assert.equal(result.body.tokenLimit, 10000);
});

test('the free cap is passed to the database and paid plans pass no cap', async () => {
  const s = fakeSupabase(0);
  await reserveTokens({ supabase: s.supabase, userId: 'u1', plan: 'free', amount: 1 });
  await reserveTokens({ supabase: s.supabase, userId: 'u1', plan: 'monthly', amount: 1 });
  assert.equal(s.calls[0].args.p_limit, 10000);
  assert.equal(s.calls[1].args.p_limit, null);
});

test('an allowed reservation returns its id and amount', async () => {
  const s = fakeSupabase(0);
  const result = await reserveTokens({ supabase: s.supabase, userId: 'u1', plan: 'free', amount: 300 });
  assert.equal(result.allowed, true);
  assert.equal(result.amount, 300);
  assert.equal(typeof result.reservationId, 'string');
});

test('settling reconciles the reservation to the real count', async () => {
  const s = fakeSupabase(0);
  const reservation = await reserveTokens({ supabase: s.supabase, userId: 'u1', plan: 'free', amount: 1000 });
  await settleTokens({ supabase: s.supabase, reservation, actualTokens: 250.4 });
  assert.equal(s.used, 250);
  assert.equal(s.reservations.size, 0);
});

test('a failed provider call releases its whole reservation (settle with 0)', async () => {
  const s = fakeSupabase(0);
  const reservation = await reserveTokens({ supabase: s.supabase, userId: 'u1', plan: 'free', amount: 800 });
  const settle = createSettler({ supabase: s.supabase, reservation });
  await settle(0);
  assert.equal(s.used, 0);
});

test('a settle with no argument charges the full reservation (client abort or stream error)', async () => {
  const s = fakeSupabase(0);
  const reservation = await reserveTokens({ supabase: s.supabase, userId: 'u1', plan: 'free', amount: 800 });
  const settle = createSettler({ supabase: s.supabase, reservation });
  await settle();
  assert.equal(s.used, 800);
});

test('only the first settle for a reservation has an effect', async () => {
  const s = fakeSupabase(0);
  const reservation = await reserveTokens({ supabase: s.supabase, userId: 'u1', plan: 'free', amount: 800 });
  const settle = createSettler({ supabase: s.supabase, reservation });
  await settle(100);
  await settle();
  await settle(0);
  assert.equal(s.used, 100);
  assert.equal(s.calls.filter((c) => c.name === 'reconcile_daily_tokens').length, 1);
});

test('a settle failure is logged and never throws into the user request', async () => {
  const supabase = {
    rpc: async () => ({ data: null, error: { message: 'db down' } }),
  };
  await assert.doesNotReject(
    settleTokens({ supabase, reservation: { reservationId: 'r1', amount: 10 }, actualTokens: 5 })
  );
});

test('contract: 20 parallel requests at 9,000 used with 500 each allow exactly the 2 that fit', async () => {
  const s = fakeSupabase(9000);
  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      reserveTokens({ supabase: s.supabase, userId: 'u1', plan: 'free', amount: 500 })
    )
  );
  assert.equal(results.filter((r) => r.allowed).length, 2);
  assert.equal(s.used, 10000);
});

test('contract: a request over the cap is refused and writes nothing', async () => {
  const s = fakeSupabase(10000);
  const result = await reserveTokens({ supabase: s.supabase, userId: 'u1', plan: 'free', amount: 1 });
  assert.equal(result.allowed, false);
  assert.equal(s.used, 10000);
  assert.equal(s.reservations.size, 0);
});
