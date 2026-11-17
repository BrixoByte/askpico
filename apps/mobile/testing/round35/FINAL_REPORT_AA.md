# Round 35 — FINAL REPORT AA (Android beta, beta-launch §2 + §11)

Device: TECNO CL6 (`119652548M014318`), staging debug build with `VITE_AGENT_ACTIONS=true` baked into bundled `apps/web/dist`.
**`VITE_AGENT_ACTIONS` is OFF in the shipped build** — flag-ON exists only locally on the test device; `dist` was rebuilt flag-OFF at the end of the round.
No commit, push, merge, tag, deploy, or any cloud/Play settings touched. CALL_PHONE manifest untouched.

## Tasks

| Task | Status | Evidence |
|---|---|---|
| 1 Chat action triggers | DONE | `CHAT_ACTIONS.md` — 9/9 device rows + 15 unit tests |
| 2 Intent actions device pass | DONE | `INTENT_ACTIONS.md` — 9/9 |
| 3 Pico Vault v1 | DONE | `VAULT.md` — 6/6 (incl. UI save via owner's test account) |
| 4 TalkBack + 48dp | DONE | `TALKBACK.md` — 12 screens audited; 10 issues found+fixed |
| 5 Low-memory handler | DONE | `LOWMEM.md` — RUNNING_LOW + RUNNING_CRITICAL verified; 3 unit tests |
| 6 Offline check | DONE | `OFFLINE.md` — Retry/session PASS; translation PARTIAL (English-only resources) |

## Device rows

| Row | Result | Evidence |
|---|---|---|
| open chrome / whatsapp (2) | PASS | shots/r35_ca1, ca2 |
| open https ×2 | PASS | shots/r35_ca3, ca4 |
| timer 5m / 10m | PASS ("Timer set.") | shots/r35_ca5, ca6 |
| call → masked confirm → cancel | PASS | shots/r35_ca7 |
| share → confirm → share sheet cancel | PASS (nothing sent) | shots/r35_ca8, ca9 |
| injection `javascript:` rejected | PASS | shots/r35_ca10 |
| non-allowlisted app / `file:` / `.evil` pkg → invalid | PASS | CDP results |
| call denied-permission path | PASS (`denied`) | shots/r35_ia_call_perm |
| app-not-installed | PASS (`unsupported`, TikTok disable→enable) | CDP results |
| vault UI save / restart / no-leak / ref-in-action / logcat-grep / ciphertext | PASS | shots/r35_vault_ui, r35_vault_share_dialog |
| low-mem RUNNING_LOW, RUNNING_CRITICAL, recovery | PASS | shots/r35_lm_* |
| offline screen + retry-session | PASS | shots/r35_offline, _after_retry |
| TalkBack: chat, sidebar, auth, offline | PASS (fixes verified) | TALKBACK.md |
| TalkBack: chat row menu, delete dialog, focus picker, focus session, agent settings, tool screen | PASS (signed-in pass) | shots/r35_chat_row_menu, r35_delete_dialog, r35_focus_picker, r35_agent_settings |
| offline translation | PARTIAL | English-only `strings.xml` (translatable, one locale) |

## Counts

- Device rows: **25 PASS, 0 FAIL, 1 PARTIAL, 0 BLOCKED**.
- Web: `tsc` clean · `vitest` **368/368** (was 360; +5 agentIntents, +3 lowMemory).
- Builds: flag-ON `vite build` ✓ · `assembleStaging` ✓ · `assembleDebug` ✓ · flag-OFF `vite build` ✓ (final dist state).
- Kotlin unchanged → native unit tests not required. API unchanged → `services/api` tests not run.

## Files changed

- `apps/web/src/utils/agentIntents.test.ts` — +5 tests (alarm, share, dangerous schemes, injection, confirm-contract).
- `apps/web/src/utils/lowMemory.test.ts` — new, 3 tests.
- `apps/web/src/components/MobileBar/MobileBar.tsx` — `New Chat` hit-area `after:-inset-2`.
- `apps/web/src/components/Chat/ModeSelector.tsx` — model-selector + dismiss-warning hit-areas.
- `apps/web/src/components/Chat/ModelWarningModal.tsx` — dismiss hit-area `after:-inset-1`.
- `apps/web/src/components/Auth/AuthModal.tsx` — checkbox `aria-label`, inputs `min-h-[48px]`, show/hide `min-w-[48px]`.
- `apps/web/src/components/SettingsMenu/AgentSettings.tsx` — vault select/inputs `min-h-[48px]`.
- `apps/web/src/components/SettingsMenu/SettingsMenu.tsx` — Settings link `after:-inset-y-1`.
- `apps/web/src/components/SettingsMenu/FocusApps.tsx` — "Search apps" `min-h-[48px]`.
- `apps/web/src/components/Menu/ChatRowMenu.tsx` — Dialog: auto-focus inside + Tab focus-trap.
- New: `apps/mobile/testing/r35_chat.mjs`, `r35_a11y.mjs`, `testing/round35/**`.

## Cleanup

- Signed in with the owner's test account (credentials used only in the sign-in form; never written to files/logs/reports/captions); **signed out afterwards** → device back on Guest.
- All `adb forward`/`reverse` removed. No local servers left running.
- DND off, font_scale 1.0, rotation auto, **TalkBack OFF**; `enabled_accessibility_services=null` = pre-test baseline.
- Device files created: **none** (captures via `exec-out`; nothing pushed). Test vault refs (`other:ref_r35test`, `other:ref_r35ui`, `other:ref_e8a6369c39f8`, `contact:ref_probe`, `credential:ref_0422054a3139`) remain inside encrypted `pico_vault` — left per the no-delete rule; owner may clear via the app.
- WhatsApp opened only to home/picker screens during share test; no message or text sent to anyone.

## Accounts touched

Only the owner's test account (sign-in + sign-out).

## Owner must do

- **Rotate the test account password** (it was shared in chat).
- Commit + PR merge of the changed files.
- Configure `VITE_BACKEND_URL` and redeploy — confirm `VITE_AGENT_ACTIONS` unset/false.
- Play Console: Usage Access + display-over-other-apps declarations.
- Optional: add translated `values-<locale>` string resources for the offline screen.
