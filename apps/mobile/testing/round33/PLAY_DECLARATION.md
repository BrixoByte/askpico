# Round 33 — Play readiness: Focus apps (text only, no submission)

## Feature description
Focus apps lets a user pick the apps that pull them away from what they planned to do (for example a messaging or video app). The user starts a focus session with a set length (1 hour, 1 day or 1 week) and a focus strength. While the session runs, when a chosen app comes to the front, Pico shows a small card with "Back to Pico" and "Close". The user can leave through system settings at any time.

## Why each permission is needed
- **Usage access (`PACKAGE_USAGE_STATS`, granted by the user in system settings):** to know which app is in the foreground, so the card can appear over a chosen app. Only the foreground app name is read.
- **Display over other apps (`SYSTEM_ALERT_WINDOW`, granted by the user in system settings):** to draw the card over the chosen app.
- No AccessibilityService. No `CALL_PHONE`. No `QUERY_ALL_PACKAGES`. The app list uses the launcher intent query declared in `<queries>`.

## Data handling statement
- **Collected and read:** the package name and label of the app in the foreground, read on device, and only for apps the user chose.
- **Not stored:** the foreground app name is not written to disk and not kept in history.
- **Not uploaded:** nothing from this feature is sent to any server.
- **Stored locally:** the user's chosen app package names, the session times, the focus score history, and the passcode and recovery code as salted hashes only. No plain-text passcode or recovery code is stored.
- **Passcode and recovery code:** never sent to the server, never logged, never shown again after setup (recovery code).

## Reviewer 60-second demo script
1. Install and sign in with the reviewer test account (guest cannot open Settings; see reviewer notes).
2. Open Settings, then the Agent section. Tap "Focus apps" and read the disclosure before any system dialog appears.
3. Tap "Turn on". Grant "Usage access" and "Display over other apps" from the buttons. Each opens the system page; come back to Pico and the row shows "On".
4. Tick WhatsApp in the app list. Choose "1 hour" and "Balanced". Set a passcode and write down the recovery code (shown once).
5. Tap "Start focus session". Open WhatsApp: the calm card appears within about a second. Tap "Back to Pico" to return.
6. Open the dialer or Settings during the session: no card appears.
7. In the session screen, tap "Turn off overlay in system settings" to see the system page for the permission. Revoke "Display over other apps": the card stops.
8. Turn the feature off in Pico, or uninstall Pico. Either way the blocking stops with no further action.

Note for the reviewer: a session cannot be shortened after it starts. The user can always stop blocking through Android's own settings, and no Pico code is needed for that.

## Reviewer notes
- Guest path: NOT available. Settings (and therefore Settings > Agent with Focus apps) is sign-in gated for guests, so the reviewer needs a signed-in test account. The owner must provide it in Play Console review notes.
- Test account: required (email and password). Owner must create it and enter it in Play Console review notes. Not created in this round (no auth-email budget).
- Status: device tests for this feature are mostly BLOCKED in this round (see FOCUS_APPS.md). The reviewer demo above must be run on a device before any submission.

## Why the user can always leave
A focus blocker must never trap the user. The card has a "Close" button and a "Back to Pico" button. Pico never blocks itself, the dialer, Settings, or emergency and system UI. Revoking the two permissions or uninstalling Pico stops the feature entirely without any Pico code running. Focus sessions end at their end time automatically.

## Privacy policy lines that must mention this feature
The public privacy policy (marketing site) is not edited in this round. These lines must be added before submission:
- "Focus apps uses Usage access to see which app is in front, only for the apps you choose. The app name is used on your device and is not stored or sent to us."
- "Focus apps uses Display over other apps to show a calm card over the apps you chose during a focus session."
- "Your focus passcode and recovery code are stored on your device only, as salted hashes. We never receive them and cannot recover your passcode."
- "You can turn Focus apps off in Pico, revoke its permissions in Android settings, or uninstall Pico at any time."

## Owner must do before submission
- Play Console: declare **Usage access** and **Display over other apps** as sensitive permissions, with the demo video and the reviewer notes above.
- Data safety form: declare that the foreground app name is read on device and not collected or shared.
- Privacy policy: add the lines above on the public page.
- Demo video: record the 8 steps above on a release build with the feature flag as shipped.
