import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import wasm from 'vite-plugin-wasm';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const marketingRoot = fileURLToPath(new URL('../marketing/', import.meta.url));

const marketingMime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

// Dev only: apex localhost mirrors the apex domain in production, where
// askpico.app serves the marketing site. Requests on localhost / 127.0.0.1
// get files from apps/marketing; subdomains (chat., auth.) and paths Vite
// owns fall through to the normal dev server.
const marketingOnApex = (): Plugin => ({
  name: 'marketing-on-apex',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const hostname = (req.headers.host ?? '').split(':')[0];
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') return next();
      if (/PicoApp\//.test(req.headers['user-agent'] ?? '')) return next();
      try {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const urlPath = decodeURIComponent(url.pathname);
        // Clean URLs: /about.html -> /about, /about -> about.html
        if (urlPath.endsWith('.html')) {
          const clean = urlPath.slice(0, -'.html'.length) || '/';
          res.writeHead(301, {
            Location: `${clean === '/index' ? '/' : clean}${url.search}`,
          });
          res.end();
          return;
        }
        let path = normalize(urlPath).replace(/^([/\\])+/, '');
        if (!path || urlPath.endsWith('/')) path = join(path, 'index.html');
        if (!extname(path)) path += '.html';
        const file = join(marketingRoot, path);
        const type = marketingMime[extname(file).toLowerCase()];
        if (!file.startsWith(marketingRoot) || !type) return next();
        const data = await readFile(file);
        res.setHeader('Content-Type', type);
        res.setHeader('Cache-Control', 'no-cache');
        res.end(data);
      } catch {
        next();
      }
    });
  },
});

// Dev only: chama.localhost:5173 redirects to the admin app on port 5174.
const adminRedirect = (): Plugin => ({
  name: 'admin-redirect',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const host = req.headers.host ?? '';
      const [hostname, port] = host.split(':');
      if (hostname !== 'chama.localhost' || port === '5174') return next();
      res.writeHead(302, { Location: `http://chama.localhost:5174${req.url ?? '/'}` });
      res.end();
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    process.env.VITEST ? null : react(),
    wasm(),
    marketingOnApex(),
    adminRedirect(),
  ],
  resolve: {
    alias: {
      '@icon/': fileURLToPath(new URL('./src/assets/icons/', import.meta.url)) + '/',
      '@type/': fileURLToPath(new URL('./src/types/', import.meta.url)) + '/',
      '@store/': fileURLToPath(new URL('./src/store/', import.meta.url)) + '/',
      '@hooks/': fileURLToPath(new URL('./src/hooks/', import.meta.url)) + '/',
      '@constants/': fileURLToPath(new URL('./src/constants/', import.meta.url)) + '/',
      '@api/': fileURLToPath(new URL('./src/api/', import.meta.url)) + '/',
      '@components/': fileURLToPath(new URL('./src/components/', import.meta.url)) + '/',
      '@utils/': fileURLToPath(new URL('./src/utils/', import.meta.url)) + '/',
      '@src/': fileURLToPath(new URL('./src/', import.meta.url)) + '/',
    },
  },
  base: './',
  build: {
    target: 'esnext',
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
});
