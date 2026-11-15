// Voice quota policy (Step 5). Pure functions only, so tests run without Supabase.
// Enforcement and counting happen in the voice_quota_debit() SQL function.

export const HEARTBEAT_SECONDS = 30;

const HOUR = 60 * 60;
const MINUTE = 60;

// null means no daily voice limit.
const DAILY_VOICE_SECONDS = {
  guest: 2 * MINUTE,
  free: 30 * MINUTE,
  weekly: 2 * HOUR,
  monthly: 2 * HOUR,
  ultra: null,
};

// Unknown plans get the free limit so a new plan name can never grant unlimited voice by accident.
export const dailyVoiceLimitSeconds = (plan) =>
  Object.hasOwn(DAILY_VOICE_SECONDS, plan) ? DAILY_VOICE_SECONDS[plan] : DAILY_VOICE_SECONDS.free;

// Anonymous (guest) sessions get the small guest allowance instead of their stored plan.
export const voicePlan = (user, plan) => (user?.is_anonymous ? 'guest' : plan);

// Maps the voice_quota_debit() JSON result to the shape the API returns.
export const quotaFromRpc = (row) => {
  if (!row || row.status !== 'ok') {
    return { exhausted: true, remainingSeconds: 0, usedSeconds: row?.used ?? null };
  }
  return {
    exhausted: false,
    remainingSeconds: row.remaining ?? null,
    usedSeconds: row.used,
  };
};
