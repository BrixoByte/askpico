/* Pico Viewer — editor drawer: open/close, dock (left/right/float), pin, resize, floating drag.
   Exports: window.PicoViewer.Drawer = { init(elements, hooks), apply(), open(focus), close(), toggle(), isOpen() }.
   Persists layout through hooks.saveUI(); reads/writes the `ui` object owned by the caller via hooks.getUI().
   hooks: getUI() -> ui, saveUI(), onClose() (close popovers), onDockChange(dockName).
   Depends on: nothing (DOM passed in). Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const mobile = window.matchMedia('(max-width: 720px)');
  let els = null;
  let hooks = {};

  function ui() { return hooks.getUI(); }

  function apply() {
    const u = ui();
    const isFloat = u.dock === 'float' && !mobile.matches;
    const isRight = u.dock === 'right' && !mobile.matches;
    els.drawer.classList.toggle('open', u.open);
    els.drawer.classList.toggle('dock-right', isRight);
    els.drawer.classList.toggle('dock-float', isFloat);
    els.head.classList.toggle('draggable', isFloat);
    els.drawer.inert = !u.open;
    document.documentElement.style.setProperty('--drawer-w', u.width + 'px');

    const d = els.drawer.style;
    if (isFloat) {
      d.left = u.floatX + 'px';
      d.top = u.floatY + 'px';
      d.right = 'auto';
      d.bottom = 'auto';
      d.height = Math.round(innerHeight * 0.72) + 'px';
    } else {
      d.left = d.top = d.right = d.bottom = d.height = '';
    }

    const pinAllowed = !isFloat && !mobile.matches;
    const pinned = u.pinned && u.open && pinAllowed;
    const offset = pinned ? u.width + 28 : 0;
    els.stage.style.left = !isRight ? offset + 'px' : '0px';
    els.stage.style.right = isRight ? offset + 'px' : '0px';

    els.pin.setAttribute('aria-pressed', String(pinned));
    els.pin.disabled = !pinAllowed;
    els.toggle.setAttribute('aria-expanded', String(u.open));
    els.toggle.setAttribute('aria-pressed', String(u.open));
    els.dock.dataset.tip = 'Dock: ' + u.dock;
  }

  function open(focus) {
    ui().open = true;
    apply();
    hooks.saveUI();
    if (focus && hooks.onFocus) hooks.onFocus();
  }

  function close() {
    const u = ui();
    if (!u.open) return;
    u.open = false;
    if (els.drawer.contains(document.activeElement)) els.toggle.focus();
    hooks.onClose();
    apply();
    hooks.saveUI();
  }

  function toggle() {
    if (ui().open) close(); else open(true);
  }

  function isOpen() {
    return ui().open;
  }

  function togglePin() {
    ui().pinned = !ui().pinned;
    apply();
    hooks.saveUI();
  }

  function cycleDock() {
    const u = ui();
    const order = ['left', 'right', 'float'];
    u.dock = order[(order.indexOf(u.dock) + 1) % order.length];
    apply();
    hooks.saveUI();
    if (hooks.onDockChange) hooks.onDockChange(u.dock);
  }

  // Drag the floating panel by its header; swipe down to close on mobile.
  function bindHeaderDrag() {
    els.head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const u = ui();
      if (mobile.matches) {
        const startY = e.clientY;
        const up = (ev) => {
          window.removeEventListener('pointerup', up);
          if (ev.clientY - startY > 70) close();
        };
        window.addEventListener('pointerup', up);
        return;
      }
      if (u.dock !== 'float') return;
      const offX = e.clientX - u.floatX;
      const offY = e.clientY - u.floatY;
      els.drawer.classList.add('dragging');
      const move = (ev) => {
        u.floatX = clamp(ev.clientX - offX, 0, innerWidth - 120);
        u.floatY = clamp(ev.clientY - offY, 0, innerHeight - 60);
        els.drawer.style.left = u.floatX + 'px';
        els.drawer.style.top = u.floatY + 'px';
      };
      const up = () => {
        els.drawer.classList.remove('dragging');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        hooks.saveUI();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }

  // Resize handle changes the drawer width.
  function bindResize() {
    const h = els.resize;
    h.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      h.setPointerCapture(e.pointerId);
      h.classList.add('active');
      els.stage.classList.add('resizing');
      const move = (ev) => {
        const u = ui();
        let w;
        if (u.dock === 'right') w = innerWidth - ev.clientX - 14;
        else if (u.dock === 'float') w = ev.clientX - u.floatX;
        else w = ev.clientX - 14;
        u.width = clamp(Math.round(w), 340, Math.min(720, innerWidth - 60));
        apply();
      };
      const up = () => {
        h.removeEventListener('pointermove', move);
        h.removeEventListener('pointerup', up);
        h.removeEventListener('pointercancel', up);
        h.classList.remove('active');
        els.stage.classList.remove('resizing');
        hooks.saveUI();
      };
      h.addEventListener('pointermove', move);
      h.addEventListener('pointerup', up);
      h.addEventListener('pointercancel', up);
    });
  }

  function init(elements, extraHooks) {
    els = elements;
    hooks = extraHooks || {};
    els.toggle.addEventListener('click', toggle);
    els.closeBtn.addEventListener('click', close);
    els.pin.addEventListener('click', togglePin);
    els.dock.addEventListener('click', cycleDock);
    bindHeaderDrag();
    bindResize();
    mobile.addEventListener('change', apply);
  }

  window.PicoViewer.Drawer = { init, apply, open, close, toggle, isOpen, mobile };
})();
