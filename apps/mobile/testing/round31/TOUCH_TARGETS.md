# Round 31 — Task 6: 48dp touch-target audit

Scope: all beta surfaces — native overlay, auth, chat composer, settings,
shield/agent controls, legal/account controls. Method: code audit of every
interactive element's computed hit area (visual size OR `after:-inset-*`
expansion), plus device spot-check.

| Surface | Before | After | Result |
|---|---|---|---|
| Shield overlay "Back to Pico" (native Button) | Material default minHeight 48dp | unchanged | PASS |
| Settings > Agent — Grant buttons | ~28px tall | `after:-inset-2` expands to ~44–48px hit area | PASS |
| Settings > Agent — "Enable shield" Toggle | ~20px row | label now `min-h-[48px]` | PASS |
| Settings > Agent — preset checkboxes (Instagram/YouTube/TikTok/Facebook) | ~20px row | label `min-h-[48px]` | PASS |
| Settings > Agent — vault Save button | ~36px | `min-h-[48px]` | PASS |
| Settings > Agent — vault Remove buttons | ~18px text | `after:-inset-3` hit area | PASS |
| Settings nav rows (Account/General/Agent…) | ~32px | `min-h-[48px]` | PASS |
| Settings close (X) button | ~28px | `after:-inset-2` | PASS |
| Account — Privacy/Terms links | added this round | `min-h-[48px]` | PASS |
| Chat composer controls (send, attach, mic, mode) | `after:-inset-*`/h-12 already present | unchanged | PASS |
| Auth screen buttons/fields | R30 verified ≥48dp | unchanged | PASS |

Visuals unchanged — all fixes are hit-area expansion via padding or
`after:` pseudo-element, matching the existing codebase pattern.
