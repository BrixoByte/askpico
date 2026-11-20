import { createHmac } from 'node:crypto';

// Keyed hash for abuse signals (device fingerprint, signup IP). Kept here so the
// referral claim path hashes signals the same way as the removed guest-trial cap did.
export const hashSignal = (value) =>
  createHmac('sha256', process.env.REFERRAL_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '')
    .update(value)
    .digest('hex');
