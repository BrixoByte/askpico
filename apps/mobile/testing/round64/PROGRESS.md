# Round 64 — voice removal remainder (repo + DB)

Branch: feat/text-only (continuing from round 63).

## Track A — repo remainder

Started. Grep list: voice, stt, tts, speech, mic, RECORD_AUDIO, heartbeat, voiceQuota,
voice_seconds, bonus_voice_seconds, voice_sessions_completed, voice_quota_debit,
tts_requests, tts_health_checks, guest_trial_grants, requestType, EDGE_TTS, TTS_SERVICE_URL,
TTS_VOICE, devLaptopTts, voice_enabled.

## Track A — done

- REMAINDER.md written; all REMOVE items applied (code aliases, msedge-tts dep+lockfile,
  stale comment, 2 architecture diagrams deleted + 7 arch files edited, 7 doc files edited).
- Gates: tsc exit 0; web tests 360/360; build OK (flag OFF); api tests 215 pass / 1 env-blocked
  (routing.test.js) / 2 todo; assembleDebug+unitTest SUCCESS; merged manifest no RECORD_AUDIO.
- TRACK_A_DIFF.md written. Working tree vs base: 113 files, +236/-7,656.
- STOP — waiting for owner "DB" + Gate 0 items (backup time, SUPABASE_DB_URL set/unset, "DB DRY RUN OK").

## Track B — Gate 0 (FAILED, stopped)

- Owner backup/PITR time: NOT provided — the prompt carried the placeholder
  "[OWNER FILLS IN the backup or PITR time, time only]" instead of a real time.
- SUPABASE_DB_URL: UNSET (not in process env, not in services/api/.env — key name checked
  only, no values read).
- SQL runner: psql and pg_dump NOT installed; `pg` npm package not found.
- Migration folder: 0001–0017 present (17 files). Tracked: 0001–0011, 0013–0014. Untracked
  WIP per REMAINDER.md: 0012, 0015–0017 — untouched.
- STOP per stop conditions: SUPABASE_DB_URL unset + no runner + no backup confirmation.
  Nothing was read from or written to the database.

## Track B — Gate 0 retry + Gates 1-2 (done, stopped)

- Owner inputs: no backup (free plan, no PITR — risk accepted by owner); project URL given
  instead of DB connection string; "khud kr lo" for runner.
- Runner chosen: PostgREST via SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from
  services/api/.env (db_probe.mjs). psql/pg_dump absent; no DB password, so no catalog SQL.
- Gate 1: INVENTORY_DB.md — 2 voice tables (guest_trial_grants=2 rows, guest_voice_usage=7),
  6 voice columns, 2 voice functions. tts_*/voice_ledger/feature_flags ABSENT (0015/0016
  untracked, never applied — matches round-61 check). Counts via content-range, no rows read.
- Gate 2: DEPENDENCY.md — SAFE: guest_trial_grants, guest_voice_usage, guest_voice_debit,
  voice_quota_debit, profiles.voice_seconds_used_today, profiles.last_reset_timestamp.
  SHARED (live on_email_verified trigger -> complete_referral_reward): profiles.
  bonus_voice_seconds, profiles.voice_sessions_completed, referrals.reward_seconds.
- STOP after Gate 2. 0018 not written. Awaiting owner decision on SAFE drop list +
  "DB DRY RUN OK".

## Track B — Gate 0r + Gates 1-4 done; Gate 5 BLOCKED (no SQL executor)

- Fresh re-verify: guest_trial_grants=2 rows, guest_voice_usage=7 rows, both voice
  functions present — 6 SAFE objects unchanged. SUPABASE_DB_URL still UNSET.
- Gate 1: CURRENT_REFERRAL_FN.sql recorded from 0008 (last applied). REST cannot call
  pg_get_functiondef — noted. Voice-touching lines: qualification reads
  voice_sessions_completed; reward writes reward_seconds + bonus_voice_seconds.
- Gate 1 step 3: existing text credit field found = reward_events.amount (kind
  'referral_activity' already allowed by CHECK constraint). No invented column.
- Gate 2: supabase/migrations/0018_remove_voice_text_reward.sql written — placeholder
  referral_reward_text_units() = 100; complete_referral_reward CREATE OR REPLACE
  (same signature/security/search_path, email-verified-only qualification, reward via
  reward_events, bonus balances frozen); 6 SAFE drops, IF EXISTS, dependency order.
- Gate 3 static checks: no DELETE/TRUNCATE/CASCADE/DROP SCHEMA at migration level;
  UPDATE/INSERT only inside function body (existing logic); drop targets = 6 SAFE only;
  new function has zero voice-column refs.
- Gate 4: schema_before_0018.json (PostgREST OpenAPI fallback — pg_dump absent):
  11,011 bytes, 31 tables, 12 RPCs, credential scan clean.
- Gate 5 DRY RUN: **BLOCKED** — no SQL executor on this machine: no psql/pg_dump, no
  docker, no pg npm package, no exec_sql RPC, SUPABASE_DB_URL unset (no DB password).
  PostgREST cannot run DDL or multi-statement transactions.

## Track B — Gate 5 PASS (dry run, all rolled back)

- Owner supplied SUPABASE_DB_URL (session pooler, Mumbai region) + temp DB password.
  Connection works via pg@8 in pg_scratch/. Credentials only in services/api/.env.
- Dry run 1: BEGIN; migration 0018; ROLLBACK — **OK**. Inside txn voice fns = 0
  (drops would apply); post-rollback fns = 2, voice_seconds_used_today col = 1.
  Nothing persisted.
- Dry run 2 (txn + rollback): complete_referral_reward('0000...dead','email_verified')
  → json {"status":"none"} (no pending referral — correct early return).
  referral_reward_text_units() → 100. Rolled back.
- Gate 6: awaiting owner "APPLY 0018" before any permanent change.

- Owner typed "DB DRY RUN OK" — dry run approved. Awaiting "APPLY 0018" for Gate 7.

## Gate 7 APPLIED + Gate 8 VERIFIED
- COMMIT succeeded. All 6 SAFE objects gone; 3 SHARED columns intact.
- referral_reward_text_units() live (=100). Health check 200.
- 3-min Railway log window: 0 lines for any removed-object name, 0 errors.
- ROLLBACK_0018.md + FINAL_REPORT_0018.md written.
