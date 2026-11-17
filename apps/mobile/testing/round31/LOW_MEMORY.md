# Round 31 — Low-memory device behaviour (doc S18, 12.8, Task 7)

Device: TECNO CL6, staging flag-ON build.
Simulated via `adb shell am send-trim-memory com.askpico.pico RUNNING_LOW`.

| Check | Result | Evidence |
|---|---|---|
| `onTrimMemory` fires ≥ `TRIM_MEMORY_RUNNING_LOW` | PASS | `MainActivity.kt:955-963` latches `ShieldService.setMemoryPressure(true)` and posts `window.PicoMemory.onLowMemory(level)` to the page. |
| Shield overlay disabled under pressure | PASS | Shield was enabled with Instagram preset and had just blocked it (`r31_shield_blocked.png`). After `send-trim-memory`, Instagram relaunched fully visible — no overlay (`r31_lowmem_ig2.png`). `memoryPressure` latches for the process (`ShieldService.kt:82`). |
| In-app message shown | PASS | Amber banner "This device is low on memory — previews and the app shield are paused so chat keeps working." rendered top-of-screen (`r31_lowmem_banner2.png`). `LowMemoryBanner` subscribes via `useSyncExternalStore(subscribeLowMemory, isLowMemoryMode)`. |
| Chat still works | PASS | With pressure latched, composer sent "open chrome" → `runAgentAction` → Chrome opened (`mCurrentFocus=…ChromeTabbedActivity`). Rule-based path unaffected. |
| Voice still works | VERIFIED-BY-CODE | `stt.ts` untouched per scope; `onTrimMemory` path only touches `ShieldService` + `PicoMemory` hook. Voice UI/composer unaffected (composer worked in test above). |
| Artifact preview pauses | VERIFIED-BY-CODE | `PreviewFrame.tsx` subscribes to `subscribeLowMemory`; when latched it replaces the iframe with "Preview paused — this device is low on memory. The code is still in the Code tab." No tool run was triggered during the pass, so the live swap was not screenshotted — covered by unit test + code path. |
| Latching semantics | PASS (by design) | Android has no "memory recovered" callback; latch holds for the process lifetime. Fresh launch clears it (verified earlier when `memoryPressure` had latched during heavy testing and cleared on force-stop+relaunch). |

## What was NOT simulated
- A real OS-driven OOM kill / `TRIM_MEMORY_COMPLETE` — `send-trim-memory` delivers the callback but doesn't actually reclaim. Behaviour at higher levels is identical by code (`level >= TRIM_MEMORY_RUNNING_LOW` all latch the same flag).
- Live PreviewFrame swap (no artifact tool was run this round).

## Stale-assets bug found & fixed during this task
`assembleStaging` was packaging `apps/mobile/app/src/staging/assets/web/` —
a snapshot last copied Nov 15 — instead of the fresh `apps/web/dist`. Root
cause: `syncWebAssets` copies `from("../web/dist")` which resolves to
`apps/mobile/web/dist` (nonexistent), so the task is a silent no-op.
Worked around by copying `dist` into the staging assets dir manually before
rebuild; **owner should fix the path in `app/build.gradle.kts` to `../../web/dist`**.
