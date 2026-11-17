# Round 43 — Fix: voice turns must not consume the text token quota

## Root cause

`/api/chat` applied the daily token-cap check to every request including
`requestType:'voice'` (server.js:171-186 → 429 QUOTA_EXHAUSTED), and `recordRequest` →
`log_request` added each turn's prompt+completion tokens to `profiles.tokens_used_today`
regardless of feature — so voice turns were both blocked by and inflating the text quota.

## Files changed

- `services/api/src/tokenQuotaPolicy.js` — added `shouldCheckTokenCap(requestType)` (only
  `'voice'` skips; missing/unknown defaults to text) and `requestLogTokens(feature, p, c)`
  (voice → `{0,0}`; anything else → real rounded counts).
- `services/api/src/server.js` — `/api/chat` token-cap block now requires
  `shouldCheckTokenCap(requestType)`; `recordRequest` sends `requestLogTokens` to
  `log_request` while keeping the real `p_cost_usd` and the `request_logs` row
  (guest daily count + circuit breaker unchanged). One change covers `/api/chat` and
  `/api/agent/chat`.
- `services/api/test/voiceTokenCap.test.js` — NEW, 6 tests.
- No client change (voice marker already sent). No SQL, no schema change. stt.ts and
  MainActivity untouched. Guest rules untouched.

## Tests

- New: 6/6 pass — voice-under-exhausted-cap allowed + voice quota still consulted; text under
  cap still rejected; voice-quota-exhausted → 403 voice error; missing/unknown requestType →
  text behaviour; voice turn records 0 tokens; guest limits unchanged.
- apps/web: `tsc --noEmit` exit 0; `yarn test` 380/380; `yarn build` success.
- services/api `npm test` (env loaded): 298 total — **295 pass, 1 fail, 2 todo**.
  The fail is the pre-existing env-dependent `imageProviders.test.js` (local `.env` has an
  extra provider key; passes without it). No regression.
- routing.test.js: passes with env (17/17); env-blocked without SUPABASE vars, as before.

## Local verification (test account, production DB, read-only checks; numbers only)

| Step | tokens_used_today | voice_seconds_used_today | Result |
|------|-------------------|--------------------------|--------|
| Before | 11445 | 0 | account over token cap (429 on /api/chat for text) |
| Voice turn `requestType:'voice'` → local API | — | — | **HTTP 200** (was 429 before fix) |
| After voice turn | **11445 (unchanged)** | 0 | voice turn added 0 tokens |
| One `/api/voice/heartbeat` | — | — | debited 30 s, remainingSeconds=1770 |
| After heartbeat | **11445 (unchanged)** | **30 (+30)** | voice quota counted normally |
| Text request (no requestType) | — | — | **429 QUOTA_EXHAUSTED** (cap still enforced) |

## Owner must do

1. Review the diff (tokenQuotaPolicy.js + server.js + voiceTokenCap.test.js).
2. Approve commit and deploy when ready (NOT done by agent).
3. Decide whether the test account needs its token count reset or a coupon (owner's decision).
4. Rotate the test password (was shared in chat earlier).
5. Note: voice turns' real token counts remain in `ai_usage` (feature='voice') for cost
   reporting; `request_logs` rows for voice carry real cost but 0 token fields by design.
