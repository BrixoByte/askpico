/* Pico Viewer — Mermaid syntax highlighting for the editor overlay.
   Pure string-to-HTML functions with no DOM access.
   Exports: window.PicoViewer.Highlight = { highlightLine(line) }.
   Depends on: nothing. Loaded before app.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  const KEYWORDS = '(?:flowchart|graph|subgraph|end|classDef|class|style|linkStyle|click|direction|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|mindmap|gitGraph|pie|journey|timeline|quadrantChart|requirementDiagram|participant|actor|title|section|dateFormat|axisFormat|note|loop|alt|else|opt|par|rect|activate|deactivate|autonumber|state|commit|branch|checkout|merge|cherry-pick|LR|RL|TB|TD|BT|accTitle|accDescr)';
  const TOKEN = new RegExp(
    '(%%.*)' +
    '|("[^"]*")' +
    '|((?:[ox])?[-=.]{2,}(?:&gt;|[ox])?)' +
    '|(\\|[^|]*\\|)' +
    '|(\\b\\d+(?:\\.\\d+)?\\b)' +
    '|(\\b' + KEYWORDS + '\\b)' +
    '|([\\[\\](){}])',
    'g'
  );
  const TOKEN_CLASS = ['c', 's', 'a', 'a', 'n', 'k', 'p'];

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlightLine(line) {
    return escHtml(line).replace(TOKEN, (m, ...groups) => {
      const idx = groups.slice(0, 7).findIndex((g) => g !== undefined);
      return idx === -1 ? m : '<span class="tok-' + TOKEN_CLASS[idx] + '">' + m + '</span>';
    });
  }

  window.PicoViewer.Highlight = { highlightLine };
})();
