# Round 31 — progress log (Android beta features)

## Preconditions
- git status: pre-existing uncommitted work on branch (admin-next deleted, R28-R31 web edits).
- HEAD: 268259a (PR #1 tip), local 1 behind origin tip 0997059 per round30 check.
- D5: resolved in docs — android-app.md §19 Phase 1 says "Open decision D5 is resolved here: ACTION_CALL, per section 6" + beta-launch §2 lists intent actions for beta → ACTION_CALL + CALL_PHONE stays.
- D4: shield+intent actions listed as beta scope in android-app.md §2 and beta-launch §11 [x] rows "code complete, device testing pending" → this round IS the device verification; ships in beta.
- FCM: NOT provided (needs Firebase project + google-services.json from owner; "Do NOT touch Firebase console") → out of scope this round, owner action.
- Emails: 0 budget. Accounts: owner + existing signed-in test account only.
- LLM: chat triggers are rule-based (utils/agentIntents.ts) → 0 LLM calls needed.
- Device actions flag: shipped builds OFF; device tests use a local build with VITE_AGENT_ACTIONS=true.
- Test infra: staging variant (BUNDLED_WEB) serves dist at http://localhost:5173 → trusted origin → bridge token valid. Plan: build web with VITE_AGENT_ACTIONS=true + VITE_BACKEND_URL=https://api.askpico.app, assembleStaging, install.

## Code read (Task 1.1)
- ActionExecutor: open_app (allowlist, invalid/unsupported), open_url (https/http only), set_alarm/set_timer (AlarmClock, SKIP_UI, strictInt + label ≤100), share_whatsapp (setPackage + chooser fallback), call (mask + confirm dialog + CALL_PHONE runtime + ACTION_CALL). Vault refs resolved on-device; unresolvable → invalid.
- ShieldService: foreground service, UsageStatsManager poll 1s, overlay w/ "Back to Pico", own package excluded (ShieldRules.save filters + checkForeground `fg != packageName`).
- VaultStore: EncryptedSharedPreferences AES256-SIV/GCM, KEY_PATTERN contact|note|credential|id|other:ref_*, max 4000.
- PicoBridge: token-gated methods (doc-start wrapper), token only to Pico origins (+localhost:5173 debug).
- agentIntents.ts: rule-based detect → runAgentAction, flag-gated, wired in EditView sendSticky already (Task 2 pre-wired).

## Session 2 (post-crash resume, 2026-11-17)
- Found pre-crash state: ActionValidation.kt extracted + ActionExecutor refactored (12:39); crash hit during/before test files. Removed dead private `mask()` left in ActionExecutor.
- NEW tests: `agent/ActionValidationTest.kt` (phone, allowlist, schemes, package shape, mask) + `VaultKeyPatternTest.kt` — 25 unit tests pass via `testStagingUnitTest` (incl. existing LoadErrorClassifierTest).
- NEW tests: `apps/web/src/utils/nativeAgent.test.ts` — 9 tests: bridge-absent defaults, queued→onResult resolve, sync invalid, args verbatim (vault ref opaque, never resolved in JS), malformed reply → unsupported, throw-safe.
- Task 7 code added: `MainActivity.onTrimMemory` (level >= TRIM_MEMORY_RUNNING_LOW) → `ShieldService.setMemoryPressure(true)` (latched; overlay stops drawing) + `window.PicoMemory.onLowMemory(level)` to web.
- Web: `nativeAgent.ts` PicoMemory latch (`isLowMemoryMode`/`subscribeLowMemory`), `LowMemoryBanner.tsx` mounted in App, `PreviewFrame` iframe gated → "Preview paused — this device is low on memory" message.
- Verification: `tsc --noEmit` clean; web vitest **14 files / 350 tests pass**; `npm run build` OK (index-778b1311.js); API `npm test` **276: 273 pass, 1 env-blocked (routing.test.js needs SUPABASE_URL+SUPABASE_SERVICE_ROLE_KEY), 2 todo** — same as R30 baseline.
- Next: flag-ON web build (VITE_AGENT_ACTIONS=true VITE_BACKEND_URL=https://api.askpico.app) → assembleStaging → install → device rows 12.9.

## Task 1 — device (staging APK, flag ON)
- Installed `app-staging.apk` (flag-ON local build), `adb reverse tcp:3001`, local API on :3001, CDP on :9222.
- BUG FIXED: manifest lacked `com.android.alarm.permission.SET_ALARM` → both alarm/timer `denied`. Added, rebuilt, both `done`. Prompt's signature-permission note did NOT reproduce on this TECNO firmware.
- All 12.9 rows verified → INTENT_ACTIONS.md. call cancelled/denied, open_app done/invalid, open_url done+invalid×2, alarm+timer entries visible in Clock, whatsapp prefilled → sent to self-chat.
- Notable: no real call placed (fake number +920000000000; denied path only, per scope). User's own alarms untouched (accidental Edit sheet dismissed via BACK, no Save).

## Task 2 — chat action triggers (device, guest session, flag ON)
- 6 required + 2 confirmation-path messages through the composer. All intercepted by agentIntents rules → runAgentAction. 0 LLM calls.
- open_app×2 (youtube, instagram): opened + "Opening the app…". open_url×2 (https, bare domain): Chrome + "Opening the link…". set_timer×2: Clock + "Timer set.". call: masked confirm → CANCEL → "Cancelled.". share: confirm → CANCEL → "Cancelled.". → CHAT_TRIGGERS.md

## Task 3 — shield (device, flag ON)
- Missing-permission path: rules enabled without usage access → service self-stops, Instagram uncovered. Granted GET_USAGE_STATS + SYSTEM_ALERT_WINDOW via appops.
- BUG FIXED: ShieldService.sync() was only called from setShield — saved shield died on every relaunch. Added sync() to MainActivity.onCreate; rebuilt+reinstalled; service auto-starts and blocks now survive restart.
- Instagram + YouTube covered ~1s, "Back to Pico" returns, Pico pkg self-excluded (verified by injecting it into the payload — filtered), preset disable removes block w/o restart. → SHIELD.md

## Task 4 — vault (device)
- 2 dummy refs saved; survive force-stop+relaunch; encrypted pico_vault.xml confirmed ciphertext.
- call with contact ref → masked resolved number in confirm; share with note ref → confirm (no echo); missing ref → invalid.
- logcat 5781 lines: 0 hits for dummy values. API logs: 0 hits. → VAULT.md

## Task 7 — low-memory (device)
- BUG FOUND: syncWebAssets in app/build.gradle.kts used `from("../web/dist")` → resolves to apps/mobile/web/dist (nonexistent) → staging APKs silently ship stale web assets (Nov 15 snapshot). Manually synced + rebuilt + reinstalled; owner should fix path to ../../web/dist.
- send-trim-memory RUNNING_LOW → banner shown, shield overlay suppressed (Instagram uncovered), chat/action still worked. → LOW_MEMORY.md

## Task 8 — offline (device)
- Forced offline screen via `--es pico_force_error offline`: icon+title+message+RETRY+OPEN IN BROWSER all rendered. RETRY recovered to chat home with session+draft intact.
- Airplane-mode cold launch on bundled build → app opens fine (local assets), airplane icon visible in shots. Airplane mode turned OFF after.
- OPEN IN BROWSER target is virtual localhost origin on bundled build; handler verified by code (ACTION_VIEW). → OFFLINE.md

## Task 5 — TalkBack (device)
- TalkBack enabled; AX tree via CDP: chat home fully labeled (composer, new chat, menu, model selector, attach, voice toggle, guest voice-trial status). Shield overlay: focus ring on title+detail, "Back to Pico" activated via tap → returned to Pico. Agent Settings NOT VERIFIED (sign-in gated, guest session). → TALKBACK.md

## Task 6 — 48dp touch targets
- Audited all beta surfaces; fixed AgentSettings (Grant/Remove/Save/checkbox rows), Toggle label, Settings nav rows + close button, new Legal links. Native overlay button already 48dp. → TOUCH_TARGETS.md

## Task 10 — store/legal
- Manifest complete (SET_ALARM added this round). Legal links added to Settings>Account; marketingOrigin moved to authRoutes.ts. Missing public deletion page + Play Console items → owner items. → STORE_LEGAL.md

## User-reported shield media bug — FIXED
- Reel audio kept playing under overlay. Added MEDIA_PAUSE dispatch + transient audio focus in ShieldService (API 26+/legacy). Post-fix: media_session state=STOPPED after overlay shown; audio stopped. Caveat: IG re-grabs exclusive focus; video may render silently behind overlay.

## Shield media bug — FINAL FIX (v2)
- v1 (MEDIA_PAUSE + audio focus) verified wrong: the "STOPPED" session in dumpsys was YouTube's, not IG's — IG reels register no MediaSession and IG re-grabs exclusive audio focus, so overlay alone never stopped reel audio.
- v2: blocked app detection now fires ACTION_MAIN/CATEGORY_HOME → app onPause → reel+audio stop guaranteed. Overlay stays over launcher with Back to Pico; non-blocked apps unaffected; bounce still fires under memory pressure (overlay draw skipped). Verified on device: IG bounced ~1s, WA unaffected, re-block on reopen. → SHIELD.md
- FINAL_REPORT_W.md written; device cleaned (TalkBack off, test alarm deleted, API stopped, forwards removed).
