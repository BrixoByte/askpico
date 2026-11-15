# Fixes — mobile app dev issues

Recurring issues hit while building/testing the Android app (`apps/mobile`) against the Vite dev server (`apps/web`, port 5173) and API backend (`services/api`, port 3001). Add new entries below as they come up.

---

## 1. WebView shows "webpage not available" / connection refused on `localhost:5173`

**Symptom:** App opens but the WebView shows an error page; logcat shows the page failed to load `http://localhost:5173`.

**Root cause:** `localhost` inside the WebView resolves to the *phone*, not the PC. The debug build relies on `adb reverse` to forward the phone's localhost ports to the PC. That mapping lives in `adbd` memory only — it is **wiped every time** the device disconnects, `adbd` restarts (USB replug, phone reboot, wireless-ADB reconnect), or the adb server restarts. Wireless ADB (`adb-..._adb-tls-connect._tcp`) drops often, so this recurs constantly during testing.

**Quick fix (one-off):**

```bat
adb-reverse.bat
```

or manually (both ports — see issue 3 for why 3001 is also needed):

```bat
adb reverse tcp:5173 tcp:5173
adb reverse tcp:3001 tcp:3001
```

Then reload the app (force-stop + reopen, or pull to refresh).

**Permanent fix (recommended):** keep the mapping re-applied automatically —

```powershell
powershell -File adb-watch.ps1
```

Run it once per session (it loops every 5s and re-applies the rules to every connected device). For across-reboots, register it in Task Scheduler:

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"C:\Users\Ahtasham734\Downloads\Drive F\Developer\Web Apps\askpico\apps\mobile\adb-watch.ps1`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName "PicoAdbReverse" -Action $action -Trigger $trigger -RunLevel Highest
```

**Diagnose when it happens:**

```bat
adb devices                 :: is the phone listed as "device" (not offline/unauthorized)?
netstat -ano | findstr :5173 :: is Vite actually listening?
adb reverse --list          :: are tcp:5173 and tcp:3001 both present?
adb logcat -d | findstr /i "vite chromium"  :: did the WebView connect?
```

Healthy logcat shows `[vite] connecting...` then `[vite] connected.` from `http://localhost:5173/@vite/client`.

**Notes:**

- `adb reverse --persistent` is NOT supported by platform-tools 37.0.1 — the mapping cannot be made permanent at the adb level.
- If the phone appears twice in `adb devices` (USB + WiFi TLS), that is the same device on two transports — harmless, but bare `adb` commands will error with "more than one device"; use `adb -s <serial>` or the scripts above which handle all devices.
- Emulator instead of a physical phone: set debug `WEB_URL` in `app/build.gradle.kts` back to `http://10.0.2.2:5173` (emulator's alias for the host PC) — no adb reverse needed.
- Alternative with zero adb: point `WEB_URL` at the PC's LAN IP and add it to `network_security_config.xml` + the host check in `MainActivity.kt`. Requires same WiFi and a stable IP (DHCP reservation).

---

## 2. Purple bars at top/bottom of screen in the app (but not in browser)

**Symptom:** solid purple strips above and below the chat UI inside the Android app.

**Root cause:** not CSS — the Android theme painted the **system bars** with `@color/brand_600` (`statusBarColor`, `navigationBarColor`, `windowBackground` in `res/values/themes.xml`). The WebView is edge-to-edge, so those colors show as hard bars.

**Fix (applied):**

- `themes.xml`: status/nav bar colors → `@android:color/transparent`, contrast enforcement off, `windowBackground` → `@color/app_bg` (`#EFECF6`, matches web bg). Light system-bar icons by default.
- `PicoBridge.setSystemBars(darkBackground)` added — web calls it from `App.tsx` on theme change so dark mode gets light icons.
- `index.html`: `viewport-fit=cover` added so `env(safe-area-inset-*)` reports real values.
- Safe-area padding added: `MobileBar` top inset, `Menu` drawer top/bottom inset + close-button offset. Bottom inset was already handled in `Chat.tsx` (`pb-[max(0.5rem,env(safe-area-inset-bottom))]`).

**Note:** requires an Android rebuild (themes/manifest/Kotlin changed) — web-side changes hot-reload via Vite.

---

## 3. Page loads but chat reply fails: "Connection to Pico was lost while generating"

**Symptom:** WebView loads fine, but sending a message shows *"Connection to Pico was lost while generating. Check your network and try again."* (set in `apps/web/src/hooks/useSubmit.ts` when any API call throws a `TypeError` = fetch failed).

**Root cause:** the page and the API are **two different ports**. Vite serves the app on `5173`, but all backend calls go to `http://<host>:3001` (`backendUrl` in `apps/web/src/api/api.ts`). `adb reverse tcp:5173` only forwards the page — the phone's `localhost:3001` hits nothing, so every chat/agent/memory request fails. `memory.ts` and `tools.ts` also hardcoded `http://localhost:3001`, which broke on emulator/LAN-IP setups; they now share the exported `backendUrl` from `api.ts` (derived from `window.location`, port 3001).

**Fix:**

- Both ports must be reversed — `adb-reverse.bat` / `adb-watch.ps1` now handle `5173` **and** `3001`. Manual:

  ```bat
  adb reverse tcp:5173 tcp:5173
  adb reverse tcp:3001 tcp:3001
  ```

- Backend must be running on the PC: `services/api` listens on `3001` (`netstat -ano | findstr :3001`).

- Emulator: no reverse needed — page at `10.0.2.2:5173` makes `backendUrl` = `http://10.0.2.2:3001`, which the emulator routes to the host automatically.

**Diagnose:** in logcat, `[Pico]` traces show which step failed; a `TypeError`/`network error` in the web console means a fetch couldn't reach `:3001`. From a shell: `adb shell "nc -z -w 5 localhost 3001"` should print nothing on failure and exit 0 on success.
