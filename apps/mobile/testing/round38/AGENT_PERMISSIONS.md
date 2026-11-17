# Round 38 — Agent settings permission status refresh

Device: TECNO CL6. Build: staging flag-ON (installed in Round 35). Session:
signed in with the owner's test account (credentials used only for sign-in,
never written to files).

Method: Settings > Agent open in-app; `appops` toggles `SYSTEM_ALERT_WINDOW`
between `default` (original state) and `allow`; refresh triggered by returning
to the app (window `focus` event — the live listener in AgentSettings/FocusApps).

| Check | Result | Evidence |
|---|---|---|
| Initial state: overlay permission `default` | PASS | `appops get … SYSTEM_ALERT_WINDOW` → `default`; 4 Grant buttons in Agent settings |
| Grant overlay → row updates to granted on return | PASS | `appops set … allow` + return → 3 Grant buttons (overlay row shows granted). `shots/r38_agent_granted.png` |
| Revoke overlay → row shows revoked without restart | PASS | `appops set … default` + return → 4 Grant buttons again. `shots/r38_agent_revoked.png` |
| Before-state screenshot | — | `shots/r38_agent_before.png` |
| Restore original state | PASS | `SYSTEM_ALERT_WINDOW` back to `default` — the original value |

Result: **PASS** — the row refreshes on window focus; no code change needed.
