# Round 64 — Migration 0018 Final Report

## Gates
| Gate | Result | Evidence |
|---|---|---|
| 0 inputs | PASS | pooler conn string set by owner; fresh SAFE re-check matched INVENTORY_DB.md |
| 1 fn read | PASS | CURRENT_REFERRAL_FN.sql (from 0008 — last applied def) |
| 2 write | PASS | supabase/migrations/0018_remove_voice_text_reward.sql |
| 3 static | PASS | no DELETE/TRUNCATE/CASCADE; drops = 6 SAFE only; fn has 0 voice-col refs |
| 4 snapshot | PASS | schema_before_0018.json (PostgREST fallback), 11 KB, creds scan clean |
| 5 dry run | PASS | BEGIN; \i; ROLLBACK OK; fn test returned {"status":"none"}; units()=100 |
| 6 owner | PASS | owner typed "DB DRY RUN OK" |
| 7 apply | PASS | BEGIN; \i; COMMIT — committed, no errors |
| 8 verify | PASS | all 6 SAFE objects gone; 3 SHARED cols kept; health 200; 3-min Railway logs 0 voice errors |

## Dropped (6)
guest_voice_debit(uuid,int,int,int,boolean), voice_quota_debit(uuid,int,int),
guest_voice_usage, guest_trial_grants, profiles.voice_seconds_used_today,
profiles.last_reset_timestamp

## Added / changed
- public.referral_reward_text_units() → int 100 — PLACEHOLDER, single place to change
- complete_referral_reward: same signature/security/search_path. Qualification now
  email-verified only. Reward credited via reward_events (kind='referral_activity',
  amount=units()) for both parties. No voice-column reads/writes.

## Kept (frozen, untouched)
profiles.bonus_voice_seconds, profiles.voice_sessions_completed, referrals.reward_seconds

## Owner must do
1. Set final referral reward amount — edit referral_reward_text_units() only.
2. Decide whether to drop the 3 frozen columns later (separate migration).
3. Rotate the temporary DB password (was shared for apply).
4. Delete stale Railway vars (EDGE_TTS_ENABLED, TTS_SERVICE_URL, TTS_VOICE).
5. Review + commit Track A changes and migration 0018 (separate commits).
6. Decide on untracked admin migrations 0012, 0015–0017.
7. Update Play Console RECORD_AUDIO declaration.
