/* Pico Viewer — inline SVG icon set (Lucide-style, 1.75 stroke) and DOM filler.
   Exports: window.PicoViewer.Icons = { svgFor(name), fillIcons() }.
   fillIcons() replaces every [data-icon] element with its SVG.
   Depends on: nothing. Loaded before app.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  const ICONS = {
    panel: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16" cy="10" r="1.2"/><path d="M12 21a2 2 0 0 1 0-4h2a2 2 0 0 0 2-2"/>',
    minus: '<path d="M5 12h14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    fit: '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    fullscreen: '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    pin: '<path d="M12 17v5M5 9l2-6h10l2 6-3 3v3H8v-3z"/>',
    dock: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
    printer: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2"/><rect x="8" y="14" width="8" height="7"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    code: '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',
    layers: '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    chevronUp: '<path d="M18 15l-6-6-6 6"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    fontUp: '<path d="M3 18L8 6l5 12M5 14h6M17 9v6M14 12h6"/>',
    fontDown: '<path d="M3 18L8 6l5 12M5 14h6M14 12h6"/>',
    wrap: '<path d="M3 6h18M3 12h15a3 3 0 1 1 0 6h-4M13 16l-2 2 2 2M3 18h6"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-6 6-9 16-9 0 10-3 16-9 16z"/>',
    bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
    square: '<rect x="4" y="4" width="16" height="16" rx="2"/>'
  };

  function svgFor(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  function fillIcons() {
    document.querySelectorAll('[data-icon]').forEach((el) => {
      const t = document.createElement('template');
      t.innerHTML = svgFor(el.dataset.icon);
      el.replaceWith(t.content.firstElementChild);
    });
  }

  window.PicoViewer.Icons = { svgFor, fillIcons };
})();
