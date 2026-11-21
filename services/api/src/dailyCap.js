import { dailyTokenLimit, isDailyTokenCapReached } from './tokenQuotaPolicy.js';

// Shared daily token cap for every route that calls the LLM. Reads the same counter as
// /api/usage (roll_daily_tokens) and the same limit (tokenQuotaPolicy.js). Read-only:
// it never increments the counter. Lookup errors throw; callers fail closed with 502.
export const quotaExhaustedBody = (plan, tokensUsed) => ({
  error: 'QUOTA_EXHAUSTED',
  message: 'Daily token limit reached. Upgrade or share your referral link to keep chatting today.',
  tokensUsed,
  tokenLimit: dailyTokenLimit(plan),
});

export const checkDailyCap = async ({ userId, getPlan, rollTokens }) => {
  const plan = await getPlan(userId);
  const tokensUsed = Number(await rollTokens(userId));
  return isDailyTokenCapReached(plan, tokensUsed) ? { status: 429, body: quotaExhaustedBody(plan, tokensUsed) } : null;
};

// Same code and shape as quotaExhaustedBody for caps that are not token-ledger
// based (per-user throttle cap, guest daily cap, live request cap). The client
// keys the daily-limit banner off this error code, so it must match.
export const quotaCapBody = (message, fields = {}) => ({
  error: 'QUOTA_EXHAUSTED',
  message,
  ...fields,
});
