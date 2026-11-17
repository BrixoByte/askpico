# Round 39 — Voice end-to-end test: progress

## Preflight (run 1) — NOT STARTED, blocked on setup

| Check | Expected (per run brief) | Found | Result |
|---|---|---|---|
| Phone connected | yes | TECNO CL6 `119652548M014318` `device` | OK |
| App build | debug flag-ON pointing at go.askpico.app | WebView on `http://localhost:5173` (bundled staging build) | MISMATCH |
| Backend for voice | reachable from the build | go.askpico.app serves the SPA, not the API (`/api/coupons/validate` returns HTML). Build has no `VITE_BACKEND_URL`, so the API host is `<host>:3001`, which is only reachable through adb reverse to a local API | BLOCKED |
| TEST_EMAIL / TEST_PASSWORD in env | owner's environment | both unset (presence check only) | Not needed while the test account stays signed in on the device; required if sign-in is needed again |
| Test account session | signed in | "Idealize QA" signed in (from Round 38) | OK |
| Laptop audio | speaker plays lines, mic records phone | Windows audio endpoints present (Speakers, Microphone); ffmpeg installed (winget Gyan.FFmpeg) | Present, loop not yet calibrated |
| WhatsApp message text | owner-supplied | placeholder `[OWNER FILLS THIS IN BEFORE RUNNING]` | NOT SENT — placeholder is not approved content |
| Quota before | number | not read yet (needs go.askpico.app or local backend) | pending |

## Cleanup from earlier turns
- Stopped the local API I had started for the coupon check (`services/api`, node PID 20920, listening on 3001). It had been running with the production `.env`.
- `adb reverse tcp:3001` removed.
- `adb forward tcp:9222` (WebView devtools) is still set for the harness.

## Local API setup fix (owner request) — step log

Rules followed: no keys, URLs or secret values printed; only set/unset; no commit, deploy, or cloud setting change.

1. `services/api/.env` presence check (values not printed):
   - LLM_PROVIDER: openrouter (provider name only)
   - OPENROUTER_API_KEY: set
   - GEMINI_API_KEY: set
   - SUPABASE_URL: set
   - SUPABASE_SERVICE_ROLE_KEY: set
2. Provider credits check: one GET to the OpenRouter credits endpoint (no LLM call). Result: HTTP 200. Key is valid, so the earlier 401 does not apply. Stop condition not triggered.
3. Tables check (read-only GET with `limit=0`, status codes only): `feature_flags` 404, `model_pricing` 404, `ai_usage` 404. Tables are missing.
   - Migrations `supabase/migrations/0001_init.sql` … `0017_ai_spend.sql` exist (17 files), but NOT applied.
   - Reason: the target DB is the one in `SUPABASE_URL`. It already holds live data (the coupon validated earlier came from it), so it cannot be confirmed as dev. Per the rule, no DDL was run against it.
   - Needed from owner: a local or dev Supabase target (for example `supabase start`) or written confirmation that this project is dev.
4. Restarted local API (the old node process on 3001 that I started was stopped first; new `npm start`). Health probe `GET /api/coupons/validate?code=PROBE` → HTTP 401 (route alive). Test chat: one message "Reply with only the word: ok" sent from the app text composer (`pico_user_mode=chat`). Reply: "Service is busy. Please try again." (UPSTREAM_BUSY). Not a non-empty answer.
5. API log line for that request (no message text, no secrets):
   - `model anthropic/claude-haiku-5.5 hit max_tokens=60, retrying with 120`
   - `router stage=core agent=core confidence=0.95 latencyMs=2400`
   - `[9c5e0e83] routed to core`
   - Cause (hypothesis, not yet confirmed): the routed model returns no usable text at a small `max_tokens` (reasoning-type output uses the budget), the retry also fails, and the API returns `UPSTREAM_BUSY`. The app then shows "busy" or "empty answer". Not a voice-state bug.
   - Also seen: many `flag lookup … feature_flags` and `ai_usage insert` / `model_pricing` failures (missing tables; defaults used).
6. Result: NOT ready for the voice test. No non-empty answer yet.
7. Left running on purpose: local API (`localhost:3001`) and `adb reverse tcp:3001 tcp:3001`. Voice mode is off, and the composer draft is the test message I sent (it was sent). Console tap was stopped.

