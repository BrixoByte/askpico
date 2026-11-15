/* Pico Viewer — canvas pointer, wheel, touch, and inertia input.
   Exports: window.PicoViewer.Input = { init(elements, hooks), setSpace(bool) }.
   hooks: animate() -> bool, onTap(node|null) for click-without-drag.
   Reads/writes: PicoViewer.State. Calls: PicoViewer.View.
   Depends on: state.js, view.js. Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  const S = window.PicoViewer.State;
  const V = window.PicoViewer.View;
  const UI_SKIP = '.toolbar, .zoom-dock, .minimap, .empty-state, .error-card, .popover, .modal-backdrop, .drawer, .drawer-resize';
  const pointers = new Map();
  let els = null;
  let hooks = { animate: () => true, onTap: () => {} };
  let pan = null, pinch = null, spaceDown = false, inertia = null, inertiaRaf = 0;

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
    S.view.x += inertia.vx;
    S.view.y += inertia.vy;
    S.target = { ...S.view };
    S.anchor = null;
    V.applyTransform();
    inertiaRaf = requestAnimationFrame(stepInertia);
  }

  function onPointerDown(e) {
    if (e.target.closest(UI_SKIP)) return;
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    els.stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { dist: dist(a, b), mid: midOf(a, b) };
      pan = null;
      return;
    }
    stopInertia();
    const node = !spaceDown && els.diagram.contains(e.target) ? e.target.closest('g.node') : null;
    pan = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, samples: [], node };
    els.stage.classList.add('grabbing');
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const rect = els.stage.getBoundingClientRect();
      const m = midOf(a, b);
      V.zoomAt(pinch.mid.x - rect.left, pinch.mid.y - rect.top, dist(a, b) / pinch.dist, true);
      S.view.x += m.x - pinch.mid.x;
      S.view.y += m.y - pinch.mid.y;
      S.target = { ...S.view };
      V.applyTransform();
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
      S.anchor = null;
      S.view.x += dx;
      S.view.y += dy;
      S.target = { ...S.view };
      V.applyTransform();
    }
  }

  function onPointerEnd(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pinch && pointers.size < 2) pinch = null;
    if (!pan || pan.id !== e.pointerId) return;
    els.stage.classList.remove('grabbing');
    if (pan.moved <= 3) {
      hooks.onTap(pan.node);
    } else if (hooks.animate()) {
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
  }

  function onWheel(e) {
    if (e.target.closest(UI_SKIP)) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : 1;
    const dy = e.deltaY * unit;
    if (e.shiftKey && !e.ctrlKey) {
      S.anchor = null;
      S.view.x -= dy;
      S.target = { ...S.view };
      V.applyTransform();
      return;
    }
    const rect = els.stage.getBoundingClientRect();
    V.zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), false);
  }

  function onDblClick(e) {
    if (e.target.closest(UI_SKIP + ', g.node')) return;
    V.fitView(false);
  }

  function setSpace(on) {
    spaceDown = on;
  }

  function init(elements, extraHooks) {
    els = elements;
    Object.assign(hooks, extraHooks || {});
    const stage = els.stage;
    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerEnd);
    stage.addEventListener('pointercancel', onPointerEnd);
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('dblclick', onDblClick);
  }

  window.PicoViewer.Input = { init, setSpace };
})();
