/* Pico Viewer — render pipeline: runs the Mermaid engine, mounts the SVG, and reports results.
   Exports: window.PicoViewer.Render = { init(elements, hooks), initEngine(theme), render(source),
   mountSvg(svgText) }.
   hooks: onBusy(bool), onSuccess({ ms, nodes, el }), onError(msg, line), onEmpty(), onMounted(),
   shouldFit() -> bool, firstRender() -> bool (fit instantly on the first render).
   Reads/writes: PicoViewer.State (contentW, contentH, hasContent).
   Depends on: state.js, view.js, global `mermaid` (bundled engine, used as a black box). Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  const S = window.PicoViewer.State;
  const V = window.PicoViewer.View;
  const MERMAID_THEME = { dark: 'dark', midnight: 'dark', forest: 'forest', neutral: 'neutral', light: 'default' };
  let els = null;
  let hooks = {};
  let seq = 0;
  let timer = null;
  let firstDone = false;

  function initEngine(theme) {
    if (!window.mermaid) return;
    mermaid.initialize({
      startOnLoad: false,
      theme: MERMAID_THEME[theme] || 'dark',
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, sans-serif',
      flowchart: { htmlLabels: false, curve: 'basis', padding: 16 }
    });
  }

  function mountSvg(svgText) {
    els.diagram.innerHTML = svgText;
    const el = els.diagram.querySelector('svg');
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
    els.diagram.style.width = w + 'px';
    els.diagram.style.height = h + 'px';
    S.contentW = w;
    S.contentH = h;
    if (hooks.onMounted) hooks.onMounted();
    return el;
  }

  async function render(source) {
    const id = ++seq;
    if (!source.trim()) {
      els.diagram.innerHTML = '';
      S.hasContent = false;
      hooks.onEmpty();
      return;
    }
    if (!window.mermaid) {
      hooks.onError('Mermaid engine not loaded', null);
      return;
    }
    const t0 = performance.now();
    hooks.onBusy(true);
    try {
      const { svg } = await mermaid.render('pico-graph-' + id, hooks.transform ? hooks.transform(source) : source);
      if (id !== seq) return;
      const el = mountSvg(svg);
      S.hasContent = true;
      els.diagram.classList.remove('stale', 'enter');
      void els.diagram.offsetWidth;
      els.diagram.classList.add('enter');
      if (!firstDone || hooks.shouldFit()) V.fitView(!firstDone);
      firstDone = true;
      const nodes = els.diagram.querySelectorAll('.node, .actor, .classGroup, .entityBox, .statediagram-state').length;
      hooks.onSuccess({ ms: Math.round(performance.now() - t0), nodes, el });
    } catch (err) {
      if (id !== seq) return;
      const stray = document.getElementById('dpico-graph-' + id);
      if (stray) stray.remove();
      const msg = String((err && err.message) || err).trim();
      const m = msg.match(/line\s+(\d+)/i);
      if (S.hasContent) els.diagram.classList.add('stale');
      hooks.onError(msg, m ? parseInt(m[1], 10) : null);
    } finally {
      if (id === seq) hooks.onBusy(false);
    }
  }

  function schedule(source, delay) {
    clearTimeout(timer);
    timer = setTimeout(() => render(source), delay);
  }

  function init(elements, extraHooks) {
    els = elements;
    hooks = extraHooks || {};
  }

  window.PicoViewer.Render = { init, initEngine, render, mountSvg, schedule };
})();
