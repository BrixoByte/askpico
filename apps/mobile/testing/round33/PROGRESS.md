# Round 33 — Focus apps: progress log

Flag: `FocusStore` is always on in the **local debug build** only when the user turns it on. Shipped builds keep the Agent flag OFF (`VITE_AGENT_ACTIONS` unchanged). No commit, push, merge, deploy, or cloud/Play/Firebase change was made.

## Step 1 — Native pure rules (done)
- `apps/mobile/app/src/main/java/com/askpico/pico/agent/FocusPolicy.kt`
  - Strength limits: STRICT 1 unblock + 60 s wait; BALANCED 2, no wait; LIGHT 5, no wait.
  - Presets 1 h / 1 day / 1 week only; sessions may only be extended, never shortened; max 7 days.
  - Early unblock: 10-minute window, −10 score. Emergency: ends session, −25 score, shares the unblock count, always 60 s wait.
  - Passcode and recovery code: PBKDF2-HMAC-SHA256 (120k iterations, 16-byte per-value salt), hex hash only.
  - Cool-down: 3 wrong = 60 s, doubles per further fail, capped at 15 min.
  - Account reset: 24 h delay.
- Unit tests: `apps/mobile/app/src/test/java/com/askpico/pico/agent/FocusPolicyTest.kt` — **20 tests, all pass**.
  Names: presets_areOnlyOneHourOneDayOneWeek, extendBy_addsTime_andRejectsMoreThanSevenDays, extendBy_rejectsShortening, session_autoEndsAtEndTime, strictStrength_allowsOneUnblock_andNeedsSixtySecondWait, balancedStrength_allowsTwoUnblocks_withoutWait, lightStrength_allowsFiveUnblocks_withoutWait, earlyUnblock_countIsLimitedPerStrength, earlyUnblock_opensTenMinuteWindow_thenBlocksAgain, earlyUnblock_deductsTenPoints, emergency_costsMoreThanEarlyUnblock_andEndsSession, emergency_sharesCountWithEarlyUnblock, emergencyWait_isSixtySeconds_forAllStrengths, scoreHistory_recordsEarlyUnblocks, cooldown_startsAfterThreeWrongTries_andDoubles, cooldown_isCappedAtFifteenMinutes, passcode_hashAndVerify_withSalt, recoveryCode_formatAndNormalize, recoveryCode_hashRoundTrip, passcodeReset_delayIsTwentyFourHours.
  (`emergencyWait_…` and `passcodeReset_…` only check constants; the real gate logic is in FocusStore, which has no unit test yet.)

## Step 2 — Native store and bridge (done, not device-tested)
- `FocusStore.kt`: SharedPreferences `pico_focus`. Stores enabled flag, session JSON, passcode salt+hash, recovery salt+hash, fail counter, lock-until, wait start, pending account reset. No plaintext passcode, no recovery code.
- `PicoBridge.kt`: `focusStatus`, `focusSetEnabled`, `focusSetupPasscode` (returns the recovery code once), `focusStart`, `focusBeginWait`, `focusEarlyUnblock`, `focusEmergency`, `focusRecover`, `focusRequestAccountReset`. All take the bridge token.
- Known gap: `FocusStore` gate logic (wait, passcode, counts, cool-down wiring) has no unit test yet. Planned for next step.

## Step 3 — ShieldService wiring (done, not device-tested)
- Blocked set = Agent shield presets (if enabled) ∪ focus session packages (only while session blocking and not in an early-unblock window).
- Never overlaid: Pico, `com.android.dialer`, `com.google.android.dialer`, `com.android.settings`, `com.android.systemui`, `com.android.emergency`, `com.google.android.apps.emergencyassist`. HiOS dialer/SOS package names still need a device check.
- Overlay card: user's opaque design kept. Added a **Close** button. After Close the card does not return for the same open of the app (`dismissedFor`), so no loop. Reopening the app shows it again.
- Service runs when either the Agent shield or focus is on. Stops when both are off.

