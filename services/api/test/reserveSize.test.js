import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatReserveAmount, CHAT_RESERVE_COMPLETION_TOKENS } from '../src/tokenBudget.js';
import { reserveTokens } from '../src/tokenBudget.js';

const fakeSupabase = (used) => ({
  rpc: async (name, args) => {
    const amount = args.p_amount;
    if (used + amount <= args.p_limit) {
      used += amount;
      return { data: [{ allowed: true, used, reservation_id: 'r1' }], error: null };
    }
    return { data: [{ allowed: false, used, reservation_id: null }], error: null };
  },
});

test('reservation reserves only a small reply budget, not the full 4096 max completion', () => {
  assert.equal(CHAT_RESERVE_COMPLETION_TOKENS, 1024);
  assert.equal(chatReserveAmount({ promptTokens: 3000, maxTokens: 4096 }), 3000 + 1024);
  assert.equal(chatReserveAmount({ promptTokens: 3000 }), 3000 + 1024);
});

test('a normal chat at 5,655 used of 10,000 is allowed (no false daily-limit popup)', async () => {
  const amount = chatReserveAmount({ promptTokens: 1500, maxTokens: 4096 });
  const result = await reserveTokens({ supabase: fakeSupabase(5655), userId: 'u1', plan: 'free', amount });
  assert.equal(result.allowed, true);
});

test('the cap still refuses a request that would really exceed it', async () => {
  const amount = chatReserveAmount({ promptTokens: 3500 });
  const result = await reserveTokens({ supabase: fakeSupabase(9500), userId: 'u1', plan: 'free', amount });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 429);
});