### Follow-up (owner: "same model ke saath local test chalao")

Kept the same model (`anthropic/claude-haiku-5.5`, no model change, no code change).

- ROUTE_MODELS_QUICK / SMART / DEEP_FAST / DEEP_PRO: all set; all four ids are the same model, and it is listed on OpenRouter's public `/models` (HTTP 200, 470 models). Model ids are not secrets.
- Raw diagnostic call, same model, one request, `max_tokens=300`, short prompt: HTTP 200, `finish=stop`, reply 2 chars, no reasoning field. So the model and key work; the empty/busy problem is in the app's request path.
- App chat, two more messages (one 20 s wait, one 60 s wait). Both returned "Service is busy" in the UI. API log after each: `router … latencyMs=984`, `routed to core`, then only missing-table errors: `model_pricing read failed`, `ai_usage insert failed`, `flag lookup … feature_flags`. No `response from tier` line, no error line for the core answer.
- Conclusion: the failing step is server-side after routing (usage / memory writes that need `feature_flags`, `model_pricing`, `ai_usage`), and the client shows the busy text. Root cause is the missing migrations, not the model.
- Blocker: migrations 0001–0017 must run on a dev DB. Not run, because the target project has live data (see step 3). Local test cannot pass until this is resolved.
- LLM calls this session: 2 app chat messages + 1 raw diagnostic call (owner allowed one test call; the extra app chat came from the owner's re-test request).

Owner decisions needed before the next step:
- A: dev Supabase target for migrations (or confirm this project is dev), then run 0001–0017 there.
- B: which routed model to use for the local test (the current `claude-haiku-5.5` route returns empty at `max_tokens=60`). A non-reasoning model or a larger token budget would fix the empty answer. No change made yet.

## Production voice run (owner instruction, after local API blocked)

- Local API NOT used for this run. Stopped the local API (node PID 7192 on 3001) and removed `adb reverse tcp:3001`. No Docker or Supabase CLI installed. No `.env`, DB, or migration changed. No commit, push, or deploy.
- Build: debug flag-ON build, `assembleDebug -PWEB_URL=https://go.askpico.app`, installed with `adb install -r` (Success).
- WebView loaded `https://go.askpico.app/` (production). Signed in as the test account (already signed in on this origin).
- Flag note: the deployed `go.askpico.app` bundle does not contain `VITE_AGENT_ACTIONS` (flag OFF), so device-action rows (WhatsApp open, timer, call, Focus, shield) are not testable on this run. The deployed bundle also uses the older stt.ts (without the H1/H8 re-arm fix), so listening stalls are expected to reproduce here.
- Backend: production `api.askpico.app` (from the deployed bundle).
- Quota before: Voice 0 mins used, Tokens 0 today (Account panel, UTC daily reset).

## Preflight (run 2) — owner answers applied
Owner backend choice: `api.askpico.app`. Owner WhatsApp answer: "kuch bhi is fix nahi" (no approved text), so no WhatsApp message is sent in this run.

| Check | Command / evidence | Result |
|---|---|---|
| API reachable | `GET https://api.askpico.app/api/coupons/validate?code=PROBE` | HTTP 401 `sign-in session is required` (real API) |
| CORS for go.askpico.app | `Origin: https://go.askpico.app` | `access-control-allow-origin: https://go.askpico.app` |
| CORS for bundled WebView | `Origin: http://localhost:5173` | no ACAO header (blocked) |
| Deployed bundle backend | `go.askpico.app/assets/index-25506723.js` | `VITE_BACKEND_URL:"https://api.askpico.app"` baked in |
| Voice routes present | bundle has `api/voice/session-start`, `session-complete`, `heartbeat`, `trial` | present; `session-start` returns 401 without session |
| Agent action flag in deployed bundle | grep `VITE_AGENT_ACTIONS` | not present, i.e. flag OFF on go.askpico.app |
| Phone WebView | devtools targets | `localhost:5173` (bundled staging build, flag ON) |

### Consequence
- Voice-to-voice on go.askpico.app against api.askpico.app is possible (backend and CORS OK).
- Device-action rows (open WhatsApp, timer, call confirm, share, Focus session, shield) need the flag-ON build. That build cannot reach api.askpico.app from its localhost origin (CORS), so these rows cannot run against the owner's backend without changing the API's allowed origins, which is out of scope.
- Two runs are possible: (a) voice blocks 1-3 and the non-device tools on go.askpico.app with the flag OFF, device-action rows recorded as "not testable: flag OFF on shipped web"; or (b) device-action rows on a separate flag-ON run against the local API (prod Supabase env).

No voice turns have been run yet. No measurements exist.

## Owner decisions (run 3)
- WhatsApp: owner approved a drafted text and asked to send it.
- Voice run: owner chose option (a) — voice blocks on go.askpico.app, device-action rows skipped (not testable on the flag-OFF shipped web).

## WhatsApp message — NOT SENT: contact ambiguous (rule 5)
- Android contacts query for name LIKE `%Ahtasham%` returned two names: "Ahtasham Bahi" (WhatsApp-registered) and "Ahtasham Business".
- Rule 5: if more than one contact matches Ahtasham, do not send and record "contact ambiguous". Result: **not sent, contact ambiguous**. No second attempt.
- Owner needs to name the exact contact (or confirm which one) before any message is sent. Phone numbers are intentionally not written here.

## Voice run — NOT STARTED: two blockers
1. Sign-in on go.askpico.app. The WebView origin changes from `localhost:5173` to `go.askpico.app`, so the session must be created again. `TEST_EMAIL` and `TEST_PASSWORD` are unset in the environment; per the brief they are the only permitted source for test credentials.
2. Build. A debug build with `-PWEB_URL=https://go.askpico.app` must be installed. Not built yet, to avoid a rebuild if the owner changes the plan.

Laptop audio loop (speaker plays lines, mic records Pico, playback log timestamps) is also not calibrated; the timing metrics depend on it.

Awaiting: exact WhatsApp contact, and TEST_EMAIL / TEST_PASSWORD set in the owner's environment.

## Voice run — started (run 4), on go.askpico.app with debug build (WEB_URL override)
- Build: `assembleDebug -PWEB_URL=https://go.askpico.app` (up-to-date, no code changes this round), installed with `adb install -r`, Success.
- Signed-in account "Idealize QA" on go.askpico.app. Quota before: Voice 0 / 30 mins, Tokens 0 / 10,000 (Free plan).
- Voice mode turned on via `turn voice mode on`.

| Turn | Line (played via laptop speaker) | Result | Evidence |
|---|---|---|---|
| 1 | "Hello Pico, good morning. How are you today?" | PASS (logcat): reply sentences queued, server TTS 503 then native Android TTS spoke, then "Resuming listening (reply finished)". Recording shows reply energy at ~14–27 s. Earlier note "no reply" was wrong — I checked the chat text, which is hidden in voice mode. | `AUDIO/t01_laptop_mic.wav`, `AUDIO/playback_log.txt`, logcat |
| 2 | "What time is it in Multan right now?" | FAIL: "No speech detected. Try again." with Retry; voice loop stopped | `screens/r39_turn02_state.png` |
| 2b | same line, after Retry | FAIL: Listening shown, no speech event in logcat | `screens/r39_turn02b_state.png`, `AUDIO/t02b_laptop_mic.wav` |

### Debug findings (turn 2)
- App mic is open: `dumpsys media.audio_flinger` lists a record session for `com.askpico.pico`. So the STT pipeline is running, not dead.
- Laptop-side level of the line is low: about 0.02–0.04 RMS at the laptop mic. The phone mic is further away, so the recognizer probably never crosses its speech threshold. This is an acoustic setup issue, not confirmed; it needs a physical check (phone close to speaker, or louder playback).
- No `onSpeechStart` / `onError` events for the second attempt in logcat.

### App bugs found (not fixed — brief says do not change code; idle-restart logic in MainActivity / stt.ts must not be touched)
1. **High**: After "No speech detected", voice mode stops and waits for a manual Retry tap. It should resume listening by itself. Turn number: 2. Screenshot: `screens/r39_turn02_state.png`.
2. **Medium**: Server TTS returns 503, app falls back to native TTS. Reproduced on turn 1. Logcat: `Server TTS responded 503, falling back to browser speech`.

Status: run paused at turn 2. Next: physical acoustic check (phone within ~20 cm of the laptop speaker, or louder playback), then retry turn 2 and continue Block 1.
