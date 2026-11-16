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

// Guest voice trial (Round 24): a lifetime allowance, not a daily one. Enforced in the
// guest_voice_debit() SQL function, keyed by the anonymous user id.
export const GUEST_VOICE_LIMIT_SECONDS = 2 * MINUTE;
// One request may never charge more than one heartbeat interval.
export const GUEST_VOICE_MAX_STEP_SECONDS = HEARTBEAT_SECONDS;

// Client-claimed seconds for a heartbeat. Session starts claim nothing. A claim may
// exceed one heartbeat interval so a heartbeat that was lost can be caught up; the
// SQL watermark still bounds every charge to real elapsed time.
export const guestClaimSeconds = (increment, body) => {
  if (increment === 0) return 0;
  const seconds = Math.floor(Number(body?.seconds));
  if (!Number.isFinite(seconds)) return 0;
  return Math.min(Math.max(seconds, 0), GUEST_VOICE_LIMIT_SECONDS);
};

// Maps the guest_voice_debit() JSON result. Any status other than ok means the trial is used up.
// chargedSeconds is what this call billed; it feeds the server-side trial logs.
export const guestQuotaFromRpc = (row) =>
  row?.status === 'ok'
    ? {
        exhausted: false,
        remainingSeconds: Number(row.remaining ?? 0),
        usedSeconds: Number(row.used ?? 0),
        chargedSeconds: Number(row.charged ?? 0),
      }
    : { exhausted: true, remainingSeconds: 0, usedSeconds: Number(row?.used ?? GUEST_VOICE_LIMIT_SECONDS), chargedSeconds: 0 };

// The executable spec for the SQL watermark math in guest_voice_debit(): given the
// claim, the wall-clock elapsed since the watermark, and the balance so far, it
// returns the charge and how far the watermark advances. Tests keep this in sync
// with the migration so client/server behaviour stays predictable.
export const guestDebitStep = ({ claimed, elapsedSeconds, usedSeconds, limitSeconds = GUEST_VOICE_LIMIT_SECONDS, maxStep = GUEST_VOICE_LIMIT_SECONDS }) => {
  if (usedSeconds >= limitSeconds) return { status: 'exhausted', charged: 0, used: usedSeconds, remaining: 0 };
  const charged = Math.min(Math.max(Math.floor(claimed), 0), Math.max(Math.floor(elapsedSeconds), 0), maxStep, limitSeconds - usedSeconds);
  return { status: 'ok', charged, used: usedSeconds + charged, remaining: limitSeconds - usedSeconds - charged };
};

export const guestVoiceLimitBody = () => ({
  error: 'GUEST_VOICE_LIMIT',
  message: 'Your 2-minute voice trial is over. Sign in to keep talking.',
  remainingSeconds: 0,
  limitSeconds: GUEST_VOICE_LIMIT_SECONDS,
});

// Only anonymous (guest) sessions use the lifetime trial. Signed-in accounts keep the daily quota.
export const usesGuestVoiceTrial = (user) => user?.is_anonymous === true;
