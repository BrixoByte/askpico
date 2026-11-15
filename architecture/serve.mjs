/* Pico Viewer - local dev server (Mode B live sync). Built-in Node modules only.
   Run: node serve.mjs  (serves the architecture folder on port 4173).
   Routes: GET / and static files; GET /api/files (list diagrams/*.mmd);
   GET /api/file?name= (read); PUT /api/file?name= (write); GET /events (SSE, change notifications).
   Only diagrams/*.mmd files can be read or written. Depends on: node:http, node:fs, node:path. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIAGRAMS = path.join(ROOT, 'diagrams');
const PORT = Number(process.env.PORT) || 4173;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mmd': 'text/plain', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const clients = new Set();
let timer = null;

function safeName(name) {
  if (!name || name !== path.basename(name) || !name.endsWith('.mmd')) return null;
  return path.join(DIAGRAMS, name);
}

function listFiles() {
  if (!fs.existsSync(DIAGRAMS)) return [];
  return fs.readdirSync(DIAGRAMS).filter((f) => f.endsWith('.mmd')).sort().map((f) => {
    const st = fs.statSync(path.join(DIAGRAMS, f));
    return { name: f, size: st.size, mtime: st.mtimeMs };
  });
}

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 2e6) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// Debounced broadcast so one save (which can fire several fs events) sends one notification.
function broadcast() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    for (const res of clients) res.write('event: change\ndata: ' + JSON.stringify({ files: listFiles(), at: Date.now() }) + '\n\n');
  }, 150);
}

if (fs.existsSync(DIAGRAMS)) fs.watch(DIAGRAMS, { persistent: true }, (_ev, name) => { if (!name || String(name).endsWith('.mmd')) broadcast(); });

async function handleApi(req, res, url) {
  if (url.pathname === '/api/files' && req.method === 'GET') return send(res, 200, listFiles());
  if (url.pathname === '/api/file') {
    const file = safeName(url.searchParams.get('name'));
    if (!file) return send(res, 400, { error: 'Invalid file name' });
    if (req.method === 'GET') {
      if (!fs.existsSync(file)) return send(res, 404, { error: 'Not found' });
      return send(res, 200, fs.readFileSync(file, 'utf8'), 'text/plain; charset=utf-8');
    }
    if (req.method === 'PUT') {
      const body = await readBody(req);
      fs.writeFileSync(file, body, 'utf8');
      return send(res, 200, { ok: true, bytes: Buffer.byteLength(body) });
    }
  }
  return send(res, 404, { error: 'Unknown API route' });
}

function serveStatic(res, url) {
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'Not found', 'text/plain');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('retry: 1000\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', 'text/plain');
    return serveStatic(res, url);
  } catch (err) {
    return send(res, 500, { error: err.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Pico Viewer running at http://localhost:' + PORT);
});
