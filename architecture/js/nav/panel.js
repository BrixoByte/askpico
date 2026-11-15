/* Pico Viewer - node details panel, Copy for AI, and Ctrl+P node search.
   Exports: window.PicoViewer.Panel = { init(), openSearch(), closeSearch() }.
   The details panel shows role, file, description, incoming/outgoing, and upstream/downstream toggles.
   Copy for AI writes a plain-Markdown summary of the node and the diagram to the clipboard (no API calls).
   Depends on: nav/graph.js, meta.js, ui/toast.js, source textarea #code. Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};
  const P = window.PicoViewer;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let panel = null;
  let search = null;
  let searchIdx = 0;
  let searchItems = [];

  function meta() { return P.Meta.parse($('code').value); }

  function listHtml(names) {
    if (!names.length) return '<li class="np-empty">none</li>';
    return names.map((n) => '<li><button class="np-link" data-go="' + esc(n) + '">' + esc(n) + '</button></li>').join('');
  }

  function show(name) {
    const m = meta();
    const info = m.nodes[name] || {};
    const inc = P.Graph.neighbors(name, 'in');
    const out = P.Graph.neighbors(name, 'out');
    const opts = P.Graph.options();
    panel.innerHTML =
      '<div class="np-head"><span class="np-name">' + esc(name) + '</span>' +
      (info.role ? '<span class="np-role">' + esc(info.role) + '</span>' : '') +
      '<button class="icon-btn sm" data-act="close" aria-label="Close details">&times;</button></div>' +
      '<p class="np-desc">' + esc(info.desc || 'No @node description yet.') + '</p>' +
      (info.file ? '<p class="np-file"><code>' + esc(info.file) + '</code></p>' : '') +
      (info.todo ? '<p class="np-todo">TODO: ' + esc(info.todo) + '</p>' : '') +
      '<div class="np-cols"><div><h4>Incoming</h4><ul>' + listHtml(inc) + '</ul></div>' +
      '<div><h4>Outgoing</h4><ul>' + listHtml(out) + '</ul></div></div>' +
      '<div class="np-actions">' +
      '<button class="chip-btn" data-act="up" aria-pressed="' + opts.showUp + '">Upstream</button>' +
      '<button class="chip-btn" data-act="down" aria-pressed="' + opts.showDown + '">Downstream</button>' +
      '<button class="chip-btn" data-act="focus" aria-pressed="' + opts.focus + '">Focus</button>' +
      '<button class="chip-btn" data-act="copy">Copy for AI</button></div>';
    panel.hidden = false;
  }

  function hide() {
    panel.hidden = true;
    panel.innerHTML = '';
  }

  function summaryFor(name) {
    const m = meta();
    const info = m.nodes[name] || {};
    const inc = P.Graph.neighbors(name, 'in');
    const out = P.Graph.neighbors(name, 'out');
    const up = [...P.Graph.reach(name, 'up')];
    const down = [...P.Graph.reach(name, 'down')];
    const subs = Object.keys(P.Graph.membership($('code').value));
    const lines = [
      '# Node: ' + name,
      '- Diagram: ' + (m.title || 'untitled') + (m.updated ? ' (updated ' + m.updated + ')' : ''),
      '- Role: ' + (info.role || 'unset'),
      '- Description: ' + (info.desc || 'none'),
      '- File: ' + (info.file || 'unset'),
      info.todo ? '- Open question: ' + info.todo : null,
      '- Incoming: ' + (inc.join(', ') || 'none'),
      '- Outgoing: ' + (out.join(', ') || 'none'),
      '- Upstream (feeds this node, directly or indirectly): ' + (up.join(', ') || 'none'),
      '- Downstream (fed by this node, directly or indirectly): ' + (down.join(', ') || 'none'),
      '- Subgraphs in diagram: ' + (subs.join(', ') || 'none'),
      '',
      'Diagram source (' + (localStorage.getItem('pico-mermaid-doc') || 'diagram.mmd') + '):',
      '```mermaid',
      $('code').value.trimEnd(),
      '```'
    ];
    return lines.filter((l) => l !== null).join('\n');
  }

  async function copyForAi(name) {
    try {
      await navigator.clipboard.writeText(summaryFor(name));
      P.Toast.show('Copied for AI');
    } catch (err) {
      P.Toast.show('Copy blocked by the browser', 'err');
    }
  }

  function onPanelClick(e) {
    const go = e.target.closest('[data-go]');
    if (go) { P.Graph.select(go.dataset.go); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const cur = P.Graph.current();
    const act = b.dataset.act;
    if (act === 'close') { P.Select.clear(); return; }
    if (act === 'copy') { copyForAi(cur); return; }
    const key = { up: 'showUp', down: 'showDown', focus: 'focus' }[act];
    P.Graph.setOpt(key, !P.Graph.options()[key]);
    show(cur);
  }

  function renderSearch() {
    const q = search.input.value.trim().toLowerCase();
    const m = meta();
    searchItems = Object.entries(m.nodes)
      .filter(([id, n]) => !q || [id, n.role, n.desc, n.file].some((v) => String(v || '').toLowerCase().includes(q)))
      .slice(0, 50);
    searchIdx = Math.min(searchIdx, Math.max(0, searchItems.length - 1));
    search.list.innerHTML = searchItems.map(([id, n], i) =>
      '<li role="option" data-id="' + esc(id) + '" class="' + (i === searchIdx ? 'active' : '') + '"><b>' + esc(id) + '</b>' +
      '<span>' + esc(n.role || '') + ' ' + esc(n.desc || '') + '</span></li>').join('') ||
      '<li class="np-empty">No matching node</li>';
  }

  function openSearch() {
    search.box.hidden = false;
    search.input.value = '';
    searchIdx = 0;
    renderSearch();
    search.input.focus();
  }

  function closeSearch() {
    search.box.hidden = true;
    $('code').focus({ preventScroll: true });
  }

  function pick(id) {
    closeSearch();
    P.Graph.select(id);
  }

  function buildSearch() {
    const box = document.createElement('div');
    box.className = 'node-search';
    box.hidden = true;
    box.innerHTML = '<div class="ns-card" role="dialog" aria-label="Find node"><input class="ns-input" placeholder="Find a node by id, role or description" aria-label="Find node">' +
      '<ul class="ns-list" role="listbox"></ul><p class="ns-hint">Enter to go to node · Esc to close</p></div>';
    document.body.appendChild(box);
    search = { box, input: box.querySelector('.ns-input'), list: box.querySelector('.ns-list') };
    search.input.addEventListener('input', () => { searchIdx = 0; renderSearch(); });
    search.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); searchIdx = Math.min(searchItems.length - 1, searchIdx + 1); renderSearch(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); searchIdx = Math.max(0, searchIdx - 1); renderSearch(); }
      else if (e.key === 'Enter' && searchItems[searchIdx]) { e.preventDefault(); pick(searchItems[searchIdx][0]); }
      else if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
    });
    search.list.addEventListener('click', (e) => { const li = e.target.closest('[data-id]'); if (li) pick(li.dataset.id); });
    box.addEventListener('pointerdown', (e) => { if (e.target === box) closeSearch(); });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); openSearch(); }
    });
  }

  function init() {
    panel = document.createElement('aside');
    panel.id = 'nodePanel';
    panel.className = 'node-panel';
    panel.setAttribute('aria-label', 'Node details');
    panel.hidden = true;
    document.body.appendChild(panel);
    panel.addEventListener('click', onPanelClick);
    $('diagram').addEventListener('pico:select', (e) => {
      if (e.detail) show(P.Graph.current() || e.detail.id); else hide();
    });
    buildSearch();
  }

  window.PicoViewer.Panel = { init, openSearch, closeSearch };
  init();
})();
