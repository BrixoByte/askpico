/* Pico Viewer — find and replace bar for the code editor.
   Exports: window.PicoViewer.Find = { init(elements, hooks), open(), close(), toggle(), isOpen() }.
   hooks: onOpen() (ensure the drawer is visible), onScrollLine(n), onCursor(), onReplace(start, end, text).
   Depends on: nothing (textarea and bar elements passed in). Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  let els = null;
  let hooks = {};
  let idx = -1;

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function matches() {
    const q = els.input.value.toLowerCase();
    if (!q) return [];
    const v = els.editor.value.toLowerCase();
    const out = [];
    let i = v.indexOf(q);
    while (i !== -1) { out.push(i); i = v.indexOf(q, i + q.length); }
    return out;
  }

  function updateCount(list) {
    els.count.textContent = list.length ? (idx + 1) + '/' + list.length : '0/0';
  }

  function gotoMatch(step) {
    const m = matches();
    if (!m.length) { idx = -1; updateCount(m); return; }
    if (idx < 0 || idx >= m.length) {
      const after = m.findIndex((p) => p >= els.editor.selectionStart);
      idx = step > 0 ? (after === -1 ? 0 : after) : (after === -1 ? m.length - 1 : Math.max(0, after - 1));
    } else {
      idx = (idx + step + m.length) % m.length;
    }
    const pos = m[idx];
    els.editor.setSelectionRange(pos, pos + els.input.value.length);
    hooks.onScrollLine(els.editor.value.slice(0, pos).split('\n').length);
    updateCount(m);
    hooks.onCursor();
  }

  function isOpen() {
    return !els.bar.hidden;
  }

  function open() {
    hooks.onOpen();
    const sel = els.editor.value.slice(els.editor.selectionStart, els.editor.selectionEnd);
    if (sel && !sel.includes('\n')) els.input.value = sel;
    els.bar.hidden = false;
    els.button.setAttribute('aria-pressed', 'true');
    idx = -1;
    els.input.focus();
    els.input.select();
    updateCount(matches());
  }

  function close() {
    els.bar.hidden = true;
    els.button.setAttribute('aria-pressed', 'false');
    els.editor.focus({ preventScroll: true });
  }

  function toggle() {
    if (isOpen()) close(); else open();
  }

  function replaceOne() {
    const m = matches();
    if (!m.length) return;
    const s = els.editor.selectionStart, e = els.editor.selectionEnd;
    if (!(m.includes(s) && e - s === els.input.value.length)) { gotoMatch(1); return; }
    hooks.onReplace(s, e, els.replace.value);
    idx--;
    gotoMatch(1);
  }

  function replaceAll() {
    const q = els.input.value;
    if (!q) return null;
    const re = new RegExp(escapeRe(q), 'gi');
    const count = (els.editor.value.match(re) || []).length;
    if (!count) return { count: 0 };
    const next = els.editor.value.replace(re, () => els.replace.value);
    idx = -1;
    updateCount(matches());
    return { count, next };
  }

  function init(elements, extraHooks) {
    els = elements;
    hooks = extraHooks || {};
    els.input.addEventListener('input', () => { idx = -1; gotoMatch(1); });
    els.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); gotoMatch(e.shiftKey ? -1 : 1); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    });
    els.replace.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); replaceOne(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    });
    els.next.addEventListener('click', () => gotoMatch(1));
    els.prev.addEventListener('click', () => gotoMatch(-1));
    els.close.addEventListener('click', close);
    els.replaceOneBtn.addEventListener('click', replaceOne);
    els.replaceAllBtn.addEventListener('click', () => {
      const r = replaceAll();
      if (r && r.next !== undefined && hooks.onReplaceAll) hooks.onReplaceAll(r.next, r.count);
      else if (r && r.count === 0 && hooks.onNoMatch) hooks.onNoMatch();
    });
  }

  window.PicoViewer.Find = { init, open, close, toggle, isOpen };
})();
