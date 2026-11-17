# Round 35 — PROGRESS

Device: TECNO CL6 (`119652548M014318`). Local flag-ON staging build (`VITE_AGENT_ACTIONS=true`, bundled dist). Shipped builds keep the flag OFF.
CDP helper: `testing/cdp_env.mjs`, `testing/r35_chat.mjs`, `testing/r35_a11y.mjs`, `testing/cdp_ax.mjs` on `adb forward tcp:9222`.

## Steps

- Read `agentIntents.ts`, `nativeAgent.ts`, `EditView.tsx` send path, `PicoBridge.kt`, `ActionExecutor.kt`, `ActionValidation.kt` — routing already wired (text-origin → `detectDeviceIntent` → `runAgentAction` → `performAction` → `ActionExecutor`; same validation for every origin).
- Added unit tests `agentIntents.test.ts` (alarm, whatsapp share, dangerous-scheme rejection, injection strings, native confirmation-contract guard) → `15 passed`.
- Added `lowMemory.test.ts` (sub-threshold ignore, RUNNING_LOW latch + notify, CRITICAL latch) → `3 passed`.
- Device chat rows: `open chrome` → Chrome foreground (r35_ca1). `open whatsapp` → WhatsApp foreground (r35_ca2). `open https://example.com` + `open https://en.wikipedia.org/wiki/Pakistan` → Chrome VIEW (r35_ca3/4). `set a timer for 5/10 minutes` → "Timer set." (r35_ca5/6). `call +923001234567` → native dialog "Call ••••••••••••67?" → CANCEL → "Cancelled." (r35_ca7). `share hello on whatsapp` → "Share this text on WhatsApp?" → SHARE → WhatsApp Send-to picker, cancelled via back, nothing sent (r35_ca8/9). `open javascript:alert(1)` → "\"javascript\" is not supported …" (r35_ca10).
- Bridge rows (hooked `PicoAction.onResult`): `open_app com.google.android.gm` → invalid; `open_url javascript:alert(1)` → invalid; `open_url file:///etc/passwd` → invalid; `open_app com.whatsapp.evil` → invalid.
- `call` → CALL → permission prompt → "Don't allow" → result `denied` (r35_ia_call_perm).
- TikTok `pm disable-user` → `open_app com.zhiliaoapp.musically` → `unsupported`; package re-enabled immediately (no data touched).
- Vault: `vaultSet('other:ref_r35test', dummy)` → true; force-stop + relaunch → `vaultHas` → true; DOM text contains no dummy value; `share_whatsapp` with `text=other:ref_r35test` → confirm dialog (no value echoed) → CANCEL → `cancelled`; logcat grep for dummy value → 0 matches; `pico_vault.xml` → keys+values all ciphertext (AES256_SIV/GCM).
- Low memory: `am send-trim-memory RUNNING_LOW` → banner shown, no iframe, composer works (r35_lm_running_low). `MODERATE`/`CRITICAL` rejected by system for foreground process (background-only levels); `RUNNING_CRITICAL` accepted → banner (r35_lm_critical). Fresh process + `MODERATE` while backgrounded → latch fires (level 60 ≥ 10).
- Offline: `--es pico_force_error offline` → "You are offline" + RETRY + OPEN IN BROWSER (r35_offline); RETRY → guest session intact, chat restored.
- A11y: CDP audit — chat home 12/12 named; found `model selector` 36px + mobile `New Chat` 32px without hit-area → added `after:-inset-2` (MobileBar.tsx, ModeSelector.tsx). Auth: checkbox unlabeled + inputs 42px + show-password 40px → `aria-label`, `min-h-48` inputs, `min-w-48` toggle (AuthModal.tsx). Rebuilt flag-ON staging, reinstalled, re-audit: expand=true, 0 unnamed.
- TalkBack enabled via settings → composer focus + typing works; `cdp_ax.mjs` tree: all controls named (New Chat, Light/Dark Mode, close sidebar, menu, model selector, Sign in, attach, send, composer placeholder). TalkBack OFF after.
- Gates: `tsc` clean; `vitest` **368/368**; flag-ON `npm run build` ✓; `assembleStaging` ✓; `assembleDebug` ✓. No Kotlin changes → native unit tests not required this round. No API changes → services/api tests not run.
- Flag-OFF `npm run build` at the end (shipped state restored on dist).

## Signed-in pass (owner's test account, credentials used only for sign-in)

- Sign in via /auth → "Idealize QA", chat rows visible. No credential written to any file/log/report.
- Vault UI save: kind=credential, label R35e → `pico-vault-refs` + `pico_vault.xml` (6→7 entries). DOM shows label, not value. (Earlier failures were a synthetic-select edge case, not a product bug.)
- Chat row menu + delete dialog: opened on "New Chat 3" → `role=dialog`, `aria-modal`, `aria-label` ✓; Cancel → dialog gone, chat kept. Found focus not entering dialog → added auto-focus + Tab trap (`ChatRowMenu.tsx`).
- Agent settings + Focus session screen audit: 0 unnamed; vault select/input 38px + Settings link 40px → fixed (`min-h-48`, `after:-inset-y-1`).
- "dismiss warning" 44×44 → `after` expand (`ModelWarningModal.tsx`, `ModeSelector.tsx`).
- Focus picker (after session expired naturally ~19:17): AX tree shows every app checkbox named via label; "Search apps" 38px → `min-h-48` (`FocusApps.tsx`).
- Gates re-run after fixes: tsc clean, vitest 368/368, flag-ON build + assembleStaging + reinstall → re-audit confirms fixes.
- Sign out → /auth, guest. Flag-OFF `npm run build` (dist back to shipped state). Forwards removed, TalkBack off, font 1.0, rotation auto, DND off.
