# Round 40 — Final report (voice pipeline debug + re-arm fix verification)

Date: 2026-11-17. Build under test: `app-staging.apk` (flag-ON bundled web at http://localhost:5173, local API at localhost:3001 via adb reverse). Production (go.askpico.app) still serves the OLD stt.ts — **this fix is not on production until a deploy**.

## 1. Summary

- **Re-arm fix: VERIFIED WORKING on the flag-ON build.** Windows that end without a final result re-arm after the 1.5 s cooldown; the 3-per-session cap stops listening with "Voice stopped. Tap to try again."; the counter resets on a final result. Case A (cold start) passed 3/3.
- **Root cause layer (unchanged from draft):** on production, the recognizer ends windows with error 7 (NO_MATCH) after partial speech and the OLD stt.ts never re-arms → stuck "Listening" / "No speech detected". The fix addresses exactly this.
- **Confidence:** high that the production stuck-listening layer is the same mechanism the fix handles; medium on field reliability (laptop-speaker SNR caused marginal recognition locally — see environment note).
- **Still unknown:** (a) the 429 on `/api/chat` (local API returned it on every attempt; body uncaptured — local API is blocked by missing tables, unchanged per constraints); (b) TTS onStart/onDone — never reached because no reply was generated locally; (c) the burst-event anomaly (§5).

## 2. Case A — cold start, first turn: 3/3 PASS

| Attempt | Result | Evidence |
|---|---|---|
| A1 | PASS | `MATRIX_EVENTS_A1.txt` 22:50:00.6 onSpeechStart → 15 partials → 22:50:02.967 `Native final result: "What time is it in Wilton right now"` → 22:50:03.072 `submit turn` → POST /api/chat 429 (22:50:04.05, ttfb 979 ms) → `Resuming listening` → next `startVoiceInput` |
| A2 | PASS | `MATRIX_EVENTS_A2.txt` 22:51:41.148 `Native final result: "What time is it in Wilton right now"` → submit → RESP /api/chat 429 (ttfb 1262 ms) → 22:51:42.5 `Resuming listening` |
| A3 | PASS | `MATRIX_EVENTS_A3.txt` 22:52:25.649 `Native final result: "What time is it in Wilton right now"` → submit → RESP /api/chat 429 (ttfb 1336 ms) → 22:52:27.1 `Resuming listening` |

Note: "Wilton" is the recognizer mis-hearing "Multan" — a transcription-accuracy issue, not a pipeline failure. All three turns reached `submit turn` and the session returned to listening by itself.

## 3. Re-arm fix verification (quoted log lines, flag-ON build)

- Re-arm after a no-final-result window (fires whether the window had partials or none):
  `🟢 [PICO-INFO][STT]: No final result in window; re-arming listening` — e.g. MATRIX_EVENTS_A1.txt 22:42:17.668, 22:42:42.905, 22:44:08.842, 22:44:57.617; 22:51:35.466.
- Cap after 3 automatic re-arms:
  `🟢 [PICO-INFO][STT]: Re-arm cap reached; listening stopped until the next tap` — MATRIX_EVENTS_C1.txt 23:01:49.368, MATRIX_EVENTS_C2.txt 23:04:40.495.
- Reset on final result: A-case turns produced final results after previous re-arms (counter reset confirmed by new windows starting without hitting cap mid-turn).
- Gates: `tsc --noEmit` clean; `stt.rearm.test.ts` 8/8 PASS; full suite 380/380 PASS; `VITE_AGENT_ACTIONS=true vite build` OK; `assembleStaging` BUILD SUCCESSFUL.
- `MainActivity` idle-restart logic: untouched. H-E/H-F/H-G code: untouched.

## 4. Cases B–E — stopped early by owner; recorded causes

| Case | Attempts | Result | Classification |
|---|---|---|---|
| B (after reply +5 s) | B1 FAIL, B2 FAIL, B3 FAIL | Harness/environment, not the fix | Primers were spoken while the session was already capped or dead (cap hit during the silent gaps between runs); B1 got partials+err7, B2/B3 saw zero recognizer activity because the session had stopped and the runner did not reset it |
| C (after silence timeout) | C1 FAIL, C2 FAIL, C3 FAIL | Harness/environment, not the fix | Session hit the 3-re-arm cap during the case's own silence wait (cap is the designed behavior), then the attempt spoke into a stopped session → zero events. The runner's mark missed cap lines that arrived before the mark |
| D (background 30 s) | D1 ABORTED (hung), D2/D3 not started | Harness | CDP socket `webview_devtools_remote_<pid>` changes after process restart/backgrounding; re-forward worked on cold start (A) but D1 hung >4 min waiting — forward lost. Stopped by owner |
| E (Wi-Fi control, same as B) | not started | — | Stopped by owner |

Why these are not fix failures: the fix's behavior was directly observed (re-arm lines, cap line, reset on result). The B/C failures trace to (a) the session legitimately capping during silence between attempts, and (b) the laptop speaker producing marginal audio (RMS 0.02–0.09) that the on-device recognizer often turns into partials-then-error-7 instead of a final result — the same marginal-recognition signature seen on production, and the reason this fix exists.

## 5. Open issue — burst-event anomaly

At 22:55:26.185–202 (MATRIX_EVENTS_B2.txt), a full turn of console events — startVoiceInput, error 7, ended, re-arm, onSpeechStart, 11 partials, final result, utterance, submit — arrived within ~17 ms of each other. Real-time emission is impossible; these are buffered/throttled deliveries flushed when the CDP client attached or the page unfroze. Implication: while frozen, no console events flow AND the voice session cannot progress — matches B2/B3 "no recognizer activity" runs.
- Screen state during those runs: device `mWakefulness=Awake`, `screen_off_timeout=600000` — the freeze may be page-level (WebView throttling), not display sleep.
- `svc power stayon usb` was enabled at ~22:59 local AFTER the anomaly was observed (timestamped in DEBUG_LOG.md) to rule out display sleep; it did not prevent the earlier freeze.
- Owner follow-up: watch for recurrence; if pages freeze mid-session in the field, listening windows stop advancing (looks identical to stuck Listening).

## 6. Proposed diff and approval

- Fix = the approved stt.ts re-arm extension (onEnd re-arm on no-final-result windows, 1.5 s cooldown, cap 3, reset on final result, cap message). Already applied under owner approval; unchanged in this round.
- Status: APPLIED locally; NOT deployed. Production still runs old stt.ts.
- No further diff proposed or applied in this round.

## 7. Remaining unknowns / owner actions

- 429 on /api/chat: seen on every local attempt (local API missing feature_flags/model_pricing/ai_usage — DB unchanged per constraints). On production it occurred once at 22:25:45 (22:25 window). Body still uncaptured — needs one voice turn against a healthy backend with the [R40-HTTP] hook (in-page, gone after reload).
- TTS onStart/onDone: never reached (no reply generated in any local attempt). Needs a working backend reply.
- B–E matrix: not completed; needs runner fixes (reset capped session before each attempt; wait for a live window; handle post-restart CDP re-forward).
- Listen for: in `AUDIO/A1_mic.wav`/`vol_check*.wav`, whether the spoken line is clearly audible; the recognizer needs clean ~0.05+ RMS speech to finalize.

## 8. Constraints honored

No code changes beyond the already-approved stt.ts fix. No commit/push/deploy. No cloud/Supabase/Railway/Firebase/Play changes. No file/app/chat/account deleted. No WhatsApp message, no call. No secrets printed.
