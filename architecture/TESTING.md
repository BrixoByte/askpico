# Pico Architecture Viewer - regression tests

Run `node serve.mjs` in `architecture/`, then open http://localhost:4173. Use Chrome or Edge for the File System Access checks. Reload between steps unless a step says otherwise.

## Rendering
1. **Default load.** The page opens with `pico-architecture.mmd`. The status bar shows "Valid syntax" and a node count. The diagram fits the screen.
2. **Empty source.** Clear the editor. The "Nothing to render yet" card appears and no error shows. Paste the text back to restore.
3. **Syntax error.** Type `flowchart LR` followed by `A -->` on a new line. The error card shows, the status bar says "Syntax error · line N", and clicking the status item moves the cursor to that line.

## Editor
4. **Undo and redo.** Type a few characters, press `Ctrl+Z` then `Ctrl+Y`. Changes come back in order.
5. **Auto-close and indent.** Type `[`, and a `]` is added. Press `Enter` after `subgraph X`. The next line is indented.
6. **Comment toggle.** Select two lines and press `Ctrl+/`. They gain `%% ` and lose it on a second press.
7. **Find and replace.** Press `Ctrl+F`, type a word, press `Enter` to step through matches, and use Replace All. The count updates.

## Canvas
8. **Zoom and pan.** Scroll to zoom toward the cursor, drag to pan, and press `0` to fit. The zoom readout updates.
9. **Node selection.** Click a node. Connected edges highlight, the details panel opens with role, file, and connections, and clicking an outgoing item selects that node.
10. **Upstream, downstream, focus.** In the panel, press Upstream, Downstream, and Focus. Matching nodes tint and unrelated nodes dim.
11. **Subgraph collapse.** Double-click a subgraph title. Its nodes hide and the frame dims. Double-click again to restore.

## Navigation
12. **Ctrl+P search.** Press `Ctrl+P`, type part of a node ID, use arrow keys, and press `Enter`. The view centres on that node.
13. **Deep link.** Select a node, then check that the URL contains `node=`. Reload the page. The same node is selected again.

## Styling
14. **Palette and legend.** Open Style Studio from the toolbar and choose another palette. Colours change, the source text stays the same, and the legend updates.
15. **Async edges.** Change a `-->` edge label to `async`. The edge becomes dashed, and it stops moving if reduced motion is on in the OS.

## Live sync and handoff
16. **Live update from disk.** With `serve.mjs` running, edit `diagrams/request-flow.mmd` in another editor and save. The viewer updates, changed nodes flash, and the viewport stays where it was.
17. **Conflict banner.** Type an unsaved edit in the viewer, then save a different version of the same file from another editor. A banner appears. "Keep mine" writes the viewer text to disk. "Load disk" replaces the viewer text.
18. **Lint and fix prompt.** Open the Lint tab. Click an issue to jump to its line. Press "Copy error + fix prompt" and paste it into a chat; it contains the error, the issues, and the rules.
19. **History and restore.** Press Ctrl+S twice with some change in between. In the History tab, press Diff on an older snapshot, then Restore. The text returns and Ctrl+Z undoes it.
20. **Exports.** From Export, download SVG, PNG 2×, and Self-contained HTML. Open the HTML file with the network off and confirm it shows the diagram.

Pass criteria: no console errors in any step, and no `aria-hidden` warning when the drawer is opened and closed.
