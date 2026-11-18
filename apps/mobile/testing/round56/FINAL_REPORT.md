# FINAL_REPORT — round 56

## Step 0 — deployed state (DEPLOYED_STATE.md)
| Feature | Marker | Live? |
|---|---|---|
| B2 follow-up window | `follow-up window expired` | yes |
| B3 barge-in | `Barge-in confirmed` | yes |
| Tap-after-cap | `Voice stopped` | yes |
| B1 partial flush | `lowConfidence` | yes |
| Signed-in heartbeat | P3 code path | yes |
- Bundle `index-52a1ae81.js` = local dist. HEAD = origin/develop = `aa38992` (merge of `c26eeb3`).

## Step 1 — P3 signed-in heartbeat
- Already implemented & deployed (round 54/55). Server route accepts signed-in tokens; no server change needed. 5/5 unit tests. Live quota check: `voice_seconds_used_today` **60 → 120** (+30/beat).
- See `P3_DIFF.md`.

## Step 2 — P4 laptop TTS + prod TTS status
- **Implemented:** `devLaptopTts.ts` — client override active only when `import.meta.env.DEV && VITE_DEV_LAPTOP_TTS==='true'`; wired into `fetchServerAudio` (laptop schema `{text,voice}`, no auth). 5/5 tests incl. release-build-never-enables. See `P4_DIFF.md`, `P4_SUMMARY.md`.
- **Prod TTS finding:** `/api/tts/status` → `{"enabled":false,"providers":[]}`. `EDGE_TTS_ENABLED` unset (default off) and `TTS_SERVICE_URL` unset → **every /api/tts returns 503**, all replies use browser/native voice. Explains the round-52 "sometimes 503" symptom.

## Step 3 — B1
- Approved earlier; already committed `c26eeb3` and live. Code verified in `stt.ts`. See `P2_DIFF.md`.

## Gates (final, on working tree)
| Gate | Result |
|---|---|
| tsc --noEmit | 0 |
| apps/web vitest | **415/415** (25 files; +5 new devLaptopTts) |
| vite build | OK (rebuilt with VITE_BACKEND_URL=prod, flag OFF — `DEV:!1` verified) |
| services/api npm test | 279 pass / 1 fail — `routingCheck.test.js` env-blocked, pre-existing |
| git diff scope | tts.ts + devLaptopTts.{ts,test.ts} only; no Kotlin, no migrations |

## Owner must do
1. **Set `EDGE_TTS_ENABLED=true` and/or `TTS_SERVICE_URL` in Railway** — production TTS is fully off; replies use device voices.
2. Approve/reject the P4 diff (`tts.ts` + 2 new files). Nothing committed.
3. Decide whether to commit/deploy — agent will not.
4. Rotate the test password (shared in earlier chat).
5. Confirm Railway source branch is `develop` (= `aa38992`, has all voice fixes).
