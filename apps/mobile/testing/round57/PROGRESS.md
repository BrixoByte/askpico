# Round 57 — progress log

## Step 1 — pre-checks
2026-11-18T11:42:25Z start

```
 M apps/web/src/voice/tts.ts
?? .r45tmp/
?? apps/admin/src/components/admin/
?? apps/admin/src/lib/mock/
?? apps/admin/src/pages/AiSpend.tsx
?? apps/admin/src/pages/Errors.tsx
?? apps/admin/src/pages/Flags.tsx
?? apps/admin/src/pages/Infrastructure.tsx
?? apps/admin/src/pages/Voice.tsx
?? apps/admin/src/types/
?? apps/web/navp.mjs
?? apps/web/src/voice/devLaptopTts.test.ts
?? apps/web/src/voice/devLaptopTts.ts
?? supabase/migrations/0012_admin_users_plans.sql
?? supabase/migrations/0015_feature_flags.sql
?? supabase/migrations/0016_voice_health.sql
?? supabase/migrations/0017_ai_spend.sql
```
develop
aa38992 Merge feat/voice-phase-b-b1-heartbeat into develop (voice follow-up window, barge-in, B1 partial flush, signed-in heartbeat)
c26eeb3 Voice: bounded follow-up window, barge-in, tap-after-cap, signed-in heartbeat, dev-only laptop TTS
aec13e5 Merge beta-rc1-guest-voice-trial into develop (voice re-arm, tap-after-cap fix, token cap voice skip)
- only P4 files dirty (tts.ts + devLaptopTts.{ts,test.ts}); on develop @ aa38992
- gates: tsc 0 | web 415/415 | api 279 pass/1 fail(routingCheck env-blocked)/2 todo
- railway linked: askpico-api, production, online

## Step 2 — Railway TTS variable
- before: EDGE_TTS_ENABLED set to a 5-char non-"true" value; TTS_SERVICE_URL unset
- railway variables --set EDGE_TTS_ENABLED=true -> OK
- redeploy done; /api/tts/status -> {"enabled":true,"providers":["edge"],"voice":"en-US-AriaNeural"}

## Step 3 — TTS check
- POST /api/tts {"text":"test","lang":"en"} signed-in -> 200, audio/mpeg, 11232 bytes
