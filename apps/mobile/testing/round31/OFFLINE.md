# Round 31 — Offline / no-network checks (doc 12.8, Task 8)

Device: TECNO CL6, staging flag-ON build (BUNDLED_WEB — page served from APK
assets at the virtual `http://localhost:5173` origin).

| Check | Result | Evidence |
|---|---|---|
| Error screen offers Retry + Open in browser | PASS | Debug forced screen (`--es pico_force_error offline`, `EXTRA_FORCE_ERROR` path in `MainActivity`): "You are offline / Pico needs an internet connection…" + RETRY + OPEN IN BROWSER both rendered (`r31_offline2.png`, `r31_offline_am.png`). OPEN IN BROWSER only shows for http/https `lastUrl` (`MainActivity.kt:835-837`). |
| Retry recovers and preserves session | PASS | RETRY tapped → bundled page reloaded → guest session intact (still signed in as Guest, not bounced to auth) and the composer draft survived (`r31_offline_retry.png`). Session lives in WebView localStorage — a main-frame reload never touches it (`MainActivity.kt:920-925` comment). |
| Open in browser button fires external intent | VERIFIED-BY-CODE | Button → `openExternal(lastUrl)` → `startActivity(ACTION_VIEW, url)` (`MainActivity.kt:769-777`). On the bundled build `lastUrl` is the virtual `localhost:5173` origin — opening it in a real browser is meaningless, so the meaningful target is the release `go.askpico.app` build. Device tap raced with the screen's built-in auto-retry (each fresh screen earns one auto-retry, `MainActivity.kt:795`, and bundled assets always succeed → screen self-dismisses). |
| Real airplane-mode launch (bundled build) | PASS | `airplane_mode_on 1` + cold start → app opened straight to the chat home (screenshots show airplane icon in status bar, `r31_offline_am.png`/`r31_after_browser_tap.png`). Bundled assets need no network; API calls degrade gracefully in the web layer. Turned airplane mode back OFF after the pass. |
| Mid-session failure → amber banner | VERIFIED-BY-CODE | `handleLoadFailure` picks `showMidBanner` once `pageLoadedOnce` (`MainActivity.kt:784-792`) — full-screen error only for initial load. Not triggered live this round (R30 covered it). |

## Notes
- The forced-error debug override (`EXTRA_FORCE_ERROR = "pico_force_error"`)
  exists only on `BuildConfig.DEBUG`/staging — shipped builds can't show it.
- Auto-retry race noted: on bundled builds the error screen self-heals fast,
  which is correct product behaviour.
