import { GUEST_VOICE_MAX_STEP_SECONDS, guestVoiceLimitBody, usesGuestVoiceTrial } from './voiceQuotaPolicy.js';

// Voice-turn quota gate shared by /api/chat and /api/agent/chat. Both dependencies are
// injected so tests do not need Supabase:
//   debitGuest({ userId, claimed }) -> guestQuotaFromRpc shape (guests only)
//   debitDaily({ userId, plan, increment }) -> quotaFromRpc shape (signed-in only)
// Guests get a small per-turn charge against the lifetime trial (touch-based billing
// covers voice turns even when no heartbeats run). Signed-in users get the daily-quota
// read-only check (increment 0) — the heartbeat does the actual billing, same as /api/chat.
// Returns { blocked, status, body, chargedSeconds }; the caller sends status+body when blocked.
export const voiceTurnQuotaCheck = async ({ user, plan, debitGuest, debitDaily }) => {
  if (usesGuestVoiceTrial(user)) {
    const trial = await debitGuest({ userId: user.id, claimed: GUEST_VOICE_MAX_STEP_SECONDS });
    return trial.exhausted
      ? { blocked: true, status: 403, body: guestVoiceLimitBody(), chargedSeconds: trial.chargedSeconds ?? 0 }
      : { blocked: false, chargedSeconds: trial.chargedSeconds ?? 0 };
  }
  const quota = await debitDaily({ userId: user.id, plan, increment: 0 });
  if (quota.exhausted) {
    return {
      blocked: true,
      status: 403,
      body: { error: 'QUOTA_EXHAUSTED', message: 'Daily voice limit reached.', ...quota },
      chargedSeconds: 0,
    };
  }
  return { blocked: false, chargedSeconds: 0 };
};
