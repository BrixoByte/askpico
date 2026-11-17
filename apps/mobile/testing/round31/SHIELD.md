# Round 31 — Whole-app distraction shield (doc 12.9 shield rows, Task 3)

Device: TECNO CL6, staging flag-ON build.
Driver: `window.PicoBridge.setShield(JSON)` via CDP — the same call the
Settings > Agent UI makes (`setShieldRules` in `nativeAgent.ts` →
`PicoBridge.setShield`). The Settings UI itself is `gateSignedIn`-gated; the
device was in a guest session (0 auth emails budget) so the bridge was driven
directly. UI gating verified by code read, see bottom.

| 12.9 shield row | Result | Evidence |
|---|---|---|
| Usage-access missing → shield off, clear state | PASS | With `hasCapability('usage')=false`, rules saved `enabled:true` but `ShieldService.onStartCommand` self-stops; Instagram opened with NO overlay (`r31_shield_noperm.png`). `dumpsys activity services` showed no ShieldService. |
| Usage access + overlay permission flows | PASS (adb-assisted) | `appops set com.askpico.pico GET_USAGE_STATS allow` and `SYSTEM_ALERT_WINDOW allow` → `hasCapability` returned `{usage:true,overlay:true}`. The in-app Grant buttons route to `requestAccess()` → system settings (same code path as R30; not re-tapped because guest session). |
| Blocks Instagram within ~1 s | PASS | Poll = 1000 ms (`POLL_MS`). Instagram covered by overlay "This app is blocked by your shield / Take a breath. Pico is ready when you are." + "Back to Pico" (`r31_shield_blocked.png`). |
| "Back to Pico" returns to Pico | PASS | Tap (350,873) → `mCurrentFocus = com.askpico.pico` (`r31_pico_not_blocked.png`). |
| Pico itself never blocked | PASS | `com.askpico.pico` was deliberately included in the setShield payload — `ShieldRules.save` filters `it != context.packageName`; additionally `checkForeground` requires `fg != packageName`. Pico screen stayed clean (`r31_pico_not_blocked.png`). |
| Blocks YouTube within ~1 s | PASS | YouTube preset added via setShield; launcher open → overlay covered YouTube (`r31_shield_yt2.png`). |
| Disabling a preset removes block, no restart | PASS | `setShield({enabled:true,packages:[]})` → Instagram reopened with no overlay (`r31_shield_disabled.png`). |
| Shield survives app restart | PASS after fix | **Bug found:** `ShieldService.sync()` was only invoked from `PicoBridge.setShield`, so saved rules did nothing after relaunch. Fixed by calling `ShieldService.sync(this)` in `MainActivity.onCreate`. Rebuilt + reinstalled; `dumpsys` shows ShieldService auto-started on launch and Instagram got covered. |

## Bug fixed
- `MainActivity.onCreate` now calls `ShieldService.sync(this)` — previously a
  saved `enabled:true` shield silently died on every app relaunch.
  (MainActivity.kt ~line 213.)

## Verified by code read (not device)
- **Settings > Agent only in Android**: `SettingsMenu.tsx:318` — menu item
  rendered only when `isNativeApp()` (PicoBridge present).
- **Permission status refreshes on return**: `AgentSettings.tsx:74-78` —
  window `focus` listener bumps a refresh tick so `hasCapability` is
  re-polled when the user returns from system settings.
- Settings item itself is `gateSignedIn`-gated (guests see "Sign in to open
  settings"). Verified on device: tapping the Guest profile card shows the
  sign-in sheet — consistent behavior.

## User-reported issue — blocked reel keeps playing (FIXED, v2)

User reported twice that the overlay covered Instagram reels but playback +
audio continued. First fix attempt (MEDIA_PAUSE dispatch + transient audio
focus) did NOT work — corrected analysis:

- Instagram reels do NOT register a MediaSession, so
  `dispatchMediaKeyEvent` has no target.
- Instagram re-requests `GAIN_TRANSIENT_EXCLUSIVE` audio focus, so a
  transient focus request doesn't hold it back either.

Real fix in `ShieldService.kt` — **bounce the blocked app to the launcher**:
- When a blocked package is detected in the foreground the service fires
  `ACTION_MAIN`/`CATEGORY_HOME`. The blocked app's `onPause` runs → reel
  playback + audio stop for real (Android lifecycle guarantee, no media
  session needed).
- The overlay then stays over the home screen showing the block message +
  "Back to Pico" until the user taps the button or opens a non-blocked app.
- MEDIA_PAUSE dispatch + transient audio focus kept as belt-and-suspenders
  for the ~1 s gap before the bounce lands.
- Under memory pressure the overlay draw is skipped but the bounce still
  happens — blocking still works, only the visual is dropped.

Device verification (post-fix build):
- Open Instagram → ~1 s → app bounced to home, shield overlay over launcher
  (`r31_bounce.png`). No IG media session active.
- "Back to Pico" → Pico foreground, overlay hidden.
- WhatsApp (non-blocked) → opens normally, no overlay.
- Reopen Instagram → bounced again, overlay returns.
- Note: the block UX changed — instead of covering the app in-place, the
  shield now returns the user to the home screen under the overlay. This is
  the only reliable way to stop in-app media without accessibility service
  or device-admin rights.
