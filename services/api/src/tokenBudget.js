import { logger } from './logger.js';
import { quotaExhaustedBody } from './dailyCap.js';
import { dailyTokenLimit } from './tokenQuotaPolicy.js';

// Single enforcement point for the daily token cap. Every LLM or provider route
// reserves tokens before the call and settles them after it. The reservation is
// one atomic database statement (reserve_daily_tokens, migration 0019), so
// concurrent requests cannot all pass a cap they would together exceed.

// Fixed estimates for routes whose provider usage is not returned to the server.
export const ROUTE_TOKEN_ESTIMATE = 1200;
export const FOCUS_TOKEN_ESTIMATE = 1200;
export const VERIFY_OVERHEAD_TOKENS = 400;
// System prompt, persona and memory overhead for a specialist (agent) call.
export const AGENT_CHAT_OVERHEAD_TOKENS = 1200;

export const estimateTokens = (text) => Math.ceil((typeof text === 'string' ? text.length : 0) / 4);

// Reply budget reserved up front for a chat call. Reserving the full max completion
// (4096) made normal chats near the cap look over it. The real usage is settled after
// the call, so this only decides when a request is refused.
export const CHAT_RESERVE_COMPLETION_TOKENS = 1024;

export const chatReserveAmount = ({ promptTokens, maxTokens }) =>
  promptTokens + Math.min(Number.isInteger(maxTokens) && maxTokens > 0 ? maxTokens : CHAT_RESERVE_COMPLETION_TOKENS, CHAT_RESERVE_COMPLETION_TOKENS);

// Reserve `amount` tokens for `userId` on `plan`. Returns either
// { allowed: false, status: 429, body } (same body shape as before) or
// { allowed: true, reservationId, amount }.
export const reserveTokens = async ({ supabase, userId, plan, amount }) => {
  const limit = dailyTokenLimit(plan);
  const { data, error } = await supabase.rpc('reserve_daily_tokens', {
    p_user_id: userId,
    p_amount: amount,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) {
    return { allowed: false, status: 429, body: quotaExhaustedBody(plan, Number(row?.used ?? 0)) };
  }
  return { allowed: true, reservationId: row.reservation_id, amount };
};

// Reconcile a reservation to the real token count. actualTokens = 0 releases it.
// Never throws: a settle failure is logged and must not fail the user's reply.
export const settleTokens = async ({ supabase, reservation, actualTokens }) => {
  const { error } = await supabase.rpc('reconcile_daily_tokens', {
    p_reservation: reservation.reservationId,
    p_actual: Math.max(0, Math.round(actualTokens)),
  });
  if (error) logger.warn(`token reconcile failed: ${error.message}`);
};

// Returns settle(actual?) that runs at most once. Called without an argument it
// charges the full reservation: the conservative default for any path where the
// provider may have generated tokens (client abort, stream error, thrown error).
export const createSettler = ({ supabase, reservation }) => {
  let done = false;
  return (actualTokens) => {
    if (done) return Promise.resolve();
    done = true;
    return settleTokens({
      supabase,
      reservation,
      actualTokens: actualTokens === undefined ? reservation.amount : actualTokens,
    });
  };
};
