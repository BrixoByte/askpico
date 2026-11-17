# Round 33 — Focus apps: final report

Build tested: local staging debug, **feature flag `VITE_AGENT_ACTIONS=true` ON** (test build only). Shipped builds keep the flag OFF. Default web build (flag unset) passes.

Status key: DONE · PARTIAL · NOT DONE · BLOCKED

## Part A — Disclosure and settings

| Item | Status | Evidence |
|---|---|---|
| Disclosure before system dialogs (apps, what is read, when card appears, how to turn off; Continue / Not now) | DONE | `shots/r33_ui_disclosure_font2_dark.png` — shown on "Turn on" before any system dialog |
| Permissions requested only after turning on | DONE | Grant buttons appear only after enabling — `shots/r33_ui_revoked_row.png` |
| Settings row Off / Needs permissions / On, refresh on return | DONE | "Needs permissions" with revoked perms, "On" after grant via live `hasCapability` check — `shots/r33_ui_revoked_row.png` |
| Turn off removes overlay immediately | DONE | `focusSetEnabled(false)` → `enabled:false`; WhatsApp opened right after with no overlay, no restart |
| App picker: search, launchable apps, checkboxes, count, empty state | DONE | `shots/r33_ui_picker_font2_dark.png`; native list 92 apps, Pico excluded |
| All texts in every locale | NOT DONE | English `defaultValue` only. Locale files not updated |

## Part B — Tests

| Item | Status | Evidence |
|---|---|---|
| Pure rules: presets, extend-only, 7-day cap, strength limits, 10-min window, score, emergency count, cool-down doubling and cap, passcode and recovery hash | DONE | `FocusPolicyTest` — 20 pass |
| Store gate logic: wait per strength, passcode gate, counts, cool-down, 24 h reset, restart/reboot consistency | PARTIAL | Verified on device for wait, count, cool-down and emergency (FOCUS_APPS 7, 9, 11). No Robolectric unit test written |
| Foreground matching, exclusions, show-once, feature-off, empty list | PARTIAL | Code. Device: no-session no-overlay, Close and reopen, Settings not overlaid. No unit test (service needs Android) |
| Web focus wrappers | DONE | `nativeFocus.test.ts` — 7 pass |
| Focus UI texts (refusal message, warning, button visibility) | DONE (unit) | `FocusApps.test.tsx` — 3 pass: exact `No early unblocks left for this session.`, warning text, `Keep focusing` default |
| Mic and TTS released on overlay, idle on return | PASS | Device logcat (FOCUS_APPS 6, 16) |

## Part C — Device cases (see `FOCUS_APPS.md`)

| Case | Status | Evidence |
|---|---|---|
| 1 Fresh state, disclosure first | PASS | Disclosure before system dialogs — `shots/r33_ui_disclosure_font2_dark.png` |
| 2 Choose apps, grant permissions | PASS | Picker UI — `shots/r33_ui_picker_font2_dark.png`; native list 92 apps, Pico excluded |
| 3 Session, overlay, Back to Pico | PASS | `shots/r33_c3_whatsapp_overlay.png`, `shots/r33_c3_back_to_pico.png` |
| 4 Unchosen app: no overlay | PASS | `shots/r33_c4_instagram_no_overlay.png` |
| 5 Pico, dialer, Settings never overlaid | PASS | `shots/r33_c5_settings.png`; notification shade/system UI no overlay; dialer not separately installed on this HiOS build |
| 6 Voice stops, mic idle on return | PASS | logcat `PICO_SHIELD` + Soda recognizer stop; `shots/r33_c6_voice_overlay.png` |
| 7 Strict: warning, wait, one unblock, refusal | PASS | `WAIT_REQUIRED` → `OK` after 60 s → `NO_UNBLOCKS`. Warning screenshot `shots/r33_ui_warning_font2_dark.png` ("Keep focusing" default verified: no unblock consumed) |
| 8 Balanced: 2 unblocks, 3rd refused | PASS | `OK`, `OK`, `NO_UNBLOCKS`; `unblocksLeft:0`, score 100→80; `shots/r33_c8_balanced_window_whatsapp.png`; exact refusal on device `shots/r33_ui_refusal_font2_dark.png` |
| 9 Wrong passcode x3 cool-down | PASS | `WRONG_PASSCODE` x3, `LOCKED`; correct passcode `OK` after 62 s |
| 10 Recovery code resets passcode | PASS | `focusRecover` → `true`; code kept in page memory only, never printed/stored |
| 11 Emergency | PASS | `WAIT_REQUIRED` → `OK` after 60 s; session ended; score 90 → 65; `shots/r33_emergency_whatsapp_free.png` |
| 12 Session end time ends blocks | PASS | Strict session ended at `endMs`, no action: `active:false, blocking:false`; WhatsApp free — `shots/r33_c12_natural_end_whatsapp.png` |
| 13 Force-stop and reboot: no lock | PASS | State identical after force-stop; Pico stopped → WhatsApp free, reopened → card; state persisted across reboot — `shots/r33_c13_pico_stopped_whatsapp_free.png`, `r33_c13_after_reboot_card.png`, `r33_after_reboot.png` |
| 14 Revoke overlay: overlay stops, row shows revoked | PASS | `hasCapability('overlay')` false, no card (`shots/r33_c14_revoked_whatsapp.png`); row "Needs permissions" → "On" after grant (`shots/r33_ui_revoked_row.png`) |
| 15 Feature off, no restart | PASS | `enabled:false`; WhatsApp opened immediately, no overlay, no restart |
| 16 Strict mic: no muted state after return | PASS | Same run as 6 (Strict session); no recognizer restart after return |
| 17 Font 2.0 and dark mode | PASS | Card (`shots/r33_font2_dark_card.png`), picker (`shots/r33_ui_picker_font2_dark.png`), session screen (`shots/r33_ui_session_refusal_font2_dark.png`) — no clipped text |

