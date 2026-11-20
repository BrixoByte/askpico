# Track B — Gate 2: dependency check (read only)

Sources: PostgREST OpenAPI FK metadata + migration file bodies (all schema objects came
from migrations, so function/trigger definitions are known) + zero code refs verified.
No views named voice-* exist. Limitation: `pg_cron` schedules are not visible via REST —
no known scheduled caller of the voice functions (they were HTTP-invoked only, now removed).

| Object | Type | Count | Class | Reason |
|---|---|---|---|---|
| `guest_trial_grants` | table | 2 rows | **SAFE** | Only the removed guest-trial IP-cap code read it; no FKs in, no policies, index drops with table. |
| `guest_voice_usage` | table | 7 rows | **SAFE** | Only `guest_voice_debit` touches it. |
| `guest_voice_debit` | function | — | **SAFE** | No code calls it (verified `rpc()` list); only touches `guest_voice_usage`. |
| `voice_quota_debit` | function | — | **SAFE** | No code calls it; only touches voice columns below. |
| `profiles.voice_seconds_used_today` | column | 8/8 | **SAFE** | Only `voice_quota_debit` + removed server code used it. |
| `profiles.last_reset_timestamp` | column | 8/8 | **SAFE** | Only `voice_quota_debit` reset logic + removed admin reads used it. Voice-only sibling of the daily token reset. |
| `profiles.bonus_voice_seconds` | column | 8/8 | **SHARED — keep** | **Written by live `complete_referral_reward`** (referral reward credited as voice seconds). Dropping breaks the referral path. Requires a `CREATE OR REPLACE FUNCTION` first — out of DROP scope. |
| `profiles.voice_sessions_completed` | column | 8/8 | **SHARED — keep** | **Read by live `complete_referral_reward`** qualification check (`>= 1` counts as real activity). Dropping breaks the trigger. |
| `referrals.reward_seconds` | column | 0 rows | **SHARED — keep** | **Written by live `complete_referral_reward`** (`status='rewarded'` sets it). Column is the reward amount in voice seconds. |
| `memory_items.source` | column | 0 rows | **SHARED — keep** | Shared text column (`'chat'\|'voice'\|'brain'` convention, no constraint). Nothing droppable anyway. |
| `on_email_verified` (auth.users) | trigger | — | **SHARED — keep** | Live trigger that reaches the voice columns above. Do not touch. |
| `handle_email_verified`, `complete_referral_reward`, `claim_referral`, `record_referral_click` | functions | — | **SHARED — keep** | Referral pipeline — text feature. The voice-column refs inside are the reason 3 columns stay SHARED. |
| `purge_inactive_guests` | function | — | **KEEP (not voice)** | Guest-account cleanup, not voice-specific. Owner decision later. |
| `guest_trial_grants_ip_idx` | index | — | **SAFE** | Belongs to `guest_trial_grants`; drops with the table. |
| RLS on guest tables | policy | — | n/a | `enable row level security` with zero policies — nothing named to drop; goes away with the tables. |
| `tts_requests`, `tts_health_checks`, `voice_ledger` | tables | — | **ABSENT** | Never applied to production (untracked migrations 0016; `voice_ledger` docs-only). Nothing to drop. |
| `profiles.tokens_used_today`, `tokens_reset_at` | columns | — | **KEEP** | Text token quota — untouched. |

## Summary for the owner

- **SAFE to drop (6):** tables `guest_trial_grants`, `guest_voice_usage`; functions
  `guest_voice_debit`, `voice_quota_debit`; columns `profiles.voice_seconds_used_today`,
  `profiles.last_reset_timestamp`.
- **SHARED — cannot drop without breaking referrals (3):** `profiles.bonus_voice_seconds`,
  `profiles.voice_sessions_completed`, `referrals.reward_seconds`. Removing them needs a
  voice-free `complete_referral_reward` rewrite first (function edit — owner decision whether
  0018 may contain a CREATE OR REPLACE, or whether these stay).
- **UNKNOWN:** none for the candidates themselves; `pg_cron` schedule visibility is the only
  blind spot — if a scheduled job ever called the voice functions it would break on apply
  (unlikely: they were HTTP-invoked, code callers are gone).
