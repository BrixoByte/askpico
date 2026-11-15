# Pico Web Theme Palette

Locked color tokens for the enterprise UI. These map to the CSS variables in
`src/main.css` and the `brand`/`surface`/`ink`/`gray` scales in
`tailwind.config.cjs`.

## Dark mode

| Token                  | Value     | CSS var / utility                          |
| ---------------------- | --------- | ------------------------------------------ |
| Main Background        | `#0A0B0E` | `body`, `.workspace-bg`, `#root`           |
| Sidebar & Panels       | `#12131A` | `--surface` → `bg-surface`                 |
| Border Stroke          | `#1F2430` | `--surface-line` → `border-surface-line`   |
| Primary Accent (Solar Lime) | `#AACC00` | `--accent` → `bg-brand-500`, focus rings   |
| Secondary Indicators   | `#10B981` | `emerald-500`                              |
| Text Primary           | `#F1F5F9` | `--ink` → `text-ink`                       |
| Muted Text             | `#94A3B8` | `--ink-muted` → `text-ink-muted`           |

Derived dark shades:
- `--surface-muted`: `#181922` · `--surface-subtle`: `#1F2430`
- `--ink-soft`: `#CBD5E1` · `--accent-strong` (hover): `#8FA800`
- `--accent-ink` (text on accent): `#0A0B0E`

## Light mode

| Token                  | Value     | CSS var / utility                          |
| ---------------------- | --------- | ------------------------------------------ |
| Main Background        | `#F8FAFC` | `body`, `.workspace-bg`, `#root`           |
| Sidebar & Panels       | `#FFFFFF` | `--surface` → `bg-surface`                 |
| Border Stroke          | `#E2E8F0` | `--surface-line` → `border-surface-line`   |
| Primary Accent (Rich Solar Lime) | `#8EA800` | `--accent` → `bg-brand-500`, focus rings |
| Secondary Indicators   | `#059669` | `emerald-600`                              |
| Text Primary           | `#0F172A` | `--ink` → `text-ink`                       |
| Muted Text             | `#64748B` | `--ink-muted` → `text-ink-muted`           |

Derived light shades:
- `--surface-muted`: `#F8FAFC` · `--surface-subtle`: `#F1F5F9`
- `--ink-soft`: `#475569` · `--accent-strong` (hover): `#7A9100`
- `--accent-ink` (text on accent): `#0F172A`

## Notes

- Accent applies to: active menu items, primary send button, focus outlines.
- The Settings accent picker (`html[data-accent]`) can still override brand
  colors per user; `purple` = default lime palette.
- `gray-*` utilities follow a slate scale so legacy components pick up the
  same border/surface tones.
