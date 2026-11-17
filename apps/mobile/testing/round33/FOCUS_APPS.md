# Round 33 — Focus apps: device test record

Build: **local staging debug, feature flag `VITE_AGENT_ACTIONS=true` ON** (test build only). Shipped builds keep the flag OFF.
Device: TECNO CL6 (HiOS), serial 119652548M014318. Method: CDP calls to `window.PicoBridge` (focus methods), `dumpsys window`, `logcat`, screenshots.
Passcode: read from the owner's User environment variable `TEST_PASSCODE` inside the test process only. Never printed, logged or written to any file or report. Recovery code: generated once, kept in page memory only; only its length (19) and reset result were recorded. WhatsApp was only opened to its home screen for overlay tests — no messages were sent or typed.

Environment limits:
- Signed in with the owner's test account (credentials used only for sign-in, never written to any file or report). All web UI screens were driven on device after sign-in. The earlier BLOCKED UI cases are now PASS with screenshots.
- Bug found and fixed during this pass: session end time rendered as `11&#x2F;17&#x2F;2026` — i18next interpolation escaping `/`. Fixed with `interpolation.escapeValue: false` in `apps/web/src/i18n.ts` (React escapes rendered output anyway). Verified on device after rebuild.

## Hardcoded preset removal (request item 1)

Removed from `apps/web/src/components/SettingsMenu/AgentSettings.tsx`:
- `SHIELD_PRESETS` array: the hardcoded Instagram / YouTube / TikTok / Facebook package list.
- `SHIELD_KEY` storage key, `readShield`, `applyShield`, `togglePackage` and the whole "Distraction shield" preset toggle UI and its state.
- Replaced by the `<FocusApps />` component (user-selected apps).

Not removed (intentional): the `<queries>` entries for Instagram, YouTube and Facebook in `AndroidManifest.xml` — they are used by the open-app intent feature for package visibility, not by any shield preset. Verified by `tsc` (exit 0), `vitest` 357/357, native `testDebugUnitTest` 45/45, `assembleDebug` and flag-ON `assembleStaging` builds green.

Result: **PASS**

## Web warning and refusal texts (request item 2)

| Case | Result | Evidence |
|------|--------|----------|
| Sign in and screenshot the early-unblock warning | PASS | `shots/r33_ui_warning_font2_dark.png` — "You chose to focus until … Continue?" with "Keep focusing" (default) and "Continue", font 2.0 + dark mode. "Keep focusing" verified: warning closed, `unblocksUsed` stayed 0 |
| Screenshot the "No early unblocks left" refusal | PASS | `shots/r33_ui_refusal_font2_dark.png` — "No early unblocks left for this session." shown, no unblock button, font 2.0 + dark mode |
| Exact refusal text | PASS | `FocusApps.test.tsx` (unit) + device screenshot above |
| Warning text + default | PASS | `FocusApps.test.tsx` (unit) + device screenshot above |
| Disclosure screen | PASS (bonus) | `shots/r33_ui_disclosure_font2_dark.png` — shown before any system permission dialog, "Continue" / "Not now" |
| Picker at font 2.0 + dark mode | PASS | `shots/r33_ui_picker_font2_dark.png` — search field, checkboxes, "0 selected", empty-state text |
| Session screen at font 2.0 + dark mode | PASS | `shots/r33_ui_session_refusal_font2_dark.png` — end time, score, unblocks left, "Turn off overlay in system settings" link |
| Settings row revoked state | PASS | `shots/r33_ui_revoked_row.png` — "Needs permissions" with "Grant usage access" / "Allow display over other apps" buttons; row shows "On" again after grant (live check, refresh on focus) |

## Device cases (request items 3–5)

