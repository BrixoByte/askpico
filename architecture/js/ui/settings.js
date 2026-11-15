/* Pico Viewer — settings modal: open/close, form population, focus trap, backdrop close.
   Exports: window.PicoViewer.Settings = { init(hooks), open(settings), close(), isOpen() }.
   hooks: onInput(event) for every form control change, onReset(), onClose() (optional).
   Depends on: nothing (DOM ids from index.html). Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  const $ = (id) => document.getElementById(id);
  const modal = $('settingsModal');
  let returnFocus = null;
  let hooks = {};

  function populate(s) {
    $('setGrid').value = s.grid;
    $('setTheme').value = s.theme;
    $('setFont').value = s.font;
    $('setFontOut').textContent = s.font;
    $('setDebounce').value = s.debounce;
    $('setDebounceOut').textContent = s.debounce;
    $('setTab').value = String(s.tab);
    $('setAutoFit').checked = s.autoFit;
    $('setAnim').checked = s.anim;
    $('setMinimap').checked = s.minimap;
    $('setAutoClose').checked = s.autoClose;
  }

  function isOpen() {
    return !modal.hidden;
  }

  function open(s) {
    populate(s);
    returnFocus = document.activeElement;
    modal.hidden = false;
    $('setGrid').focus();
  }

  function close() {
    modal.hidden = true;
    if (returnFocus && returnFocus.focus) returnFocus.focus();
    if (hooks.onClose) hooks.onClose();
  }

  function trapTab(e) {
    const items = [...modal.querySelectorAll('button, input, select')].filter((el) => !el.disabled);
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function init(extraHooks) {
    hooks = extraHooks || {};
    $('settingsClose').addEventListener('click', close);
    $('settingsDone').addEventListener('click', close);
    $('settingsReset').addEventListener('click', () => hooks.onReset());
    modal.addEventListener('pointerdown', (e) => { if (e.target === modal) close(); });
    modal.addEventListener('input', hooks.onInput);
    modal.addEventListener('change', hooks.onInput);
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key === 'Tab') trapTab(e);
    });
  }

  window.PicoViewer.Settings = { init, open, close, isOpen, populate };
})();
