# Round 39 — Voice disconnect: diagnosis

Device: TECNO CL6 (adb `119652548M014318`), debug build with `WEB_URL=https://go.askpico.app`, signed in as the test account. Clock: device time equals PC time (both local).

## 1. What the recordings say (offline STT: faster-whisper `base`, CPU)

Transcripts: `AUDIO/*.txt` (timestamps are seconds inside each WAV).

| File | Played line (PC speaker, `playback_log.txt`) | What the PC mic captured | Pico reply captured? |
|---|---|---|---|
| t01_laptop_mic.wav | "Hello Pico, good morning. How are you today?" (20:38:03–08) | "hello Piko, good morning. How are you today?" at 0–4.7 s; silence after | No. Logs say Pico spoke (see §2). The PC mic did not pick the reply up. |
| t02_laptop_mic.wav | "What time is it in Multan right now?" (20:39:19–23) | "nd" | No |
| t02b_laptop_mic.wav | same, after Retry (20:40:36–39) | "What time is it in all time right now?" at 0 s and 30 s | No |
| t03_laptop_mic.wav | same, volume max (20:43:42–46) | "What time is it in rule time right now?" | No |
| t04_laptop_mic.wav | same, fresh voice mode (20:45:03–07) | "What time is it in return right now?" | No |

Correction: the file you played back (t04) contains **my own scripted line**, not Pico's reply. Pico's reply speech is not present in any recording.

## 2. Timeline from phone logcat (device clock)

| Time | Event | Source |
|---|---|---|
| 20:38:03 | Turn 1 line played | playback_log |
| (turn 1) | Reply sentences enqueued; server TTS `503` → native Android TTS "Speaking reply"; "Resuming listening (reply finished)" | logcat `PICO-INFO][Reply]`, `[TTS]` |
| 20:39:19 | Turn 2 line played | playback_log |
| 20:40 | No speech → UI shows "No speech detected. Try again." with Retry | screenshot `r39_turn02_state.png` |
| 20:40:36 | Turn 2b line played (after Retry) | playback_log |
| 20:43:42 | Turn 3 line played (volume max) | playback_log |
| 20:45:03 | Turn 4 line played (after reload + voice mode on) | playback_log |
| 20:45:48 | `RecognitionService#onStartListening` — **45 s after the line was played** | logcat |
| 20:45:49 | `onStartOfSpeech` (source unknown; not my line, which had ended at 20:45:07) | logcat |
| 20:46:04 | SODA (on-device recognizer) initialised for `com.askpico.pico` (`Initializing SODA`) | logcat |
| 20:46:04.8 | Offline recognizer start detection | logcat `Recognizer` |
| 20:46:09.2 | "Audio process finished" (about 5 s window) | logcat |
| 20:46:09.39 | `NO_SPEECH_DETECTED` (error code −1, `RecognitionServiceImpl`) | logcat |
| 20:46:10.7 | Idle restart #1 (the single allowed restart) | logcat |
| 20:46:15.9 | Second `NO_SPEECH_DETECTED` → `Native recognizer error code 7` → `Native recognizer ended` | logcat `[STT]` |
| after 20:46:15 | Nothing restarts. UI stays on "No speech" + Retry | screenshot |

## 3. Code path (apps/web/src/voice/stt.ts)

- `onEnd` (≈ line 575–585): sets `wantRunning = false` and calls `finish(true)`. The comment says "Wake-driven listening: the native recognizer is not restarted during silence."
- Idle path (≈ line 474–497): silence with no speech restarts at most `MAX_IDLE_RESTARTS` times (one restart seen in logs). After that the window ends with `waiting for the next voice onset`. In practice there is no next onset, because the engine is not running, so the session is dead until the user taps the mic.
- `onError` no-speech branch (≈ line 554–557): sets `wantRunning = false`, shows "No speech detected. Try again.", then finishes. There is no re-arm.

So: once a listening window passes without speech (about 5 s per window, one restart), voice mode stops listening and needs a manual Retry. This is the "bar stopped and voice stopped" behaviour you saw.

## 4. Ranked hypotheses

