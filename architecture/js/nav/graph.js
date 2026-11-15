/* Pico Viewer - graph navigation model built from the rendered SVG: node/edge lookup, upstream and downstream
   reach, focus dimming, subgraph collapse (from source membership), zoom-to-node, and #node= deep links.
   Exports: window.PicoViewer.Graph = { refresh(), select(name, zoom), neighbors(name, 'in'|'out'), reach(name, 'up'|'down'),
   setOpt(key, value), current(), toggleCollapse(name), collapsedList(), nodeList() }.
   Listens for 'pico:select' on the diagram (dispatched by render/select.js).
   Depends on: render/select.js, render/render.js, meta.js, canvas/view.js. Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};
  const P = window.PicoViewer;
  const $ = (id) => document.getElementById(id);

  const opts = { showUp: false, showDown: false, focus: false };
  const collapsed = new Set();
  let model = { nodes: new Map(), edges: [] };
  let cur = null;

  const nodeName = (g) => {
    const m = (g.id || '').match(/^[A-Za-z]+-(.+)-\d+$/);
    return m ? m[1] : null;
  };
  const source = () => $('code').value;

  function membership(src) {
    const out = {};
    const stack = [];
    src.split('\n').forEach((line) => {
      if (/^\s*%%/.test(line)) return;
      const sg = line.match(/^\s*subgraph\s+(\w+)/);
      if (sg) { stack.push(sg[1]); out[sg[1]] = out[sg[1]] || []; return; }
      if (/^\s*end\s*$/.test(line)) { stack.pop(); return; }
      const decl = line.match(/^\s*([A-Za-z_][\w-]*)\s*[\[({]/);
      if (decl && stack.length) out[stack[stack.length - 1]].push(decl[1]);
    });
    return out;
  }

  function applyCollapse() {
    const d = $('diagram');
    const hidden = new Set();
    const members = membership(source());
    collapsed.forEach((s) => (members[s] || []).forEach((n) => hidden.add(n)));
    model.nodes.forEach((g, n) => g.classList.toggle('nav-hidden', hidden.has(n)));
    model.edges.forEach((e) => e.el.classList.toggle('nav-hidden', hidden.has(e.src) || hidden.has(e.dst)));
    d.querySelectorAll('g.cluster').forEach((c) => {
      const m = (c.id || '').match(/^(?:flowchart-)?(.+?)(?:-\d+)?$/);
      c.classList.toggle('collapsed', !!m && collapsed.has(m[1]));
    });
  }

  function refresh() {
    const d = $('diagram');
    model = { nodes: new Map(), edges: [] };
    d.querySelectorAll('g.node').forEach((g) => { const n = nodeName(g); if (n) model.nodes.set(n, g); });
    d.querySelectorAll('.flowchart-link').forEach((e) => {
      const c = e.getAttribute('class') || '';
      const src = (c.match(/LS-(\S+)/) || [])[1];
      const dst = (c.match(/LE-(\S+)/) || [])[1];
      if (src && dst) model.edges.push({ src, dst, el: e });
    });
    applyCollapse();
    d.classList.toggle('perf-lite', model.nodes.size > 300);
    const want = new URLSearchParams(location.hash.slice(1)).get('node') || cur;
    if (want && model.nodes.has(want)) select(want, false);
    else { cur = null; d.dispatchEvent(new CustomEvent('pico:select', { detail: null })); }
  }

  function neighbors(name, dir) {
    return model.edges.filter((e) => (dir === 'in' ? e.dst : e.src) === name).map((e) => (dir === 'in' ? e.src : e.dst));
  }

  function reach(start, dir) {
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const n = queue.shift();
      model.edges.forEach((e) => {
        const from = dir === 'down' ? e.src : e.dst;
        const to = dir === 'down' ? e.dst : e.src;
        if (from === n && !seen.has(to)) { seen.add(to); queue.push(to); }
      });
    }
    seen.delete(start);
    return seen;
  }

  function highlight(name) {
    const d = $('diagram');
    model.nodes.forEach((g) => g.classList.remove('nav-up', 'nav-down', 'nav-set'));
    model.edges.forEach((e) => e.el.classList.remove('nav-edge'));
    d.classList.remove('nav-focus');
    if (!name || !model.nodes.has(name)) return;
    const up = reach(name, 'up');
    const down = reach(name, 'down');
    const inSet = (x) => x === name || up.has(x) || down.has(x);
    model.nodes.forEach((g, n) => {
      if (inSet(n)) g.classList.add('nav-set');
      if (opts.showUp && up.has(n)) g.classList.add('nav-up');
      if (opts.showDown && down.has(n)) g.classList.add('nav-down');
    });
    model.edges.forEach((e) => { if (inSet(e.src) && inSet(e.dst)) e.el.classList.add('nav-edge'); });
    d.classList.toggle('nav-focus', opts.focus);
  }

  function zoomTo(g) {
    const S = P.State;
    const stage = $('stage');
    const size = { w: stage.clientWidth, h: stage.clientHeight };
    const sr = stage.getBoundingClientRect();
    const r = g.getBoundingClientRect();
    const cx = r.left + r.width / 2 - sr.left;
    const cy = r.top + r.height / 2 - sr.top;
    const v = S.view;
    const wx = (cx - v.x) / v.s;
    const wy = (cy - v.y) / v.s;
    const s = Math.max(v.s, 1);
    P.View.setTarget({ s, x: size.w / 2 - wx * s, y: size.h / 2 - wy * s }, false);
  }

  function setHash(name) {
    const p = new URLSearchParams(location.hash.slice(1));
    if (name) p.set('node', name); else p.delete('node');
    history.replaceState(null, '', '#' + p.toString());
  }

  function select(name, zoom) {
    const g = model.nodes.get(name);
    if (!g) return false;
    P.Select.select(g);
    if (zoom !== false) zoomTo(g);
    return true;
  }

  function setOpt(key, value) {
    opts[key] = value;
    highlight(cur);
  }

  function toggleCollapse(name) {
    if (collapsed.has(name)) collapsed.delete(name); else collapsed.add(name);
    applyCollapse();
    return collapsed.has(name);
  }

  function init() {
    const d = $('diagram');
    d.addEventListener('pico:select', (e) => {
      cur = e.detail ? nodeName(e.detail) : null;
      highlight(cur);
      setHash(cur);
    });
    d.addEventListener('dblclick', (e) => {
      const c = e.target.closest('g.cluster');
      if (!c || e.target.closest('g.node')) return;
      e.stopPropagation();
      const m = (c.id || '').match(/^(?:flowchart-)?(.+?)(?:-\d+)?$/);
      if (m) toggleCollapse(m[1]);
    });
  }

  P.Graph = {
    init,
    refresh,
    select,
    neighbors,
    reach,
    setOpt,
    toggleCollapse,
    current: () => cur,
    collapsedList: () => [...collapsed],
    nodeList: () => [...model.nodes.keys()],
    options: () => ({ ...opts }),
    membership
  };
  init();
})();
