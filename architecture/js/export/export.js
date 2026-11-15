/* Pico Viewer — export: SVG download, PNG (1x/2x/4x), PDF via print, clipboard copy.
   Exports: window.PicoViewer.Export = { init(hooks), run(kind) }.
   run kinds: svg, png1, png2, png4, pdf, copy-svg, copy-png, copy-code.
   hooks: svg() -> SVGElement|null, size() -> {w,h}, source() -> string, baseName() -> string,
   transparent() -> bool, toast(msg, type), canvasColor() -> string.
   Depends on: nothing (receives everything via hooks). Loaded before main.js. */
(function () {
  'use strict';
  window.PicoViewer = window.PicoViewer || {};

  const SVG_NS = 'http://www.w3.org/2000/svg';
  let hooks = null;

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // An SVG drawn to canvas is tainted when it contains <foreignObject> or
  // cross-origin <image> refs, which blocks toBlob/toDataURL. Swap HTML labels
  // for plain <text> carrying the live computed color, and drop remote images.
  function makeRasterSafe(clone, liveEl) {
    const liveFos = liveEl.querySelectorAll('foreignObject');
    clone.querySelectorAll('foreignObject').forEach((fo, i) => {
      const x = parseFloat(fo.getAttribute('x')) || 0;
      const y = parseFloat(fo.getAttribute('y')) || 0;
      const w = parseFloat(fo.getAttribute('width')) || 0;
      const h = parseFloat(fo.getAttribute('height')) || 16;
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', String(x + w / 2));
      text.setAttribute('y', String(y + h / 2));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('font-size', '12');
      const color = liveFos[i] && getComputedStyle(liveFos[i]).color;
      text.setAttribute('fill', color || '#000');
      text.textContent = (fo.textContent || '').replace(/\s+/g, ' ').trim();
      fo.parentNode.replaceChild(text, fo);
    });
    clone.querySelectorAll('image').forEach((im) => {
      const href = im.getAttribute('href') ||
        im.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
      if (/^https?:/i.test(href)) im.remove();
    });
  }

  function buildSvgString(transparent, forRaster) {
    const el = hooks.svg();
    if (!el) return null;
    const { w, h } = hooks.size();
    const clone = el.cloneNode(true);
    clone.setAttribute('xmlns', SVG_NS);
    clone.setAttribute('width', w);
    clone.setAttribute('height', h);
    if (!transparent) {
      const bg = document.createElementNS(SVG_NS, 'rect');
      bg.setAttribute('width', '100%');
      bg.setAttribute('height', '100%');
      bg.setAttribute('fill', hooks.canvasColor());
      clone.insertBefore(bg, clone.firstChild);
    }
    if (forRaster) makeRasterSafe(clone, el);
    return new XMLSerializer().serializeToString(clone);
  }

  function svgToPngBlob(scale, transparent) {
    return new Promise((resolve, reject) => {
      const svgStr = buildSvgString(transparent, true);
      if (!svgStr) { reject(new Error('No diagram')); return; }
      const { w, h } = hooks.size();
      const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }));
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = Math.round(w * scale);
          c.height = Math.round(h * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          c.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png');
        } catch (err) {
          reject(err);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not rasterize SVG')); };
      img.src = url;
    });
  }

  function printPdf() {
    const svgStr = buildSvgString(true);
    if (!svgStr) return hooks.toast('Nothing to export yet', 'err');
    const root = document.getElementById('printRoot');
    root.innerHTML = svgStr;
    const done = () => {
      root.innerHTML = '';
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
  }

  async function run(kind) {
    if (!hooks.svg()) return hooks.toast('Nothing to export yet', 'err');
    const transparent = hooks.transparent();
    try {
      if (kind === 'svg') {
        download(new Blob([buildSvgString(transparent)], { type: 'image/svg+xml' }), hooks.baseName() + '.svg');
        hooks.toast('SVG exported');
      } else if (kind.startsWith('png')) {
        const scale = Number(kind.slice(3));
        download(await svgToPngBlob(scale, transparent), hooks.baseName() + '@' + scale + 'x.png');
        hooks.toast('PNG exported at ' + scale + '×');
      } else if (kind === 'pdf') {
        printPdf();
      } else if (kind === 'copy-svg') {
        await navigator.clipboard.writeText(buildSvgString(transparent));
        hooks.toast('SVG copied to clipboard');
      } else if (kind === 'copy-png') {
        const blob = await svgToPngBlob(2, transparent);
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        hooks.toast('PNG copied to clipboard');
      } else if (kind === 'copy-code') {
        await navigator.clipboard.writeText(hooks.source());
        hooks.toast('Mermaid code copied');
      } else if (kind === 'html') {
        const title = hooks.baseName();
        const page = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
          '<title>' + title + '</title><style>html,body{margin:0;min-height:100%}body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0b0d10;padding:24px;box-sizing:border-box}svg{max-width:100%;height:auto}</style></head><body>' +
          buildSvgString(false) + '</body></html>\n';
        download(new Blob([page], { type: 'text/html' }), title + '.html');
        hooks.toast('HTML exported (works offline)');
      }
    } catch (err) {
      let msg = err.message || 'browser blocked it. Try SVG.';
      if (location.protocol === 'file:') {
        msg += ' — file:// pages taint the canvas; run "node serve.mjs" in the architecture folder and open the viewer over http://localhost';
      }
      hooks.toast('Export failed: ' + msg, 'err');
    }
  }

  function init(h) {
    hooks = h;
  }

  window.PicoViewer.Export = { init, run };
})();
