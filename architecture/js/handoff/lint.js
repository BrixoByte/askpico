/* Pico Viewer - diagram lint: checks metadata and @node annotations against the Mermaid source.
   Pure functions, no DOM. Exports: window.PicoViewer.Lint = { run(source) -> [{ line, severity, msg }], fixPrompt(opts) }.
   severity: 'error' | 'warn' | 'info'. Rules follow diagrams/AGENTS.md.
   Depends on: meta.js. Loaded before handoff/panel.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};
  const P = window.PicoViewer;

  const DIAGRAM_RE = /^\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey)\b/m;
  const DECL_RE = /^\s*([A-Za-z_][\w-]*)\s*[\[({]/;
  const NODE_ANN_RE = /^\s*%%\s*@node\s+(\S+)/;
  const KEYWORDS = new Set(['subgraph', 'end', 'classDef', 'class', 'style', 'linkStyle', 'click', 'direction']);

  function run(source) {
    const issues = [];
    const add = (line, severity, msg) => issues.push({ line, severity, msg });
    const lines = String(source || '').split('\n');
    const meta = P.Meta.parse(source);
    const code = lines.filter((l) => !/^\s*%%/.test(l));
    const body = code.join('\n');

    if (!body.trim()) { add(1, 'error', 'Diagram is empty'); return issues; }
    if (!DIAGRAM_RE.test(body)) add(1, 'error', 'Missing diagram type line (for example: flowchart LR)');
    if (!meta.title) add(1, 'info', 'Missing %% title header');
    if (!meta.description) add(1, 'info', 'Missing %% description header');

    const declared = new Map();
    const annotated = new Map();
    lines.forEach((line, i) => {
      const ann = line.match(NODE_ANN_RE);
      if (ann) {
        if (annotated.has(ann[1])) add(i + 1, 'error', 'Duplicate @node ' + ann[1]);
        annotated.set(ann[1], i + 1);
        return;
      }
      if (/^\s*%%/.test(line) || /^\s*subgraph\b/.test(line)) return;
      const re = new RegExp(DECL_RE.source.replace('^\\s*', ''), 'g');
      const bare = line.replace(/"[^"]*"/g, '""');
      let d;
      while ((d = re.exec(bare))) { if (!KEYWORDS.has(d[1])) declared.set(d[1], i + 1); }
    });

    declared.forEach((line, id) => {
      if (!annotated.has(id)) add(line, 'warn', 'Node ' + id + ' has no @node annotation');
    });
    Object.entries(meta.nodes).forEach(([id, n]) => {
      if (!declared.has(id)) add(n.line, 'warn', '@node ' + id + ' does not match any node in the diagram');
      if (!n.role) add(n.line, 'warn', '@node ' + id + ' is missing role=');
      if (!n.file) add(n.line, 'warn', '@node ' + id + ' is missing file=');
      if (n.todo) add(n.line, 'info', 'Open question on ' + id + ': ' + n.todo);
    });
    meta.todos.forEach((t) => add(t.line, 'info', 'TODO: ' + t.text));

    return issues.sort((a, b) => a.line - b.line);
  }

  function fixPrompt(o) {
    const issues = (o.issues || []).filter((i) => i.severity !== 'info').map((i) => '- line ' + i.line + ': ' + i.msg);
    return [
      'Fix this Mermaid diagram in the Pico architecture viewer (file: ' + (o.name || 'diagram.mmd') + ').',
      '',
      o.error ? 'Render error' + (o.errorLine ? ' (line ' + o.errorLine + ')' : '') + ': ' + o.error : 'The diagram has no render error. Fix the lint issues below.',
      '',
      issues.length ? 'Lint issues:\n' + issues.join('\n') : 'No lint issues.',
      '',
      'Rules:',
      '- Keep existing node IDs. Do not rename them.',
      '- Follow diagrams/AGENTS.md. Keep the %% title, %% description, %% owner, and %% updated headers.',
      '- Use only facts from the repo. Mark unknowns with %% TODO: confirm.',
      '- Do not add classDef or style lines.',
      '- Return the full corrected .mmd file.',
      '',
      '```mermaid',
      o.source || '',
      '```'
    ].join('\n');
  }

  window.PicoViewer.Lint = { run, fixPrompt };
})();
