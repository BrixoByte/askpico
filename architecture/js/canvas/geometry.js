/* Pico Viewer — pure canvas geometry: fit-to-view transform and minimap layout.
   No DOM or shared state; every input is passed in.
   Exports: window.PicoViewer.Geometry = { fitTransform, minimapLayout }.
   Depends on: nothing. Loaded before app.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // Returns the { s, x, y } view that centres a content box inside a stage of size w x h.
  function fitTransform(contentW, contentH, w, h, limits) {
    const padX = 56, padTop = 84, padBottom = 96;
    const availH = h - padTop - padBottom;
    const s = clamp(Math.min((w - padX * 2) / contentW, availH / contentH, limits.fitMax), limits.zoomMin, limits.zoomMax);
    return {
      s,
      x: (w - contentW * s) / 2,
      y: padTop + (availH - contentH * s) / 2
    };
  }

  // Returns the scale and offset that fit a content box inside a minimap canvas of size W x H.
  function minimapLayout(W, H, contentW, contentH) {
    const pad = 10;
    const mm = Math.min((W - pad * 2) / contentW, (H - pad * 2) / contentH);
    return { mm, ox: (W - contentW * mm) / 2, oy: (H - contentH * mm) / 2 };
  }

  window.PicoViewer.Geometry = { fitTransform, minimapLayout };
})();
