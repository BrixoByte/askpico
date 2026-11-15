import { supabase } from './supabase.js';
import { dailyVoiceLimitSeconds, quotaFromRpc } from './voiceQuotaPolicy.js';

// Atomically resets the daily counter if the UTC day changed, checks the cap,
// and adds `increment` seconds when allowed. Increment 0 is a read-only check.
export const debitVoiceQuota = async ({ userId, plan, increment }) => {
  const { data, error } = await supabase.rpc('voice_quota_debit', {
    p_user_id: userId,
    p_limit_seconds: dailyVoiceLimitSeconds(plan),
    p_increment: increment,
  });
  if (error) throw new Error(`voice quota failed: ${error.message}`);
  return quotaFromRpc(data);
};
