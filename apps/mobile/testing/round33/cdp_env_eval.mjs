// CDP eval for the Pico WebView. Reads the JS expression from env var CDP_EXPR.
// The placeholder %%PASS%% is replaced with the JSON-escaped value of the
// TEST_PASSCODE env var, so secrets never appear on the command line or in
// this file. Prints only the eval result (e.g. "OK", "NO_UNBLOCKS").
const base = 'http://localhost:9222';

const pass = process.env.TEST_PASSCODE ?? '';
const email = process.env.TEST_EMAIL ?? '';
const pwd = process.env.TEST_PASSWORD ?? '';
const expr = (process.env.CDP_EXPR ?? '')
  .replaceAll('%%PASS%%', JSON.stringify(pass))
  .replaceAll('%%EMAIL%%', JSON.stringify(email))
  .replaceAll('%%PWD%%', JSON.stringify(pwd));
if (!expr) throw new Error('CDP_EXPR env var is required');

const pages = await (await fetch(`${base}/json/list`)).json();
const page = pages.find((p) => p.type === 'page' && p.url.startsWith('http'));
if (!page) throw new Error('no WebView page target; is Pico running and adb forwarded?');

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const req = ++id;
    pending.set(req, resolve);
    ws.send(JSON.stringify({ id: req, method, params }));
  });
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
await new Promise((r) => (ws.onopen = r));
const res = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
const r = res.result;
console.log(r.exceptionDetails ? `EXCEPTION: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}` : JSON.stringify(r.result.value ?? r.result.description));
ws.close();
