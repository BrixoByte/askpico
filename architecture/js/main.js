/* Pico Viewer — entry point. Wires the PicoViewer modules together and owns settings persistence,
   the status bar, the error card, and boot.
   Exports: none (runs on load). Depends on: every PicoViewer module loaded before it, and mermaid.bundle.js.
   Loaded last in index.html. */
(function () {
  'use strict';

  const P = window.PicoViewer;
  const S = P.State;
  const KEYS = { code: 'pico-mermaid-code', settings: 'pico-mermaid-settings', ui: 'pico-mermaid-ui', doc: 'pico-mermaid-doc' };
  const DEFAULT_SETTINGS = {
    grid: 'lines', theme: 'auto', font: 13, debounce: 400, tab: 2,
    autoFit: true, anim: true, minimap: true, autoClose: true, wrap: false
  };
  const DEFAULT_UI = { open: true, dock: 'left', pinned: false, width: 468, floatX: 40, floatY: 90 };
  const FONT_MIN = 11, FONT_MAX = 20;
  const $ = (id) => document.getElementById(id);
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));

  const loadJSON = (key, fallback) => {
    try { return Object.assign({}, fallback, JSON.parse(localStorage.getItem(key)) || {}); }
    catch (e) { return Object.assign({}, fallback); }
  };
  const saveJSON = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  };

  let settings = loadJSON(KEYS.settings, DEFAULT_SETTINGS);
  let ui = loadJSON(KEYS.ui, DEFAULT_UI);
  let docName = localStorage.getItem(KEYS.doc) || 'diagram.mmd';
  let errLine = null;
  let saveTimer = null;
  let busyTimer = null;

  const ta = $('code');
  const diagram = $('diagram');
  const emptyEl = $('emptyState');

  const toast = P.Toast.show;
  const baseName = () => (docName.replace(/\.(mmd|mermaid|md|txt)$/i, '') || 'diagram') + '-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  /* ── Theme and grid ── */
  function resolveTheme() {
    const light = window.matchMedia('(prefers-color-scheme: light)');
    return settings.theme === 'auto' ? (light.matches ? 'light' : 'dark') : settings.theme;
  }
  function applyTheme() {
    document.documentElement.dataset.theme = resolveTheme();
    P.Render.initEngine(resolveTheme());
  }
  function setTheme(id) {
    settings.theme = id;
    saveJSON(KEYS.settings, settings);
    applyTheme();
    P.Menus.buildThemes(settings.theme);
    if (ta.value.trim()) P.Render.render(ta.value);
  }

  function updateGrid() {
    const v = S.view;
    let minor = 24 * v.s;
    while (minor < 14) minor *= 5;
    while (minor > 140) minor /= 5;
    const major = minor * 5;
    const mod = (x, m) => ((x % m) + m) % m;
    const st = $('grid').style;
    st.setProperty('--gs', minor + 'px');
    st.setProperty('--gm', major + 'px');
    st.setProperty('--ox', mod(v.x, minor) + 'px');
    st.setProperty('--oy', mod(v.y, minor) + 'px');
    st.setProperty('--mx', mod(v.x, major) + 'px');
    st.setProperty('--my', mod(v.y, major) + 'px');
  }
  function applyGrid() {
    $('grid').dataset.style = settings.grid;
    updateGrid();
  }

  /* ── Editor view: highlight, gutter, status ── */
  function syncScroll() {
    $('hl').scrollTop = ta.scrollTop;
    $('hl').scrollLeft = ta.scrollLeft;
    $('gutterInner').style.transform = 'translateY(' + (-ta.scrollTop) + 'px)';
  }
  function refreshHighlight() {
    const lines = ta.value.split('\n');
    let html = '';
    for (let i = 0; i < lines.length; i++) {
      const inner = P.Highlight.highlightLine(lines[i]);
      html += i + 1 === errLine ? '<span class="err-line">' + (inner || ' ') + '</span>\n' : inner + '\n';
    }
    $('hlCode').innerHTML = html;
  }
  function refreshGutter() {
    const n = ta.value.split('\n').length;
    let html = '';
    for (let i = 1; i <= n; i++) {
      html += '<div class="gutter-line' + (i === errLine ? ' err' : '') + '">' + i + '</div>';
    }
    $('gutterInner').innerHTML = html;
    syncScroll();
  }
  function updateCursor() {
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos);
    const sel = ta.selectionEnd - ta.selectionStart;
    $('stCursor').textContent = 'Ln ' + before.split('\n').length + ', Col ' + (pos - before.lastIndexOf('\n')) +
      (sel ? ' (' + sel + ' selected)' : '');
  }
  function updateCounts() {
    $('stChars').textContent = ta.value.split('\n').length + ' lines · ' + ta.value.length + ' chars';
    emptyEl.hidden = !!ta.value.trim();
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
    $('errorCard').hidden = false;
  }
  function hideError() { $('errorCard').hidden = true; }

  function scrollToLine(n) {
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 21;
    ta.scrollTop = Math.max(0, (n - 1) * lh - ta.clientHeight / 3);
    syncScroll();
  }
  function goToLine(n) {
    const lines = ta.value.split('\n');
    let pos = 0;
    for (let i = 0; i < n - 1 && i < lines.length; i++) pos += lines[i].length + 1;
    P.Drawer.open(false);
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(pos, pos + (lines[n - 1] || '').length);
    scrollToLine(n);
    updateCursor();
  }

  function onEditorChanged() {
    refreshHighlight();
    refreshGutter();
    updateCursor();
    updateCounts();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => localStorage.setItem(KEYS.code, ta.value), 400);
    P.Render.schedule(ta.value, settings.debounce);
    P.Live.onEdit();
  }

  function setFont(n) {
    settings.font = Math.min(FONT_MAX, Math.max(FONT_MIN, n));
    document.documentElement.style.setProperty('--code-size', settings.font + 'px');
    saveJSON(KEYS.settings, settings);
  }
  function applyWrap() {
    $('editor').classList.toggle('wrap', settings.wrap);
    $('btnWrap').setAttribute('aria-pressed', String(settings.wrap));
    refreshGutter();
  }

  /* ── Document name, templates ── */
  function setDocName(name) {
    docName = name;
    localStorage.setItem(KEYS.doc, name);
    $('docName').textContent = name;
    document.title = 'Pico — ' + name;
  }
  function loadTemplate(id) {
    const t = P.Templates.TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    P.Menus.closeAll();
    applySource(t.code);
    if (!P.Drawer.isOpen()) P.Drawer.open(false);
    toast(t.name + ' template loaded · Ctrl+Z to undo');
  }

  /* ── Settings ── */
  function applyMotion() {
    document.documentElement.dataset.motion = settings.anim ? '' : 'off';
  }
  function applyAllSettings() {
    applyTheme();
    P.Menus.buildThemes(settings.theme);
    applyGrid();
    setFont(settings.font);
    applyWrap();
    P.Minimap.setVisible(settings.minimap);
    applyMotion();
    if (ta.value.trim()) P.Render.render(ta.value);
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
      case 'setMinimap': settings.minimap = el.checked; P.Minimap.setVisible(settings.minimap); break;
      case 'setAutoClose': settings.autoClose = el.checked; break;
      default: return;
    }
    saveJSON(KEYS.settings, settings);
  }
  function resetSettings() {
    settings = { ...DEFAULT_SETTINGS };
    saveJSON(KEYS.settings, settings);
    P.Settings.populate(settings);
    applyAllSettings();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => toast('Fullscreen unavailable', 'err'));
    } else {
      document.exitFullscreen();
    }
  }

  /* ── Module wiring and boot ── */
  function wire() {
    P.View.init({
      stage: $('stage'), world: $('world'), zoomPct: $('zoomPct'), tbZoomLabel: $('tbZoomLabel')
    }, {
      animate: () => settings.anim,
      onTransform: () => { updateGrid(); P.Minimap.updateViewport(); }
    });
    P.Input.init({ stage: $('stage'), diagram }, {
      animate: () => settings.anim,
      onTap: (node) => (node ? P.Select.select(node) : P.Select.clear())
    });
    P.Minimap.init({ mini: $('minimap'), wrap: $('minimapWrap'), vp: $('minimapVp') }, {
      enabled: () => settings.minimap
    });
    P.Render.init({ diagram }, {
      onBusy: (on) => {
        clearTimeout(busyTimer);
        busyTimer = setTimeout(() => $('shimmer').classList.toggle('on', on), on ? 180 : 0);
      },
      onSuccess: ({ ms, nodes, el }) => {
        errLine = null;
        hideError();
        $('stRender').textContent = ms + ' ms';
        $('stNodes').textContent = nodes + ' nodes';
        setSyntax('ok', 'Valid syntax');
        refreshHighlight();
        refreshGutter();
        P.Minimap.updateViewport();
        idle(() => P.Minimap.renderImage(el));
        P.Live.afterRender();
      },
      onError: (msg, line) => {
        errLine = line;
        if (S.hasContent) diagram.classList.add('stale');
        showError(msg);
        setSyntax('err', line ? 'Syntax error · line ' + line : 'Syntax error');
        refreshHighlight();
        refreshGutter();
      },
      onEmpty: () => {
        S.hasContent = false;
        errLine = null;
        hideError();
        refreshHighlight();
        refreshGutter();
        setSyntax('', 'Empty');
        $('stNodes').textContent = '0 nodes';
        $('stRender').textContent = '— ms';
        emptyEl.hidden = false;
        $('shimmer').classList.remove('on');
      },
      onMounted: () => { P.Select.reset(); P.Minimap.computeLayout(); diagram.classList.remove('stale'); emptyEl.hidden = true; P.Style.afterRender(); P.Graph.refresh(); },
      transform: (s) => P.Style.apply(s), shouldFit: () => !P.Live.consumeKeepView() && settings.autoFit
    });
    P.Select.init(diagram);
    P.Editor.init(ta, {
      tabSize: () => settings.tab,
      autoClose: () => settings.autoClose,
      onChange: onEditorChanged,
      onFont: (d) => setFont(d ? settings.font + d : 13),
      onCursor: updateCursor
    });
    ta.addEventListener('scroll', syncScroll);
    P.Find.init({
      input: $('findInput'), replace: $('replaceInput'), count: $('findCount'), bar: $('findbar'),
      button: $('btnFind'), editor: ta, next: $('findNext'), prev: $('findPrev'), close: $('findClose'),
      replaceOneBtn: $('replaceOne'), replaceAllBtn: $('replaceAll')
    }, {
      onOpen: () => { if (!P.Drawer.isOpen()) P.Drawer.open(false); },
      onScrollLine: scrollToLine,
      onCursor: updateCursor,
      onReplace: (s, e, text) => P.Editor.replaceRange(s, e, text),
      onReplaceAll: (next, count) => { applySource(next); toast(count + ' replaced · Ctrl+Z to undo'); },
      onNoMatch: () => toast('No matches found', 'err')
    });
    P.Drawer.init({
      drawer: $('drawer'), head: $('drawerHead'), resize: $('resizeHandle'), stage: $('stage'),
      toggle: $('btnEditor'), closeBtn: $('btnDrawerClose'), pin: $('btnPin'), dock: $('btnDock')
    }, {
      getUI: () => ui,
      saveUI: () => saveJSON(KEYS.ui, ui),
      onClose: () => P.Menus.closeAll(),
      onFocus: () => ta.focus({ preventScroll: true }),
      onDockChange: (d) => toast('Editor docked: ' + d)
    });
    P.Files.init({
      open: $('btnOpen'), badge: $('watchBadge'), badgeName: $('watchName'), picker: $('filePicker'),
      dropOverlay: createDropOverlay(), editor: ta
    }, {
      setSource: applySource,
      setDocName,
      toast,
      onWatchChange: () => {}
    });
    P.Menus.init({
      themeBtn: $('btnTheme'), themeMenu: $('themeMenu'), exportBtn: $('btnExport'), exportMenu: $('exportMenu'),
      templateBtn: $('btnTemplates'), templateMenu: $('templateMenu')
    }, {
      onTheme: setTheme,
      onExport: (kind) => P.Export.run(kind),
      onTemplate: loadTemplate
    });
    P.Export.init({
      svg: () => diagram.querySelector('svg'),
      size: () => ({ w: S.contentW, h: S.contentH }),
      source: () => ta.value,
      baseName,
      toast,
      transparent: () => $('transparentBg').checked,
      canvasColor: () => getComputedStyle(document.documentElement).getPropertyValue('--canvas-a').trim() || '#0b0d10'
    });
    P.Settings.init({ onInput: onSettingsInput, onReset: resetSettings });
    $('btnSettings').addEventListener('click', () => { P.Menus.closeAll(); P.Settings.open(settings); });
    const stage = $('stage');
    P.Keys.init({
      toggleDrawer: () => P.Drawer.toggle(),
      closeDrawer: () => P.Drawer.close(),
      saveNow: () => { localStorage.setItem(KEYS.code, ta.value); toast('Saved to this browser'); },
      openFile: () => P.Files.openPicker(),
      openFind: () => P.Find.open(),
      findOpen: () => P.Find.isOpen(),
      closeFind: () => P.Find.close(),
      closeMenus: () => P.Menus.closeAll(),
      settingsOpen: () => P.Settings.isOpen(),
      zoomBy: (f) => P.View.zoomBy(f),
      fitView: () => P.View.fitView(false),
      oneToOne: () => P.View.oneToOne(),
      toggleFullscreen,
      setSpace: (on) => { P.Input.setSpace(on); stage.classList.toggle('space-down', on); },
      spaceTarget: (el) => el === document.body || el === stage
    });
    P.Toolbar.init({ zoomBy: P.View.zoomBy, fitView: P.View.fitView, oneToOne: P.View.oneToOne, toggleFullscreen });
    ['errorGoto', 'stSyntax'].forEach((id) => $(id).addEventListener('click', () => { if (errLine) goToLine(errLine); }));
    $('btnFind').addEventListener('click', () => P.Find.toggle());
    $('btnUndo').addEventListener('click', P.Editor.undo); $('btnRedo').addEventListener('click', P.Editor.redo);
    $('btnFontUp').addEventListener('click', () => setFont(settings.font + 1)); $('btnFontDown').addEventListener('click', () => setFont(settings.font - 1));
    $('btnWrap').addEventListener('click', () => { settings.wrap = !settings.wrap; applyWrap(); saveJSON(KEYS.settings, settings); });
    document.querySelectorAll('[data-sample]').forEach((b) => b.addEventListener('click', () => loadTemplate(b.dataset.sample)));
    window.addEventListener('resize', () => { P.Drawer.apply(); P.Minimap.updateViewport(); });
  }

  // Programmatic source change: update the editor and refresh lint/history,
  // since setValue does not fire a textarea 'input' event.
  function applySource(text) {
    P.Editor.setValue(text);
    P.Handoff.refresh();
  }

  function createDropOverlay() {
    const el = document.createElement('div');
    el.className = 'drop-overlay';
    el.hidden = true;
    el.textContent = 'Drop a .mmd, .md or .txt file';
    document.body.appendChild(el);
    return el;
  }

  function boot() {
    P.Icons.fillIcons();
    wire();
    applyTheme();
    P.Menus.buildThemes(settings.theme);
    P.Menus.buildTemplates(P.Templates.TEMPLATES);
    applyGrid();
    setFont(settings.font);
    applyWrap();
    P.Minimap.setVisible(settings.minimap);
    applyMotion();
    P.Drawer.apply();
    setDocName(docName);
    if (!P.Files.supportsFSA) $('btnOpen').dataset.tip = 'Open file';
    if (!window.mermaid) toast('Mermaid engine failed to load', 'err');
    P.Live.init({ editor: ta, diagram, setSource: applySource, setDocName, toast });
    const saved = localStorage.getItem(KEYS.code);
    ta.value = (saved === null || saved === P.Templates.LEGACY_DEFAULT) ? P.Templates.DEFAULT_CODE : saved;
    localStorage.setItem(KEYS.code, ta.value);
    applySource(ta.value);
    P.View.applyTransform();
    P.Render.render(ta.value);
  }

  boot();
})();
