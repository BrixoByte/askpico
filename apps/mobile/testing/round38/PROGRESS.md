# Round 38 — Progress log

Device: TECNO CL6. Build: staging flag-ON (installed in Round 35 — no rebuild
this round; no Kotlin changes). Session: guest first, then signed in with the
owner's test account for the Agent-settings checks (credentials used only for
sign-in, never written to files). `TEST_EMAIL` was unset in env — the
owner-provided chat credentials were used for sign-in only.

## Task 1 — Magic-link sign-in check

Greps across `apps/web/src`, `apps/mobile/app/src`, `apps/web/public/locales`:

- `signInWithOtp` — **0 matches** anywhere in shipped code.
- `magiclink` — only in `utils/verifyLink.ts` `OTP_TYPES` (the Supabase
  token_hash verify route used by signup/recovery links — kept per spec).
- "magic link" / "email me a link to sign in" — 0 matches in code and in all
  21 locale dirs.
- The word "magic" in shipped UI = **Magic mode** (model auto-picker,
  `ModeSelector.tsx`, `constants/chat.ts`) — unrelated, kept.
- File list (only magic-link-related file, and it stays):
  `apps/web/src/utils/verifyLink.ts`.
- Device: `shots/r38_auth_screen.png` — auth screen shows email + password,
  Sign in, Sign Up, Forgot Password, Continue as guest. No magic-link control.
- Unit test added: `AuthModal.magiclink.test.tsx` — "renders only
  email/password sign-in — no magic-link control". PASS.

**Nothing needed removing — no user-facing magic-link sign-in exists.**

## Task 2 — Share to WhatsApp fallback (device)

Path: `ActionExecutor.shareWhatsApp` — WhatsApp-targeted `ACTION_SEND`
(`setPackage(com.whatsapp)`), `ActivityNotFoundException` →
`Intent.createChooser` system sheet. No code change needed.

| Case | Result | Evidence |
|---|---|---|
| WhatsApp present → prefilled composer | PASS | confirm "Share this text on WhatsApp?" → SHARE → `com.whatsapp/.contact.ui.picker.ExternalShareAlias` foreground (`dumpsys`); `shots/r38_share_target.png`. Backed out — nothing sent. |
| WhatsApp disabled → system share sheet | PASS | `pm disable-user --user 0 com.whatsapp` → SHARE → `com.transsion.resolver/.ChooserActivityLauncher` "Sharing Text" sheet with the draft text (`shots/r38_share_fallback.png`). Dismissed — nothing sent. |
| User must press send in both cases | PASS | Contact picker / app chooser both require a user pick; no auto-send. |
| Re-enable + verify | PASS | `pm enable com.whatsapp` → `pm list packages` shows `package:com.whatsapp` (+ `.w4b`). |

- `pm disable-user` made Pico lose foreground once (HiOS home-screen bounce);
  re-sent the message — no data touched, WhatsApp re-enabled immediately.
- Unit test added: `share falls back to the system sheet when WhatsApp is
  missing` (agentIntents.test.ts) — asserts `setPackage(WHATSAPP_PACKAGE)` +
  `ActivityNotFoundException`→`createChooser`. PASS.

## Task 3 — Agent settings permission refresh (device)

See `AGENT_PERMISSIONS.md` — **PASS**, no fix needed (window-focus refresh
already live). Grant/revoke via `appops`; row updated both ways without
restart; original `default` state restored.

## Task 4 — beta-launch.md updates

Applied: changelog line (Round 38); section 11 Chibi + Intent-actions +
shield→Focus-apps rows; section 12.4 Chibi rows; section 12.8 ticks
(S3, S18, offline — linked to round35 reports); section 12.9 rewritten —
call row → ACTION_DIAL text, 4 Shield rows → 8 Focus-apps rows, all 12.9 rows
ticked with evidence links (rounds 31/33/35/37/38).

## Task 5 — Gates

- `npx tsc --noEmit`: clean.
- `npx vitest run`: **372/372** (17 files; +1 magic-link test, +1 share-fallback
  guard — count went 370→372 because one earlier test count reported 370).
- `npm run build` (VITE_AGENT_ACTIONS unset → flag OFF): ✓ 17.23s.
- Kotlin unchanged this round → assembleDebug/testDebugUnitTest not required.
- Repo "magic" grep in shipped UI: only Magic-mode strings (unrelated); no
  magic-link text in any locale.

## Cleanup

- WhatsApp re-enabled (`pm list packages` confirmed).
- `SYSTEM_ALERT_WINDOW` restored to `default` (original).
- Signed out the owner's test account (back to /auth).
- `adb forward tcp:9222` added for CDP and removed at the end; forward and
  reverse lists empty.
- font 1.0, rotation auto, DND off, accessibility list `null` (baseline),
  TalkBack untouched.
- No files created on the device. Nothing deleted.
