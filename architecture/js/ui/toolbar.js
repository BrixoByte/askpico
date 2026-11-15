/* Pico Viewer — floating toolbar and zoom-dock buttons: zoom in/out, fit, 1:1, fullscreen.
   Exports: window.PicoViewer.Toolbar = { init(hooks) }.
   hooks: zoomBy(factor), fitView(), oneToOne(), toggleFullscreen().
   Depends on: nothing (DOM ids from index.html). Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  const $ = (id) => document.getElementById(id);

  function init(h) {
    $('tbZoomIn').addEventListener('click', () => h.zoomBy(1.25));
    $('zoomIn').addEventListener('click', () => h.zoomBy(1.25));
    $('tbZoomOut').addEventListener('click', () => h.zoomBy(0.8));
    $('zoomOut').addEventListener('click', () => h.zoomBy(0.8));
    $('tbFit').addEventListener('click', () => h.fitView());
    $('zoomFit').addEventListener('click', () => h.fitView());
    $('tbZoomLabel').addEventListener('click', h.oneToOne);
    $('zoomActual').addEventListener('click', h.oneToOne);
    $('btnFullscreen').addEventListener('click', h.toggleFullscreen);
    document.addEventListener('fullscreenchange', () =>
      $('btnFullscreen').setAttribute('aria-pressed', String(!!document.fullscreenElement)));
  }

  window.PicoViewer.Toolbar = { init };
})();
