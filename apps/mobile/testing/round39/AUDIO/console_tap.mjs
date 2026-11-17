// Round 39 — records Pico web console events (STT / TTS / reply / UI) with timestamps
// to AUDIO/console_run5.txt. Read-only: it only listens to Runtime.consoleAPICalled.
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('./console_run5.txt', import.meta.url));
const pages = await (await fetch('http://localhost:9222/json/list')).json();
const page = pages.find((p) => p.type === 'page' && p.url.startsWith('https://go.askpico.app'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const send = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }));
ws.onmessage = (ev) => {
  const d = JSON.parse(ev.data);
  if (d.method !== 'Runtime.consoleAPICalled') return;
  const text = d.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
  if (!/STT|TTS|Reply|Session|Listening|VoiceDebug|Native|Speaking|re-arm|cap|Voice stopped/i.test(text)) return;
  const stamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
  appendFileSync(out, `${stamp} ${text.slice(0, 220)}\n`);
};
await new Promise((r) => (ws.onopen = r));
send('Runtime.enable');
appendFileSync(out, `# tap started ${new Date().toISOString()}\n`);
setInterval(() => {}, 1 << 30);
