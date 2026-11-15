/* Pico Viewer — code editor behaviour: undo/redo history, indent/comment, bracket auto-close, key handling.
   Exports: window.PicoViewer.Editor = { init(textarea, hooks), setValue(text), undo(), redo(),
   replaceRange(start, end, text, selStart?, selEnd?), snapshot() }.
   hooks: tabSize() -> number, autoClose() -> bool, onChange(), onFont(delta|0 reset), onCursor().
   Depends on: nothing (DOM textarea passed in). Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  let ta = null;
  let hooks = {};

  function notify(recordStep) {
    if (recordStep !== false) record(false);
    hooks.onChange();
  }
  const history = { stack: [], idx: 0, last: 0 };
  const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
  const CLOSERS = new Set([')', ']', '}', '"', "'", '`']);

  function snapshot() {
    return { v: ta.value, s: ta.selectionStart, e: ta.selectionEnd };
  }

  // Keystrokes within 600ms are grouped into one undo step.
  function record(force) {
    const now = Date.now();
    const snap = snapshot();
    if (!history.stack.length) {
      history.stack.push(snap);
      history.idx = 0;
    } else if (force || now - history.last > 600) {
      history.stack.splice(history.idx + 1);
      history.stack.push(snap);
      history.idx = history.stack.length - 1;
      if (history.stack.length > 300) { history.stack.shift(); history.idx--; }
    } else {
      history.stack[history.idx] = snap;
    }
    history.last = now;
  }

  function applySnapshot(s) {
    history.last = 0;
    ta.value = s.v;
    ta.setSelectionRange(s.s, s.e);
    notify(false);
  }

  function undo() {
    if (history.idx <= 0) return;
    history.idx--;
    applySnapshot(history.stack[history.idx]);
  }

  function redo() {
    if (history.idx >= history.stack.length - 1) return;
    history.idx++;
    applySnapshot(history.stack[history.idx]);
  }

  function setValue(v) {
    ta.value = v;
    ta.setSelectionRange(0, 0);
    ta.scrollTop = 0;
    record(true);
    notify(false);
  }

  function replaceRange(start, end, text, selStart, selEnd) {
    ta.setRangeText(text, start, end, 'preserve');
    const caret = start + text.length;
    ta.setSelectionRange(selStart ?? caret, selEnd ?? caret);
    notify(true);
  }

  function lineStartAt(v, p) { return p <= 0 ? 0 : v.lastIndexOf('\n', p - 1) + 1; }
  function lineEndAt(v, p) { const i = v.indexOf('\n', p); return i === -1 ? v.length : i; }
  const indentUnit = () => ' '.repeat(hooks.tabSize());

  function indentSelection() {
    const { selectionStart: s, selectionEnd: e, value: v } = ta;
    if (s === e) return replaceRange(s, e, indentUnit());
    const bs = lineStartAt(v, s), be = lineEndAt(v, e);
    const block = v.slice(bs, be).split('\n').map((l) => indentUnit() + l).join('\n');
    replaceRange(bs, be, block, bs, bs + block.length);
  }

  function outdentSelection() {
    const { selectionStart: s, selectionEnd: e, value: v } = ta;
    const bs = lineStartAt(v, s), be = lineEndAt(v, e);
    const re = new RegExp('^ {1,' + hooks.tabSize() + '}');
    const block = v.slice(bs, be).split('\n').map((l) => l.replace(re, '')).join('\n');
    replaceRange(bs, be, block, bs, bs + block.length);
  }

  function toggleComment() {
    const { selectionStart: s, selectionEnd: e, value: v } = ta;
    const bs = lineStartAt(v, s), be = lineEndAt(v, e);
    const lines = v.slice(bs, be).split('\n');
    const allCommented = lines.every((l) => l.trim() === '' || /^\s*%%/.test(l));
    const block = lines.map((l) => {
      if (l.trim() === '') return l;
      return allCommented ? l.replace(/^(\s*)%% ?/, '$1') : l.replace(/^(\s*)/, '$1%% ');
    }).join('\n');
    replaceRange(bs, be, block, bs, bs + block.length);
  }

  function autoIndentNewline() {
    const v = ta.value;
    const p = ta.selectionStart;
    const before = v.slice(lineStartAt(v, p), p);
    const base = before.match(/^[ \t]*/)[0];
    const trimmed = before.trim();
    const opens = /[[({]$/.test(trimmed) || /^(subgraph|loop|alt|opt|par|rect|critical|break|section)\b/.test(trimmed);
    replaceRange(p, ta.selectionEnd, '\n' + base + (opens ? indentUnit() : ''));
  }

  function autoCloseKey(k) {
    const v = ta.value;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const next = v.charAt(e), prev = v.charAt(s - 1);
    if (CLOSERS.has(k) && s === e && next === k) {
      ta.setSelectionRange(s + 1, s + 1);
      hooks.onCursor();
      return true;
    }
    if (!(k in PAIRS)) return false;
    if (s !== e) {
      replaceRange(s, e, k + v.slice(s, e) + PAIRS[k], s + 1, e + 1);
      return true;
    }
    const quote = k === '"' || k === "'" || k === '`';
    if (quote && (/\w/.test(prev) || prev === k)) return false;
    if (next && !/[\s)\]}>,;]/.test(next)) return false;
    replaceRange(s, e, k + PAIRS[k], s + 1, s + 1);
    return true;
  }

  function deletePair() {
    const v = ta.value, s = ta.selectionStart;
    if (!hooks.autoClose() || ta.selectionEnd !== s || s === 0) return false;
    const prev = v.charAt(s - 1);
    if (PAIRS[prev] && PAIRS[prev] === v.charAt(s)) {
      replaceRange(s - 1, s + 1, '', s - 1, s - 1);
      return true;
    }
    return false;
  }

  function onKeydown(e) {
    if (ta.readOnly) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (mod) {
      const lk = k.toLowerCase();
      if (lk === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((lk === 'z' && e.shiftKey) || lk === 'y') { e.preventDefault(); redo(); return; }
      if (k === '/') { e.preventDefault(); toggleComment(); return; }
      if (k === '=' || k === '+') { e.preventDefault(); hooks.onFont(1); return; }
      if (k === '-') { e.preventDefault(); hooks.onFont(-1); return; }
      if (k === '0') { e.preventDefault(); hooks.onFont(0); return; }
      return;
    }
    if (k === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) outdentSelection(); else indentSelection();
      return;
    }
    if (k === 'Enter') { e.preventDefault(); autoIndentNewline(); return; }
    if (k === 'Backspace') { if (deletePair()) e.preventDefault(); return; }
    if (hooks.autoClose() && k.length === 1 && !e.altKey && autoCloseKey(k)) e.preventDefault();
  }

  function init(textarea, extraHooks) {
    ta = textarea;
    hooks = extraHooks || {};
    ta.addEventListener('input', () => notify(true));
    ta.addEventListener('keydown', onKeydown);
    ['keyup', 'click', 'select', 'focus'].forEach((ev) => ta.addEventListener(ev, () => hooks.onCursor()));
    record(true);
  }

  window.PicoViewer.Editor = { init, setValue, undo, redo, replaceRange, snapshot };
})();
