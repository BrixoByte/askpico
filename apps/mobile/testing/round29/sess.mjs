// Injects the session from .sess into the WebView localStorage via CDP.
import fs from 'fs';
process.env.CDP_HOST = 'localhost:4173';
const { key, session } = JSON.parse(fs.readFileSync('round29/.sess', 'utf8'));
const expr = `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(JSON.stringify(session))}); 'injected'`;
const pages = await (await fetch('http://localhost:9223/json/list')).json();
const page = pages.find((p) => p.type === 'page' && p.url.includes('localhost:4173'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id === 1) { console.log(JSON.stringify(m.result?.result?.value)); ws.close(); process.exit(0); }
};
setTimeout(() => process.exit(1), 8000);
