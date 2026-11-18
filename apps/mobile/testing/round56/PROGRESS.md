# Round 56 — progress log

## Step 0 — deployed state (read only)
2026-11-18T11:33:04Z step0 start
- served bundle: assets/index-52a1ae81.js — identical to local apps/web/dist
- markers live: "follow-up window expired" x1, "Barge-in confirmed" x1, "Voice stopped" x1, "lowConfidence" x1, "Resuming listening" x1
- git: HEAD=origin/develop=aa38992 (no-ff merge of c26eeb3)
2026-11-18T11:33:33Z step1 start

## Step 1 — signed-in heartbeat (P3)
- server route /api/voice/heartbeat: requireUser accepts any auth; non-guest -> debitVoiceQuota +30s. No server change needed (confirmed server.js:801-841).
- Client sender already implemented in c26eeb3 (live): voiceHeartbeat.ts + useVoiceHeartbeat.ts + api.sendVoiceHeartbeat, mounted in VoiceController, gated on isGuest === false.
- vitest src/voice/voiceHeartbeat.test.ts: 5/5 pass.
- Live quota check (real route, test account): 60 -> 120, +30 per beat, remaining 1710 -> 1680.

## Step 2 — P4 laptop TTS flag + prod TTS status
- No client switch existed; server laptop provider is TTS_SERVICE_URL-only.
- Added devLaptopTts.ts (DEV && flag gated, env-injectable) + wired into fetchServerAudio; laptop mode posts {text,voice}, no auth bearer.
- devLaptopTts.test.ts: 5/5. Full suite 415/415. tsc 0. vite build OK.
- Prod dist: flag string absent from deployed bundle; in new build it appears only inside the DEV:!1-guarded branch.
- /api/tts/status live: {"enabled":false,"providers":[]} — EDGE_TTS_ENABLED and TTS_SERVICE_URL both unset in prod; every reply falls back to browser/native TTS. Owner must set env in Railway.

## Step 3 — B1
- Owner approved B1 previously; implementation already committed (c26eeb3) and deployed. stt.ts flush code verified present (pendingPartial/androidWindow/flushedWindow/mayFlushPartial).
- git diff --name-only: only apps/web/src/voice/tts.ts modified + 2 new devLaptopTts files. No Kotlin, no migrations.
- Gates: tsc 0 | web tests 415/415 | vite build OK | api npm test 279 pass / 1 env-blocked routingCheck.
