# Round 40 debug log (timestamps local +05:00)

2026-11-17T22:19:37+05:00 runner_prod run5 stopped at turn 5; prod turns 1-4 results recorded in round39/PROGRESS.md
2026-11-17T22:22:59+05:00 debug tap started (logging only)

## Step 1 — text-only control (production go.askpico.app)
- 22:20:36 text sent ("What time is it in Multan") after reload with pico_user_mode=chat. Reply appeared (Urdu, non-empty). No "empty answer", no "busy".
- 22:23:11 text sent again with debug tap running. Network (status only):
  - POST /api/agent/truncate -> 200 (ttfb 9622 ms, preflight 204 at 7014 ms)
  - POST /api/agent/route -> 200 (ttfb 2561 ms)
  - POST /api/agent/chat -> 200 (ttfb 4352 ms)
- UI after reply: a "Live Agent" card with "Answer with core chat instead" and "Open Live Time" (routing chose a live-time agent). Reply text is shown.
- TTS: no logcat line for tts/audiofocus/synth; no speechSynthesis activity. Text mode does not necessarily speak replies, so spoken output is NOT confirmed or rejected by this control.
- Conclusion for H-G: backend/LLM is OK on production for text (rejected for production). H-C: not yet tested for voice output path.
- Evidence: DEBUG_TAP.txt (lines 22:23:11–22:23:28), screens/r40_step1_text_after.png.

## Status
- Stopped: production runner (round39 prod run) at turn 5 at owner request. Turn 1 speech detected but no final result; turns 2-4 no speech event; re-arm not present in production bundle.
- Pending: step 2 (voice-input control with debug tap), step 3 (TTS path), step 4 (mic level), step 5 matrix (A-E x3), step 6 ROOT_CAUSE.md.
2026-11-17T22:24:33+05:00 STEP2 voice-input control: speaking line
2026-11-17T22:24:37+05:00 line played
2026-11-17T22:25:37+05:00 STEP2 line start
2026-11-17T22:25:41+05:00 STEP2 line end

## Step 2 — voice-input control result (production)
- 22:25:37 line played (laptop speaker). Mic level: speech energy at the last 2 s windows (0.050–0.071 RMS), so audio reached the phone mic (H-E not supported as the cause here).
- 22:25:39.5 onSpeechStart; 22:25:41.97 Native final result "What time is it in Wilton right now" (recognizer mis-heard Multan).
- 22:25:42.03 submit turn; POST /api/chat sent 22:25:42.03; OPTIONS 204 at 22:25:42.47; POST /api/chat status=429 ttfb 3419 ms at 22:25:45.45.
- 22:25:45.45 "Resuming listening"; restarted recognizer 22:25:45.45; 22:26:09.2 error 7 (NO_MATCH) and recognizer ended.
- No reply text, no TTS events after the 429 (H-C/H-G for this turn: 429 from the chat endpoint).
- UI at 22:26: "No speech detected. Try again." + Retry. Body of the 429 not captured (tap records status only, by design). Possible causes to test: per-user chat rate limit (in-memory), daily cap, or upstream 429 mapped to 429.
2026-11-17T22:27:00+05:00 waiting 60s before controlled text retest (rate-limit hypothesis)
2026-11-17T22:29:52+05:00 STEP3 line start
2026-11-17T22:29:55+05:00 STEP3 line end

