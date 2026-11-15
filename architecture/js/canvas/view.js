/* Pico Viewer — canvas transform: eased zoom/pan target, cursor-anchored zoom, fit-to-view.
   Exports: window.PicoViewer.View = { init(hooks), setTarget, zoomAt, zoomBy, oneToOne, fitView,
   applyTransform, stageSize, requestTick }.
   Reads/writes: PicoViewer.State (view, target, anchor, contentW, contentH, hasContent).
   Depends on: state.js, geometry.js. Loaded before app.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const ZOOM_MIN = 0.08, ZOOM_MAX = 5, FIT_MAX = 2.5;
  const S = window.PicoViewer.State;
  let els = null;
  let hooks = { animate: () => true, onTransform: () => {} };
  let rafId = 0;

  function init(elements, extraHooks) {
    els = elements;
    Object.assign(hooks, extraHooks || {});
  }

  function stageSize() {
    return { w: els.stage.clientWidth, h: els.stage.clientHeight };
  }

  function near(a, b) {
    return Math.abs(a.x - b.x) < 0.05 && Math.abs(a.y - b.y) < 0.05 && Math.abs(a.s - b.s) < 0.0005;
  }

  function applyTransform() {
    const v = S.view;
    els.world.style.transform = 'translate3d(' + v.x + 'px, ' + v.y + 'px, 0) scale(' + v.s + ')';
    const pct = Math.round(v.s * 100) + '%';
    els.zoomPct.textContent = pct;
    els.tbZoomLabel.textContent = pct;
    hooks.onTransform();
  }

  function requestTick() {
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  // Eases the view toward the target. Cursor-anchored zoom keeps the anchor point fixed.
  function tick() {
    rafId = 0;
    const k = hooks.animate() ? 0.2 : 1;
    const v = S.view, t = S.target, a = S.anchor;
    if (a) {
      v.s += (t.s - v.s) * k;
      v.x = a.sx - a.wx * v.s;
      v.y = a.sy - a.wy * v.s;
      if (Math.abs(t.s - v.s) < 0.0005) { S.view = { ...t }; S.anchor = null; }
    } else if (near(v, t)) {
      S.view = { ...t };
    } else {
      v.x += (t.x - v.x) * k;
      v.y += (t.y - v.y) * k;
      v.s += (t.s - v.s) * k;
    }
    applyTransform();
    if (S.anchor || !near(S.view, S.target)) requestTick();
  }

  function setTarget(t, instant) {
    S.anchor = null;
    S.target = { ...t };
    if (instant) {
      S.view = { ...t };
      applyTransform();
    } else {
      requestTick();
    }
  }

  function zoomAt(cx, cy, factor, instant) {
    const t = S.target;
    const ns = clamp(t.s * factor, ZOOM_MIN, ZOOM_MAX);
    if (ns === t.s) return;
    const wx = (cx - t.x) / t.s;
    const wy = (cy - t.y) / t.s;
    if (instant) {
      S.anchor = null;
      S.view.s = ns;
      S.view.x = cx - wx * ns;
      S.view.y = cy - wy * ns;
      S.target = { ...S.view };
      applyTransform();
      return;
    }
    S.anchor = { wx, wy, sx: cx, sy: cy };
    S.target = { s: ns, x: cx - wx * ns, y: cy - wy * ns };
    requestTick();
  }

  function zoomBy(f) {
    const { w, h } = stageSize();
    zoomAt(w / 2, h / 2, f, false);
  }

  function oneToOne() {
    const { w, h } = stageSize();
    zoomAt(w / 2, h / 2, 1 / S.target.s, false);
  }

  function fitView(instant) {
    if (!S.hasContent || !S.contentW || !S.contentH) return;
    const { w, h } = stageSize();
    const fit = window.PicoViewer.Geometry.fitTransform(S.contentW, S.contentH, w, h,
      { fitMax: FIT_MAX, zoomMin: ZOOM_MIN, zoomMax: ZOOM_MAX });
    setTarget(fit, instant);
  }

  window.PicoViewer.View = {
    init, setTarget, zoomAt, zoomBy, oneToOne, fitView, applyTransform, stageSize, requestTick
  };
})();
