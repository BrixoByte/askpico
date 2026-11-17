// Builds the sandboxed-iframe document for a `mermaid` artifact.
// The diagram renders inside the PreviewFrame iframe (sandbox="allow-scripts");
// the mermaid + panzoom chunks load on demand from a pinned CDN version,
// so they only cost bytes when a diagram preview is actually opened.
// Failures show the source plus the parse error — never a blank page.

export const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js';
export const PANZOOM_CDN = 'https://cdn.jsdelivr.net/npm/panzoom@9.4.3/dist/panzoom.min.js';

// Warms the CDN scripts in the browser cache while a mermaid fence is still
// streaming, so the preview is ready when the reply finishes (beta plan §4.8).
export const prefetchMermaidAssets = (): void => {
  try {
    for (const href of [MERMAID_CDN, PANZOOM_CDN]) {
      if (document.querySelector(`link[href="${href}"]`)) continue;
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      link.as = 'script';
      document.head.appendChild(link);
    }
  } catch {
    /* prefetch is best-effort */
  }
};

export const buildMermaidDoc = (source: string): string => {
  // JSON-embed the source; neutralize `</script` so it cannot close the tag.
  const embedded = JSON.stringify(source).replace(/<\//g, '<\\/');
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html, body { margin: 0; height: 100%; background: #ffffff; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
  #stage { height: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  #stage svg { max-width: 100%; max-height: 100%; }
  #fallback { display: none; margin: 0; padding: 16px; height: 100%; box-sizing: border-box; overflow: auto; }
  #err { color: #b91c1c; font: 13px/1.4 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding: 12px 16px; margin: 0; }
  pre.code { font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; color: #111827; background: #f6f7f9; border-radius: 8px; padding: 12px; white-space: pre-wrap; word-break: break-word; }
</style>
<script src="${MERMAID_CDN}"></script>
<script src="${PANZOOM_CDN}"></script>
</head>
<body>
<div id="stage"></div>
<div id="fallback"><p id="err"></p><pre class="code" id="src"></pre></div>
<script id="diagram-src" type="application/json">${embedded}</script>
<script>
(function () {
  var source = JSON.parse(document.getElementById('diagram-src').textContent);
  var stage = document.getElementById('stage');
  function fail(msg) {
    document.getElementById('err').textContent = 'Could not render diagram: ' + msg;
    document.getElementById('src').textContent = source;
    stage.style.display = 'none';
    document.getElementById('fallback').style.display = 'block';
  }
  if (typeof mermaid === 'undefined') { fail('the diagram library could not be loaded'); return; }
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: {
      primaryColor: '#e9f7d1',
      primaryTextColor: '#111827',
      primaryBorderColor: '#5a9400',
      lineColor: '#5a9400',
      secondaryColor: '#f6f7f9',
      tertiaryColor: '#ffffff',
      fontFamily: '-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
    }
  });
  mermaid.render('pico-diagram', source).then(function (out) {
    stage.innerHTML = out.svg;
    var svg = stage.querySelector('svg');
    if (svg && typeof panzoom !== 'undefined') {
      svg.style.width = '100%';
      svg.style.height = '100%';
      panzoom(svg, { minZoom: 0.2, maxZoom: 8, bounds: true, boundsPadding: 0.1, zoomDoubleClickSpeed: 1 });
    }
  }).catch(function (e) { fail(e && e.message ? e.message : String(e)); });
})();
</script>
</body>
</html>`;
};
