/* Pico Viewer — transient toast notifications in the #toasts container.
   Exports: window.PicoViewer.Toast = { show(msg, type) } where type is '' (info) or 'err'.
   Depends on: icons.js (svgFor). Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  function show(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'err' ? ' err' : '');
    el.innerHTML = window.PicoViewer.Icons.svgFor(type === 'err' ? 'alert' : 'check') + '<span></span>';
    el.lastChild.textContent = msg;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 260); }, 2400);
  }

  window.PicoViewer.Toast = { show };
})();
