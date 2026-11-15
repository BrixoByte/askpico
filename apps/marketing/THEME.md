# Marketing Site Theme

Source of truth for the marketing landing page colors. Tokens live in `css/style.css`: `:root` is light mode, `[data-theme="dark"]` is dark mode.

## Backgrounds

| Token / Element | Dark Mode | Light Mode | CSS token |
| --- | --- | --- | --- |
| Page / main canvas | zinc-950 `#09090b` | white `#ffffff` | `--bg-page`, `--bg-surface` |
| Cards / modals | zinc-900 `#18181b` (zinc-950 at 80%) | zinc-50 `#fafafa` | `--bg-soft` |
| Input fields | zinc-900 `#18181b` | zinc-100 `#f4f4f5` | `--bg-soft-2` |

## Borders

| Token / Element | Dark Mode | Light Mode | CSS token |
| --- | --- | --- | --- |
| Dividers / outlines | zinc-800 `#27272a` | zinc-200 `#e4e4e7` | `--line`, `--line-strong` |

## Text

| Token / Element | Dark Mode | Light Mode | CSS token |
| --- | --- | --- | --- |
| Headings (h1, h2) | zinc-100 `#f4f4f5` | zinc-900 `#18181b` | `--ink` |
| Body / labels | zinc-300 `#d4d4d8` | zinc-700 `#3f3f46` | `--text`, `--text-2` |
| Subtext / muted | zinc-400 `#a1a1aa` | zinc-500 `#71717a` | `--muted` |
| Placeholders | zinc-600 `#52525b` | zinc-400 `#a1a1aa` | `--muted-2` |

## Accents

| Token / Element | Dark Mode | Light Mode | CSS token |
| --- | --- | --- | --- |
| Primary brand green | `#9EFF00` (status dot, active CTA highlights) | `#84cc16` (high-contrast green, hover `#65a30d`) | `--brand`, `--brand-hover` |
| Brand gradient | `--brand-400` to `--brand-600` (approximated `#9EFF00` to `#65a30d`) | `--brand-500` to `--brand-700` (approximated `#84cc16` to `#4d7c0f`) | `--brand-from`, `--brand-to` |

Gradient stops are approximations because the full brand scale is not defined in this file. Replace them with the exact `--brand-*` hex values when available.

## Derived tokens

| Purpose | Dark | Light |
| --- | --- | --- |
| Text on brand surfaces | `#09090b` | `#09090b` |
| Brand text links | `#9EFF00` | `#4d7c0f` |
| Dark button (background / text) | `#f4f4f5` / `#09090b` | `#18181b` / `#f4f4f5` |
| Light button (background / text) | `#18181b` / `#f4f4f5` | `#ffffff` / `#18181b` |

## Landing v2 (index.html)

The home page uses its own dark palette in `css/pico.css` (`:root`). Other pages still use `css/style.css` and the tokens above.

| Token | Value |
| --- | --- |
| `--bg` | `#07080a` |
| `--bg-2` | `#0c0e11` |
| `--surface` | `#101317` |
| `--text` | `#eef1f4` |
| `--muted` | `#9aa3ae` |
| `--lime` | `#c6ff3d` (CTA, active states, key numbers only) |
| `--lime-ink` | `#0b1203` (text on lime) |
