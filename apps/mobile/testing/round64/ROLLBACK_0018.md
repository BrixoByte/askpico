# Rollback plan — migration 0018 (owner-run, no automatic rollback)

Owner confirmed: free plan, no PITR/backup. If production breaks after 0018,
restore is manual in the Supabase SQL editor:

1. Recreate the two dropped profile columns (frozen values lost — they were
   per-day counters, safe to rebuild as 0):
   alter table public.profiles
     add column if not exists voice_seconds_used_today int not null default 0,
     add column if not exists last_reset_timestamp timestamptz;
   (Re-check the original column definitions in migration 0008/0011 if exact
   types/defaults matter.)

2. Recreate the two dropped tables from their definitions in
   supabase/migrations/0011_guest_voice_trial.sql and 0014_guest_trial_ip_cap.sql.
   Historical rows (2 + 7) are lost — counts only were recorded in INVENTORY_DB.md.

3. Recreate the two dropped functions from 0011/0013 (guest_voice_debit) and
   0008 (voice_quota_debit) if ever needed.

4. The referral trigger: keep the new text-based complete_referral_reward.
   bonus_voice_seconds balances were never modified — nothing to restore there.

5. referral_reward_text_units() is additive; dropping it is optional and safe.
