// Navigate the Pico WebView to the URL in .mlink (keeps token out of argv/logs).
import { readFileSync } from 'fs';
const link = readFileSync(new URL('./.mlink', import.meta.url), 'utf8').trim();
const pages = await (await fetch('http://localhost:9223/json/list')).json();
const page = pages.find((p) => p.type === 'page' && p.url.includes('askpico'));
if (!page) throw new Error('no page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
const send = (m, p = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (ev) => { const msg = JSON.parse(ev.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } };
await new Promise((r) => (ws.onopen = r));
const res = await send('Runtime.evaluate', { expression: `location.href=${JSON.stringify(link)}; 'nav'` });
console.log(JSON.stringify(res.result?.result?.value));
ws.close();
