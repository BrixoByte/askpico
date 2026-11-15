/* Pico Viewer - render-time colour palettes for the style engine (8 palettes).
   Each palette is a set of hues (one per semantic role, in order) and a saturation.
   Exports: window.PicoViewer.Palettes = { list, get(id) } where get falls back to the first palette.
   Pure data, no DOM. Loaded before style/engine.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  const list = [
    { id: 'pico', name: 'Pico lime', hues: [80, 200, 280, 35, 160, 330], sat: 60 },
    { id: 'ocean', name: 'Ocean', hues: [190, 205, 220, 170, 240, 160], sat: 60 },
    { id: 'sunset', name: 'Sunset', hues: [15, 30, 350, 45, 300, 5], sat: 65 },
    { id: 'forest', name: 'Forest', hues: [120, 95, 150, 80, 170, 60], sat: 50 },
    { id: 'mono', name: 'Monochrome', hues: [220], sat: 6 },
    { id: 'pastel', name: 'Pastel', hues: [200, 300, 40, 160, 260, 80], sat: 70 },
    { id: 'ember', name: 'Ember', hues: [10, 25, 0, 35, 50, 355], sat: 75 },
    { id: 'slate', name: 'Slate', hues: [215, 225, 235, 210, 245, 200], sat: 35 }
  ];

  const get = (id) => list.find((p) => p.id === id) || list[0];

  window.PicoViewer.Palettes = { list, get };
})();