| # | Hypothesis | Status | Evidence |
|---|---|---|---|
| H1 | After a no-speech window, listening is not re-armed (stt.ts: wake-driven design plus `MAX_IDLE_RESTARTS` cap). Speech that starts after the window is lost, and the UI waits for a Retry. | **CONFIRMED** (code + logs) | logcat 20:46:09–15; stt.ts ≈ 474–497, 554–557, 575–585 |
| H2 | Cold-start delay of the recognizer after reload or voice-mode toggle (about 45 s: 20:45:03 play, 20:45:48 onStartListening, SODA init 20:46:04). Turn 4 spoke into a window that had not started. | **LIKELY** | logcat timestamps above |
| H3 | Acoustic: Pico reply and my line are too quiet at the PC mic. PC mic captured my own line at about 0.02–0.05 RMS; no Pico reply in any file. | **LIKELY**, not confirmed; needs physical setup (phone within about 20 cm of PC speaker, or PC mic gain check) | recordings, RMS windows |
| H4 | Audio routed to earpiece so the reply is quiet. | **REJECTED**: `Audio mode: MODE_NORMAL`, music device is `speaker(2)`, volume 12/15, not muted | `dumpsys audio` |
| H5 | Echo cancellation or wrong mic source drops the line. | **REJECTED**: record source is `AUDIO_SOURCE_DEFAULT`; no loopback AEC on this path | `dumpsys media.audio_flinger`, SODA log "No loopback, turning off both AEC" |
| H6 | Server TTS 503 blocks the reply. | **Separate bug**: 503 falls back to native TTS, so it does not block speech. Medium severity. | logcat `Server TTS responded 503` |
| H7 | Mood tag or markdown breaking TTS. | **UNKNOWN**: not reached in this run, because no reply was generated after turn 1 | — |

## 5. Proposed diff (NOT applied — stt.ts is the forbidden file without owner approval)

Idea: keep listening while voice mode is on. A no-speech window re-arms the recognizer after a short cooldown, with a per-session cap that resets whenever speech is heard. Nothing is restarted during actual speech.

```diff
--- a/apps/web/src/voice/stt.ts
+++ b/apps/web/src/voice/stt.ts
@@ onEnd: native recognizer ended
       onEnd: () => {
         ...
         if (stale()) return;
-        // Wake-driven listening: the native recognizer is not restarted during silence.
-        this.wantRunning = false;
-        this.finish(true);
+        if (!this.heardAudio && this.wantRunning && this.idleRestarts < MAX_IDLE_RESTARTS) {
+          this.idleRestarts += 1;
+          PicoLogger.info('STT', 'No speech in window; re-arming listening', { attempt: this.idleRestarts });
+          this.restartTimer = setTimeout(() => {
+            this.restartTimer = null;
+            if (!stale() && this.wantRunning) this.startWeb();
+          }, RESTART_COOLDOWN_MS);
+          return;
+        }
+        this.wantRunning = false;
+        this.finish(true);
       },
@@ onError: no-speech
         if (key === 'no-speech') {
-          this.wantRunning = false;
-          this.handlers.onError?.(ERROR_MESSAGES['no-speech'], false);
-          setTimeout(() => { if (!stale()) this.finish(); }, 300);
+          // Let onEnd decide: it re-arms while under MAX_IDLE_RESTARTS.
           return;
         }
```

Also: raise `MAX_IDLE_RESTARTS` for voice-mode sessions (the 5 s native window is short for normal speech), and reset `idleRestarts` on every `onSpeechStart` (already done).

Unit test to add with the fix (`stt.test.ts`): feed `onEnd` with `heardAudio=false, wantRunning=true` and assert exactly one `startWeb` after the cooldown; feed it with `heardAudio=true` and assert no restart.

## 6. What needs owner approval

The diff above changes `stt.ts` idle-restart behaviour. Per the brief, I stop here and wait for approval in chat before editing that file. Nothing has been changed in code this round.

Safe to do without approval (not yet done): debug-only logging in web code that prints each reply text (first 200 characters) and recognizer/TTS state transitions, guarded by the debug flag, with a unit test that it is off in release.

## 6a. Applied H1 fix (approved) and what the 5-turn reproduction showed

Applied in `apps/web/src/voice/stt.ts` (Android bridge path only):
- Constants `ANDROID_REARM_MAX = 3`, `ANDROID_REARM_COOLDOWN_MS = 1500`.
- `onEnd`: when `!heardAudio && wantRunning` and the per-session count is under the cap, re-arm via `picoBridge().startVoiceInput` after 1.5 s (counter +1). At the cap, log `Re-arm cap reached; listening stopped until the next tap` (PicoLogger.info, `max: 3`) and finish.
- `onPartial`, `onResult`, `onSpeechStart`: counter reset to 0 (real speech only).
- `onError` no-speech: no longer ends the session; `onEnd` decides.
- Re-arm resets `heardAudio = false` so each silent window counts on its own.

Tests: `apps/web/src/voice/stt.rearm.test.ts` (6 tests, pass). Full suite 378/378; tsc clean; `npm run build` (flag ON, `VITE_BACKEND_URL=http://localhost:3001`) OK; `assembleDebug`, `testDebugUnitTest`, `assembleStaging` BUILD SUCCESSFUL.

Device: staging flag-ON APK installed, WebView on bundled `localhost:5173` origin, backend = local API via `adb reverse tcp:3001` (see deviation below).

Deviation: the phone previously loaded `go.askpico.app` (deployed bundle). The fix only exists in the local bundle, and `api.askpico.app` does not allow the `localhost` origin (CORS), so the test used the local API on `localhost:3001`.

