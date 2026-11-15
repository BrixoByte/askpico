/* Pico Viewer - live sync with serve.mjs (Mode B): diagram Explorer, autosave, SSE updates, conflict banner.
   Exports: window.PicoViewer.Live = { init(hooks) -> Promise<boolean>, onEdit(), afterRender(), consumeKeepView() }.
   Active only when /api/files responds (served by serve.mjs). Otherwise it stays inert.
   hooks: editor (textarea), diagram (SVG host), setSource(text), setDocName(name), toast(msg, type).
   Depends on: serve.mjs endpoints, state from editor/render modules via hooks. Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  const DEFAULT_FILE = 'pico-architecture.mmd';
  const FLASH_MS = 1500;
  let els = null;
  let hooks = {};
  let active = null;
  let synced = '';
  let saveTimer = null;
  let keepViewOnce = false;
  let pendingFlash = new Set();
  let select = null;
  let banner = null;

  const enc = encodeURIComponent;
  async function api(path, opts) {
    const r = await fetch(path, opts);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r;
  }
  const dirty = () => !!active && els.editor.value !== synced;

  function hashFile() {
    const m = location.hash.match(/file=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function fillSelect(files) {
    const current = active;
    select.innerHTML = files.map((f) => '<option value="' + f.name + '">' + f.name + '</option>').join('');
    if (current) select.value = current;
  }

  function changedIds(before, after) {
    const seen = new Set(before.split('\n'));
    const ids = new Set();
    after.split('\n').forEach((line) => {
      if (seen.has(line)) return;
      const re = /\b([A-Za-z_][\w-]*)(?=\s*[\[({])/g;
      let m;
      while ((m = re.exec(line))) ids.add(m[1]);
    });
    return ids;
  }

  function showBanner(diskText) {
    hideBanner();
    banner = document.createElement('div');
    banner.className = 'conflict-banner';
    banner.setAttribute('role', 'alert');
    banner.innerHTML = '<span>This file changed on disk while you have unsaved edits.</span>' +
      '<button class="chip-btn" data-act="mine">Keep mine</button>' +
      '<button class="chip-btn" data-act="disk">Load disk</button>';
    banner.addEventListener('click', (e) => {
      const act = e.target.dataset && e.target.dataset.act;
      if (act === 'mine') { hideBanner(); save(true).catch(reportError); }
      else if (act === 'disk') { hideBanner(); applyRemote(diskText); }
    });
    els.drawer.querySelector('.editor').before(banner);
  }

  function hideBanner() {
    if (banner) banner.remove();
    banner = null;
  }

  function applyRemote(text) {
    const before = synced;
    synced = text;
    keepViewOnce = true;
    hooks.setSource(text);
    pendingFlash = changedIds(before, text);
    hooks.toast('Updated from disk');
  }

  function reportError(err) {
    hooks.toast('Save failed: ' + err.message, 'err');
  }

  async function save(force) {
    if (!active || (!force && !dirty())) return;
    const text = els.editor.value;
    await api('/api/file?name=' + enc(active), { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: text });
    synced = text;
    window.PicoViewer.History.auto(active, text);
  }

  async function openFile(name) {
    if (active && dirty()) await save(false);
    const text = await (await api('/api/file?name=' + enc(name))).text();
    active = name;
    synced = text;
    hideBanner();
    hooks.setDocName(name);
    hooks.setSource(text);
    select.value = name;
    history.replaceState(null, '', '#file=' + enc(name));
  }

  async function syncActive() {
    if (!active) return;
    const disk = await (await api('/api/file?name=' + enc(active))).text();
    if (disk === synced) return;
    if (dirty()) showBanner(disk);
    else applyRemote(disk);
  }

  async function refreshList() {
    const files = await (await api('/api/files')).json();
    fillSelect(files);
    return files;
  }

  function onEdit() {
    if (!active) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(false).catch(reportError), 600);
  }

  function afterRender() {
    pendingFlash.forEach((id) => {
      els.diagram.querySelectorAll('g.node[id^="flowchart-' + id + '-"]').forEach((n) => {
        n.classList.add('flash');
        setTimeout(() => n.classList.remove('flash'), FLASH_MS);
      });
    });
    pendingFlash = new Set();
  }

  function consumeKeepView() {
    const v = keepViewOnce;
    keepViewOnce = false;
    return v;
  }

  async function init(extra) {
    hooks = extra || {};
    els = { editor: hooks.editor, diagram: hooks.diagram, drawer: document.getElementById('drawer') };
    let files;
    try {
      files = await (await api('/api/files')).json();
    } catch (err) {
      return false;
    }
    select = document.createElement('select');
    select.className = 'file-select';
    select.setAttribute('aria-label', 'Diagram file');
    select.addEventListener('change', () => openFile(select.value).catch(reportError));
    document.querySelector('.editor-bar').prepend(select);
    fillSelect(files);
    const want = hashFile() || DEFAULT_FILE;
    const start = files.find((f) => f.name === want) ? want : (files[0] && files[0].name);
    if (start) await openFile(start).catch(reportError);
    const es = new EventSource('/events');
    es.addEventListener('change', (e) => {
      const data = JSON.parse(e.data);
      fillSelect(data.files);
      syncActive().catch(() => {});
    });
    return true;
  }

  window.PicoViewer.Live = { init, onEdit, afterRender, consumeKeepView, refreshList };
})();
