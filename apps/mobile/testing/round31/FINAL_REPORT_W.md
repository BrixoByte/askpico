# Round 31 — FINAL_REPORT_W: Android beta (D4/D5, §11, 12.8, 12.9)

Date: 2025-11-17. Device: TECNO CL6 (HiOS, Android 15).
Build: `com.askpico.pico` 1.0.0-beta.1 staging debug, web bundle with
`VITE_AGENT_ACTIONS=true` (test build only — shipped builds keep flag OFF).
Method: adb + screenshots + logcat + WebView CDP (`webview_devtools_remote`),
AX tree via `Accessibility.getFullAXTree`. HiOS blocks uiautomator idle and
monkey-injected long input — taps/dumps used instead.

## Task matrix

| # | Scope | Status | Evidence |
|---|---|---|---|
| 1 | Native intent actions (call/open_app/open_url/alarm/timer/whatsapp) | PASS | INTENT_ACTIONS.md — all 12.9 rows verified on device |
| 2 | Rule-based chat action triggers | PASS | CHAT_TRIGGERS.md — 8 msgs via real composer, 0 LLM calls |
| 3 | Whole-app distraction shield | PASS (2 bugs fixed) | SHIELD.md |
| 4 | Local encrypted Pico Vault | PASS | VAULT.md — EncryptedSharedPreferences, no logcat/API leaks |
| 5 | TalkBack / accessibility | PASS w/ 1 not-verified | TALKBACK.md |
| 6 | 48dp touch targets | PASS (fixes applied) | TOUCH_TARGETS.md |
| 7 | Low-memory behavior | PASS | LOW_MEMORY.md |
| 8 | Offline behavior | PASS (1 tap limitation noted) | OFFLINE.md |
| 9 | Start-flow regression | PARTIAL | START_FLOW.md — guest verified; signed-in paths need credentials |
| 10 | Store/legal prerequisites | AUDITED | STORE_LEGAL.md — owner items listed |

## Bugs found & fixed this round

1. **Shield died on app relaunch** — `ShieldService.sync()` was only called
   from `PicoBridge.setShield`. Added `ShieldService.sync(this)` to
   `MainActivity.onCreate`. Verified: service auto-starts on launch.
2. **Missing SET_ALARM permission** — clock intents failed `denied`;
   `com.transsion.deskclock` requires `com.android.alarm.permission.SET_ALARM`.
   Added to manifest; alarm + timer now `done`.
3. **Stale bundled web assets** — `syncWebAssets` used `from("../web/dist")`
   → resolved to nonexistent `apps/mobile/web/dist`, silently shipping Nov-15
   assets. Fixed to `../../web/dist`; task now runs and syncs correctly.
4. **Blocked app media kept playing (user-reported, two rounds)** — overlay
   alone cannot stop in-app media: Instagram reels register no MediaSession
   (MEDIA_PAUSE had no target) and IG re-grabs exclusive audio focus.
   **Fix:** the shield now bounces the blocked app to the home screen —
   `onPause` guarantees playback + audio stop. Overlay persists over the
   launcher with the block message + "Back to Pico". MEDIA_PAUSE + transient
   focus kept as belt-and-suspenders. Bounce still fires under memory
   pressure (only the overlay draw is skipped).
5. **Touch targets below 48dp** — AgentSettings Grant/Remove/Save controls,
   preset checkbox rows, Enable-shield toggle, Settings nav rows, and the
   Settings close button expanded (padding/`after:-inset`, visuals unchanged).

## Code changes (native)
- `ShieldService.kt` — relaunch sync path (via MainActivity), bounce-to-
  launcher blocking, media pause + audio focus, launcher-aware overlay state.
- `MainActivity.kt` — `ShieldService.sync(this)` in onCreate; `onTrimMemory`
  → `ShieldService.setMemoryPressure` + `window.PicoMemory.onLowMemory`.
- `ActionExecutor.kt` — `ActionValidation` refactor finished, dead `mask()` removed.
- `AndroidManifest.xml` — `SET_ALARM` permission.
- `app/build.gradle.kts` — syncWebAssets path fix.

## Code changes (web)
- `nativeAgent.ts` — `PicoMemory` low-memory bridge hook + store.
- `LowMemoryBanner.tsx` / `App.tsx` / `PreviewFrame.tsx` — banner + iframe gate.
- `authRoutes.ts` — shared `marketingOrigin()`.
- `AuthPage.tsx`, `SettingsMenu.tsx` — legal links under Settings > Account,
  48dp targets; nav/close-button hit areas.
- `AgentSettings.tsx`, `Toggle.tsx` — 48dp hit areas.

## Verification
- `tsc --noEmit`: clean. Web unit tests: 19/19 (nativeAgent 9, agentIntents 10).
  Full web suite: 350/350. Kotlin unit tests: 25 pass. API: 273 pass,
  1 env-blocked (pre-existing), 2 todo — matches R30 baseline.
- Final staging APK built + installed; device re-verified: shield bounce,
  Back to Pico, non-blocked app unaffected, re-block on reopen.

## Not verified / blocked
- Signed-in start flow + expired-session path — no credentials, 0 auth-email
  budget (per instructions). Guest flow verified instead.
- Settings > Agent UI — `gateSignedIn`-gated for guests; native path tested
  via bridge directly, UI gating confirmed by code read.
- OPEN IN BROWSER tap — auto-retry dismisses the forced screen first;
  rendered screen + intent handler verified.
- Play Console items (AAB signing, Data Safety, rating, listing, support
  email) + a public account-deletion web page — owner items.

## Device cleanup
- TalkBack disabled. R31 test alarm deleted (user alarms untouched).
- Local API stopped; adb reverse/forward removed; app force-stopped.
- Shield rules (IG+YT) left enabled at the user's discretion — user was
  actively testing the shield feature; toggle in Settings > Agent.
- No real recipients used (WhatsApp test went to user's own self-chat).
  No vault values in screenshots/logs/reports.
