# Round 31 — Intent actions (doc 12.9, Task 1)

Device: TECNO CL6 (119652548M014318), staging build `1.0.0-beta.1` (BUNDLED_WEB,
`VITE_AGENT_ACTIONS=true` local build — flag OFF in shipped builds).
Driver: `window.PicoBridge.performAction` via CDP; statuses captured on
`window.PicoAction.onResult`. Shots in `shots/`.

| Row (12.9) | Result | Evidence |
|---|---|---|
| call: masked confirm, Cancel → `cancelled` | PASS | `r31_call_confirm.png` shows "Call •••••••••••00?" (last-2 only). onResult: `cancelled` (id 81332e29). |
| call: Call + denied permission → `denied` | PASS | System prompt "Allow Pico to make and manage phone calls?" → Don't allow → onResult: `denied` (id c58bbcb0). `r31_call_perm.png`. |
| open_app: allowlisted opens | PASS | `com.instagram.android` → `done`; mCurrentFocus = `com.instagram.mainactivity.InstagramMainActivity`. `r31_open_instagram.png`. |
| open_app: non-listed → `invalid` | PASS | `com.google.android.gm` → `invalid` (id 793cf8e8). |
| open_url: https opens in browser | PASS | `https://example.com` → `done`; mCurrentFocus = `com.android.chrome …ChromeTabbedActivity`. `r31_open_url.png`. |
| open_url: `javascript:`/`file:` rejected | PASS | Both → `invalid` (ids 6fedd5f8, f1f79553). |
| set_alarm creates clock entry | PASS* | `com.android.alarm.permission.SET_ALARM` added to manifest (was missing — real bug found, see below). After fix: `done`; Clock app shows "7:30 AM R31 test alarm" (`r31_clock1.png`). |
| set_timer creates clock entry | PASS* | After manifest fix: `done`; Timer tab shows running 5:00 → 3:31 (`r31_timer4.png`). NOTE: the predicted TECNO signature-permission denial did NOT occur on this firmware — both actions needed only the normal SET_ALARM permission. |
| share_whatsapp: prefilled composer | PASS | Confirm dialog "Share this text on WhatsApp?" (text never echoed — `r31_share_confirm.png`) → SHARE → `done`; WhatsApp picker opened with text prefilled (`r31_wa_prefill.png`); sent to own self-chat (`r31_wa_sent2.png`, 1:01 PM). |
| share_whatsapp: fallback to share sheet | VERIFIED-BY-CODE | WhatsApp is installed — cannot uninstall owner's phone. `ActionExecutor.shareWhatsApp` catches `ActivityNotFoundException` → `Intent.createChooser` (lines 122–128). |
| Model-originated = user-input validation | PASS (unit) | `ActionValidationTest.kt` (25 tests incl. VaultKeyPatternTest) — `testStagingUnitTest` green. `nativeAgent.test.ts` — 9 tests: refs pass verbatim, statuses resolve. |

## Bug found and fixed
- **Missing `com.android.alarm.permission.SET_ALARM` in the manifest.** First run: both
  `set_alarm` and `set_timer` returned `denied`. logcat: `Permission Denial: …
  com.transsion.deskclock/.HandleSetAlarmApiCalls … requires
  com.android.alarm.permission.SET_ALARM` (12:58:11/12). It's a normal
  permission — declared it, rebuilt, both actions now `done`. The prompt's
  "signature permission" limitation does not reproduce on this firmware.

## Statuses captured (onResult)
```
call    81332e29 cancelled   (Cancel tapped)
call    c58bbcb0 denied      (CALL_PHONE denied)
open_app e13721ba done       (com.instagram.android)
open_app 793cf8e8 invalid    (com.google.android.gm)
open_url 27ca3650 done       (https://example.com)
open_url 6fedd5f8 invalid    (javascript:alert(1))
open_url f1f79553 invalid    (file:///sdcard/x.txt)
set_alarm 08600c3b done      (post-manifest-fix; pre-fix run showed denied)
set_timer d6d3a63c done      (post-manifest-fix)
share_whatsapp 3b121786 done
```
