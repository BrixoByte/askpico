/* Pico — Mermaid Diagram Viewer. Vanilla JS; Mermaid is only the render engine. */
(function () {
  'use strict';

  /* ── Constants ── */
  const KEYS = { code: 'pico-mermaid-code', settings: 'pico-mermaid-settings', ui: 'pico-mermaid-ui', doc: 'pico-mermaid-doc' };
  const DEFAULT_SETTINGS = {
    grid: 'lines', theme: 'auto', font: 13, debounce: 400, tab: 2,
    autoFit: true, anim: true, minimap: true, autoClose: true, wrap: false
  };
  const DEFAULT_UI = { open: true, dock: 'left', pinned: false, width: 468, floatX: 40, floatY: 90 };
  const MERMAID_THEME = { dark: 'dark', midnight: 'dark', forest: 'forest', neutral: 'neutral', light: 'default' };
  const THEME_LIST = [
    ['auto', 'Auto (system)', 'monitor'], ['dark', 'Dark', 'moon'], ['light', 'Light', 'sun'],
    ['midnight', 'Midnight', 'bolt'], ['forest', 'Forest', 'leaf'], ['neutral', 'Neutral', 'square']
  ];
  const ZOOM_MIN = 0.08, ZOOM_MAX = 5, FIT_MAX = 2.5, FONT_MIN = 11, FONT_MAX = 20;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const { DEFAULT_CODE, TEMPLATES } = window.PicoViewer.Templates;

  const { svgFor, fillIcons } = window.PicoViewer.Icons;
  const { fitTransform, minimapLayout } = window.PicoViewer.Geometry;

  /* ── DOM refs & utilities ── */
  const $ = (id) => document.getElementById(id);
  const stage = $('stage'), world = $('world'), diagram = $('diagram'), gridEl = $('grid');
  const editor = $('code'), hlEl = $('hl'), hlCode = $('hlCode'), gutterInner = $('gutterInner'), editorBox = $('editor');
  const drawer = $('drawer'), drawerHead = $('drawerHead'), emptyEl = $('emptyState'), errorCard = $('errorCard');
  const findbar = $('findbar'), findInput = $('findInput'), replaceInput = $('replaceInput'), findCount = $('findCount');
  const modal = $('settingsModal'), mini = $('minimap'), miniCtx = mini.getContext('2d');
  const miniWrap = $('minimapWrap'), miniVp = $('minimapVp'), zoomPct = $('zoomPct'), tbZoomLabel = $('tbZoomLabel');
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function loadJSON(key, fallback) {
    try { return Object.assign({}, fallback, JSON.parse(localStorage.getItem(key)) || {}); }
    catch (e) { return Object.assign({}, fallback); }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }
  function saveSettings() { saveJSON(KEYS.settings, settings); }
  function saveUI() { saveJSON(KEYS.ui, ui); }

  function toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'err' ? ' err' : '');
    el.innerHTML = svgFor(type === 'err' ? 'alert' : 'check') + '<span></span>';
    el.lastChild.textContent = msg;
    $('toasts').appendChild(el);
    setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 260); }, 2400);
  }
  function timestamp() { return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'); }
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* ── State ── */
  let settings = loadJSON(KEYS.settings, DEFAULT_SETTINGS);
  let ui = loadJSON(KEYS.ui, DEFAULT_UI);
  let docName = localStorage.getItem(KEYS.doc) || 'diagram.mmd';
  let view = { x: 0, y: 0, s: 1 };
  let target = { x: 0, y: 0, s: 1 };
  let anchor = null;
  let contentW = 0, contentH = 0, hasContent = false, firstRender = true;
  let errLine = null;

  /* ── Theme & Mermaid engine ── */
  const mqLight = window.matchMedia('(prefers-color-scheme: light)');
  function resolveTheme() {
    return settings.theme === 'auto' ? (mqLight.matches ? 'light' : 'dark') : settings.theme;
  }
  function initMermaidEngine(theme) {
    if (!window.mermaid) return;
    mermaid.initialize({
      startOnLoad: false,
      theme: MERMAID_THEME[theme] || 'dark',
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, sans-serif',
      flowchart: { htmlLabels: false, curve: 'basis', padding: 16 }
    });
  }
  function applyTheme() {
    const t = resolveTheme();
    document.documentElement.dataset.theme = t;
    initMermaidEngine(t);
  }
  function setTheme(id) {
    settings.theme = id;
    saveSettings();
    applyTheme();
    buildThemeMenu();
    if (editor.value.trim()) renderDiagram();
  }
  mqLight.addEventListener('change', () => { if (settings.theme === 'auto') setTheme('auto'); });
  function buildThemeMenu() {
    $('themeMenu').innerHTML = '<div class="menu-label">Theme</div>' + THEME_LIST.map(([id, label, icon]) =>
      '<button class="menu-item' + (settings.theme === id ? ' current' : '') + '" role="menuitemradio" data-theme-id="' + id + '">' +
      svgFor(icon) + label + '</button>').join('');
  }

  /* ── Grid ── */
  function applyGrid() {
    gridEl.dataset.style = settings.grid;
    updateGrid();
  }
  function updateGrid() {
    let minor = 24 * view.s;
    while (minor < 14) minor *= 5;
    while (minor > 140) minor /= 5;
    const major = minor * 5;
    const mod = (v, m) => ((v % m) + m) % m;
    const st = gridEl.style;
    st.setProperty('--gs', minor + 'px');
    st.setProperty('--gm', major + 'px');
    st.setProperty('--ox', mod(view.x, minor) + 'px');
    st.setProperty('--oy', mod(view.y, minor) + 'px');
    st.setProperty('--mx', mod(view.x, major) + 'px');
    st.setProperty('--my', mod(view.y, major) + 'px');
  }

  /* ── Drawer (floating editor) ── */
  const mobile = window.matchMedia('(max-width: 720px)');

  function applyDrawer() {
    const isFloat = ui.dock === 'float' && !mobile.matches;
    const isRight = ui.dock === 'right' && !mobile.matches;
    drawer.classList.toggle('open', ui.open);
    drawer.classList.toggle('dock-right', isRight);
    drawer.classList.toggle('dock-float', isFloat);
    drawerHead.classList.toggle('draggable', isFloat);
    drawer.setAttribute('aria-hidden', String(!ui.open));
    document.documentElement.style.setProperty('--drawer-w', ui.width + 'px');

    if (isFloat) {
      drawer.style.left = ui.floatX + 'px';
      drawer.style.top = ui.floatY + 'px';
      drawer.style.right = 'auto';
      drawer.style.bottom = 'auto';
      drawer.style.height = Math.round(innerHeight * 0.72) + 'px';
    } else {
      drawer.style.left = drawer.style.top = drawer.style.right = drawer.style.bottom = drawer.style.height = '';
    }

    const pinAllowed = !isFloat && !mobile.matches;
    const pinned = ui.pinned && ui.open && pinAllowed;
    const offset = pinned ? ui.width + 28 : 0;
    stage.style.left = !isRight ? offset + 'px' : '0px';
    stage.style.right = isRight ? offset + 'px' : '0px';

    $('btnPin').setAttribute('aria-pressed', String(pinned));
    $('btnPin').disabled = !pinAllowed;
    $('btnEditor').setAttribute('aria-expanded', String(ui.open));
    $('btnEditor').setAttribute('aria-pressed', String(ui.open));
    $('btnDock').dataset.tip = 'Dock: ' + ui.dock;
  }
  function openDrawer(focus) {
    ui.open = true;
    applyDrawer();
    saveUI();
    if (focus) editor.focus({ preventScroll: true });
  }
  function closeDrawer() {
    if (!ui.open) return;
    ui.open = false;
    closePopovers();
    applyDrawer();
    saveUI();
  }
  function toggleDrawer() { if (ui.open) closeDrawer(); else openDrawer(true); }
  function togglePin() { ui.pinned = !ui.pinned; applyDrawer(); saveUI(); }
  function cycleDock() {
    const order = ['left', 'right', 'float'];
    ui.dock = order[(order.indexOf(ui.dock) + 1) % order.length];
    applyDrawer();
    saveUI();
    toast('Editor docked: ' + ui.dock);
  }

  $('btnEditor').addEventListener('click', toggleDrawer);
  $('btnDrawerClose').addEventListener('click', closeDrawer);
  $('btnPin').addEventListener('click', togglePin);
  $('btnDock').addEventListener('click', cycleDock);

  // Drag floating panel by header; swipe down to close on mobile.
  drawerHead.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    if (mobile.matches) {
      const startY = e.clientY;
      const up = (ev) => {
        window.removeEventListener('pointerup', up);
        if (ev.clientY - startY > 70) closeDrawer();
      };
      window.addEventListener('pointerup', up);
      return;
    }
    if (ui.dock !== 'float') return;
    const offX = e.clientX - ui.floatX;
    const offY = e.clientY - ui.floatY;
    drawer.classList.add('dragging');
    const move = (ev) => {
      ui.floatX = clamp(ev.clientX - offX, 0, innerWidth - 120);
      ui.floatY = clamp(ev.clientY - offY, 0, innerHeight - 60);
      drawer.style.left = ui.floatX + 'px';
      drawer.style.top = ui.floatY + 'px';
    };
    const up = () => {
      drawer.classList.remove('dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      saveUI();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  // Resize handle.
  const resizeHandle = $('resizeHandle');
  resizeHandle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    resizeHandle.setPointerCapture(e.pointerId);
    resizeHandle.classList.add('active');
    stage.classList.add('resizing');
    const move = (ev) => {
      let w;
      if (ui.dock === 'right') w = innerWidth - ev.clientX - 14;
      else if (ui.dock === 'float') w = ev.clientX - ui.floatX;
      else w = ev.clientX - 14;
      ui.width = clamp(Math.round(w), 340, Math.min(720, innerWidth - 60));
      applyDrawer();
    };
    const up = () => {
      resizeHandle.removeEventListener('pointermove', move);
      resizeHandle.removeEventListener('pointerup', up);
      resizeHandle.removeEventListener('pointercancel', up);
      resizeHandle.classList.remove('active');
      stage.classList.remove('resizing');
      saveUI();
    };
    resizeHandle.addEventListener('pointermove', move);
    resizeHandle.addEventListener('pointerup', up);
    resizeHandle.addEventListener('pointercancel', up);
  });

  /* ── Editor: highlight overlay, gutter ── */
  const { highlightLine } = window.PicoViewer.Highlight;
  function refreshHighlight() {
    const lines = editor.value.split('\n');
    let html = '';
    for (let i = 0; i < lines.length; i++) {
      const inner = highlightLine(lines[i]);
      html += i + 1 === errLine ? '<span class="err-line">' + (inner || ' ') + '</span>\n' : inner + '\n';
    }
    hlCode.innerHTML = html;
  }
  function refreshGutter() {
    const n = editor.value.split('\n').length;
    let html = '';
    for (let i = 1; i <= n; i++) {
      html += '<div class="gutter-line' + (i === errLine ? ' err' : '') + '">' + i + '</div>';
    }
    gutterInner.innerHTML = html;
    syncScroll();
  }
  function syncScroll() {
    hlEl.scrollTop = editor.scrollTop;
    hlEl.scrollLeft = editor.scrollLeft;
    gutterInner.style.transform = 'translateY(' + (-editor.scrollTop) + 'px)';
  }
  function updateCursor() {
    const pos = editor.selectionStart;
    const before = editor.value.slice(0, pos);
    const col = pos - before.lastIndexOf('\n');
    const sel = editor.selectionEnd - editor.selectionStart;
    $('stCursor').textContent = 'Ln ' + before.split('\n').length + ', Col ' + col + (sel ? ' (' + sel + ' selected)' : '');
  }
  function updateCounts() {
    $('stChars').textContent = editor.value.split('\n').length + ' lines · ' + editor.value.length + ' chars';
    emptyEl.hidden = !!editor.value.trim();
  }

  /* ── Editor: undo / redo ── */
  const history = { stack: [], idx: 0, last: 0 };
  function snapshot() { return { v: editor.value, s: editor.selectionStart, e: editor.selectionEnd }; }
  // Keystrokes within 600ms are grouped into one undo step.
  function recordHistory(force) {
    const now = Date.now();
    const snap = snapshot();
    if (!history.stack.length) {
      history.stack.push(snap);
      history.idx = 0;
    } else if (force || now - history.last > 600) {
      history.stack.splice(history.idx + 1);
      history.stack.push(snap);
      history.idx = history.stack.length - 1;
      if (history.stack.length > 300) { history.stack.shift(); history.idx--; }
    } else {
      history.stack[history.idx] = snap;
    }
    history.last = now;
  }
  function applySnapshot(s) {
    history.last = 0;
    editor.value = s.v;
    editor.setSelectionRange(s.s, s.e);
    onEditorChanged(false);
  }
  function undo() {
    if (history.idx <= 0) return;
    history.idx--;
    applySnapshot(history.stack[history.idx]);
  }
  function redo() {
    if (history.idx >= history.stack.length - 1) return;
    history.idx++;
    applySnapshot(history.stack[history.idx]);
  }
  function onEditorChanged(record) {
    if (record !== false) recordHistory(false);
    refreshHighlight();
    refreshGutter();
    updateCursor();
    updateCounts();
    scheduleSave();
    scheduleRender();
  }
  function setEditorValue(v) {
    editor.value = v;
    editor.setSelectionRange(0, 0);
    editor.scrollTop = 0;
    recordHistory(true);
    onEditorChanged(false);
  }

  /* ── Editor: text operations ── */
  function lineStartAt(v, p) { return p <= 0 ? 0 : v.lastIndexOf('\n', p - 1) + 1; }
  function lineEndAt(v, p) { const i = v.indexOf('\n', p); return i === -1 ? v.length : i; }
  function replaceRange(start, end, text, selStart, selEnd) {
    editor.setRangeText(text, start, end, 'preserve');
    const caret = start + text.length;
    editor.setSelectionRange(selStart ?? caret, selEnd ?? caret);
    onEditorChanged(true);
  }
  function indentUnit() { return ' '.repeat(settings.tab); }
  function indentSelection() {
    const { selectionStart: s, selectionEnd: e, value: v } = editor;
    if (s === e) return replaceRange(s, e, indentUnit());
    const bs = lineStartAt(v, s), be = lineEndAt(v, e);
    const block = v.slice(bs, be).split('\n').map((l) => indentUnit() + l).join('\n');
    replaceRange(bs, be, block, bs, bs + block.length);
  }
  function outdentSelection() {
    const { selectionStart: s, selectionEnd: e, value: v } = editor;
    const bs = lineStartAt(v, s), be = lineEndAt(v, e);
    const re = new RegExp('^ {1,' + settings.tab + '}');
    const block = v.slice(bs, be).split('\n').map((l) => l.replace(re, '')).join('\n');
    replaceRange(bs, be, block, bs, bs + block.length);
  }
  function toggleComment() {
    const { selectionStart: s, selectionEnd: e, value: v } = editor;
    const bs = lineStartAt(v, s), be = lineEndAt(v, e);
    const lines = v.slice(bs, be).split('\n');
    const allCommented = lines.every((l) => l.trim() === '' || /^\s*%%/.test(l));
    const block = lines.map((l) => {
      if (l.trim() === '') return l;
      return allCommented ? l.replace(/^(\s*)%% ?/, '$1') : l.replace(/^(\s*)/, '$1%% ');
    }).join('\n');
    replaceRange(bs, be, block, bs, bs + block.length);
  }
  function autoIndentNewline() {
    const v = editor.value;
    const p = editor.selectionStart;
    const before = v.slice(lineStartAt(v, p), p);
    const base = before.match(/^[ \t]*/)[0];
    const trimmed = before.trim();
    const opens = /[[({]$/.test(trimmed) || /^(subgraph|loop|alt|opt|par|rect|critical|break|section)\b/.test(trimmed);
    replaceRange(p, editor.selectionEnd, '\n' + base + (opens ? indentUnit() : ''));
  }
  const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
  const CLOSERS = new Set([')', ']', '}', '"', "'", '`']);
  function autoCloseKey(k) {
    const v = editor.value;
    const s = editor.selectionStart, e = editor.selectionEnd;
    const next = v.charAt(e), prev = v.charAt(s - 1);
    if (CLOSERS.has(k) && s === e && next === k) {
      editor.setSelectionRange(s + 1, s + 1);
      updateCursor();
      return true;
    }
    if (!(k in PAIRS)) return false;
    if (s !== e) {
      replaceRange(s, e, k + v.slice(s, e) + PAIRS[k], s + 1, e + 1);
      return true;
    }
    const quote = k === '"' || k === "'" || k === '`';
    if (quote && (/\w/.test(prev) || prev === k)) return false;
    if (next && !/[\s)\]}>,;]/.test(next)) return false;
    replaceRange(s, e, k + PAIRS[k], s + 1, s + 1);
    return true;
  }
  function deletePair() {
    const v = editor.value, s = editor.selectionStart;
    if (!settings.autoClose || editor.selectionEnd !== s || s === 0) return false;
    const prev = v.charAt(s - 1);
    if (PAIRS[prev] && PAIRS[prev] === v.charAt(s)) {
      replaceRange(s - 1, s + 1, '', s - 1, s - 1);
      return true;
    }
    return false;
  }
  function onEditorKeydown(e) {
    if (editor.readOnly) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (mod) {
      const lk = k.toLowerCase();
      if (lk === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((lk === 'z' && e.shiftKey) || lk === 'y') { e.preventDefault(); redo(); return; }
      if (k === '/') { e.preventDefault(); toggleComment(); return; }
      if (k === '=' || k === '+') { e.preventDefault(); setFont(settings.font + 1); return; }
      if (k === '-') { e.preventDefault(); setFont(settings.font - 1); return; }
      if (k === '0') { e.preventDefault(); setFont(13); return; }
      return;
    }
    if (k === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) outdentSelection(); else indentSelection();
      return;
    }
    if (k === 'Enter') { e.preventDefault(); autoIndentNewline(); return; }
    if (k === 'Backspace') { if (deletePair()) e.preventDefault(); return; }
    if (settings.autoClose && k.length === 1 && !e.altKey && autoCloseKey(k)) e.preventDefault();
  }
  editor.addEventListener('input', () => onEditorChanged(true));
  editor.addEventListener('keydown', onEditorKeydown);
  editor.addEventListener('scroll', syncScroll);
  ['keyup', 'click', 'select', 'focus'].forEach((ev) => editor.addEventListener(ev, updateCursor));

  function applyFont() { document.documentElement.style.setProperty('--code-size', settings.font + 'px'); }
  function setFont(n) {
    settings.font = clamp(n, FONT_MIN, FONT_MAX);
    applyFont();
    saveSettings();
  }
  function applyWrap() {
    editorBox.classList.toggle('wrap', settings.wrap);
    $('btnWrap').setAttribute('aria-pressed', String(settings.wrap));
    refreshGutter();
  }
  function toggleWrap() { settings.wrap = !settings.wrap; applyWrap(); saveSettings(); }

  /* ── Find & replace ── */
  let findIdx = -1;
  function findMatches() {
    const q = findInput.value.toLowerCase();
    if (!q) return [];
    const v = editor.value.toLowerCase();
    const out = [];
    let i = v.indexOf(q);
    while (i !== -1) { out.push(i); i = v.indexOf(q, i + q.length); }
    return out;
  }
  function scrollToLine(n) {
    const lh = parseFloat(getComputedStyle(editor).lineHeight) || 21;
    editor.scrollTop = Math.max(0, (n - 1) * lh - editor.clientHeight / 3);
    syncScroll();
  }
  function updateFindCount(matches) {
    findCount.textContent = matches.length ? (findIdx + 1) + '/' + matches.length : '0/0';
  }
  function gotoMatch(step) {
    const m = findMatches();
    if (!m.length) { findIdx = -1; updateFindCount(m); return; }
    if (findIdx < 0 || findIdx >= m.length) {
      const after = m.findIndex((p) => p >= editor.selectionStart);
      findIdx = step > 0 ? (after === -1 ? 0 : after) : (after === -1 ? m.length - 1 : Math.max(0, after - 1));
    } else {
      findIdx = (findIdx + step + m.length) % m.length;
    }
    const pos = m[findIdx];
    editor.setSelectionRange(pos, pos + findInput.value.length);
    scrollToLine(editor.value.slice(0, pos).split('\n').length);
    updateFindCount(m);
    updateCursor();
  }
  function openFind() {
    if (!ui.open) openDrawer(false);
    const sel = editor.value.slice(editor.selectionStart, editor.selectionEnd);
    if (sel && !sel.includes('\n')) findInput.value = sel;
    findbar.hidden = false;
    $('btnFind').setAttribute('aria-pressed', 'true');
    findIdx = -1;
    findInput.focus();
    findInput.select();
    updateFindCount(findMatches());
  }
  function closeFind() {
    findbar.hidden = true;
    $('btnFind').setAttribute('aria-pressed', 'false');
    editor.focus({ preventScroll: true });
  }
  function toggleFind() { if (findbar.hidden) openFind(); else closeFind(); }
  function replaceOne() {
    const m = findMatches();
    if (!m.length) return;
    const s = editor.selectionStart, e = editor.selectionEnd;
    if (!(m.includes(s) && e - s === findInput.value.length)) { gotoMatch(1); return; }
    replaceRange(s, e, replaceInput.value);
    findIdx--;
    gotoMatch(1);
  }
  function replaceAll() {
    const q = findInput.value;
    if (!q) return;
    const re = new RegExp(escapeRe(q), 'gi');
    const count = (editor.value.match(re) || []).length;
    if (!count) { toast('No matches found', 'err'); return; }
    setEditorValue(editor.value.replace(re, () => replaceInput.value));
    findIdx = -1;
    updateFindCount(findMatches());
    toast(count + ' replaced · Ctrl+Z to undo');
  }
  findInput.addEventListener('input', () => { findIdx = -1; gotoMatch(1); });
  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); gotoMatch(e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFind(); }
  });
  replaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); replaceOne(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFind(); }
  });
  $('findNext').addEventListener('click', () => gotoMatch(1));
  $('findPrev').addEventListener('click', () => gotoMatch(-1));
  $('findClose').addEventListener('click', closeFind);
  $('replaceOne').addEventListener('click', replaceOne);
  $('replaceAll').addEventListener('click', replaceAll);
  $('btnFind').addEventListener('click', toggleFind);
  $('btnUndo').addEventListener('click', undo);
  $('btnRedo').addEventListener('click', redo);
  $('btnFontUp').addEventListener('click', () => setFont(settings.font + 1));
  $('btnFontDown').addEventListener('click', () => setFont(settings.font - 1));
  $('btnWrap').addEventListener('click', toggleWrap);

  /* ── Canvas: transform loop ── */
  let rafId = 0;
  function requestTick() { if (!rafId) rafId = requestAnimationFrame(tick); }
  function near(a, b) {
    return Math.abs(a.x - b.x) < 0.05 && Math.abs(a.y - b.y) < 0.05 && Math.abs(a.s - b.s) < 0.0005;
  }
  // Eases the view toward the target; cursor-anchored zoom keeps the anchor point fixed.
  function tick() {
    rafId = 0;
    const k = settings.anim ? 0.2 : 1;
    if (anchor) {
      view.s += (target.s - view.s) * k;
      view.x = anchor.sx - anchor.wx * view.s;
      view.y = anchor.sy - anchor.wy * view.s;
      if (Math.abs(target.s - view.s) < 0.0005) { view = { ...target }; anchor = null; }
    } else {
      if (near(view, target)) view = { ...target };
      else {
        view.x += (target.x - view.x) * k;
        view.y += (target.y - view.y) * k;
        view.s += (target.s - view.s) * k;
      }
    }
    applyTransform();
    if (anchor || !near(view, target)) requestTick();
  }
  function applyTransform() {
    world.style.transform = 'translate3d(' + view.x + 'px, ' + view.y + 'px, 0) scale(' + view.s + ')';
    const pct = Math.round(view.s * 100) + '%';
    zoomPct.textContent = pct;
    tbZoomLabel.textContent = pct;
    updateGrid();
    updateMinimapViewport();
  }
  function setTarget(t, instant) {
    anchor = null;
    target = { ...t };
    if (instant) { view = { ...t }; applyTransform(); }
    else requestTick();
  }
  function stageSize() { return { w: stage.clientWidth, h: stage.clientHeight }; }

  /* ── Canvas: zoom & fit ── */
  function zoomAt(cx, cy, factor, instant) {
    const ns = clamp(target.s * factor, ZOOM_MIN, ZOOM_MAX);
    if (ns === target.s) return;
    const wx = (cx - target.x) / target.s;
    const wy = (cy - target.y) / target.s;
    if (instant) {
      anchor = null;
      view.s = ns;
      view.x = cx - wx * ns;
      view.y = cy - wy * ns;
      target = { ...view };
      applyTransform();
      return;
    }
    anchor = { wx, wy, sx: cx, sy: cy };
    target = { s: ns, x: cx - wx * ns, y: cy - wy * ns };
    requestTick();
  }
  function zoomBy(f) {
    const { w, h } = stageSize();
    zoomAt(w / 2, h / 2, f, false);
  }
  function oneToOne() {
    const { w, h } = stageSize();
    zoomAt(w / 2, h / 2, 1 / target.s, false);
  }
  function fitView(instant) {
    if (!hasContent || !contentW || !contentH) return;
    const { w, h } = stageSize();
    setTarget(fitTransform(contentW, contentH, w, h, { fitMax: FIT_MAX, zoomMin: ZOOM_MIN, zoomMax: ZOOM_MAX }), instant);
  }

  /* ── Canvas: pointer, wheel, touch ── */
  const UI_SKIP = '.toolbar, .zoom-dock, .minimap, .empty-state, .error-card, .popover, .modal-backdrop, .drawer, .drawer-resize';
  const pointers = new Map();
  let pan = null, pinch = null, spaceDown = false, inertia = null, inertiaRaf = 0;
  let selectedNode = null, hoveredNode = null;

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const midOf = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  function startInertia(vx, vy) {
    inertia = { vx, vy };
    if (!inertiaRaf) inertiaRaf = requestAnimationFrame(stepInertia);
  }
  function stopInertia() {
    inertia = null;
    cancelAnimationFrame(inertiaRaf);
    inertiaRaf = 0;
  }
  function stepInertia() {
    inertiaRaf = 0;
    if (!inertia) return;
    inertia.vx *= 0.92;
    inertia.vy *= 0.92;
    if (Math.abs(inertia.vx) < 0.1 && Math.abs(inertia.vy) < 0.1) { inertia = null; return; }
    view.x += inertia.vx;
    view.y += inertia.vy;
    target = { ...view };
    anchor = null;
    applyTransform();
    inertiaRaf = requestAnimationFrame(stepInertia);
  }

  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest(UI_SKIP)) return;
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { dist: dist(a, b), mid: midOf(a, b) };
      pan = null;
      return;
    }
    stopInertia();
    const node = !spaceDown && diagram.contains(e.target) ? e.target.closest('g.node') : null;
    pan = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, samples: [], node };
    stage.classList.add('grabbing');
  });

  stage.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const rect = stage.getBoundingClientRect();
      const m = midOf(a, b);
      const local = { x: pinch.mid.x - rect.left, y: pinch.mid.y - rect.top };
      zoomAt(local.x, local.y, dist(a, b) / pinch.dist, true);
      view.x += m.x - pinch.mid.x;
      view.y += m.y - pinch.mid.y;
      target = { ...view };
      applyTransform();
      pinch.dist = dist(a, b);
      pinch.mid = m;
      return;
    }
    if (pan && pan.id === e.pointerId) {
      const dx = e.clientX - pan.x;
      const dy = e.clientY - pan.y;
      pan.x = e.clientX;
      pan.y = e.clientY;
      pan.moved += Math.abs(dx) + Math.abs(dy);
      const now = performance.now();
      pan.samples.push({ dx, dy, t: now });
      while (pan.samples.length && now - pan.samples[0].t > 90) pan.samples.shift();
      anchor = null;
      view.x += dx;
      view.y += dy;
      target = { ...view };
      applyTransform();
    }
  });

  const endPointer = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pinch && pointers.size < 2) pinch = null;
    if (!pan || pan.id !== e.pointerId) return;
    stage.classList.remove('grabbing');
    if (pan.moved <= 3) {
      if (pan.node) selectNode(pan.node);
      else clearSelection();
    } else if (settings.anim) {
      const now = performance.now();
      const recent = pan.samples.filter((s) => now - s.t < 90);
      if (recent.length > 1) {
        const dt = Math.max(1, now - recent[0].t);
        const sx = recent.reduce((acc, s) => acc + s.dx, 0);
        const sy = recent.reduce((acc, s) => acc + s.dy, 0);
        startInertia((sx / dt) * 16, (sy / dt) * 16);
      }
    }
    pan = null;
  };
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);

  stage.addEventListener('wheel', (e) => {
    if (e.target.closest(UI_SKIP)) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : 1;
    const dy = e.deltaY * unit;
    if (e.shiftKey && !e.ctrlKey) {
      anchor = null;
      view.x -= dy;
      target = { ...view };
      applyTransform();
      return;
    }
    const rect = stage.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), false);
  }, { passive: false });

  stage.addEventListener('dblclick', (e) => {
    if (e.target.closest(UI_SKIP + ', g.node')) return;
    fitView(false);
  });

  /* ── Minimap ── */
  let miniMap = { mm: 1, ox: 0, oy: 0 };
  let miniCache = null;
  let miniDrag = false;

  function computeMiniMap() {
    miniMap = minimapLayout(mini.width, mini.height, contentW, contentH);
  }
  function renderMinimapImage(svgEl) {
    if (!settings.minimap || !svgEl) return;
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svgEl)], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = mini.width;
      c.height = mini.height;
      c.getContext('2d').drawImage(img, miniMap.ox, miniMap.oy, contentW * miniMap.mm, contentH * miniMap.mm);
      miniCache = c;
      miniCtx.clearRect(0, 0, mini.width, mini.height);
      miniCtx.drawImage(miniCache, 0, 0);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }
  function updateMinimapViewport() {
    if (!hasContent || !settings.minimap) return;
    const { mm, ox, oy } = miniMap;
    const { w, h } = stageSize();
    miniVp.style.left = (ox - view.x / view.s * mm) + 'px';
    miniVp.style.top = (oy - view.y / view.s * mm) + 'px';
    miniVp.style.width = (w / view.s * mm) + 'px';
    miniVp.style.height = (h / view.s * mm) + 'px';
  }
  function applyMinimapSetting() {
    miniWrap.classList.toggle('hidden', !settings.minimap);
    if (settings.minimap) updateMinimapViewport();
  }
  function minimapCenter(e, instant) {
    const r = miniWrap.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (mini.width / r.width);
    const my = (e.clientY - r.top) * (mini.height / r.height);
    const wx = (mx - miniMap.ox) / miniMap.mm;
    const wy = (my - miniMap.oy) / miniMap.mm;
    const { w, h } = stageSize();
    setTarget({ s: view.s, x: w / 2 - wx * view.s, y: h / 2 - wy * view.s }, instant);
  }
  miniWrap.addEventListener('pointerdown', (e) => {
    if (!hasContent) return;
    miniDrag = true;
    miniWrap.setPointerCapture(e.pointerId);
    minimapCenter(e, false);
  });
  miniWrap.addEventListener('pointermove', (e) => { if (miniDrag) minimapCenter(e, true); });
  const endMiniDrag = () => { miniDrag = false; };
  miniWrap.addEventListener('pointerup', endMiniDrag);
  miniWrap.addEventListener('pointercancel', endMiniDrag);

  /* ── Render pipeline ── */
  let renderSeq = 0, renderTimer = null, saveTimer = null, shimmerTimer = null;

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderDiagram, settings.debounce);
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCode, 400);
  }
  function saveCode() {
    try { localStorage.setItem(KEYS.code, editor.value); } catch (e) { /* storage unavailable */ }
  }
  function setBusy(on) {
    clearTimeout(shimmerTimer);
    if (on) shimmerTimer = setTimeout(() => $('shimmer').classList.add('on'), 180);
    else $('shimmer').classList.remove('on');
  }
  function setSyntax(state, text) {
    $('stSyntax').className = 'st-item st-syntax ' + state;
    $('stDot').className = 'st-dot ' + state;
    $('stSyntaxText').textContent = text;
    $('stSyntax').title = state === 'err' && errLine ? 'Click to jump to line ' + errLine : '';
  }
  function showError(msg) {
    $('errorText').textContent = msg.length > 800 ? msg.slice(0, 800) + '…' : msg;
    $('errorGoto').hidden = !errLine;
    errorCard.hidden = false;
  }
  function hideError() { errorCard.hidden = true; }

  function parseErrorLine(msg) {
    const m = msg.match(/line\s+(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  }

  function mountSvg(svgText) {
    diagram.innerHTML = svgText;
    const el = diagram.querySelector('svg');
    if (!el) throw new Error('Mermaid produced no SVG output.');
    const vb = el.viewBox && el.viewBox.baseVal;
    const rect = el.getBoundingClientRect();
    const w = (vb && vb.width) || rect.width || 800;
    const h = (vb && vb.height) || rect.height || 600;
    el.removeAttribute('style');
    el.setAttribute('width', w);
    el.setAttribute('height', h);
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    diagram.style.width = w + 'px';
    diagram.style.height = h + 'px';
    contentW = w;
    contentH = h;
    selectedNode = null;
    hoveredNode = null;
    computeMiniMap();
    return el;
  }

  async function renderDiagram() {
    const text = editor.value;
    const seq = ++renderSeq;
    if (!text.trim()) {
      diagram.innerHTML = '';
      hasContent = false;
      hideError();
      errLine = null;
      refreshHighlight();
      refreshGutter();
      setSyntax('', 'Empty');
      $('stNodes').textContent = '0 nodes';
      $('stRender').textContent = '— ms';
      emptyEl.hidden = false;
      setBusy(false);
      return;
    }
    if (!window.mermaid) {
      setSyntax('err', 'Mermaid engine not loaded');
      return;
    }
    const id = 'pico-graph-' + seq;
    const t0 = performance.now();
    setBusy(true);
    try {
      const { svg } = await mermaid.render(id, text);
      if (seq !== renderSeq) return;
      const el = mountSvg(svg);
      hasContent = true;
      emptyEl.hidden = true;
      errLine = null;
      hideError();
      diagram.classList.remove('stale', 'enter');
      void diagram.offsetWidth;
      diagram.classList.add('enter');
      if (firstRender || settings.autoFit) fitView(firstRender);
      firstRender = false;
      $('stRender').textContent = Math.round(performance.now() - t0) + ' ms';
      $('stNodes').textContent = diagram.querySelectorAll('.node, .actor, .classGroup, .entityBox, .statediagram-state').length + ' nodes';
      setSyntax('ok', 'Valid syntax');
      refreshHighlight();
      refreshGutter();
      updateMinimapViewport();
      idle(() => renderMinimapImage(el));
    } catch (err) {
      if (seq !== renderSeq) return;
      const stray = document.getElementById('d' + id);
      if (stray) stray.remove();
      const msg = String((err && err.message) || err).trim();
      errLine = parseErrorLine(msg);
      if (hasContent) diagram.classList.add('stale');
      showError(msg);
      setSyntax('err', errLine ? 'Syntax error · line ' + errLine : 'Syntax error');
      refreshHighlight();
      refreshGutter();
    } finally {
      if (seq === renderSeq) setBusy(false);
    }
  }

  function goToLine(n) {
    const v = editor.value;
    const lines = v.split('\n');
    let pos = 0;
    for (let i = 0; i < n - 1 && i < lines.length; i++) pos += lines[i].length + 1;
    openDrawer(false);
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(pos, pos + (lines[n - 1] || '').length);
    scrollToLine(n);
    updateCursor();
  }
  $('errorGoto').addEventListener('click', () => { if (errLine) goToLine(errLine); });
  $('stSyntax').addEventListener('click', () => { if (errLine) goToLine(errLine); });

  /* ── Node hover & selection ── */
  function nodeName(g) {
    const m = (g.id || '').match(/^[A-Za-z]+-(.+)-\d+$/);
    return m ? m[1] : null;
  }
  function clearSelection() {
    if (selectedNode) selectedNode.classList.remove('sel');
    diagram.querySelectorAll('.is-edge, .linked').forEach((el) => el.classList.remove('is-edge', 'linked'));
    diagram.classList.remove('has-sel');
    selectedNode = null;
  }
  function selectNode(g) {
    clearSelection();
    selectedNode = g;
    g.classList.add('sel');
    diagram.classList.add('has-sel');
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
  diagram.addEventListener('pointerover', (e) => {
    const g = e.target.closest ? e.target.closest('g.node') : null;
    if (!g || g === hoveredNode) return;
    if (hoveredNode) hoveredNode.classList.remove('is-hover');
    hoveredNode = g;
    g.classList.add('is-hover');
  });
  diagram.addEventListener('pointerout', (e) => {
    if (!hoveredNode) return;
    if (e.relatedTarget && hoveredNode.contains(e.relatedTarget)) return;
    hoveredNode.classList.remove('is-hover');
    hoveredNode = null;
  });

  /* ── Export ── */
  function canvasColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--canvas-a').trim() || '#0b0d10';
  }
  function buildSvgString(transparent) {
    const el = diagram.querySelector('svg');
    if (!el) return null;
    const clone = el.cloneNode(true);
    clone.setAttribute('xmlns', SVG_NS);
    clone.setAttribute('width', contentW);
    clone.setAttribute('height', contentH);
    if (!transparent) {
      const bg = document.createElementNS(SVG_NS, 'rect');
      bg.setAttribute('width', '100%');
      bg.setAttribute('height', '100%');
      bg.setAttribute('fill', canvasColor());
      clone.insertBefore(bg, clone.firstChild);
    }
    return new XMLSerializer().serializeToString(clone);
  }
  function svgToPngBlob(scale, transparent) {
    return new Promise((resolve, reject) => {
      const svgStr = buildSvgString(transparent);
      if (!svgStr) { reject(new Error('No diagram')); return; }
      const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }));
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = Math.round(contentW * scale);
          c.height = Math.round(contentH * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          c.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png');
        } catch (err) {
          reject(err);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not rasterize SVG')); };
      img.src = url;
    });
  }
  function baseName() {
    return (docName.replace(/\.(mmd|mermaid|md|txt)$/i, '') || 'diagram') + '-' + timestamp();
  }
  function noContent() { toast('Nothing to export yet', 'err'); }
  function transparentChecked() { return $('transparentBg').checked; }

  async function runExport(kind) {
    if (!hasContent) return noContent();
    const transparent = transparentChecked();
    try {
      if (kind === 'svg') {
        download(new Blob([buildSvgString(transparent)], { type: 'image/svg+xml' }), baseName() + '.svg');
        toast('SVG exported');
      } else if (kind.startsWith('png')) {
        const scale = Number(kind.slice(3));
        download(await svgToPngBlob(scale, transparent), baseName() + '@' + scale + 'x.png');
        toast('PNG exported at ' + scale + '×');
      } else if (kind === 'pdf') {
        exportPdf();
      } else if (kind === 'copy-svg') {
        await navigator.clipboard.writeText(buildSvgString(transparent));
        toast('SVG copied to clipboard');
      } else if (kind === 'copy-png') {
        const blob = await svgToPngBlob(2, transparent);
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('PNG copied to clipboard');
      } else if (kind === 'copy-code') {
        await navigator.clipboard.writeText(editor.value);
        toast('Mermaid code copied');
      }
    } catch (err) {
      toast('Export failed: ' + (err.message || 'browser blocked it. Try SVG.'), 'err');
    }
  }

  function exportPdf() {
    const svgStr = buildSvgString(true);
    if (!svgStr) return noContent();
    const root = $('printRoot');
    root.innerHTML = svgStr;
    const done = () => {
      root.innerHTML = '';
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
  }

  $('exportMenu').addEventListener('click', (e) => {
    const b = e.target.closest('[data-export]');
    if (!b) return;
    closePopovers();
    runExport(b.dataset.export);
  });

  /* ── Popovers ── */
  function closePopovers() {
    let any = false;
    document.querySelectorAll('.popover').forEach((p) => {
      if (!p.hidden) { any = true; p.hidden = true; }
    });
    document.querySelectorAll('[aria-haspopup][aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    return any;
  }
  function togglePopover(btn, pop) {
    const willOpen = pop.hidden;
    closePopovers();
    if (willOpen) {
      pop.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
    }
  }
  $('btnTheme').addEventListener('click', () => togglePopover($('btnTheme'), $('themeMenu')));
  $('btnExport').addEventListener('click', () => togglePopover($('btnExport'), $('exportMenu')));
  $('btnTemplates').addEventListener('click', () => togglePopover($('btnTemplates'), $('templateMenu')));
  $('themeMenu').addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-id]');
    if (!b) return;
    closePopovers();
    setTheme(b.dataset.themeId);
  });
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest || !e.target.closest('.menu-anchor')) closePopovers();
  });

  /* ── Templates ── */
  function buildTemplateMenu() {
    $('templateMenu').innerHTML = '<div class="menu-label">Start from a template</div>' + TEMPLATES.map((t) =>
      '<button class="menu-item" role="menuitem" data-template="' + t.id + '">' + svgFor('layers') +
      '<span>' + t.name + '</span><small>' + t.hint + '</small></button>').join('');
  }
  function loadTemplate(id) {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    closePopovers();
    setEditorValue(t.code);
    if (!ui.open) openDrawer(false);
    toast(t.name + ' template loaded · Ctrl+Z to undo');
  }
  $('templateMenu').addEventListener('click', (e) => {
    const b = e.target.closest('[data-template]');
    if (b) loadTemplate(b.dataset.template);
  });
  document.querySelectorAll('[data-sample]').forEach((b) => {
    b.addEventListener('click', () => loadTemplate(b.dataset.sample));
  });

  /* ── Files: open, watch, drop ── */
  let fileHandle = null, lastMod = 0, watchTimer = null;
  const supportsFSA = typeof window.showOpenFilePicker === 'function';

  function setDocName(name) {
    docName = name;
    localStorage.setItem(KEYS.doc, name);
    $('docName').textContent = name;
    document.title = 'Pico — ' + name;
  }
  function extractMermaid(text) {
    const m = text.match(/```mermaid\s*\n([\s\S]*?)```/);
    return m ? m[1].trim() + '\n' : text;
  }
  function stopWatch(silent) {
    clearInterval(watchTimer);
    watchTimer = null;
    if (!fileHandle) return;
    fileHandle = null;
    editor.readOnly = false;
    $('watchBadge').hidden = true;
    if (!silent) toast('Stopped watching');
  }
  async function syncFile() {
    if (!fileHandle) return;
    try {
      const file = await fileHandle.getFile();
      if (file.lastModified === lastMod) return;
      lastMod = file.lastModified;
      const text = extractMermaid(await file.text());
      setEditorValue(text);
    } catch (err) {
      stopWatch(true);
      toast('Watch stopped: ' + err.message, 'err');
    }
  }
  async function startWatch(handle) {
    stopWatch(true);
    fileHandle = handle;
    lastMod = 0;
    setDocName(handle.name);
    editor.readOnly = true;
    $('watchName').textContent = 'Watching ' + handle.name;
    $('watchBadge').hidden = false;
    await syncFile();
    watchTimer = setInterval(syncFile, 800);
    toast('Watching ' + handle.name + ' · click the badge to stop');
  }
  async function loadFile(file) {
    stopWatch(true);
    try {
      const text = await file.text();
      setDocName(file.name);
      setEditorValue(extractMermaid(text));
      toast('Opened ' + file.name);
    } catch (err) {
      toast('Could not read file', 'err');
    }
  }
  async function openFile() {
    if (!supportsFSA) { $('filePicker').click(); return; }
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Mermaid diagram', accept: { 'text/plain': ['.mmd', '.mermaid', '.md', '.txt'] } }],
        multiple: false
      });
      await startWatch(handle);
    } catch (err) {
      if (err.name !== 'AbortError') toast('Open failed: ' + err.message, 'err');
    }
  }
  $('btnOpen').addEventListener('click', openFile);
  $('watchBadge').addEventListener('click', () => stopWatch(false));
  $('filePicker').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) loadFile(f);
  });

  const dropOverlay = document.createElement('div');
  dropOverlay.className = 'drop-overlay';
  dropOverlay.hidden = true;
  dropOverlay.textContent = 'Drop a .mmd, .md or .txt file';
  document.body.appendChild(dropOverlay);
  let dragDepth = 0;
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth++;
    dropOverlay.hidden = false;
  });
  window.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropOverlay.hidden = true;
  });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    dropOverlay.hidden = true;
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  });

  /* ── Zoom & view controls ── */
  $('tbZoomIn').addEventListener('click', () => zoomBy(1.25));
  $('zoomIn').addEventListener('click', () => zoomBy(1.25));
  $('tbZoomOut').addEventListener('click', () => zoomBy(0.8));
  $('zoomOut').addEventListener('click', () => zoomBy(0.8));
  $('tbFit').addEventListener('click', () => fitView(false));
  $('zoomFit').addEventListener('click', () => fitView(false));
  $('tbZoomLabel').addEventListener('click', oneToOne);
  $('zoomActual').addEventListener('click', oneToOne);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => toast('Fullscreen unavailable', 'err'));
    } else {
      document.exitFullscreen();
    }
  }
  $('btnFullscreen').addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => {
    $('btnFullscreen').setAttribute('aria-pressed', String(!!document.fullscreenElement));
  });

  /* ── Settings modal ── */
  let modalReturnFocus = null;
  function populateSettings() {
    $('setGrid').value = settings.grid;
    $('setTheme').value = settings.theme;
    $('setFont').value = settings.font;
    $('setFontOut').textContent = settings.font;
    $('setDebounce').value = settings.debounce;
    $('setDebounceOut').textContent = settings.debounce;
    $('setTab').value = String(settings.tab);
    $('setAutoFit').checked = settings.autoFit;
    $('setAnim').checked = settings.anim;
    $('setMinimap').checked = settings.minimap;
    $('setAutoClose').checked = settings.autoClose;
  }
  function openSettings() {
    closePopovers();
    populateSettings();
    modalReturnFocus = document.activeElement;
    modal.hidden = false;
    $('setGrid').focus();
  }
  function closeSettings() {
    modal.hidden = true;
    if (modalReturnFocus && modalReturnFocus.focus) modalReturnFocus.focus();
  }
  function onSettingsInput(e) {
    const el = e.target;
    switch (el.id) {
      case 'setGrid': settings.grid = el.value; applyGrid(); break;
      case 'setTheme': setTheme(el.value); break;
      case 'setFont': setFont(Number(el.value)); $('setFontOut').textContent = settings.font; break;
      case 'setDebounce': settings.debounce = Number(el.value); $('setDebounceOut').textContent = settings.debounce; break;
      case 'setTab': settings.tab = Number(el.value); break;
      case 'setAutoFit': settings.autoFit = el.checked; break;
      case 'setAnim': settings.anim = el.checked; applyMotion(); break;
      case 'setMinimap': settings.minimap = el.checked; applyMinimapSetting(); break;
      case 'setAutoClose': settings.autoClose = el.checked; break;
      default: return;
    }
    saveSettings();
  }
  function applyMotion() {
    document.documentElement.dataset.motion = settings.anim ? '' : 'off';
  }
  $('btnSettings').addEventListener('click', openSettings);
  $('settingsClose').addEventListener('click', closeSettings);
  $('settingsDone').addEventListener('click', closeSettings);
  $('settingsReset').addEventListener('click', () => {
    settings = { ...DEFAULT_SETTINGS };
    saveSettings();
    populateSettings();
    applyAllSettings();
  });
  modal.addEventListener('pointerdown', (e) => { if (e.target === modal) closeSettings(); });
  modal.addEventListener('input', onSettingsInput);
  modal.addEventListener('change', onSettingsInput);
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); closeSettings(); return; }
    if (e.key !== 'Tab') return;
    const items = [...modal.querySelectorAll('button, input, select')].filter((el) => !el.disabled);
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  function applyAllSettings() {
    applyTheme();
    buildThemeMenu();
    applyGrid();
    applyFont();
    applyWrap();
    applyMinimapSetting();
    applyMotion();
    if (editor.value.trim()) renderDiagram();
  }

  /* ── Fullscreen & global keyboard ── */
  const isTyping = (el) => !!(el && el.closest && el.closest('input, textarea, select, [contenteditable="true"]'));

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const lk = e.key.toLowerCase();
    if (mod && lk === 'e') { e.preventDefault(); toggleDrawer(); return; }
    if (mod && lk === 's') { e.preventDefault(); saveCode(); toast('Saved to this browser'); return; }
    if (mod && lk === 'o') { e.preventDefault(); openFile(); return; }
    if (mod && lk === 'f') { e.preventDefault(); openFind(); return; }
    if (e.key === 'Escape') {
      if (!modal.hidden) return;
      if (closePopovers()) return;
      if (!findbar.hidden) { closeFind(); return; }
      closeDrawer();
      return;
    }
    if (mod || e.altKey || isTyping(e.target) || !modal.hidden) return;
    if (e.key === ' ' && (e.target === document.body || e.target === stage)) {
      spaceDown = true;
      stage.classList.add('space-down');
      e.preventDefault();
      return;
    }
    if (e.key === '+' || e.key === '=') zoomBy(1.25);
    else if (e.key === '-') zoomBy(0.8);
    else if (e.key === '0') fitView(false);
    else if (e.key === '1') oneToOne();
    else if (lk === 'f') toggleFullscreen();
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
      spaceDown = false;
      stage.classList.remove('space-down');
    }
  });
  window.addEventListener('blur', () => {
    spaceDown = false;
    stage.classList.remove('space-down');
  });

  /* ── Resize ── */
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      applyDrawer();
      updateMinimapViewport();
    }, 120);
  });
  mobile.addEventListener('change', applyDrawer);

  /* ── Boot ── */
  function boot() {
    fillIcons();
    buildThemeMenu();
    buildTemplateMenu();
    applyTheme();
    applyGrid();
    applyFont();
    applyWrap();
    applyMinimapSetting();
    applyMotion();
    applyDrawer();
    setDocName(docName);
    if (!supportsFSA) $('btnOpen').dataset.tip = 'Open file';
    editor.value = localStorage.getItem(KEYS.code) ?? DEFAULT_CODE;
    recordHistory(true);
    refreshHighlight();
    refreshGutter();
    updateCursor();
    updateCounts();
    applyTransform();
    if (!window.mermaid) toast('Mermaid engine failed to load', 'err');
    renderDiagram();
  }
  boot();
})();

