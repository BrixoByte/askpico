# last-chat.md — session handoff

Read this first when you resume. It summarises the last chat so you can continue without re-discovering the setup.
Last updated: 2026-11-13 (~11:45 PKT).

## Project

- Repo: `F:\Developer\Web Apps\askpico` (Pico AI workspace).
- `apps/mobile` = Android app (Kotlin WebView shell, package `com.askpico.pico`). Open this folder in Android Studio.
- `apps/web` = React/Vite web app (WebView loads `http://localhost:5173` in debug).
- `services/api` = Express backend on port 3001 (Supabase, OpenRouter).
- Testing docs and logs: `apps/mobile/testing/` (`TESTING_PLAYBOOK.md`, `before-crash.md`, `todo.md`, `debug.log`, `live_web.log`, `live_native.log`, screenshots).

## Environment

- Device: TECNO CL6, Android 16, wireless adb serial `119652548M014318`. Screen 1080x2436, CSS viewport 360px wide.
- adb: `C:\Users\Ahtasham734\AppData\Local\Android\sdk\platform-tools\adb.exe` (not on PATH). Use `MSYS_NO_PATHCONV=1` in Git Bash for `/sdcard` paths.
- JDK: `C:\Users\Ahtasham734\.jdks\jbr-21.0.11`. Gradle 8.9 at `C:\Users\Ahtasham734\.gradle\wrapper\dists\gradle-8.9-bin\90cnw93cvbtalezasaz0blq0a\gradle-8.9\bin\gradle`.
- Build: `cd apps/mobile && gradle :app:assembleDebug`, then `adb install -r app/build/outputs/apk/debug/app-debug.apk`.
- adb reverse: `powershell -File adb-watch.ps1 -Once` (ports 5173 and 3001). Re-run after reconnect.
- Backend: `cd services/api && node --env-file=.env src/server.js`. Web: `cd apps/web && npx vite --host 0.0.0.0 --port 5173 --strictPort`.
- WebView DevTools: `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`, then `node apps/mobile/testing/cdp.mjs eval "<js>"` or `logs <seconds>`. Re-forward after each app restart (pid changes).

## Model rule (current)

- Only `anthropic/claude-haiku-5.5` via OpenRouter. No voice/audio AI model.
- Set in `services/api/.env`: `LLM_PROVIDER=openrouter`, `ROUTE_MODELS_QUICK/SMART/DEEP_FAST/DEEP_PRO=anthropic/claude-haiku-5.5`, `EMBEDDINGS_ENABLED=false`, `EDGE_TTS_ENABLED=false`.
- Original `.env` backup is outside the repo: `C:\Users\Ahtasham734\askpico-env-backup-do-not-commit.bak`. Never copy it into the repo.
- Voice input and output use the phone's native engines: `SpeechRecognizer` (input) and `TextToSpeech` (output).

## Code changes made (uncommitted working tree)

1. **Voice listening (main fix):** removed `WakeListener.kt` (VAD). It never received audio on this device, so the mic never triggered.
   - `MainActivity.kt`: native recognizer stays on during voice mode. It restarts after `NO_MATCH` and `SPEECH_TIMEOUT`. Transient errors (network, server, busy, client) retry up to 3 times. Other errors end the session.
   - `apps/web/src/voice/stt.ts`: Android error-code mapping corrected.
2. **Composer clipped at 360px:** `apps/web/src/components/Chat/ModeSelector.tsx`. Model pill label is narrower on small screens (`max-w-[88px] sm:max-w-[140px]`).
3. **Sign-up left session as Guest:** `apps/web/src/components/Auth/AuthModal.tsx`. If the current session is anonymous, sign-up now calls `updateUser` (upgrade) instead of `signUp`.
4. **Native mic permission modal:** `apps/web/src/components/Voice/VoiceVisualizer.tsx`. Uses native capability (`hasCapability` / `requestAccess`); no WebView `getUserMedia` probe in native app.
5. **Backend kill switch:** `services/api/src/memory/vectorWorker.js`. `EMBEDDINGS_ENABLED=false` disables embeddings. Default unchanged.

Verification done: `tsc --noEmit` passes; debug APK builds; backend tests 95/95 (before the kill switch change, which was verified by a live chat turn).

## Test results so far

- Text chat with Haiku works (Roman Urdu and English). Replies stream and complete.
- Voice loop works: speech → transcript → `/api/chat` → Haiku → native TTS. Round-trip about 2.8–4 s to first audio sentence.
- Sidebar, dark mode, Explore/Library placeholders OK.
- Sign-up/upgrade path verified via API: guest upgraded to `picoguest20261113@gmail.com`, sign-in gives `is_anonymous=false`.
- Known open items:
  - PC speaker test sentences were not transcribed reliably (acoustic limit of test setup). User should test with real speech.
  - Chat mic is off while the assistant speaks (by design, to avoid echo). Barge-in during reply is not possible.
  - Explore, Library, Projects, Studio are placeholders.
  - Guest users: voice home hides text composer; "Magic" menu asks for sign-in.
  - English prompt sometimes gets a Roman Urdu reply. Check reply-language setting.

## Plan / billing (work done in this chat)

- Plan is stored in Supabase table `subscriptions` (`user_id`, `plan`, `expires_at`). Backend reads it in `getUserPlan` (`services/api/src/supabase.js`).
- Coupon `100OFF` (100%, monthly, 1 use) was redeemed by `picoguest20261113@gmail.com`. Redeem burns the coupon and writes `coupon_redemptions`, but it does **not** create a subscription row. That is a code gap in `redeem_coupon` (`supabase/migrations/0004_coupons_rewards.sql`).
- Manual data fix: inserted `subscriptions` row for `picoguest20261113@gmail.com` (user id `ff517a75-6277-4664-adcc-dbbf880a4494`), `plan=monthly`, expiry 30 days. `/api/usage` now returns `plan: monthly`.
- Pending: confirm the Account panel in the app shows Monthly (not verified on the device UI yet). Fix `redeem_coupon` so it creates the subscription itself (needs user confirmation before running a migration on the production DB).
- Another account `letsearnnowinstantaly@gmail.com` already has a `monthly` subscription (set earlier by the user).
- Never write billing rows without explicit user confirmation.

## Repo hygiene

- Working tree has many pre-existing modified and deleted files unrelated to this session (for example `apps/web/public/*`, `services/api/src/*`). Do not revert them.
- Keep secrets out of docs and chat. `services/api/.env` is gitignored; the backup must stay outside the repo.

## Next steps (in order)

1. Check the Account panel on the device shows the monthly plan. If not, force-stop the app and reopen.
2. Test voice with real speech: tap mic, speak a question, confirm reply is spoken, confirm mic reopens after reply.
3. Ask user whether to make `redeem_coupon` create subscriptions (migration). Do this only with confirmation.
4. Continue `todo.md` items: stop generation, chat history, settings, forgot password, logout, offline banner.