### 5-turn reproduction result (run 5, `AUDIO/run5.sh`)

| Turn | Line | Result | Evidence |
|---|---|---|---|
| 1 | "Hello Pico, good morning. How are you today?" | FAIL (no recognizer events logged in this run) | `AUDIO/r5_t01.logcat.txt` (empty) |
| 2 | "What time is it in Multan right now?" | FAIL (no recognizer events) | `AUDIO/r5_t02.logcat.txt` |
| 3 | "Tell me one short fact about the moon." | FAIL (no recognizer events) | `AUDIO/r5_t03.logcat.txt` |
| 4 | "Say that again please." | not completed (runner stopped) | — |
| 5 | "Thanks, that is all for now." | not run | — |

Earlier in the same session (console, 21:33 local), the fix did work once: `No speech in window; re-arming listening` → `Native speech detected (onSpeechStart)` → partials and store. So the re-arm path is live, but it does not cover the case below.

### New finding H8 (CONFIRMED by console trace): speech without a final result leaves listening stuck

- Console (CDP, 15 s window after the run): no STT events at all. The UI still shows "Listening…".
- Sequence in the last window: `Native speech detected` → partial/store → `Native recognizer error code 7` → `Native recognizer ended`. There was speech, so `heardAudio = true`, so `onEnd` does not re-arm (by design), and `finish(true)` waits for "the next voice onset". The engine is not running, so no onset can happen.
- Recognizer host is alive (`com.google.android.tts` pid 8287, `GoogleTTSRecognitionService` bound). Memory is fine (MemAvailable about 2.3 GB). The "low memory" banner is shown by the app's trim handler but it is not the cause.

Proposed minimal extension (NOT applied, outside the approved H1 scope):
- In `onEnd`, if the window ended after speech but with no final result (`onResult` not called) and `wantRunning` is still true, re-arm with the same cooldown and the same cap of 3. Reset the counter on `onResult` (already done). Keep the wake-driven behaviour when the user has a final result.
- Unit test: window with `onSpeechStart` and no `onResult` → one re-arm after 1.5 s; with `onResult` → no re-arm.

## 6b. Re-arm extension (approved) — applied, unit-tested, and the run result

Applied in `stt.ts` (Android path): re-arm any window that ends while still wanted (partial-only or silent), cap 3 per session, 1.5 s cooldown; counter reset only on `onResult`; at cap, `onError("Voice stopped. Tap to try again.", false)`.

Tests: `stt.rearm.test.ts` 8/8 (partial-only re-arm, speech-start re-arm, cap at 3, cap UI message, reset only on final result, no re-arm after final result, no re-arm after stop, no-speech re-arm). Full suite 380/380, tsc clean, `npm run build` (flag ON, local backend) OK, `assembleDebug` + `testDebugUnitTest` + `assembleStaging` BUILD SUCCESSFUL. Staging flag-ON APK reinstalled.

### Run 6 (5-turn reproduction, with console tap)

| Turn | Line | Recognised (final result) | Spoken reply | Result |
|---|---|---|---|---|
| 1 | Hello Pico, good morning. How are you today? | no final result in window; re-arm (21:43:04) | no | FAIL |
| 2 | What time is it in Multan right now? | yes: "What time is it in Wilton right now" (21:43:28) | no (see below) | PARTIAL |
| 3 | What time is it in Multan right now? (repeated, 21:44:10) | yes: "What time is it in Wilton right now" | no | PARTIAL |
| 4 | Tell me one short fact about the Moon | yes: "Tell me one short fact about the Moon" (21:45:04) | no | PARTIAL |
| 5 | Say that again please | not captured | no | FAIL |

Turn numbering: the run had 5 lines; the console shows 3 captured final results (rows 2, 3, 4 above). Run stopped after turn 5.

Why there is no spoken reply: the on-screen text was "The model returned an empty answer. Please try again." The local API (`services/api`, pointed at the owner's Supabase `.env`) logs `[voice-turn] chat ...`, but also `Could not find the table 'public.feature_flags' / 'model_pricing' / 'ai_usage'` and an earlier `provider sync failed: credits endpoint returned 401`. So the LLM provider returned an empty reply. This is backend setup, not the voice state machine. Speech recognition, submit, and "Resuming listening" all work.

Open question (not verified): whether the cap UI message (Voice stopped) appeared in run 6. It did not reach the cap in run 6 (re-arms were within limit).

## 7. Next steps once approved

1. Apply the stt.ts diff and unit test; run tsc, `yarn test`, `yarn build`, `./gradlew assembleDebug`.
2. Reinstall the debug build; re-run turns 1 to 5 with the same playback and recording setup.
3. Acoustic check (H3) with the phone about 20 cm from the PC speaker, so that Pico's reply is captured.
