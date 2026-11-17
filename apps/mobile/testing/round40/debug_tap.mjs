// Round 40 debug tap (logging only, read-only). Records every console message, uncaught
// exception, and /api/ network response status + timing from the production WebView.
// Never records request/response bodies, headers, or tokens.
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('./DEBUG_TAP.txt', import.meta.url));
const stamp = () => new Date().toLocaleTimeString('en-GB', { hour12: false }) + '.' + String(new Date().getMilliseconds()).padStart(3, '0');
const log = (line) => appendFileSync(out, `${stamp()} ${line}\n`);
const pages = await (await fetch('http://localhost:9222/json/list')).json();
const page = pages.find((p) => p.type === 'page' && p.url.startsWith('https://go.askpico.app'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const send = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }));
const reqStart = new Map();
ws.onmessage = (ev) => {
  const d = JSON.parse(ev.data);
  if (d.method === 'Runtime.consoleAPICalled') {
    const text = d.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
    log(`CONSOLE[${d.params.type}] ${text.slice(0, 220)}`);
  } else if (d.method === 'Runtime.exceptionThrown') {
    log(`EXCEPTION ${JSON.stringify(d.params.exceptionDetails.text ?? '').slice(0, 200)} ${d.params.exceptionDetails.url ?? ''}:${d.params.exceptionDetails.lineNumber ?? ''}`);
  } else if (d.method === 'Network.requestWillBeSent' && /\/api\//.test(d.params.request.url)) {
    reqStart.set(d.params.requestId, Date.now());
    log(`REQ ${d.params.request.method} ${new URL(d.params.request.url).pathname}`);
  } else if (d.method === 'Network.responseReceived' && /\/api\//.test(d.params.response.url)) {
    const t = reqStart.get(d.params.requestId);
    log(`RESP ${new URL(d.params.response.url).pathname} status=${d.params.response.status} ttfb_ms=${t ? Date.now() - t : '?'}`);
  } else if (d.method === 'Network.loadingFailed') {
    log(`NETFAIL requestId=${d.params.requestId} ${d.params.errorText ?? ''}`);
  }
};
await new Promise((r) => (ws.onopen = r));
send('Runtime.enable');
send('Network.enable');
log(`# debug tap started (production page)`);
setInterval(() => {}, 1 << 30);
