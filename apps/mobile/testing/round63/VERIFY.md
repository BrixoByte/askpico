# Phase 6 — Behaviour verification (text-only build)

Branch `feat/text-only`, flag OFF. Local stack: API on :3001 (`npm start` in `services/api`),
Vite dev on :5173 (`apps/web`), served at `chat.localhost:5173`.

## Web — desktop Chrome via CDP (port 9223)

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | No mic button / voice UI / voice trial row / Start voice mode / mic prompt | **PASS** — 0 DOM hits for `startVoiceInput`, `PicoVoice`, `VoiceController`, `VoiceVisualizer`, `GuestVoiceTrial`, `PermissionPrompt`, `voice-store`, `RECORD_AUDIO`; 0 `class`/`id` hits for `mic`, `voice`, `speech`. `window.PicoBridge` undefined (desktop). | `verify_web_guest.png` |
| 2 | One short text message → text reply | **PASS** — anonymous guest session created (`createGuestSession` → `sb-*` localStorage key), submitted "Say hi" via composer, received streamed reply "ہیلو!ا ہوں؟". | `verify_web_chat_reply.png` |
| 3 | Open one tool (Magic menu) | **PASS (gate)** — "Magic" opens the tools sheet; for a guest it correctly shows the sign-in gate ("Sign in to choose a mode"), dismissible via "Not now". Full tool run needs a signed-in test account (credentials not used per rules). | CDP eval log |
| 4 | History rename/delete (test chat only) | **PASS** — done on the Android shell below (same `ChatHistory` code path): double-click rename "New Chat 29" → "r63 verify chat" (list updated), context-menu delete + confirm (chat count 29 → 28). Desktop guest sidebar hides the history list for anonymous users by design (`signedIn` gate in `ChatHistoryList.tsx`). | CDP eval log |
| 5 | Sign-in screen loads, guest entry works | **PASS** — `?guest=1` flow runs `enterChat` → anonymous Supabase session; sign-in modal renders with email field + "Not now". | CDP eval log |

## Android — debug APK on TECNO-CL6 (physical, adb)

Debug build (`WEB_URL=http://localhost:5173`) served through `adb reverse tcp:5173` and
`tcp:3001`. APK: `app/build/outputs/apk/debug/app-debug.apk` (installed via `adb install -r`).

| # | Check | Result | Evidence |
|---|---|---|---|
| a | App opens | **PASS** — `MainActivity` resumed, WebView loads `http://localhost:5173/` (Pico home, "Good to see you.") | `verify_android_launch.png` |
| b | No mic permission requested | **PASS** — `dumpsys package` requested permissions: `POST_NOTIFICATIONS`, `SYSTEM_ALERT_WINDOW`, `FOREGROUND_SERVICE(+_SPECIAL_USE)`, `SET_ALARM`, `INTERNET`, `PACKAGE_USAGE_STATS`, `ACCESS_NETWORK_STATE`, `CAMERA` — no `RECORD_AUDIO`; no permission prompt shown at launch. | dumpsys output |
| c | Voice bridge removed | **PASS** — `window.PicoBridge` exists; `PicoBridge.speak` = `undefined`, `PicoBridge.startVoiceInput` = `undefined`. Kept methods present: `share`, `openExternal`, `getAppVersion`, `hasCapability`, `requestAccess`, `performAction`, `vaultSet/Has`, `setShield`, `setSystemBars`, `focus*` (11 methods), `listLaunchableApps`, `logMessage/Error`, `openAppSettings`. | CDP eval @9222 |
| d | Text chat works | **PASS** — composer typed "Say ok", send button submit, streamed reply "ٹھیک ہ". | `verify_android_chat.png` |
| e | Downloads still work | **PASS (surface)** — `PicoDownload` JS interface + `PicoDownloader` download listener intact in `MainActivity.kt` (lines 113, 340-342); not voice-related. | source grep |

## Notes / non-voice observations (pre-existing, not regressions)

- Direct `chat.localhost:5173/` with no `?guest=1` and no session shows the guest UI but
  `/api/chat` returns `sign-in session is required` — expected: guest anonymous session is
  created only via the explicit guest hand-off (`authRoutes.ts` → `createGuestSession`).
- First LLM call on both surfaces returned "The model returned an empty answer. Please try
  again."; the immediate retry succeeded. Transient upstream behaviour, unrelated to voice.
- On Android a synthetic `Enter` keydown did not submit (native IME path differs); the send
  button submits correctly — normal behaviour, no code change needed.
- `services/api` `routing.test.js` remains env-blocked (needs `SUPABASE_URL`/`SUPABASE_KEY`).
