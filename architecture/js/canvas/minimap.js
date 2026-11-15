/* Pico Viewer — minimap: bitmap preview of the diagram, viewport box, click/drag to navigate.
   Exports: window.PicoViewer.Minimap = { init(elements, hooks), computeLayout(), renderImage(svgEl),
   updateViewport(), setVisible(bool) }.
   hooks: enabled() -> bool (the minimap setting).
   Reads/writes: PicoViewer.State (miniMap, contentW, contentH, view, hasContent).
   Depends on: state.js, geometry.js, view.js. Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  const S = window.PicoViewer.State;
  const V = window.PicoViewer.View;
  let els = null;
  let hooks = { enabled: () => true };
  let miniCtx = null;
  let miniDrag = false;

  function computeLayout() {
    S.miniMap = window.PicoViewer.Geometry.minimapLayout(els.mini.width, els.mini.height, S.contentW, S.contentH);
  }

  function renderImage(svgEl) {
    if (!hooks.enabled() || !svgEl) return;
    const xml = new XMLSerializer().serializeToString(svgEl);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const m = S.miniMap;
      const c = document.createElement('canvas');
      c.width = els.mini.width;
      c.height = els.mini.height;
      c.getContext('2d').drawImage(img, m.ox, m.oy, S.contentW * m.mm, S.contentH * m.mm);
      miniCtx.clearRect(0, 0, els.mini.width, els.mini.height);
      miniCtx.drawImage(c, 0, 0);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  function updateViewport() {
    if (!S.hasContent || !hooks.enabled()) return;
    const { mm, ox, oy } = S.miniMap;
    const { w, h } = V.stageSize();
    const v = S.view;
    els.vp.style.left = (ox - v.x / v.s * mm) + 'px';
    els.vp.style.top = (oy - v.y / v.s * mm) + 'px';
    els.vp.style.width = (w / v.s * mm) + 'px';
    els.vp.style.height = (h / v.s * mm) + 'px';
  }

  function setVisible(on) {
    els.wrap.classList.toggle('hidden', !on);
    if (on) updateViewport();
  }

  function centerAt(e, instant) {
    const r = els.wrap.getBoundingClientRect();
    const m = S.miniMap;
    const mx = (e.clientX - r.left) * (els.mini.width / r.width);
    const my = (e.clientY - r.top) * (els.mini.height / r.height);
    const wx = (mx - m.ox) / m.mm;
    const wy = (my - m.oy) / m.mm;
    const { w, h } = V.stageSize();
    V.setTarget({ s: S.view.s, x: w / 2 - wx * S.view.s, y: h / 2 - wy * S.view.s }, instant);
  }

  function bind() {
    els.wrap.addEventListener('pointerdown', (e) => {
      if (!S.hasContent) return;
      miniDrag = true;
      els.wrap.setPointerCapture(e.pointerId);
      centerAt(e, false);
    });
    els.wrap.addEventListener('pointermove', (e) => { if (miniDrag) centerAt(e, true); });
    const end = () => { miniDrag = false; };
    els.wrap.addEventListener('pointerup', end);
    els.wrap.addEventListener('pointercancel', end);
  }

  function init(elements, extraHooks) {
    els = elements;
    Object.assign(hooks, extraHooks || {});
    miniCtx = els.mini.getContext('2d');
    bind();
  }

  window.PicoViewer.Minimap = { init, computeLayout, renderImage, updateViewport, setVisible };
})();