## Step 4 — Mic (partially done)
- `silenceForShield()` already ends the recognizer and TTS when the overlay shows. Idle-restart logic, `stt.ts`, and `MainActivity` idle-restart code were **not** touched.
- Return-to-idle and no-leak check: NOT verified on device.

## Not done in this round (honest status)
- Web UI: Focus apps settings, disclosure screen, status row, app picker, session setup, session screen, i18n keys, web unit tests. NOT DONE.
- Device tests Part C (cases 1–17): NOT DONE. Nothing in FOCUS_APPS.md is marked PASS.
- PLAY_DECLARATION.md and FINAL_REPORT_Y.md: NOT DONE.
- Gates: native `assembleDebug` and native unit tests pass (45 tests). Web tsc / vitest / build / API not re-run for this round because no web or API code changed yet.

## Owner confirmations (recorded)
- Score cost: early unblock −10, emergency −25 — confirmed.
- Passcode minimum length: 4 characters — confirmed.
- Blocked set = Agent shield presets ∪ focus session packages — confirmed.
- Device test passcode: supplied only through an owner-set environment variable (`TEST_PASSCODE`), never written to files, logs or reports — confirmed.
- HiOS dialer and SOS package names: to be checked on device before PASS — confirmed.

## Steps after confirmation
- Gate logic moved: `FocusStore.startSession` now refuses to start without a passcode (owner rule: passcode set at first session start). Verified on device: `focusStart` without passcode returns `ERROR`.
- `listLaunchableApps` bridge method added and `<queries>` launcher intent declared (no QUERY_ALL_PACKAGES). Verified on device: 92 launcher apps, Pico excluded.
- Web: `FocusApps.tsx` (disclosure, status row, picker, session setup, session screen, early unblock warning and 60 s wait, emergency, recovery) mounted at the top of Agent settings. English defaults only (`defaultValue`); locale files not yet updated.
- Web unit tests: `nativeFocus.test.ts` 7 pass. Full web vitest: 357 pass (15 files).
- Native unit tests: 45 pass (FocusPolicy 20, ActionValidation 8, LoadErrorClassifier 12, RetryGate 3, VaultKeyPattern 2).
- Gates: web tsc exit 0; web vite build (flag OFF) exit 0; API npm test 273 pass, 1 fail = routing.test.js (env-blocked: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not set), 2 todo; native assembleDebug exit 0; assembleStaging (flag ON) exit 0.
- Device (flag ON staging): native checks and no-session overlay check done. Session-dependent cases BLOCKED: TEST_PASSCODE not set. Focus UI BLOCKED: TEST_PASSWORD not set (Settings is sign-in gated for guests).
- Cleanup done: focus disabled, Agent shield disabled (was IG+YT from Round 32), usage/overlay appops reset to default for com.askpico.pico, adb forward/reverse removed.
- Open issue for owner: Play reviewer cannot reach Focus apps as a guest (Settings is sign-in gated). A reviewer test account is required.

## Continuation — device testing (flag ON staging, TEST_PASSCODE/TEST_PASSWORD from User env)

