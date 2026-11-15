# Pico Architecture Viewer

A local viewer for Pico's Mermaid architecture diagrams. It is plain HTML, CSS, and vanilla JavaScript. Mermaid is used only as the render engine.

## Run it

```bash
cd architecture
node serve.mjs
```

Open http://localhost:4173. `serve.mjs` uses built-in Node modules only. Without it, the viewer still works as a file, but live sync, the diagram picker, and autosave are off.

## Layout

- `diagrams/` holds the `.mmd` files. Start with `pico-architecture.mmd`.
- `diagrams/AGENTS.md` holds the rules for writing diagrams. `.cursorrules` and `.windsurfrules` repeat them for those tools.
- `js/` holds the modules, loaded in order by `index.html`. `js/main.js` is the entry point. Every module is 400 lines or fewer.
- `styles.css` imports the files in `styles/`.
- `mermaid.bundle.js` is third-party. Do not edit it.
- `PLAN.md` tracks progress. `TESTING.md` lists the regression checks.

## Diagram metadata

```
%% title: Pico Architecture
%% description: one line
%% @node SRV role=api desc="Express routes" file="services/api/src/server.js"
```

Each `@node` line gives a node's role, description, and real file path. The viewer uses these for the details panel, lint, and Copy for AI. Unknown facts go in as `%% TODO: confirm`.

## Shortcuts

- `Ctrl+E` toggle editor · `Ctrl+S` save snapshot · `Ctrl+O` open file · `Ctrl+F` find · `Ctrl+P` find node
- `Ctrl+Z` / `Ctrl+Y` undo / redo · `Ctrl+/` comment · `Tab` indent · `Ctrl+=` / `Ctrl+-` editor font size
- `+` / `-` zoom · `0` fit · `1` actual size · `F` fullscreen · `Space` + drag to pan · `Esc` close
- Double-click a subgraph title to collapse or expand it.

## Notes

- Styling is applied at render time. The `.mmd` file is never rewritten with styles.
- Diagrams over 300 nodes turn off edge animation to keep the canvas responsive.
- Exports: SVG, PNG (1×, 2×, 4×), PDF (print), self-contained HTML, and clipboard copy.
