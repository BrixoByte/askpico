# Round 63 — Phase 4 diff summary (apps/mobile Android shell)

Branch: `feat/text-only`. Uncommitted. Stat: **5 files changed, 3 insertions(+), 296 deletions(-)**. No release APK/AAB built (debug only, per plan).

## AndroidManifest.xml (−1)

- Removed `<uses-permission android:name="android.permission.RECORD_AUDIO" />` (was line 12). CAMERA kept (attachment capture). No other manifest change.
- No in-app mic explanation dialog or mic strings exist in `res/` — the mic rationale lived in the web layer (`PermissionPrompt.tsx`, deleted in Phase 2). Verified: `rg mic|audio|voice app/src/main/res/` → 0 hits.

## PicoBridge.kt (−24)

Removed 4 `@JavascriptInterface` voice methods:

- `speak(token,id,text,lang)` → `speakNative` (was L59-63)
- `stopSpeaking(token)` → `stopNativeSpeech` (was L65-69)
- `startVoiceInput(token,language)` (was L221-225)
- `stopVoiceInput(token)` (was L227-231)

Kept: share, openExternal, logMessage/logError, openAppSettings, hasCapability, requestAccess, performAction, vault*, setShield, focus* (15 methods), setSystemBars, listLaunchableApps, getAppVersion.

## MainActivity.kt (−272). Removed ranges (pre-edit line numbers)

| range | what |
|---|---|
| L16-18 | imports `RecognitionListener`, `RecognizerIntent`, `SpeechRecognizer` |
| L48-50 | imports `TextToSpeech`, `UtteranceProgressListener`, `java.util.Locale` |
| L60-62 | companion `current` field + comment — existed only for ShieldService→silenceForShield; that call removed, so field + both write sites went too |
| L91-99 | voice fields: `speechRecognizer`, `pendingVoiceLang`, `voiceWanted`, `voiceRetries`, `idleRestarts`, `voiceLang`, `preferOffline` |
| L101-113 | TTS fields: `tts`, `ttsReady`, `ttsProgress` (UtteranceProgressListener) |
| L115-125 | `voicePermissionLauncher` (RECORD_AUDIO request → beginVoiceSession) |
| L181 | `current = this` in onCreate |
| L204-207 | `tts = TextToSpeech(...)` init in onCreate |
| L401-403 | bridge method list: removed `"speak"`, `"stopSpeaking"`, `"startVoiceInput"`, `"stopVoiceInput"` from the token-wrapper list (list kept single-line otherwise) |
| L428-471 | whole voice bridge block: `startVoiceInput`, `stopVoiceInput`, `beginVoiceSession`, **`restartListening` — the idle-restart logic, removed here as it exists only for the recognizer**, `endVoiceSession` |
| L551-570 | `speakNative` (Android TTS reply speech) |
| L572-574 | `stopNativeSpeech` |
| L576-584 | `silenceForShield` (only caller was ShieldService; call removed there) |
| L586-593 | `emitTts` → `window.PicoTTS.onDone` |
| L595-619 | `startListening` (SpeechRecognizer intent builder incl. `EXTRA_PREFER_OFFLINE`) |
| L621-699 | `voiceListener` RecognitionListener — incl. **bounded idle restart `MAX_IDLE_RESTARTS`/`idleRestarts` (idle-restart logic, recognizer-only)**, `MAX_TRANSIENT_RETRIES`, offline-pack fallback 12/13, error→restart matrix |
| L701-704 | `fail` |
| L706-709 | `emitVoice` → `window.PicoVoice.*` events |
| L712 | `RESOURCE_AUDIO_CAPTURE → RECORD_AUDIO` mapping in `resourceToPermission` (VIDEO_CAPTURE→CAMERA kept for attachment capture) |
| L974 | comment "Chat and voice are untouched" → "Chat is untouched" |
| L1003, L1011-1019 | onDestroy: `current === this` clear, `tts?.shutdown()`, `speechRecognizer?.destroy()`/null |

Kept intact: webView setup, bridge token/script, file chooser + capture permissions (camera), requestAccess overlay/usage/notifications, runAgentAction, bundled assets, load failure/offline/mid-banner, retry + watchdog + network callback, confirmExit, onTrimMemory→PicoMemory, onConfigurationChanged, onResume/onPause, ShieldService.sync.

## Capabilities.kt (−1)

- Removed `"microphone" -> Manifest.permission.RECORD_AUDIO` from `runtimePermission`. `notifications`, `overlay`, `usage` rows kept. A stray `requestAccess("microphone")` now resolves to `null` permission → no-op (web no longer sends it).

## ShieldService.kt (−1)

- Removed `MainActivity.current?.silenceForShield()` (was L126) — its callee is gone; `MainActivity.current` removed with it.
- **Kept** `requestShieldAudioFocus`/mute guard — that mutes the *blocked app's* media while the overlay is up (Focus feature, not voice).

## proguard-rules.pro — no change

No voice-specific keep rules exist. `-keep PicoBridge`/`MainActivity`/`agent.**` are shared keeps and stay.

## Gates

| gate | result |
|---|---|
| `assembleDebug` | **BUILD SUCCESSFUL in 29s** (compileDebugKotlin clean) |
| `testDebugUnitTest` | **BUILD SUCCESSFUL in 4s** |
| merged debug manifest `RECORD_AUDIO` | **absent** — 0 hits in `merged_manifests/debug` and `packaged_manifests/debug`; INTERNET/NETWORK_STATE/CAMERA/NOTIFICATIONS/SYSTEM_ALERT_WINDOW/FOREGROUND_SERVICE(+SPECIAL_USE)/PACKAGE_USAGE_STATS all still present |
| `app/src/main` grep voice\|speech\|tts\|RECORD_AUDIO\|microphone | **0 hits** |
| release build | not built (per plan) |

## STOP — waiting for owner "CONTINUE" before Phase 5 (docs).
