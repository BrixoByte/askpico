/* Pico Viewer - Style Studio UI: toolbar popover to pick a palette, toggle async animation and the legend.
   Per-diagram settings are saved through PicoViewer.Style.setSettings. Changes re-render the current source.
   Exports: window.PicoViewer.Studio = { init() }. Creates the toolbar button and the legend container at load.
   Depends on: style/engine.js, style/palettes.js, render/render.js, icons.js (data-icon fill). Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};
  const P = window.PicoViewer;
  const $ = (id) => document.getElementById(id);

  function menuHtml() {
    const s = P.Style.getSettings();
    const items = P.Style.palettes().map((p) =>
      '<button class="menu-item' + (p.id === s.palette ? ' current' : '') + '" role="menuitemradio" data-palette="' + p.id + '">' +
      '<span class="pal-sw">' + [0, 1, 2].map((i) => '<i style="background:hsl(' + p.hues[i % p.hues.length] + ' ' + p.sat + '% 60%)"></i>').join('') + '</span>' +
      p.name + '</button>').join('');
    return '<div class="menu-label">Palette</div>' + items +
      '<div class="menu-sep"></div>' +
      '<label class="menu-check"><input type="checkbox" id="stAnim"' + (s.animate ? ' checked' : '') + '> Animate async edges</label>' +
      '<label class="menu-check"><input type="checkbox" id="stLegend"' + (s.legend ? ' checked' : '') + '> Show legend</label>';
  }

  function rerender() {
    P.Render.render($('code').value);
  }

  function build() {
    const bar = document.querySelector('.toolbar');
    if (!bar) return;
    const wrap = document.createElement('div');
    wrap.className = 'menu-anchor';
    wrap.innerHTML = '<button class="icon-btn" id="btnStyle" aria-haspopup="menu" aria-expanded="false" data-tip="Style Studio" aria-label="Style Studio"><span data-icon="layers"></span></button>' +
      '<div class="popover style-menu" id="styleMenu" role="menu" hidden></div>';
    bar.appendChild(wrap);
    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.id = 'styleLegend';
    legend.hidden = true;
    $('stage').appendChild(legend);
    wire(wrap);
  }

  function wire(wrap) {
    const menu = $('styleMenu');
    const btn = $('btnStyle');
    btn.addEventListener('click', () => {
      const open = menu.hidden;
      if (open) menu.innerHTML = menuHtml();
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('[data-palette]');
      if (!b) return;
      P.Style.setSettings(null, { palette: b.dataset.palette });
      rerender();
      menu.innerHTML = menuHtml();
    });
    menu.addEventListener('change', (e) => {
      if (e.target.id === 'stAnim') P.Style.setSettings(null, { animate: e.target.checked });
      if (e.target.id === 'stLegend') P.Style.setSettings(null, { legend: e.target.checked });
      rerender();
    });
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { menu.hidden = true; btn.focus(); } });
  }

  window.PicoViewer.Studio = { init: build };
  build();
})();