- Hardcoded shield presets removed from `AgentSettings.tsx`: `SHIELD_PRESETS` (IG/YT/TikTok/Facebook), `SHIELD_KEY`, `readShield`, `applyShield`, `togglePackage` and the "Distraction shield" preset UI. Manifest `<queries>` kept — used by open-app intents, not shielding. Gates re-run: tsc 0, vitest 357/357, native unit tests 45/45, assembleDebug + flag-ON assembleStaging green. `FocusApps.test.tsx` added (3 tests): exact refusal text, hidden unblock button at 0 unblocks, warning text + "Keep focusing" default.
- Device, all via `window.PicoBridge` over CDP (secrets read from User env inside the test process only, never printed):
  - Recovery reset: `focusRecover` returned `true`; recovery code kept in page memory only (length 19 recorded, value never stored).
  - Font 2.0 + dark mode: card renders without clipped text — `shots/r33_font2_dark_card.png`.
  - Force-stop: session state identical before/after (endMs, score, unblocks).
  - Reboot: state persisted; Pico stopped → WhatsApp free (`mCurrentFocus=com.whatsapp`); Pico reopened → card again — `shots/r33_c13_pico_stopped_whatsapp_free.png`, `r33_c13_after_reboot_card.png`, `r33_after_reboot.png`.
  - Overlay revoke: `hasCapability('overlay')` false after appops deny; WhatsApp opened with no card — `shots/r33_c14_revoked_whatsapp.png`.
  - Strict session ended naturally at `endMs` (no action taken): `active:false, blocking:false, unblocksUsed:0`; WhatsApp free — `shots/r33_c12_natural_end_whatsapp.png`. Verified.
  - New Balanced session (1 h, WhatsApp): early unblocks returned `OK`, `OK`, `NO_UNBLOCKS`; status `unblocksUsed:2, unblocksLeft:0, score 100→80`; WhatsApp free inside the unblock window — `shots/r33_c8_balanced_window_whatsapp.png`. Exact refusal message "No early unblocks left for this session." verified by `FocusApps.test.tsx` unit test.
  - Feature off: `focusSetEnabled(false)` → `enabled:false`; WhatsApp opened right after with no overlay, no restart.
- BLOCKED: sign-in (TEST_EMAIL not set) → web UI screenshots of early-unblock warning and refusal, disclosure, picker, session screen, settings-row revoked state. Not guessed or bypassed.
- Cleanup (nothing deleted per owner instruction): `focusSetEnabled(false)`; usage/overlay appops reset to default; `uimode night` off; font 1.0; DND 0; rotation auto; `adb forward tcp:9222` removed; Balanced session record left in prefs to expire at its endMs; no files deleted on device; no messages sent.
- `FOCUS_APPS.md` rewritten with PASS/FAIL/BLOCKED per case. Totals: PASS 13 device/native, BLOCKED 6 UI items, FAIL 0.

## Continuation — signed-in UI pass (flag ON staging, rebuilt)

- Signed in with the owner's test account (credentials used for sign-in only; never written to files, logs or reports).
- **Bug found and fixed:** session end time rendered as `11&#x2F;17&#x2F;2026` — i18next escaping `/` in interpolated values. Fix: `interpolation.escapeValue: false` in `apps/web/src/i18n.ts`. Verified on device after rebuild.
- Gates re-run after fix: tsc 0, vitest 360/360, flag-ON vite build 0, `assembleStaging` green, reinstalled.
- UI cases completed on device (font 2.0 + dark mode):
  - Disclosure before permission dialogs — `shots/r33_ui_disclosure_font2_dark.png`.
  - Picker (search, checkboxes, count, empty state) — `shots/r33_ui_picker_font2_dark.png`.
  - Session screen (end time, score, "Turn off overlay in system settings") — `shots/r33_ui_session_refusal_font2_dark.png`.
  - Early-unblock warning + "Keep focusing" default (verified: no unblock consumed) — `shots/r33_ui_warning_font2_dark.png`.
  - "No early unblocks left for this session." refusal — `shots/r33_ui_refusal_font2_dark.png`.
  - Settings row revoked → "Needs permissions" → "On" after grant — `shots/r33_ui_revoked_row.png`.
- New 1-hour Balanced session started through the UI for the warning test; left active (expires on its own). Feature disabled at cleanup.
- Cleanup: feature off, signed out (back to guest), appops reset to default, font 1.0, night mode off, rotation auto, DND 0, adb forward removed. Nothing deleted on the phone.
- `FOCUS_APPS.md` totals now: PASS 17/17, FAIL 0, BLOCKED 0.
