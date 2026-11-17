# Round 31 — Chat action triggers (doc 11, Task 2)

Device: TECNO CL6, staging flag-ON build. Guest session (no auth email used).
Mode: `pico_user_mode=chat` so the text composer is visible (voice home is the
native default; the toggle is a user preference, not a bypass).
Driver: React-native setter on the composer `textarea` + `send message` button.

Rule-based detection in `agentIntents.ts` runs inside `EditView.sendSticky`
before `handleSubmit()` — matched messages never reach the API. **0 LLM calls
were made for this task** (all 8 messages intercepted by rules).

| # | Message sent | Intent | Reply shown | Device result |
|---|---|---|---|---|
| 1 | `open youtube` | open_app com.google.android.youtube | "Opening the app…" | YouTube in foreground (mCurrentFocus `Shell$HomeActivity`) |
| 2 | `open instagram` | open_app com.instagram.android | "Opening the app…" | InstagramMainActivity foreground |
| 3 | `open https://example.com` | open_url | "Opening the link…" | Chrome ChromeTabbedActivity foreground |
| 4 | `go to wikipedia.org` | open_url (bare domain → https) | "Opening the link…" | Chrome foreground |
| 5 | `set a timer for 2 minutes` | set_timer 120s | "Timer set." | com.transsion.deskclock task 10322 created timer |
| 6 | `set a timer for 1 minute` | set_timer 60s | "Timer set." | Clock running (00:52 pill in status bar) |
| + | `call +920000000011` | call → native confirm | "Cancelled." | Masked dialog "Call ••••••••••••11?" — `r31_trig_call_confirm.png`; CANCEL → cancelled |
| + | `share on whatsapp: r31 chat trigger test` | share_whatsapp → native confirm | "Cancelled." | Dialog "Share this text on WhatsApp?" (text not echoed) — `r31_trig_share_confirm.png`; CANCEL → cancelled |

Verification that no LLM round trip happened: assistant replies are the static
`STATUS_TEXT` strings from `agentIntents.ts` ("Opening the app…", "Timer set.",
"Cancelled.") — identical to the map at lines 119–132; no streaming, instant.

Visible confirmation requirement (call + share): PASS — both show the native
AlertDialog before any intent leaves the app.
Server router untouched: PASS — `handleSubmit()` is only reached on non-match.

Evidence: screenshots `shots/r31_trig_*.png`; message DOM capture above.
