# P3_DIFF — signed-in voice heartbeat

**Status: already implemented and deployed** — landed in `c26eeb3` / `aa38992` (round 54/55 work), live on `go.askpico.app`. This round re-verified it; no new diff needed.

## Implementation (existing, verified)
- `apps/web/src/voice/voiceHeartbeat.ts` — `createSignedInVoiceHeartbeat(env)`: 30s interval, per-beat `isHidden`+`canSend` checks, hidden>30s tears down, no 'end' flush (each beat debits a full 30s server-side).
- `apps/web/src/components/Voice/useVoiceHeartbeat.ts` — hook gated on `voiceMode && isGuest === false`; mounted in `VoiceController` alongside the guest hook; mutually exclusive + per-beat re-check so no double-send.
- `apps/web/src/api/api.ts:378` — `sendVoiceHeartbeat(reason)`; omits guest-only `seconds` claim.
- Server: `/api/voice/heartbeat` → `requireUser` (any auth) → non-guests → `debitVoiceQuota` → `voice_quota_debit` RPC, +30s per call (server.js:801-841). **No server change was needed.**

## Tests — 5/5 pass
`src/voice/voiceHeartbeat.test.ts`: starts on signed-in voice on · stops on voice off · guests excluded · no double send · hidden>30s teardown.

## Live verification (this round)
`voice_seconds_used_today`: **60 → 120** (+30 per heartbeat, 2 beats 31s apart; remaining 1710 → 1680 of 1800).
