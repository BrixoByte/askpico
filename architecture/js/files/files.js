/* Pico Viewer — file handling: open via File System Access API (live watch), file input fallback, drag-and-drop.
   Exports: window.PicoViewer.Files = { init(elements, hooks), openPicker(), loadFile(file), stopWatch(silent) }.
   hooks: setSource(text), setDocName(name), toast(msg, type), onWatchChange(active, name).
   Depends on: nothing (DOM passed in). Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  const supportsFSA = typeof window.showOpenFilePicker === 'function';
  let els = null;
  let hooks = {};
  let fileHandle = null, lastMod = 0, watchTimer = null;

  function extractMermaid(text) {
    const m = text.match(/```mermaid\s*\n([\s\S]*?)```/);
    return m ? m[1].trim() + '\n' : text;
  }

  function setWatching(active, name) {
    els.editor.readOnly = active;
    els.badge.hidden = !active;
    if (active) els.badgeName.textContent = 'Watching ' + name;
    hooks.onWatchChange(active, name);
  }

  function stopWatch(silent) {
    clearInterval(watchTimer);
    watchTimer = null;
    if (!fileHandle) return;
    fileHandle = null;
    setWatching(false);
    if (!silent) hooks.toast('Stopped watching');
  }

  async function syncFile() {
    if (!fileHandle) return;
    try {
      const file = await fileHandle.getFile();
      if (file.lastModified === lastMod) return;
      lastMod = file.lastModified;
      hooks.setSource(extractMermaid(await file.text()));
    } catch (err) {
      stopWatch(true);
      hooks.toast('Watch stopped: ' + err.message, 'err');
    }
  }

  async function startWatch(handle) {
    stopWatch(true);
    fileHandle = handle;
    lastMod = 0;
    hooks.setDocName(handle.name);
    setWatching(true, handle.name);
    await syncFile();
    watchTimer = setInterval(syncFile, 800);
    hooks.toast('Watching ' + handle.name + ' · click the badge to stop');
  }

  async function loadFile(file) {
    stopWatch(true);
    try {
      const text = await file.text();
      hooks.setDocName(file.name);
      hooks.setSource(extractMermaid(text));
      hooks.toast('Opened ' + file.name);
    } catch (err) {
      hooks.toast('Could not read file', 'err');
    }
  }

  async function openPicker() {
    if (!supportsFSA) { els.picker.click(); return; }
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Mermaid diagram', accept: { 'text/plain': ['.mmd', '.mermaid', '.md', '.txt'] } }],
        multiple: false
      });
      await startWatch(handle);
    } catch (err) {
      if (err.name !== 'AbortError') hooks.toast('Open failed: ' + err.message, 'err');
    }
  }

  function bindDrop() {
    const overlay = els.dropOverlay;
    let depth = 0;
    const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
    window.addEventListener('dragenter', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      overlay.hidden = false;
    });
    window.addEventListener('dragover', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    window.addEventListener('dragleave', (e) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) overlay.hidden = true;
    });
    window.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      overlay.hidden = true;
      const f = e.dataTransfer.files[0];
      if (f) loadFile(f);
    });
  }

  function init(elements, extraHooks) {
    els = elements;
    hooks = extraHooks || {};
    els.open.addEventListener('click', openPicker);
    els.badge.addEventListener('click', () => stopWatch(false));
    els.picker.addEventListener('change', (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (f) loadFile(f);
    });
    bindDrop();
  }

  window.PicoViewer.Files = { init, openPicker, loadFile, stopWatch, supportsFSA };
})();