Close button (extra check): card closed, no loop, card returns on reopen (`shots/r33_c_close_whatsapp.png`, `shots/r33_c_reopen_card.png`).

Device totals: **PASS 17 of 17 · FAIL 0 · BLOCKED 0.**

Bug found and fixed during the signed-in pass: session end time rendered as `11&#x2F;17&#x2F;2026` — i18next escaping `/` in interpolated values. Fixed via `interpolation.escapeValue: false` in `apps/web/src/i18n.ts` and verified on device.

## Part D — Play readiness

| Item | Status | Evidence |
|---|---|---|
| `PLAY_DECLARATION.md`: feature, permission reasons, data statement, 60 s demo, reviewer notes, always-can-leave section | DONE (text) | `testing/round33/PLAY_DECLARATION.md` |
| Privacy policy lines | DONE (text) | Listed in PLAY_DECLARATION. Public page not edited (round rule) |
| Reviewer can reach the feature | BLOCKED | Settings is sign-in gated for guests. Reviewer needs a signed-in test account |

## Gates

| Gate | Result |
|---|---|
| Web `tsc --noEmit` | exit 0 |
| Web `vitest run` | 360 pass, 0 fail (16 files; includes `FocusApps.test.tsx` and the mojibake guard) |
| Web `vite build` (flag OFF, default) | exit 0 |
| API `npm test` | 273 pass, 1 fail (`routing.test.js`, env-blocked: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not set), 2 todo. Baseline unchanged |
| Native `assembleDebug` | exit 0 |
| Native `testDebugUnitTest` | 45 pass |
| Native `assembleStaging` (flag ON, device build) | exit 0, installed |

## Files changed this round
- Native (new): `agent/FocusPolicy.kt`, `agent/FocusStore.kt`, `test/.../agent/FocusPolicyTest.kt`
- Native (changed): `agent/ShieldService.kt`, `PicoBridge.kt`, `MainActivity.kt` (bridge allowlist), `AndroidManifest.xml` (launcher `<queries>` intent)
- Web (new): `components/SettingsMenu/FocusApps.tsx`, `components/SettingsMenu/FocusApps.test.tsx`, `utils/nativeFocus.test.ts`
- Web (changed): `utils/nativeAgent.ts`, `components/SettingsMenu/AgentSettings.tsx`, `i18n.ts` (escapeValue fix)
- Testing: `testing/round33/PROGRESS.md`, `FOCUS_APPS.md`, `PLAY_DECLARATION.md`, `FINAL_REPORT_Y.md`, `cdp_env_eval.mjs`, `check_env.ps1`, `shots/r33_*.png`

## Flag status
- Shipped build: flag OFF. Default web build verified.
- Device build: flag ON (local staging only).

## Accounts touched
- Signed in with the owner's test account for the UI pass, then signed out (device back to guest). No accounts created. No auth emails. No Supabase or Play changes.

## Hardcoded preset removal (this continuation)
- Removed from `apps/web/src/components/SettingsMenu/AgentSettings.tsx`: `SHIELD_PRESETS` (Instagram/YouTube/TikTok/Facebook packages), `SHIELD_KEY`, `readShield`, `applyShield`, `togglePackage` and the "Distraction shield" preset UI. Replaced by `<FocusApps />`.
- Manifest `<queries>` for Instagram/YouTube/Facebook kept intentionally — used by open-app intents, not shielding.
- Gates after removal: tsc 0, vitest 357/357 (incl. new `FocusApps.test.tsx` 3 tests), native 45/45, builds green.

## Device changes and cleanup
- Focus disabled via `focusSetEnabled(false)` (verified `enabled:false`). The Balanced test session record was left in `pico_focus` prefs and expires at its `endMs` — per owner instruction nothing on the phone was deleted in this continuation.
- Test permissions reset (`GET_USAGE_STATS`, `SYSTEM_ALERT_WINDOW`) to default for `com.askpico.pico`.
- `uimode night` off, font scale 1.0, zen_mode 0 (DND off), rotation auto.
- adb forward `tcp:9222` removed; no reverse ports. No local servers running. Accessibility services unchanged.
- WhatsApp was only opened to its home screen for overlay checks; no messages were typed or sent.

## Owner must do
1. Confirm the warning and score wording.
2. Confirm preset lengths (1 h, 1 day, 1 week) and the 7-day maximum.
3. Confirm score deductions: early unblock −10, emergency −25.
4. Confirm the recovery code policy (shown once, passcode reset immediately, signed-in reset after 24 h).
5. Play Console: declare **Usage access** and **Display over other apps** as sensitive permissions, with the demo video and reviewer notes. Provide a reviewer test account.
5a. Rotate the test account password — it was shared in chat for the sign-in pass.
6. Data safety form: foreground app name read on device, not collected, not shared.
7. Privacy policy: add the lines in `PLAY_DECLARATION.md`.
8. Record the demo video on a release build with the flag as shipped.
9. Translate the Focus strings into all locales.
10. Commit and PR merge (not done by me).
11. Set `VITE_BACKEND_URL` for the release build if needed.
12. Redeploy after review (not done by me).
