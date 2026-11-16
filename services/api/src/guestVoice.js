import { GUEST_VOICE_LIMIT_SECONDS, guestQuotaFromRpc } from './voiceQuotaPolicy.js';

// Reads or charges the guest's lifetime voice balance. touch: false with claimed 0 is read-only.
// p_max_step is the whole limit: the SQL watermark already bounds every charge to real
// elapsed time, so a higher cap only lets a single call bill a backlog it is owed.
// The Supabase client is passed in so this module stays importable without server env vars.
export const debitGuestVoice = async ({ client, userId, claimed, touch }) => {
  const { data, error } = await client.rpc('guest_voice_debit', {
    p_user_id: userId,
    p_limit_seconds: GUEST_VOICE_LIMIT_SECONDS,
    p_claimed: claimed,
    p_max_step: GUEST_VOICE_LIMIT_SECONDS,
    p_touch: touch,
  });
  if (error) throw new Error(`guest voice check failed: ${error.message}`);
  return guestQuotaFromRpc(data);
};
