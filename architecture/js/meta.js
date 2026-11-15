/* Pico Viewer - Mermaid metadata parser.
   Reads %% comment conventions: title, description, owner, updated, @node annotations, and TODO markers.
   Exports: window.PicoViewer.Meta = { parse(source) -> { title, description, owner, updated, nodes, todos } }.
   nodes: { [id]: { line, role, desc, file, todo } }. Pure function, no DOM. Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  const HEADER_RE = /^%%\s*(title|description|owner|updated)\s*:\s*(.*)$/i;
  const NODE_RE = /^%%\s*@node\s+(\S+)\s*(.*)$/;
  const ATTR_RE = /(\w+)=(?:"([^"]*)"|(\S+))/g;
  const TODO_RE = /%%\s*TODO\b:?\s*(.*)$/i;

  function parseAttrs(text) {
    const out = {};
    let m;
    ATTR_RE.lastIndex = 0;
    while ((m = ATTR_RE.exec(text))) out[m[1]] = m[2] !== undefined ? m[2] : m[3];
    return out;
  }

  function parse(source) {
    const meta = { title: '', description: '', owner: '', updated: '', nodes: {}, todos: [] };
    String(source || '').split('\n').forEach((raw, i) => {
      const line = raw.trim();
      const lineNo = i + 1;
      let m = line.match(HEADER_RE);
      if (m) { meta[m[1].toLowerCase()] = m[2].trim(); return; }
      m = line.match(NODE_RE);
      if (m) {
        const todo = TODO_RE.exec(m[2]);
        const attrs = parseAttrs(m[2].replace(TODO_RE, ''));
        meta.nodes[m[1]] = Object.assign({ line: lineNo }, attrs, todo ? { todo: todo[1].trim() || 'confirm' } : {});
        return;
      }
      const todo = TODO_RE.exec(line);
      if (todo) meta.todos.push({ line: lineNo, text: todo[1].trim() || line });
    });
    return meta;
  }

  window.PicoViewer.Meta = { parse };
})();
