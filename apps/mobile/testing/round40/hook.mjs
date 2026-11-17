const pages = await (await fetch('http://localhost:9222/json/list')).json();
const page = pages.find((p) => p.type === 'page' && p.url.startsWith('https://go.askpico.app'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (e) => { const d = JSON.parse(e.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
await new Promise((r) => (ws.onopen = r));
function r40Hook() {
  if (window.__r40Hooked) return 'already';
  window.__r40Hooked = true;
  const orig = window.fetch.bind(window);
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
    const res = await orig(...args);
    if (/\/api\/(agent\/)?chat/.test(url) && !res.ok) {
      let code = '';
      try { const j = await res.clone().json(); code = String(j.code || j.error || '').slice(0, 80); } catch (e) { code = 'non-json'; }
      console.log('[R40-HTTP] ' + new URL(url).pathname + ' status=' + res.status + ' errorCode=' + JSON.stringify(code) + ' at=' + new Date().toISOString());
    }
    return res;
  };
  return 'hooked';
}
const r = await send('Runtime.evaluate', { expression: '(' + r40Hook.toString() + ')()', returnByValue: true, awaitPromise: true });
console.log('inject:', JSON.stringify(r.result?.result?.value ?? r.result?.result ?? r));
const c = await send('Runtime.evaluate', { expression: 'window.__r40Hooked === true', returnByValue: true });
console.log('check:', JSON.stringify(c.result?.result?.value));
ws.close();
