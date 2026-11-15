/* Pico Viewer - version snapshots (last 20 per file) and line diff.
   Exports: window.PicoViewer.History = { list(name), take(name, text, label), auto(name, text), diff(a, b), MAX }.
   Storage: localStorage key 'pico-mermaid-snapshots' = { [file]: [{ t, label, text }] }, newest first.
   auto() takes at most one snapshot per 60 s per file and skips identical text.
   Pure data logic, no DOM. Loaded before handoff/panel.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  const KEY = 'pico-mermaid-snapshots';
  const MAX = 20;
  const AUTO_MS = 60000;
  const lastAuto = {};

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(all) {
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* storage full or unavailable */ }
  }

  function list(name) {
    return load()[name] || [];
  }

  function take(name, text, label) {
    const all = load();
    const arr = all[name] || [];
    if (arr[0] && arr[0].text === text) return false;
    arr.unshift({ t: Date.now(), label: label || 'Snapshot', text });
    all[name] = arr.slice(0, MAX);
    save(all);
    return true;
  }

  function auto(name, text) {
    const now = Date.now();
    if (now - (lastAuto[name] || 0) < AUTO_MS) return false;
    lastAuto[name] = now;
    return take(name, text, 'Auto');
  }

  // Longest-common-subsequence line diff. Falls back to a full replace for very large inputs.
  function diff(a, b) {
    const A = String(a).split('\n');
    const B = String(b).split('\n');
    if (A.length * B.length > 4e6) {
      return A.map((t) => ({ type: 'del', text: t })).concat(B.map((t) => ({ type: 'add', text: t })));
    }
    const n = A.length, m = B.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const out = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { out.push({ type: 'eq', text: A[i] }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: 'del', text: A[i] }); i++; }
      else { out.push({ type: 'add', text: B[j] }); j++; }
    }
    while (i < n) out.push({ type: 'del', text: A[i++] });
    while (j < m) out.push({ type: 'add', text: B[j++] });
    return out;
  }

  window.PicoViewer.History = { list, take, auto, diff, MAX };
})();
