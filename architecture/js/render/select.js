/* Pico Viewer — node hover and selection: highlights a node and its directly connected edges/nodes.
   Exports: window.PicoViewer.Select = { init(diagramEl), select(gNode), clear(), reset() }.
   Relies on Mermaid's flowchart class names (LS-<id>, LE-<id>) and node ids "<prefix>-<name>-<n>".
   Depends on: nothing. Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  let diagram = null;
  let selected = null;
  let hovered = null;

  function nodeName(g) {
    const m = (g.id || '').match(/^[A-Za-z]+-(.+)-\d+$/);
    return m ? m[1] : null;
  }

  function clear() {
    if (selected) selected.classList.remove('sel');
    diagram.querySelectorAll('.is-edge, .linked').forEach((el) => el.classList.remove('is-edge', 'linked'));
    diagram.classList.remove('has-sel');
    if (selected) diagram.dispatchEvent(new CustomEvent('pico:select', { detail: null }));
    selected = null;
  }

  function select(g) {
    clear();
    selected = g;
    g.classList.add('sel');
    diagram.classList.add('has-sel');
    diagram.dispatchEvent(new CustomEvent('pico:select', { detail: g }));
    const name = nodeName(g);
    if (!name) return;
    const linked = new Set();
    diagram.querySelectorAll('.flowchart-link').forEach((edge) => {
      const cls = edge.getAttribute('class') || '';
      const src = (cls.match(/LS-(\S+)/) || [])[1];
      const dst = (cls.match(/LE-(\S+)/) || [])[1];
      if (src !== name && dst !== name) return;
      edge.classList.add('is-edge');
      if (src) linked.add(src);
      if (dst) linked.add(dst);
    });
    linked.delete(name);
    diagram.querySelectorAll('g.node').forEach((n) => {
      if (n !== g && linked.has(nodeName(n))) n.classList.add('linked');
    });
  }

  function reset() {
    selected = null;
    hovered = null;
  }

  function init(diagramEl) {
    diagram = diagramEl;
    diagram.addEventListener('pointerover', (e) => {
      const g = e.target.closest ? e.target.closest('g.node') : null;
      if (!g || g === hovered) return;
      if (hovered) hovered.classList.remove('is-hover');
      hovered = g;
      g.classList.add('is-hover');
    });
    diagram.addEventListener('pointerout', (e) => {
      if (!hovered) return;
      if (e.relatedTarget && hovered.contains(e.relatedTarget)) return;
      hovered.classList.remove('is-hover');
      hovered = null;
    });
  }

  window.PicoViewer.Select = { init, select, clear, reset };
})();
