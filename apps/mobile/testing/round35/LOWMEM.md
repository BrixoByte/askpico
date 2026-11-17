# Round 35 — Low-memory handler (Task 5)

Device: TECNO CL6, flag-ON staging build.

Implementation (pre-existing, verified): `MainActivity.onTrimMemory` → levels `< TRIM_MEMORY_RUNNING_LOW` ignored → `ShieldService.setMemoryPressure(true)` (overlay pauses) → `window.PicoMemory.onLowMemory(level)` → web latch (`nativeAgent.ts`) → `LowMemoryBanner` ("This device is low on memory — previews and the app shield are paused so chat keeps working.") + `PreviewFrame` unmounts the artifact iframe.

| Simulation | Result | Evidence |
|---|---|---|
| `am send-trim-memory … RUNNING_LOW` | PASS — banner visible, no `iframe` in DOM, textarea works | r35_lm_running_low.png + CDP `{banner:true, iframe:false, ta:true}` |
| `MODERATE` (foreground) | N/A — system refused: "Unable to set a background trim level on a foreground process". Level 60 ≥ threshold anyway (fresh-process check: latch fires) | logcat_r35.txt adbd lines |
| `CRITICAL` (literal) | N/A — not a valid `am` option | logcat |
| `RUNNING_CRITICAL` (foreground equivalent) | PASS — banner present, chat usable | r35_lm_critical.png |
| Recovery | PASS — latch is per-page-load; force-stop+relaunch restores normal state (heavy UI returns on relaunch) | PROGRESS.md |

Unit tests: `lowMemory.test.ts` — 3 pass (sub-threshold level 5 ignored; RUNNING_LOW latches + notifies once; CRITICAL latches). Web tests total 368/368.

Voice: handler does not touch recognizer/`stt.ts`; voice path untouched per rule.