| # | Case | Result | Evidence |
|---|------|--------|----------|
| 1 | Fresh state: feature off, disclosure first | PASS | Disclosure shown on "Turn on" before any system dialog (`shots/r33_ui_disclosure_font2_dark.png`) |
| 2 | Choose apps, grant permissions | PASS | Picker UI on device (`shots/r33_ui_picker_font2_dark.png`); `listLaunchableApps` 92 apps, Pico excluded; WhatsApp picked via search and ticked |
| 3 | Session, overlay ~1 s, Back to Pico | PASS | `shots/r33_c3_whatsapp_overlay.png`, `shots/r33_c3_back_to_pico.png` |
| 4 | Unchosen app: no overlay | PASS | `shots/r33_c4_instagram_no_overlay.png` |
| 5 | Pico, dialer, Settings never overlaid | PASS | `shots/r33_c5_settings.png` (Settings, no overlay); Pico returned without overlay; notification shade/system UI opened with no overlay. Dialer app not installed/visible separately on this HiOS build |
| 6 | Voice stops on chosen app, mic idle on return | PASS | logcat `PICO_SHIELD: voice silenced for blocked app`, `SodaSpeechRecognizer: stop detection`, `STOP_CALLED`; no recognizer restart after Back to Pico. `shots/r33_c6_voice_overlay.png` |
| 7 | Strict: wait, one unblock, refusal | PASS | `WAIT_REQUIRED` before 60 s, `OK` after 60 s, `NO_UNBLOCKS` on second try. Warning text + "Keep focusing" default verified on device (`shots/r33_ui_warning_font2_dark.png`) |
| 8 | Balanced: 2 unblocks OK, 3rd refused | PASS | `OK`, `OK`, `NO_UNBLOCKS`; `unblocksUsed:2, unblocksLeft:0, score 100→80`. `shots/r33_c8_balanced_window_whatsapp.png` (free during window) + `shots/r33_ui_refusal_font2_dark.png` (exact refusal message on device) |
| 9 | Wrong passcode x3 cool-down | PASS | `WRONG_PASSCODE` x3, 4th `LOCKED` (58 s left); correct passcode `OK` after 62 s |
| 10 | Recovery code resets passcode | PASS | `focusRecover` returned `true`; state restored; recovery code value never printed or stored |
| 11 | Emergency: wait, end session, score | PASS | `WAIT_REQUIRED` → after 60 s `OK`; `active:false`; score 90 → 65 (−25); history records emergency. `shots/r33_emergency_whatsapp_free.png` |
| 12 | Session end time ends blocks | PASS | Strict session ended at `endMs` with no action: `active:false, blocking:false, unblocksUsed:0`. WhatsApp opened with no overlay: `mCurrentFocus=com.whatsapp`, `shots/r33_c12_natural_end_whatsapp.png` |
| 13 | Force-stop and reboot: no permanent lock | PASS | Force-stop: session state identical (endMs, score, unblocks); Pico stopped → `mCurrentFocus=com.whatsapp` free, Pico reopened → card back (`shots/r33_c13_pico_stopped_whatsapp_free.png`, `r33_c13_after_reboot_card.png`). Reboot: state persisted; after Pico launch WhatsApp blocked again (`shots/r33_after_reboot.png`) |
| 14 | Revoke Display over other apps | PASS | `appops` deny → `hasCapability('overlay')` false, no card (`shots/r33_c14_revoked_whatsapp.png`). Settings row shows "Needs permissions" (`shots/r33_ui_revoked_row.png`), back to "On" after grant |
| 15 | Feature off: overlay gone, no restart | PASS | `focusSetEnabled(false)` → `enabled:false`; WhatsApp opened immediately after, `mCurrentFocus=com.whatsapp`, no overlay, no restart |
| 16 | Strict mic: no muted/listening after return | PASS | Same evidence as case 6 (ran in Strict session) |
| 17 | Font 2.0 and dark mode | PASS | Card (`shots/r33_font2_dark_card.png`), picker (`shots/r33_ui_picker_font2_dark.png`), session screen (`shots/r33_ui_session_refusal_font2_dark.png`) — all readable, no clipped text |

Also verified:
- Close button: card closed, WhatsApp stayed visible 4 s with no card (no loop); reopening showed the card again. `shots/r33_c_close_whatsapp.png`, `shots/r33_c_reopen_card.png`.
- `focusStart` without a passcode returns `ERROR`.
- Notification shade / system UI never overlaid.

Totals: **PASS 17 of 17** listed cases (+ Close check). **FAIL 0 · BLOCKED 0.** One UI bug found and fixed during the pass (i18n `escapeValue` date rendering) and re-verified on device.

## Cleanup on device (done, nothing deleted)

- `focusSetEnabled(false)` → `enabled:false` (verified). An active 1-hour Balanced test session remains in `pico_focus` prefs and expires at its `endMs` — per owner instruction nothing on the phone was deleted.
- Signed out of the owner's test account (device is back to guest).
- `GET_USAGE_STATS` and `SYSTEM_ALERT_WINDOW` reset to `default` for `com.askpico.pico`.
- `adb forward tcp:9222` removed; no reverse ports were open.
- Font scale 1.0, `uimode night` off, zen_mode 0 (DND off), rotation auto.
- No accessibility service touched. No chats, vault, account or app data touched. No messages sent in WhatsApp or anywhere else.
