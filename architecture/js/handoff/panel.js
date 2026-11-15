/* Pico Viewer - handoff panel: Lint tab (issues, jump to line, copy error + fix prompt) and History tab
   (snapshots, diff against the current source, restore). Buttons are added to the editor bar.
   Exports: window.PicoViewer.Handoff = { toggle(tab), refresh() }.
   Ctrl+S also takes a named snapshot. Depends on: handoff/lint.js, handoff/history.js, editor/editor.js,
   ui/toast.js, source textarea #code, error card #errorCard. Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};
  const P = window.PicoViewer;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  let panel = null;
  let body = null;
  let tab = 'lint';
  let timer = null;
  let issues = [];
  let diffIdx = -1;

  const docName = () => localStorage.getItem('pico-mermaid-doc') || 'diagram.mmd';
  const src = () => $('code').value;

  function errorInfo() {
    if ($('errorCard').hidden) return {};
    const msg = $('errorText').textContent;
    const m = msg.match(/line\s+(\d+)/i);
    return { error: msg, errorLine: m ? parseInt(m[1], 10) : null };
  }

  function gotoLine(n) {
    const ta = $('code');
    const lines = ta.value.split('\n');
    let pos = 0;
    for (let i = 0; i < n - 1 && i < lines.length; i++) pos += lines[i].length + 1;
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(pos, pos + (lines[n - 1] || '').length);
  }

  function updateBadge() {
    issues = P.Lint.run(src());
    const bad = issues.filter((i) => i.severity !== 'info').length;
    $('btnLint').dataset.count = bad ? String(bad) : '';
  }

  function renderLint() {
    const errs = issues.filter((i) => i.severity === 'error').length;
    const warns = issues.filter((i) => i.severity === 'warn').length;
    const infos = issues.length - errs - warns;
    body.innerHTML =
      '<div class="hp-summary">' + errs + ' error' + (errs === 1 ? '' : 's') + ' · ' + warns + ' warning' + (warns === 1 ? '' : 's') + ' · ' + infos + ' note' + (infos === 1 ? '' : 's') + '</div>' +
      '<ul class="hp-list">' + (issues.map((i) =>
        '<li><button class="hp-issue sev-' + i.severity + '" data-line="' + i.line + '"><span class="hp-line">L' + i.line + '</span>' + esc(i.msg) + '</button></li>').join('') ||
        '<li class="hp-empty">No issues found.</li>') + '</ul>' +
      '<div class="hp-actions"><button class="chip-btn primary" data-act="fix">Copy error + fix prompt</button></div>';
  }

  function renderHistory() {
    const snaps = P.History.list(docName());
    const fmt = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    body.innerHTML =
      '<div class="hp-summary">' + snaps.length + ' of ' + P.History.MAX + ' snapshots · Ctrl+S saves one</div>' +
      '<div class="hp-actions"><button class="chip-btn" data-act="snap">Snapshot now</button></div>' +
      '<ul class="hp-list">' + (snaps.map((s, i) =>
        '<li class="hp-snap"><div><b>' + esc(s.label) + '</b> <small>' + fmt(s.t) + '</small></div>' +
        '<div class="hp-btns"><button class="chip-btn" data-act="diff" data-idx="' + i + '">Diff</button>' +
        '<button class="chip-btn" data-act="restore" data-idx="' + i + '">Restore</button></div></li>').join('') ||
        '<li class="hp-empty">No snapshots yet. Edits are saved automatically about once a minute.</li>') + '</ul>' +
      '<div id="hpDiff" class="hp-diff"></div>';
    if (diffIdx >= 0 && snaps[diffIdx]) showDiff(diffIdx);
  }

  function showDiff(idx) {
    const snap = P.History.list(docName())[idx];
    const el = $('hpDiff');
    if (!snap || !el) return;
    const ops = P.History.diff(snap.text, src());
    const add = ops.filter((o) => o.type === 'add').length;
    const del = ops.filter((o) => o.type === 'del').length;
    el.innerHTML = '<div class="hp-summary">Snapshot → current: +' + add + ' added, −' + del + ' removed</div>' +
      '<pre class="hp-code">' + ops.filter((o) => o.type !== 'eq').slice(0, 400).map((o) =>
        '<span class="dl-' + o.type + '">' + (o.type === 'add' ? '+ ' : '- ') + esc(o.text) + '</span>\n').join('') +
      (ops.some((o) => o.type !== 'eq') ? '' : 'No line differences.') + '</pre>';
  }

  function render() {
    if (tab === 'lint') renderLint(); else renderHistory();
    panel.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
  }

  function open(which) {
    if (which) tab = which;
    updateBadge();
    render();
    panel.hidden = false;
  }

  function close() {
    panel.hidden = true;
  }

  function toggle(which) {
    if (!panel.hidden && (!which || which === tab)) close();
    else open(which);
  }

  function refresh() {
    updateBadge();
    if (!panel.hidden) render();
  }

  async function copyFix() {
    const text = P.Lint.fixPrompt(Object.assign({ name: docName(), issues, source: src() }, errorInfo()));
    try {
      await navigator.clipboard.writeText(text);
      P.Toast.show('Error + fix prompt copied');
    } catch (err) {
      P.Toast.show('Copy blocked by the browser', 'err');
    }
  }

  function onBodyClick(e) {
    const issue = e.target.closest('[data-line]');
    if (issue) { gotoLine(parseInt(issue.dataset.line, 10)); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const idx = parseInt(b.dataset.idx, 10);
    if (act === 'fix') copyFix();
    else if (act === 'snap') { P.History.take(docName(), src(), 'Manual'); renderHistory(); P.Toast.show('Snapshot saved'); }
    else if (act === 'diff') { diffIdx = idx; showDiff(idx); }
    else if (act === 'restore') {
      const snap = P.History.list(docName())[idx];
      if (!snap) return;
      P.History.take(docName(), src(), 'Before restore');
      P.Editor.setValue(snap.text);
      P.Toast.show('Restored. Ctrl+Z to undo');
      updateBadge();
      renderHistory();
    }
  }

  function buildButtons() {
    const bar = document.querySelector('.editor-bar');
    if (!bar) return;
    const lint = document.createElement('button');
    lint.className = 'chip-btn';
    lint.id = 'btnLint';
    lint.setAttribute('aria-haspopup', 'dialog');
    lint.innerHTML = 'Lint';
    const hist = document.createElement('button');
    hist.className = 'chip-btn';
    hist.id = 'btnHistory';
    hist.setAttribute('aria-haspopup', 'dialog');
    hist.textContent = 'History';
    bar.appendChild(lint);
    bar.appendChild(hist);
    lint.addEventListener('click', () => toggle('lint'));
    hist.addEventListener('click', () => toggle('history'));
  }

  function init() {
    buildButtons();
    panel = document.createElement('aside');
    panel.id = 'handoffPanel';
    panel.className = 'handoff-panel';
    panel.setAttribute('aria-label', 'Lint and history');
    panel.hidden = true;
    panel.innerHTML = '<div class="hp-head"><div class="hp-tabs">' +
      '<button class="chip-btn" data-tab="lint" aria-pressed="true">Lint</button>' +
      '<button class="chip-btn" data-tab="history" aria-pressed="false">History</button></div>' +
      '<button class="icon-btn sm" data-act="close" aria-label="Close panel">&times;</button></div><div class="hp-body"></div>';
    document.body.appendChild(panel);
    body = panel.querySelector('.hp-body');
    panel.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; render(); return; }
      if (e.target.closest('[data-act="close"]')) { close(); return; }
    });
    body.addEventListener('click', onBodyClick);
    $('code').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(refresh, 300); });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') P.History.take(docName(), src(), 'Saved');
    });
    updateBadge();
  }

  window.PicoViewer.Handoff = { toggle, refresh };
  init();
})();