## Step 3 — repeat voice-input control with fetch hook (production)
- 22:29:48 voice ON (listening). 22:29:52 line played; mic energy present 22:29:52–22:29:56 (peaks 0.015, weaker than step 2's 0.07).
- 22:29:53.2 onSpeechStart; partials 22:29:53.8–22:29:54.9; no Native final result.
- 22:30:19.5 error 7 (NO_MATCH); recognizer ended. No /api/chat request in this window (no final result, so nothing sent).
- Hook injected (log-only, status + error code): no [R40-HTTP] lines because no chat request was made.
- Layer found: RECOGNIZER END WITHOUT FINAL RESULT after partial speech (H-B). Same mechanism as round39 H8. The old production stt.ts does not re-arm after a window with partial speech.
- Earlier 429 (step 2, 22:25:45 POST /api/chat, ttfb 3419 ms): body not captured (hook was not yet injected). Cause unknown; candidates: per-user rate limit (in-memory limiter in server), daily cap, or upstream 429 mapped to 429. Repro needed with hook (see matrix).
- Not run yet: repro matrix A-E x3 (owner approval/time).
2026-11-17T22:31:34+05:00 ROOT_CAUSE.md draft written (fix pending approval)
2026-11-17T22:31:51+05:00 FINAL_REPORT_AG.md written; debug taps stopped; repro matrix NOT RUN; diff pending approval
2026-11-17T17:40:33.673Z MATRIX A1 begin (case A attempt 1)
2026-11-17T17:41:14.894Z MATRIX A1 FAIL no-cdp
2026-11-17T17:41:34.434Z MATRIX A1 begin (case A attempt 1)
2026-11-17T17:41:46.778Z MATRIX A1 attempt speak at 22:41:46.778
2026-11-17T17:42:53.513Z MATRIX A1 FAIL — re-armed 2x but no final result (err7=true cap=false)
2026-11-17T17:43:33.489Z MATRIX A1 begin (case A attempt 1)
2026-11-17T17:44:08.891Z MATRIX A1 attempt speak at 22:44:08.891
2026-11-17T17:45:15.591Z MATRIX A1 FAIL — re-armed 2x but no final result (err7=true cap=false)
2026-11-17T17:46:00.617Z MATRIX A1 begin (case A attempt 1)
2026-11-17T17:46:38.472Z MATRIX A1 attempt speak at 22:46:38.472
2026-11-17T17:47:45.220Z MATRIX A1 FAIL — re-armed 1x but no final result (err7=true cap=false)
2026-11-17T17:49:21.984Z MATRIX A1 begin (case A attempt 1)
2026-11-17T17:49:59.671Z MATRIX A1 attempt speak at 22:49:59.671
2026-11-17T17:50:06.211Z MATRIX A1 PASS — final "What time is it in Wilton right now" chat=204 rearm=0 tts=false/false/false resume=true
2026-11-17T17:51:00.084Z MATRIX A2 begin (case A attempt 2)

## Fix applied (approval 2026-11-17) — verification
- stt.ts already contained the approved re-arm extension (applied under earlier approval): onEnd re-arms any window that ends while wantRunning (covers partial-only windows), cooldown 1500 ms, cap ANDROID_REARM_MAX=3 per session, counter resets on final result (onResult), cap shows ANDROID_REARM_CAP_MESSAGE "Voice stopped. Tap to try again." stt.ts lines 54-56, 587-619. MainActivity idle-restart untouched; H-E/F/G code untouched.
- Gates: tsc --noEmit clean; vitest stt.rearm.test.ts 8/8 PASS; npm test 380/380 PASS; VITE_AGENT_ACTIONS=true vite build OK (dist index contains the re-arm code); gradle assembleStaging BUILD SUCCESSFUL; app-staging.apk installed (Success).
- Production note: go.askpico.app still serves the OLD bundle; this fix is not on production until a deploy.
- Local API restarted (src/server.js, port 3001, health 200); adb reverse tcp:3001 re-added; adb forward tcp:9222 -> webview_devtools_remote_<pid> (socket name changes per process, runner re-discovers it).
- Known blocker unchanged: local /api/chat returns 429 (missing feature_flags/model_pricing/ai_usage tables — DB untouched per constraints). So replies/TTS are not expected locally; PASS criterion = final result + submit turn (input layer).
- MATRIX runner: A1 PASS (final "What time is it in Wilton right now", submit turn, POST /api/chat 429, Resuming listening). Remaining A2-E3 running.
2026-11-17T17:51:37.930Z MATRIX A2 attempt speak at 22:51:37.930
2026-11-17T17:51:44.478Z MATRIX A2 PASS — final "What time is it in Wilton right now" chat=429 rearm=0 tts=false/false/false resume=true
2026-11-17T17:51:44.563Z MATRIX A3 begin (case A attempt 3)
2026-11-17T17:52:22.297Z MATRIX A3 attempt speak at 22:52:22.297
2026-11-17T17:52:28.850Z MATRIX A3 PASS — final "What time is it in Wilton right now" chat=429 rearm=0 tts=false/false/false resume=true
2026-11-17T17:52:28.933Z MATRIX B1 begin (case B attempt 1)
2026-11-17T17:52:51.927Z MATRIX B1 primer speak at 22:52:51.927
2026-11-17T17:53:51.448Z MATRIX B1 attempt speak at 22:53:51.448
2026-11-17T17:54:01.478Z MATRIX B1 repeat speak at 22:54:01.478
2026-11-17T17:54:43.086Z MATRIX B1 FAIL — speech detected (5 partials) but no final result (err7=true)
2026-11-17T17:54:43.160Z MATRIX B2 begin (case B attempt 2)
2026-11-17T17:55:49.209Z MATRIX B2 primer speak at 22:55:49.209
2026-11-17T17:57:30.882Z MATRIX B2 attempt speak at 22:57:30.882
2026-11-17T17:57:40.897Z MATRIX B2 repeat speak at 22:57:40.897
2026-11-17T17:58:37.558Z MATRIX B2 FAIL — no recognizer activity (err7=false rearm=0 cap=false)
2026-11-17T17:58:37.642Z MATRIX B3 begin (case B attempt 3)
2026-11-17T17:59:00.627Z MATRIX B3 primer speak at 22:59:00.627
2026-11-17T18:00:42.302Z MATRIX B3 attempt speak at 23:00:42.302
2026-11-17T18:00:52.338Z MATRIX B3 repeat speak at 23:00:52.338
2026-11-17T18:01:49.024Z MATRIX B3 FAIL — no recognizer activity (err7=false rearm=0 cap=false)
2026-11-17T18:01:49.152Z MATRIX C1 begin (case C attempt 1)
2026-11-17T18:03:33.488Z MATRIX C1 attempt speak at 23:03:33.488
2026-11-17T18:03:43.525Z MATRIX C1 repeat speak at 23:03:43.525
2026-11-17T18:04:40.235Z MATRIX C1 FAIL — no recognizer activity (err7=false rearm=0 cap=false)
2026-11-17T18:04:40.333Z MATRIX C2 begin (case C attempt 2)
2026-11-17T18:06:24.570Z MATRIX C2 attempt speak at 23:06:24.570
2026-11-17T18:06:34.621Z MATRIX C2 repeat speak at 23:06:34.621
2026-11-17T18:07:31.290Z MATRIX C2 FAIL — no recognizer activity (err7=false rearm=0 cap=false)
2026-11-17T18:07:31.376Z MATRIX C3 begin (case C attempt 3)
2026-11-17T23:09:12+05:00 svc power stayon usb enabled for matrix runs (test env; revert at cleanup)
2026-11-17T18:09:35.602Z MATRIX C3 attempt speak at 23:09:35.602
2026-11-17T18:09:45.647Z MATRIX C3 repeat speak at 23:09:45.647
2026-11-17T18:10:42.347Z MATRIX C3 FAIL — no recognizer activity (err7=false rearm=0 cap=false)
2026-11-17T18:10:42.440Z MATRIX D1 begin (case D attempt 1)
2026-11-17T23:16:26+05:00 MATRIX runner STOPPED by owner; D1 aborted (hung after background-return, CDP forward lost); D2 D3 E1 E2 E3 not started
2026-11-17T18:16:26.209Z MATRIX D2 begin (case D attempt 2)

## Cleanup (owner instruction)
- Matrix runner stopped; D1 aborted (hung >4 min on CDP re-forward after background return), D2/D3/E1-E3 never started.
- Local API stopped (was src/server.js pid 11916). adb forward --remove-all (removed tcp:9222). adb reverse --remove-all (removed tcp:3001). svc power stayon reverted to false.
- Phone: flag-ON staging build (bundled localhost:5173) still installed and in foreground; voice session stopped since cap at 23:04:40 — no recognizer running.
- FINAL_REPORT_AG.md written. No commits, no pushes, no deploys.
