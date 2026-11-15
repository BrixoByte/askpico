# Pico Viewer Progress

Source plan: `C:\Users\Ahtasham734\.windsurf\plans\pico-viewer-8929fa.md`

## Phase 0: Setup
- [ ] Split `app.js` (1549 lines) into `PicoViewer.*` modules, each 400 lines or fewer
- [ ] Split `styles.css` (589 lines) into modules, each 400 lines or fewer
- [ ] Add a header comment to every module (purpose, exports, dependencies)
- [ ] Load modules by script tag in `index.html`, in dependency order
- [ ] Smoke test: diagram renders, zoom, pan, editor, export all work

## Phase 1: AI-friendly foundation
- [ ] Create `diagrams/pico-architecture.mmd` with the `%%` header and `@node` annotations
- [ ] Add `js/meta.js` parser
- [ ] Write `diagrams/AGENTS.md`, `diagrams/.cursorrules`, `diagrams/.windsurfrules`
- [ ] Add starter diagrams: request flow, agents, artifacts flow

## Phase 2: Live sync
- [ ] Mode A: File System Access API folder watch (about 400ms poll)
- [ ] Mode B: `serve.mjs` (Node built-ins only) with SSE and `PUT /api/file`
- [ ] Flash changed nodes and edges for 1.5s; keep zoom and pan
- [ ] Conflict banner: Keep mine, Load disk, Compare
- [ ] Status pill and Explorer tree; `#file=` in URL hash

## Phase 3: Style engine
- [ ] 8+ render-time palettes
- [ ] Semantic role colours and injected `classDef`
- [ ] Subgraph styling, edge typing, animated async edges
- [ ] Auto legend and Style Studio panel

## Phase 4: Navigation
- [ ] Node Details drawer
- [ ] Upstream and downstream highlight, focus mode
- [ ] Ctrl+P search with zoom-to-node
- [ ] Subgraph collapse
- [ ] Layout options checked against the bundled Mermaid API
- [ ] Deep links: `#file=...&node=...`

## Phase 5: AI and human handoff
- [ ] "Copy for AI" Markdown output
- [ ] Lint panel with "Copy error + fix prompt"
- [ ] Version snapshots and diff view
- [ ] Export: SVG, PNG 1x/2x/4x, PDF, self-contained HTML

## Phase 6: Polish
- [ ] Performance for 300+ nodes
- [ ] Reduced motion, keyboard panel, mobile, a11y
- [ ] `TESTING.md` with 15-20 regression steps
- [ ] Viewer `README.md` (400 words or fewer)

## Status
- Phase 0 in progress.
- Done: templates and default source moved to `js/data/templates.js` (119 lines), loaded before `app.js` in `index.html`. `app.js` is now 1507 lines. `node --check` passes.
- Done: icon set and `svgFor`/`fillIcons` moved to `js/ui/icons.js`, loaded before `app.js`. `app.js` is now 1461 lines. Syntax checks pass.
- Done: Mermaid tokenizer moved to `js/editor/highlight.js` (`highlightLine`), loaded before `app.js`. `app.js` is now 1440 lines. Syntax checks pass.
- Done: fit-to-view and minimap layout math moved to `js/canvas/geometry.js` (`fitTransform`, `minimapLayout`), loaded before `app.js`. `app.js` is now 1432 lines. Checks pass and outputs match the original formulas.
- Modular rewrite complete, pending browser verification. `index.html` now loads the modules and `js/main.js`. `app.js` is no longer loaded and is kept on disk for rollback until verified. Every file in `js/` is 400 lines or fewer and passes `node --check`.
- Modules:
  - `js/core/state.js`: shared canvas state
  - `js/canvas/view.js`: transform loop, zoom, fit
  - `js/canvas/input.js`: pointer, wheel, inertia
  - `js/canvas/minimap.js`: minimap draw and navigation
  - `js/export/export.js`: SVG, PNG, PDF, clipboard
  - `js/render/render.js`: Mermaid engine and mount
  - `js/render/select.js`: node hover and selection
  - `js/editor/editor.js`: history, text ops, key handling
  - `js/editor/find.js`: find and replace bar
  - `js/ui/drawer.js`: dock, pin, resize, float drag
  - `js/files/files.js`: open, watch, drop
  - `js/ui/menus.js`: theme, export, and template menus
  - `js/ui/settings.js`, `js/ui/keys.js`, `js/ui/toast.js`, `js/ui/toolbar.js`
  - `js/main.js`: entry point, boot, status bar, error card, templates
