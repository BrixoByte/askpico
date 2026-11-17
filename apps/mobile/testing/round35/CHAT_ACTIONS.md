# Round 35 — Chat action triggers (Task 1)

Device: TECNO CL6. Local flag-ON staging build only — `VITE_AGENT_ACTIONS` stays OFF in shipped builds.

Route: composer text → `detectDeviceIntent` (rule-based, `agentIntents.ts`) → `runAgentAction` → `PicoBridge.performAction` → `ActionExecutor` → `ActionValidation`. No new agent, no LLM call. Model-originated and text-originated actions hit the same `ActionExecutor` → `ActionValidation` path.

| # | Chat message | Result | Evidence |
|---|---|---|---|
| 1 | `open chrome` | "Opening the app…" → `com.android.chrome` foreground | `shots/r35_ca1_open_chrome.png` + dumpsys topResumedActivity |
| 2 | `open whatsapp` | "Opening the app…" → `com.whatsapp` foreground | `shots/r35_ca2_open_whatsapp.png` + dumpsys |
| 3 | `open https://example.com` | "Opening the link…" → Chrome VIEW | `shots/r35_ca3_open_url.png` |
| 4 | `open https://en.wikipedia.org/wiki/Pakistan` | "Opening the link…" → Chrome VIEW | `shots/r35_ca4_open_url2.png` |
| 5 | `set a timer for 5 minutes` | "Timer set." (Clock accepted `SET_TIMER`) | `shots/r35_ca5_timer_set.png` |
| 6 | `set a timer for 10 minutes` | "Timer set." | `shots/r35_ca6_timer2.png` |
| 7 | `call +923001234567` | Native dialog `Call ••••••••••••67?` (masked) → CANCEL → "Cancelled." | `shots/r35_ca7_call_confirm.png` |
| 8 | `share hello on whatsapp` | Dialog `Share this text on WhatsApp?` (text not echoed) → SHARE → WhatsApp "Send to…" picker → cancelled via Back; nothing sent | `shots/r35_ca8_share_confirm.png`, `shots/r35_ca9_sharesheet.png` |
| 9 | `open javascript:alert(1)` | Rejected: `"javascript" is not supported — only Chrome, WhatsApp, YouTube, Instagram, Facebook and TikTok can be opened.` | `shots/r35_ca10_injection.png` |

PASS 9/9.

## Unit tests (agentIntents.test.ts — 15 pass)

- Each intent mapping: call, open_url, set_timer, set_alarm, open_app, share_whatsapp.
- Dangerous schemes never produce `open_url` (`javascript:`, `file:` fall through to unsupported-app).
- Unknown app → `open_app` + `unsupportedApp`.
- Injection strings → `null` (`toolId=…`, fake JSON, `runAgentAction(…)` text).
- Clock denial → "The Clock app on this phone does not allow this" (statusText, timer+alarm).
- Native confirmation contract: `call`/`share_whatsapp` always route via `confirmCall`/`confirmShare` — source-guard test.
