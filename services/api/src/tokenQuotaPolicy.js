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
