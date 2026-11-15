/* Pico Viewer - style engine: adds semantic role colours, tinted subgraphs, dashed async edges, and a legend.
   Styling is appended to the source only for rendering. The .mmd file is never changed, and lines are appended
   at the end so Mermaid error line numbers stay the same.
   Exports: window.PicoViewer.Style = { apply(source), afterRender(), getSettings(name), setSettings(name, patch),
   last() }. Per-diagram settings are stored under localStorage key 'pico-mermaid-style'.
   Depends on: style/palettes.js, meta.js, and the localStorage doc key 'pico-mermaid-doc'. Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};
  const P = window.PicoViewer;

  const KEY = 'pico-mermaid-style';
  const DOC_KEY = 'pico-mermaid-doc';
  const ROLE_ORDER = ['client', 'api', 'agent', 'llm', 'voice', 'memory', 'auth', 'db', 'client-state', 'safety', 'tool', 'artifact', 'async'];
  const ARROW_RE = /-->|-\.->|==>|---|-\.-|===/g;
  let lastRun = null;

  const isDark = () => document.documentElement.dataset.theme !== 'light';
  const currentName = () => localStorage.getItem(DOC_KEY) || 'diagram.mmd';
  const roleClass = (role) => 'role' + String(role).replace(/[^a-z0-9]/gi, '');

  function loadAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function getSettings(name) {
    return Object.assign({ palette: 'pico', animate: true, legend: true }, loadAll()[name || currentName()] || {});
  }
  function setSettings(name, patch) {
    const all = loadAll();
    all[name || currentName()] = Object.assign(getSettings(name), patch);
    localStorage.setItem(KEY, JSON.stringify(all));
  }

  // Mermaid's style/classDef grammar only accepts simple colour tokens (hex or rgb(...)), not hsl().
  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
    const p = (n) => f(n).toString(16).padStart(2, '0');
    return '#' + p(0) + p(8) + p(4);
  }
  const H = (hue, sat, light) => hslToHex(hue, sat, light);

  function colors(hue, sat, tint) {
    const dark = isDark();
    if (tint) return dark
      ? { fill: H(hue, sat * 0.25, 13), stroke: H(hue, sat * 0.5, 35) }
      : { fill: H(hue, sat * 0.3, 96), stroke: H(hue, sat * 0.5, 70) };
    return dark
      ? { fill: H(hue, sat, 20), stroke: H(hue, sat, 60), color: '#eef1f6' }
      : { fill: H(hue, sat, 92), stroke: H(hue, sat, 40), color: '#1c1d21' };
  }

  function hueFor(pal, role) {
    const i = ROLE_ORDER.indexOf(role);
    return pal.hues[(i < 0 ? ROLE_ORDER.length : i) % pal.hues.length];
  }

  function swatch(role, name) {
    const pal = P.Palettes.get(getSettings(name).palette);
    return colors(hueFor(pal, role), pal.sat);
  }

  function dashedEdgeIndexes(source) {
    const out = [];
    let edge = 0;
    source.split('\n').forEach((line) => {
      if (/^\s*%%/.test(line)) return;
      const count = (line.match(ARROW_RE) || []).length;
      if (count && /async|stream/i.test(line)) for (let i = 0; i < count; i++) out.push(edge + i);
      edge += count;
    });
    return out;
  }

  function apply(source) {
    const name = currentName();
    const s = getSettings(name);
    const pal = P.Palettes.get(s.palette);
    const meta = P.Meta.parse(source);
    const roles = [];
    const byRole = {};
    Object.entries(meta.nodes).forEach(([id, n]) => {
      if (!n.role) return;
      if (!byRole[n.role]) { byRole[n.role] = []; roles.push(n.role); }
      byRole[n.role].push(id);
    });
    const lines = [];
    roles.forEach((role) => {
      const c = colors(hueFor(pal, role), pal.sat);
      lines.push(`classDef ${roleClass(role)} fill:${c.fill},stroke:${c.stroke},color:${c.color},stroke-width:1.5px`);
      lines.push(`class ${byRole[role].join(',')} ${roleClass(role)}`);
    });
    const subs = [...source.matchAll(/^\s*subgraph\s+(\w+)/gm)].map((m) => m[1]);
    subs.forEach((id, i) => {
      const c = colors(pal.hues[i % pal.hues.length], pal.sat, true);
      lines.push(`style ${id} fill:${c.fill},stroke:${c.stroke}`);
    });
    const dashed = s.animate ? dashedEdgeIndexes(source) : [];
    if (dashed.length) lines.push(`linkStyle ${dashed.join(',')} stroke-dasharray:6 4`);
    lastRun = { name, roles, subs, dashed: dashed.length > 0, palette: pal.name, legend: s.legend };
    return source.replace(/\s*$/, '\n') + lines.join('\n') + '\n';
  }

  function safeApply(source) {
    try { return apply(source); } catch (err) { lastRun = null; return source; }
  }

  function afterRender() {
    const el = document.getElementById('styleLegend');
    if (!el) return;
    if (!lastRun || !lastRun.legend) { el.hidden = true; return; }
    el.hidden = false;
    const rows = lastRun.roles.map((role) => {
      const c = swatch(role, lastRun.name);
      return `<div class="lg-row"><span class="lg-sw" style="background:${c.stroke}"></span>${role}</div>`;
    });
    if (lastRun.dashed) rows.push('<div class="lg-row"><span class="lg-dash"></span>async / stream</div>');
    el.innerHTML = '<div class="lg-title">Legend</div>' + (rows.join('') || '<div class="lg-row">No @node roles</div>');
  }

  P.Style = {
    apply: safeApply,
    afterRender,
    getSettings,
    setSettings,
    swatch,
    last: () => lastRun,
    palettes: () => P.Palettes.list
  };
})();
