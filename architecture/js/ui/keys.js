/* Pico Viewer — global keyboard shortcuts (outside the editor textarea).
   Exports: window.PicoViewer.Keys = { init(hooks) }.
   hooks: toggleDrawer(), closeDrawer(), saveNow(), openFile(), openFind(), findOpen() -> bool,
   closeFind(), closeMenus() -> bool, settingsOpen() -> bool, zoomBy(f), fitView(), oneToOne(),
   toggleFullscreen(), setSpace(bool), spaceTarget(el) -> bool.
   Depends on: nothing. Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  const isTyping = (el) => !!(el && el.closest && el.closest('input, textarea, select, [contenteditable="true"]'));

  function init(h) {
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const lk = e.key.toLowerCase();
      if (mod && lk === 'e') { e.preventDefault(); h.toggleDrawer(); return; }
      if (mod && lk === 's') { e.preventDefault(); h.saveNow(); return; }
      if (mod && lk === 'o') { e.preventDefault(); h.openFile(); return; }
      if (mod && lk === 'f') { e.preventDefault(); h.openFind(); return; }
      if (e.key === 'Escape') {
        if (h.settingsOpen()) return;
        if (h.closeMenus()) return;
        if (h.findOpen()) { h.closeFind(); return; }
        h.closeDrawer();
        return;
      }
      if (mod || e.altKey || isTyping(e.target) || h.settingsOpen()) return;
      if (e.key === ' ' && h.spaceTarget(e.target)) {
        h.setSpace(true);
        e.preventDefault();
        return;
      }
      if (e.key === '+' || e.key === '=') h.zoomBy(1.25);
      else if (e.key === '-') h.zoomBy(0.8);
      else if (e.key === '0') h.fitView();
      else if (e.key === '1') h.oneToOne();
      else if (lk === 'f') h.toggleFullscreen();
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === ' ') h.setSpace(false);
    });
    window.addEventListener('blur', () => h.setSpace(false));
  }

  window.PicoViewer.Keys = { init };
})();
