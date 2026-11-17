// Pull the WebView session JWT + POST the docx to /api/attachments/extract.
// Prints only the extracted text / status — never the token.
import { readFileSync } from 'fs';
const pages = await (await fetch('http://localhost:9223/json/list')).json();
const page = pages.find((p) => p.type === 'page' && p.url.includes('askpico'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
const send = (m, p = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (ev) => { const msg = JSON.parse(ev.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } };
await new Promise((r) => (ws.onopen = r));
const res = await send('Runtime.evaluate', { expression: `(()=>{const k=Object.keys(localStorage).find(k=>k.includes('auth-token'));const s=JSON.parse(localStorage.getItem(k));return s.access_token})()`, returnByValue: true });
const token = res.result.result.value;
const b64 = readFileSync('F:/Developer/Web Apps/askpico/apps/mobile/testing/round28/r28_test.docx').toString('base64');
const r = await fetch('https://api.askpico.app/api/attachments/extract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ name: 'r28_test.docx', dataBase64: b64 }),
});
const j = await r.json().catch(() => null);
console.log('status', r.status, '| text:', JSON.stringify(j?.text ?? j));
ws.close();
