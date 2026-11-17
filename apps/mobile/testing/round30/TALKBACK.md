# Round 30 — TalkBack pass (local build, device 119652548M014318)

Method: TalkBack enabled live (SpeechController activity in logcat); per-screen
accessibility tree read via CDP `Accessibility.getFullAXTree` — the same tree
TalkBack consumes. Screenshots with visible TalkBack focus ring as evidence.

## Screen 1 — Auth (`/auth`)

| Control | Role/name | Verdict |
|---|---|---|
| Pico logo | image "Pico logo" | OK |
| Email | textbox "Email" | OK |
| Password | textbox "Password" | OK |
| Show password | button "Show password" | OK |
| Remember me | checkbox "Remember me" | OK |
| Forgot Password / Sign in / Sign Up | buttons | OK |
| Continue as guest | button | OK |
| Privacy Policy / Terms | links | OK |

Focus order follows visual order (logo → email → password → controls → legal).

## Screen 2 — Chat with composer (`/?chat=r30mmd`)

| Control | Role/name | Verdict |
|---|---|---|
| menu / model selector / attach file / turn voice mode on | labeled buttons | OK |
| Composer | textbox "Ask PICO anything..." | OK — TalkBack ring visible (r30_p2.png) |
| Chat rows | links "Mermaid test Chat options…" etc. | OK |
| Artifact panel | Preview/Code tabs, close, download, copy code, file rows | all labeled |

## Screen 3 — Sidebar + guest voice-trial row (`/`, guest session)

- Sidebar controls (New Chat, search chats, Appearance Light/Dark, close sidebar, Sign in, profile chip) all labeled.
- Voice-trial row: **hidden by design** for a fresh guest (`GuestVoiceTrialRow.tsx`
  renders only when `isGuest && remaining != null`); unit tests
  `GuestVoiceTrialRow.test.tsx` assert role=`status` + aria-label
  "Voice trial: 2:00 left". Verified live in R29 on production ("Voice trial:
  2:00 left" as `status` role). This round's fresh guest had no grant → hidden —
  correct behavior.

## Screen 4 — Delete-account dialog (Settings → Account)

- **Bug found + fixed this round**: the confirmation overlay had no dialog
  semantics — only headings + buttons. Added `role="alertdialog"`,
  `aria-modal="true"`, `aria-labelledby/aria-describedby` to the delete-account
  and clear-memory confirm dialogs in `SettingsMenu.tsx`.
- Verified post-fix: `[role=alertdialog] aria-modal=true
  aria-labelledby=delete-account-title` present in the live AX tree;
  Cancel/Delete buttons labeled. Dialog dismissed via Cancel (no deletion).
- Note: focus trap is not implemented (backdrop click closes; keyboard users
  can still reach buttons — acceptable for beta, flagged for later).

## Screen 5 — Tool (QR Scanner)

- `dialog` role, `aria-label="QR Scanner tool"`, `aria-modal`.
- Controls: Back to chat, tool search (textbox), tool buttons (Freelance Rate,
  Barcode Generator, QR Generator, QR Scanner), Start camera — all labeled.

## Fixes applied

- `SettingsMenu.tsx`: `alertdialog` semantics on both destructive-confirmation
  dialogs (delete account, clear memory).

## Residual (not blocking)

- Profile-chip popup items ("Settings", "Sign out") are `<a>` elements without
  `role="menuitem"` — announced as links; functional.
- No keyboard focus trap in confirm dialogs.
- End state: TalkBack OFF, prior service restored
  (`com.ksxkq.autoclick/.service.AutoClickAccessibilityService`).
