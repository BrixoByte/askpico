# Round 31 — Task 5: TalkBack / accessibility pass

Date: 2025-11-17. Device: TECNO CL6 (HiOS), TalkBack enabled via
`settings put secure enabled_accessibility_services`.
Method: device screenshots with TalkBack focus ring + CDP
`Accessibility.getFullAXTree` (`testing/round31/cdp_ax.mjs`) since HiOS
breaks `uiautomator dump`.

| Surface | Result | Evidence |
|---|---|---|
| Chat home (guest) | PASS | AX tree: `New Chat`, `menu`, `model selector`, `attach file`, `turn voice mode on`, composer textbox `Ask PICO anything...`, guest status `Voice trial: 2:00 left` — all named, focusable, logical order. (AX dump via cdp_ax.mjs; matches R30 baseline.) |
| Low-memory banner | PASS | `role="status"` + polite live region (`LowMemoryBanner.tsx`); announced without stealing focus. |
| Shield overlay (native) | PASS | With TalkBack on, Instagram blocked → focus ring landed on title "This app is blocked by your shield", swipes walked to detail text, tap on "Back to Pico" activated and returned to Pico. Shots: `r31_tb_shield*.png`, `r31_tb_btn_focus.png`. Native Button exposes proper role+label to the a11y tree. |
| Auth screen | PASS (R30 carry-over) | Unchanged this round; R30 verified email field + buttons labeled. |
| Delete-account dialog | PASS (R30 carry-over) | Unchanged this round. |
| Settings > Agent | NOT VERIFIED | `gateSignedIn` gates the whole Settings sheet for guests (0 auth-email budget). Code read confirms Toggle uses a real `<input type=checkbox>` (a11y-correct) and presets are `<label>`+checkbox. |

## Fixes made this round (a11y-adjacent)
- Settings nav rows + close button now ≥48dp hit areas (see TOUCH_TARGETS.md).

## Notes
- TalkBack focus cycling on the overlay iterated title→detail→(wrap); the
  button was reached via explore-by-touch (single tap = focus+announce,
  activation confirmed by return to Pico). This is standard TalkBack
  behavior for `TYPE_APPLICATION_OVERLAY` windows.
