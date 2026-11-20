# Round 63 — Phase 3 diff summary (services/api backend)

Branch: `feat/text-only`. Uncommitted. Stat: **23 files changed, 43 insertions(+), 1,775 deletions(-)**.

## Deleted (voice-only)

- `src/tts.js` (249) — Edge TTS + laptop provider chain
- `src/voiceHealth.js` (193) — TTS probes, heartbeat ledger
- `src/voiceQuota.js` (14), `src/voiceQuotaPolicy.js` (83), `src/voiceTurnGate.js` (28) — voice billing/limits
- `src/guestVoice.js` (64) — guest trial debit
- `src/admin/voiceRoutes.js` (159) — `/api/admin/voice/*`
- `test/guestVoice.test.js` (211), `test/voiceQuota.test.js` (64), `test/voiceTurnGate.test.js` (67), `test/voiceTokenCap.test.js` (68)

## Edited

| file | removed |
|---|---|
| `src/server.js` (−257) | 6 voice imports; `userLimits.voice/tts`; `requestType` destructures; `shouldCheckTokenCap` (token cap now unconditional — **a stale client sending requestType='voice' is now treated as text: voice-billing abuse path closed**); `blockVoiceTurnOverQuota` calls in /api/chat + /api/agent/chat; voiceRule prompt; `feature='voice'` (always 'text'); `earnedSeconds`+`bonus_voice_seconds` from /api/referral/stats; whole voice block (`/api/voice/session-complete`, `/session-start`, `/heartbeat`, `/trial`, handleGuestVoice, heartbeatReason, handleVoiceQuota); voice fields from /api/usage (now `{plan, tokensUsed, tokenLimit}`); `/api/tts`, `/api/tts/status`, `/api/tts/heartbeat` + `HEARTBEAT_SECRET` env read; `startVoiceProbes()` |
| `src/guestTrialIp.js` (−41) | GUEST_TRIAL_* constants, clientIp, normalizeClientIp, hashGuestIp — all guest-trial-only. **Kept `hashSignal`** (referral signup fraud logging, server.js:597-598). Note: filename still says "guestTrialIp" — cosmetic, flagged |
| `src/tokenQuotaPolicy.js` (−21) | `shouldCheckTokenCap` (voice skip); `requestLogTokens` voice zeroing — now always counts |
| `src/routing.js` (−16) | `requestType` param + `MODE_LEVEL` + voice→smart clamp in `chooseMode` |
| `src/routingService.js` (−4) | `requestType` param threading |
| `src/orchestrator.js` (−8) | `requestType` param + voiceRule prompt in `runSpecialist` |
| `src/flags.js` (−6) | `/api/tts/heartbeat` alternative in kill-switch EXEMPT regex |
| `src/admin/routes.js` (−64) | voiceRouter mount, dailyVoiceLimitSeconds import, voice columns in user-list/detail selects (+ dead `last_reset_timestamp`), `voiceRequests` day-series field, `/stats/voice-usage` endpoint (44 lines) |
| `src/admin/aiSpendRoutes.js` (−17) | voice metric fields (voiceMinutesToday, costPerVoiceMinuteTodayUsd, voiceUsd) + profiles voice query |
| `src/admin/flagRoutes.js` (−1) | `tts_primary` enum entry (voice flag) |
| `test/guestTrialIp.test.js` (−177) | rewrote: trial-cap tests removed → single `hashSignal` determinism test (shared infra coverage kept) |
| `test/routing.test.js` (−5) | removed voice-clamp test (tested deleted behavior) |

## Behaviour notes

- `requestType` body field no longer destructured anywhere — stale clients sending `'voice'` get normal text handling + normal text token cap (documented above).
- Referral reward `complete_referral_reward` RPC no longer triggered (its only trigger was `p_trigger:'voice_session'`); DB function remains, unused.
- No env var reads remain for `EDGE_TTS_ENABLED`, `TTS_SERVICE_URL`, `TTS_VOICE`, `TTS_HEARTBEAT_SECRET`. **Railway values untouched — owner may delete them later.**
- DB: zero queries to voice columns/functions remain in src. Tables/columns/functions untouched (no migration run, none needed).

## Gates

| gate | result |
|---|---|
| `node --check` on all 10 edited src files | all OK |
| `npm test` | **218 tests: 215 pass, 1 fail, 2 todo** — the 1 fail is `test/routing.test.js`, env-blocked (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` unset; fails at import, pre-existing). 2 todo are documented routing decisions in routingCheck.test.js |
| src grep `voice|tts|heartbeat|edge|laptop` | **0 real hits** — only "invoice" substrings in routingRules regexes + "ledger"/"edges" (GraphQL) false positives |

## Untouched

`src/config.js.new` — untracked stray file, no voice refs, not in WIP list, left as-is and not staged.

## STOP — waiting for owner "CONTINUE" before Phase 4 (apps/mobile).
