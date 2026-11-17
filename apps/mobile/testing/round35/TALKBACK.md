# Round 35 — TalkBack + 48dp pass (Task 4)

Device: TECNO CL6, flag-ON staging build. Method: TalkBack enabled via secure settings + CDP accessibility tree (`cdp_ax.mjs`) + DOM audit (`r35_a11y.mjs`: accessible name + ≥48dp effective hit area, counting `::after` expansion). Signed in with the owner's test account for the gated screens.

## Screens

| Screen | Labels | 48dp | Notes |
|---|---|---|---|
| Chat home + composer | PASS — 12/12 named | FIXED — `model selector` (36px), mobile `New Chat` (32px) → `after:-inset-2` (`ModeSelector.tsx`, `MobileBar.tsx`); re-audit expand=true | r35_a11y |
| Sidebar (guest rows) | PASS — all named, 48×48 | PASS | a11y tree |
| Auth sign-in | FIXED — "Remember me" checkbox unlabeled → `aria-label` | FIXED — inputs 42px → `min-h-[48px]`, show/hide 40px → `min-w-[48px]` (`AuthModal.tsx`) | re-audit 0 unnamed |
| Auth sign-up | covered — same components | covered | — |
| Guest screen | = chat home, PASS | PASS | — |
| Offline screen | PASS — `cd_error_offline` contentDescription, native Buttons | PASS | r35_offline.png |
| Chat row menu (signed in) | PASS — Rename/Delete menu, 0 unnamed | PASS | shots/r35_chat_row_menu.png |
| Delete dialog | PASS — `role=dialog`, `aria-modal`, `aria-label='Delete chat'` | PASS | FIXED — focus now auto-moves into dialog + Tab trap added (`ChatRowMenu.tsx` Dialog) | shots/r35_delete_dialog.png |
| Focus apps picker | PASS — AX tree: every app checkbox named via wrapping `<label>` ("WhatsApp, checkbox" …); rows `min-h-[48px]` | FIXED — "Search apps" input 38px → `min-h-[48px]` (`FocusApps.tsx`) | shots/r35_focus_picker.png, cdp_ax dump |
| Focus session screen | PASS — end time, score, unblocks, Turn off/Open app/Emergency all named | PASS | r35_agent_settings.png |
| Agent settings section | PASS — Permissions rows, Grant buttons, Vault form all named | FIXED — vault kind `select` + label `input` 38px → `min-h-[48px]`; popover "Settings" link 40px → `after:-inset-y-1` (`AgentSettings.tsx`, `SettingsMenu.tsx`) | r35_agent_settings.png |
| One tool screen (model warning) | PASS — `aria-label='dismiss warning'` | FIXED — dismiss 44×44 → `after:-inset-1` (`ModelWarningModal.tsx`, `ModeSelector.tsx`) | — |

## TalkBack live check

Enabled `com.google.android.marvin.talkback` → composer focused and accepted text; `cdp_ax.mjs` full-tree dump: all controls named/focusable; picker checkboxes announce app names. TalkBack **OFF** afterwards (`enabled_accessibility_services=null`, `accessibility_enabled=0` — device baseline restored).

## Controls that read wrong — record

1. `Remember me` checkbox — no accessible name → `aria-label` (fixed).
2. Mobile `model selector` — 36px, no expansion (fixed).
3. Mobile `New Chat` FAB — 32px, no expansion (fixed).
4. Auth email/password inputs — 42px (fixed → 48px).
5. `Show password` — 40×42px (fixed → ≥48px).
6. Vault `select` + label `input` — 38px (fixed → 48px).
7. Popover "Settings" link — 40px (fixed → ≥48px via `::after`).
8. "Search apps" input — 38px (fixed → 48px).
9. "dismiss warning" buttons — 44×44 (fixed → ≥48px effective).
10. Delete dialog — focus didn't move inside; added auto-focus + Tab trap (fixed).
- Decorative images ("Tech Waves Background", "Pico logo") announce — cosmetic, non-interactive; left unchanged.
- Picker bare checkboxes (16×16): audit false-positives — they sit inside `min-h-[48px]` `<label>` rows; AX tree shows correct names and the row is the tap target.
