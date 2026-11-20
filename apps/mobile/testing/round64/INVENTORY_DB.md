# Track B — Gate 1: production DB inventory (read only)

Runner: **PostgREST** via `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `services/api/.env`
(script `db_probe.mjs`; never prints key/rows). `psql`/`pg_dump` not installed; no DB
password available, so catalog SQL was not possible — triggers/policies/view-vs-table
distinction assessed from migration files. Counts via `Prefer: count=exact` — no row
content read. Backup: **none — owner confirmed free plan, no PITR** (accepted risk).

## Voice tables (public, exposed via REST)

| Table | Rows | Notes |
|---|---|---|
| `guest_trial_grants` | 2 | RLS on, no policies (service-role only). Index `guest_trial_grants_ip_idx` (from 0014). |
| `guest_voice_usage` | 7 | RLS on, no policies (service-role only). |

## Voice-named objects expected but ABSENT from production

`tts_requests`, `tts_health_checks`, `laptop_heartbeat` (0016 — untracked, never applied),
`voice_ledger` (docs-only, never migrated), `feature_flags` (0015 — untracked, never applied).
Consistent with round-61 schema check (migrations 0015–0017 were never applied).

## Voice columns

| Table.Column | Non-null / rows | Notes |
|---|---|---|
| `profiles.bonus_voice_seconds` | 8/8 | Referral reward balance (voice seconds). |
| `profiles.voice_seconds_used_today` | 8/8 | Daily voice usage counter. |
| `profiles.voice_sessions_completed` | 8/8 | Voice session count; referral qualification signal. |
| `profiles.last_reset_timestamp` | 8/8 | Daily voice-reset anchor (added in 0008 alongside voice quota). |
| `referrals.reward_seconds` | 0/0 | `referrals` table empty; reward amount in voice seconds. |
| `memory_items.source='voice'` | 0/0 | `memory_items` empty; `source` is plain `text` default `'chat'` — no CHECK constraint, nothing droppable. |

## Voice functions (RPC surface)

`voice_quota_debit`, `guest_voice_debit` — present. `purge_inactive_guests` — present but
**not voice-specific** (guest cleanup; kept out of the voice set).

## Live dependencies found (Gate 2 preview)

- `on_email_verified` trigger on `auth.users` → `handle_email_verified()` →
  `complete_referral_reward()` — **live, fires on every email confirmation**. Current body
  (from 0008, last applied): reads `profiles.voice_sessions_completed` (qualification),
  writes `profiles.bonus_voice_seconds` and `referrals.reward_seconds` (reward credit).
- Code RPC calls remaining: `claim_referral`, `consume_routing_mode`, `log_request`,
  `match_memory_items`, `record_referral_click`, `redeem_coupon`, `roll_daily_tokens` —
  **none** call the voice functions.
- Code refs to any voice column/table/function name in `services/api/src` + `apps/web/src`: **0**.
