/* Pico Viewer — shared mutable state for the canvas and render pipeline.
   Modules read and write fields on this single object (no module-level globals).
   Exports: window.PicoViewer.State = { view, target, anchor, contentW, contentH, hasContent, miniMap }.
   Depends on: nothing. Loaded first, before any other PicoViewer module. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  window.PicoViewer.State = {
    view: { x: 0, y: 0, s: 1 },
    target: { x: 0, y: 0, s: 1 },
    anchor: null,
    contentW: 0,
    contentH: 0,
    hasContent: false,
    miniMap: { mm: 1, ox: 0, oy: 0 }
  };
})();