- Done: `styles.css` split into `styles/tokens.css`, `base.css`, `canvas.css`, `chrome.css`, `drawer.css`, `responsive.css` (all under 400 lines). `styles.css` is now an `@import` entry. Line content verified against the original.
- Phase 1 (partial): `diagrams/pico-architecture.mmd` (default source with `%% @node` annotations), `js/meta.js` parser (verified: 14 nodes parsed), `diagrams/AGENTS.md`, `.cursorrules`, `.windsurfrules`.
- Done: Phase 1 starter diagrams `diagrams/request-flow.mmd`, `diagrams/agents.mmd`, `diagrams/artifacts.mmd` (unknowns marked `%% TODO: confirm`).
- Phase 2 (partial): `serve.mjs` built-ins-only server. Verified: `GET /api/files` lists 4 diagrams, read works, path traversal returns 400, static index returns 200. SSE `/events` (debounced fs.watch) and `PUT /api/file` are implemented but the PUT and SSE paths are not yet tested.
- Done (Phase 2 viewer, `js/live/live.js` + `styles/live.css`): diagram picker in the editor bar, `#file=` hash, autosave via PUT (600 ms), SSE updates with viewport preserved, changed-node flash, conflict banner (Keep mine / Load disk). Live mode is inert when opened without `serve.mjs`.
- Tested: PUT returns 200, SSE change event fires, readback matches. The test file was restored to its original content.
- Phase 2 remaining: "Compare" button in the conflict banner (not built yet) and a browser check of the live flow.
- Fixed: the static `aria-hidden` on the drawer in `index.html` (the cause of the focus warning) is removed. Visibility now uses `inert`.
- Phase 3 (mostly done): `js/style/palettes.js` (8 palettes), `js/style/engine.js` (render-time `classDef`, `class`, subgraph `style`, and `linkStyle` for async/stream edges; source file unchanged, lines appended at the end), `js/style/studio.js` (toolbar Style Studio menu: palette, animate, legend), auto legend, dashed flow animation that respects reduced motion. Per-diagram settings are in localStorage.
- Tested in Node: role classes are generated, source text is preserved, and the async edge index is correct. Palette setting is saved.
- Phase 3 remaining: drop shadows and corner-radius tuning for nodes, and a browser check of the palettes and legend.
- Phase 4 (mostly done): `js/nav/graph.js` (node/edge model from the SVG, upstream/downstream reach, Focus dimming, subgraph collapse on double-click, zoom-to-node, `#node=` deep link), `js/nav/panel.js` (details panel with role, file, description, incoming/outgoing, toggles; Ctrl+P search with keyboard navigation; Copy for AI, which is Markdown with no API calls). Styles in `styles/nav.css`. `select.js` dispatches `pico:select`.
- Phase 4 remaining: layout choices (must be checked against the Mermaid API, not the bundle), and browser testing. Collapse hides subgraph contents and keeps the layout space; it does not re-layout. Subgraph element detection assumes Mermaid's `g.cluster` markup; this needs a browser check.
- Phase 5 (done in code, browser check pending): `js/handoff/lint.js` (rules: missing diagram type, missing title/description, undeclared @node, missing role/file, duplicate @node, nodes without @node, open TODOs; Node test flags a node that has no annotation), "Copy error + fix prompt" (uses the live render error and lint issues; no API calls), `js/handoff/history.js` (last 20 snapshots per file in localStorage; auto snapshot at most once a minute after save; LCS line diff), `js/handoff/panel.js` (Lint and History tabs next to the editor, Ctrl+S takes a snapshot, Restore keeps an undoable edit and first snapshots the current text), self-contained HTML export in `js/export/export.js`.
- Phase 5 remaining: browser check. Manual edits are snapshotted only on Ctrl+S, "Snapshot now", or a live save.
- Phase 6 (done in code, browser check pending): `README.md` (310 words), `TESTING.md` (20 regression steps), `perf-lite` mode for diagrams over 300 nodes (turns off edge animation and transitions), reduced motion and `data-motion="off"` respected, responsive bottom-sheet drawer and panels on narrow screens, keyboard shortcuts in the README.
- Phase 6 remaining: real performance measurement with 300+ nodes, and an a11y audit in the browser (focus order, labels on the new panels).
- Fixed (reported bug): the style engine emitted `style ... fill:hsl(...)` lines that Mermaid could not parse. All generated colours are now hex via `hslToHex()`. Verified: no `hsl(` in the styled source; `pico-architecture` lints clean (0 errors, 0 warnings).
- Fixed (lint false positive): words inside quoted node labels (for example `shell` in the `Mob` label) were counted as node declarations. Quoted text is now stripped before scanning. Re-scanning after a first fix that stripped whole brackets (which hid real declarations) now detects every node correctly.
- Fixed (repeating lint prompt): the viewer rendered the built-in default/localStorage copy, not the fixed `diagram.mmd`. `DEFAULT_CODE` in `templates.js` is now the annotated diagram, `LEGACY_DEFAULT` keeps the old text, and boot replaces a saved source that still equals the old default. New default lints clean (0 errors, 0 warnings, 5 info TODOs). Verified in Node.
- Open items from earlier phases: Compare button (Phase 2), layout choices (Phase 4), node shadow tuning (Phase 3).
- Remaining Phase 0: browser verification of the modular build, then deleting `app.js`.
