import { GUEST_VOICE_LIMIT_SECONDS, guestQuotaFromRpc } from './voiceQuotaPolicy.js';
import {
  GUEST_TRIAL_IP_CAP,
  GUEST_TRIAL_REDUCED_SECONDS,
  GUEST_TRIAL_CAP_WINDOW_MS,
} from './guestTrialIp.js';

// The trial size granted to a guest. The first touch for a user records an IP-keyed
// grant; once an IP's rolling 24h cap is reached, new guests from it get the reduced
// trial instead of the full one. Later calls re-read the stored grant so a user's
// limit stays stable. Calls without an ipHash (reads, turns before a grant exists)
// fall back to the full limit.
export const resolveGuestTrialSeconds = async ({ client, userId, ipHash }) => {
  const { data: grant, error: readErr } = await client
    .from('guest_trial_grants')
    .select('granted_seconds')
    .eq('user_id', userId)
    .maybeSingle();
  // Deploy order: the API may ship before migration 0014 creates the table.
  // A missing table falls back to the full trial; other errors still throw.
  if (readErr && readErr.code === 'PGRST205') return GUEST_VOICE_LIMIT_SECONDS;
  if (readErr) throw new Error(`trial grant read failed: ${readErr.message}`);
  if (grant) return grant.granted_seconds;
  if (!ipHash) return GUEST_VOICE_LIMIT_SECONDS;

  const since = new Date(Date.now() - GUEST_TRIAL_CAP_WINDOW_MS).toISOString();
  const { count, error: countErr } = await client
    .from('guest_trial_grants')
    .select('user_id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);
  if (countErr) throw new Error(`trial grant count failed: ${countErr.message}`);
  const granted = (count ?? 0) >= GUEST_TRIAL_IP_CAP ? GUEST_TRIAL_REDUCED_SECONDS : GUEST_VOICE_LIMIT_SECONDS;
  const { error: insErr } = await client
    .from('guest_trial_grants')
    .insert({ user_id: userId, ip_hash: ipHash, granted_seconds: granted });
  if (insErr) {
    // A concurrent first touch may have written the row first — the stored grant wins.
    const { data: existing } = await client
      .from('guest_trial_grants')
      .select('granted_seconds')
      .eq('user_id', userId)
      .maybeSingle();
    if (existing) return existing.granted_seconds;
  }
  return granted;
};

// Reads or charges the guest's lifetime voice balance. touch: false with claimed 0 is read-only.
// p_max_step is the user's granted limit: the SQL watermark already bounds every charge
// to real elapsed time, so a higher cap only lets a single call bill a backlog it is owed.
// The Supabase client is passed in so this module stays importable without server env vars.
export const debitGuestVoice = async ({ client, userId, claimed, touch, ipHash }) => {
  const limitSeconds = await resolveGuestTrialSeconds({ client, userId, ipHash });
  const { data, error } = await client.rpc('guest_voice_debit', {
    p_user_id: userId,
    p_limit_seconds: limitSeconds,
    p_claimed: claimed,
    p_max_step: limitSeconds,
    p_touch: touch,
  });
  if (error) throw new Error(`guest voice check failed: ${error.message}`);
  return { ...guestQuotaFromRpc(data), limitSeconds };
};
