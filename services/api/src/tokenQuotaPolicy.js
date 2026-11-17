// Daily text-token policy. Pure functions only, so tests run without Supabase.
// Counting and reset happen in roll_daily_tokens() and log_request() (migration 0009).

// null means no daily token cap.
const DAILY_TOKENS = {
  free: 10000,
  weekly: null,
  monthly: null,
};

// Unknown plans get the free cap so a new plan name never gets unlimited tokens by accident.
export const dailyTokenLimit = (plan) =>
  Object.hasOwn(DAILY_TOKENS, plan) ? DAILY_TOKENS[plan] : DAILY_TOKENS.free;

export const isDailyTokenCapReached = (plan, tokensUsedToday) => {
  const limit = dailyTokenLimit(plan);
  return limit !== null && tokensUsedToday >= limit;
};

// Voice turns are billed in voice seconds, not text tokens. Only an explicit
// requestType of 'voice' skips the token cap — anything missing or unknown
// keeps text behaviour so the cap can never be bypassed by omission.
export const shouldCheckTokenCap = (requestType) => requestType !== 'voice';

// Token counts reported to log_request(). Voice turns still write a
// request_logs row (guest daily count + circuit-breaker cost need it) but must
// not grow tokens_used_today — their real token counts stay in ai_usage
// (feature='voice'). Any feature that is not 'voice' counts normally.
export const requestLogTokens = (feature, promptTokens, completionTokens) =>
  feature === 'voice'
    ? { promptTokens: 0, completionTokens: 0 }
    : {
        promptTokens: Math.max(0, Math.round(promptTokens)),
        completionTokens: Math.max(0, Math.round(completionTokens)),
      };
