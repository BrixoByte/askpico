# Round 35 — Mobile offline check (Task 6)

Device: TECNO CL6, flag-ON staging build (bundled dist at virtual `http://localhost:5173`).

| Check | Result | Evidence |
|---|---|---|
| Offline screen shows Retry + Open in browser | PASS — forced via `--es pico_force_error offline`: "You are offline / Pico needs an internet connection. Check your Wi-Fi or mobile data and try again." + RETRY + OPEN IN BROWSER | r35_offline.png |
| Retry keeps session | PASS — RETRY tapped → bundled page reloaded → still Guest session, chat home restored | r35_offline_after_retry.png + CDP `{guest:true}` |
| Message translated | PARTIAL — strings live in `res/values/strings.xml` (`error_offline_title`/`error_offline_message`, resource-based = translatable) but only English locale ships; no `values-<locale>` dirs | strings.xml |

Note (same as Round 31): on bundled builds the error screen auto-heals because local assets always load; a real network-off cold start lands on the chat home directly.
