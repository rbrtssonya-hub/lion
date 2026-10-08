import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const site = resolve(process.cwd(), 'site');
const legacyFiles = ['legacy.html', 'src/main.js', 'styles.css'];

export default defineConfig({
  root: resolve(process.cwd(), 'react'),
  base: './',
  plugins: [{
    name: 'existing-site-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url, 'http://localhost').pathname.slice(1);
        if (legacyFiles.includes(pathname)) {
          res.setHeader('Content-Type', pathname.endsWith('.html') ? 'text/html; charset=utf-8' : pathname.endsWith('.css') ? 'text/css' : 'text/javascript');
          res.end(readFileSync(resolve(site, pathname)));
          return;
        }
        if (pathname.startsWith('assets/') || pathname.startsWith('data/')) {
          req.url = '/@fs/' + resolve(site, decodeURIComponent(pathname)).replaceAll('\\', '/');
        }
        next();
      });
    },
  }],
  build: {
    outDir: site,
    emptyOutDir: false,
    assetsDir: 'build-assets',
  },
});
