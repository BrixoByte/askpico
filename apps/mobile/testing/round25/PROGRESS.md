# Round 25 progress — open-issue fixes

Goal: fix the open issues left after Round 24 (billing discrepancy, agent-chat voice
quota, offline banner verification, native offline Retry, trial bypass proposal,
email deliverability checklist, cleanup). No deploy, no commit.

## Issue 1 — billing discrepancy (~6 s billed for ~35 s of voice) — FIXED (code)

Root cause (two compounding bugs):

1. Client (`useGuestVoiceTrial.ts`): `claimActiveSeconds` deducted seconds from the
   local timer BEFORE the heartbeat request was sent, and failures were swallowed
   (`catch(() => null)`). One dropped heartbeat (e.g. the t+30 s beat in the test)
   permanently lost its seconds — they were never claimed again locally and never
   billed. The final flush then only claimed the un-claimed remainder (~6 s).
   Server charged `min(claimed=6, elapsed=35, step=30) = 6`. Matches observation exactly.
2. Server (`guest_voice_debit`, migration 0011): `last_touch_at = now` on every touch,
   discarding any unbilled wall-clock gap; a single request could never bill a backlog
   (max_step=30 while gap could be larger).

Fix:
- `supabase/migrations/0013_guest_voice_watermark.sql` (OWNER MUST RUN in the Supabase
  SQL editor): `last_touch_at` is now a "billed through" watermark that advances only
  by the charged seconds. Unbilled time stays claimable. Also returns `charged`.
- `debitGuestVoice` passes `p_max_step = limit` (elapsed is the real bound; allows
  backlog drain in one call). `guestClaimSeconds` clamps to limit for catch-up claims.
- `guestDebitStep` added to `voiceQuotaPolicy.js` as the executable spec of the SQL math.
- Client: `refundClaim()` in `guestVoiceTimer.ts`; failed heartbeats refund the claim
  so the next one reports it. Heartbeats carry `reason` (beat|pause|end) for logging.
- Structured logging: `[voice-trial] <label> user=<suffix> claimed=X charged=Y used=Z
  remaining=R reason=…` on every guest debit; `[voice-turn]` on chat/agent turns.

Tests: `guestVoice.test.js` rewritten around a watermark-faithful fake (19 assertions
in file); new cases: dropped-heartbeat catch-up, first-vs-subsequent session parity,
re-opened session keeps the gap, abrupt disconnect never over-bills, over-claim capped
by elapsed. `refundClaim` covered in `guestVoiceTrial.test.ts`.
SQL verified against real Postgres (PGlite, outside repo): charge-35-after-drop,
per-claim billing, elapsed cap, watermark held on second session-start, exhausted path.

Manual step: run migration 0013 in Supabase SQL editor (file
`supabase/migrations/0013_guest_voice_watermark.sql`). Until then the server still runs
the old function — the API works with both, but under-billing persists until applied.

## Issue 2 — /api/agent/chat signed-in voice turns had no daily quota — FIXED

New shared gate `services/api/src/voiceTurnGate.js` (`voiceTurnQuotaCheck`) used by
both `/api/chat` and `/api/agent/chat`. Guests → lifetime trial charge (unchanged);
signed-in → `debitVoiceQuota` read-only check (increment 0), same as /api/chat —
the heartbeat still does the daily billing. 403 + `QUOTA_EXHAUSTED` when over.
Tests: `voiceTurnGate.test.js` — guest allow/block, signed-in allow/block,
next-day reset, ultra unlimited, guests never hit daily path and vice versa.

## Issue 3 — offline banner verification — CODE + HOOK DONE (device check pending)

Banner was already correct (online/offline events + navigator.onLine). Added a
simulated-offline hook so it can be verified on device without airplane mode or
cache clearing: open `?pico-offline` in the URL (or `setForcedOffline(true)` in the
console). UI-only; never signs out. New test covers the hook.

## Issue 4 — native offline Retry — FIXED (device check pending)

`MainActivity.retryLoad()`: checks real connectivity first (ConnectivityManager +
NET_CAPABILITY_VALIDATED — toasts "Still offline" instead of a blind reload),
debounces (button disabled + "Retrying…" while in flight), reloads with
`Cache-Control: no-cache` so a stale cached shell cannot come back. Session lives in
localStorage — untouched by reload. `onPageStarted`/`onReceivedError` reset the state.
Added `ACCESS_NETWORK_STATE` permission + 2 strings.

## Issue 5 — trial bypass — PROPOSAL ONLY (awaiting owner approval)

See FINAL_REPORT_S.md for options/trade-offs. Nothing implemented.

## Issue 6 — email deliverability — CHECKLIST ONLY

DNS records already documented in `apps/mobile/testing/round22/DNS_RECORDS.md`
(Resend generates exact values per domain). Gmail "Show original" check is owner's.

## Verification

- API `npm test`: 263 tests, 261 pass, 0 fail, 2 known todo (routing over-route cases).
- Web `vitest run`: 317 pass. `tsc --noEmit` clean. `vite build` clean.
- Kotlin changes not compiled here (no gradle run) — verify on next APK build.
