import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { lionBookPlugin } from './scripts/lion-book-vite-plugin.mjs';
import { xiaoxingPlugin } from './scripts/assistant/vite-plugin.mjs';

export default defineConfig({
  plugins: [lionBookPlugin(), xiaoxingPlugin(), react()],
  optimizeDeps: { exclude: ['@designcodeio/threeui'] },
  base: './',
  publicDir: 'source/public',
  server: {
    host: '127.0.0.1',
    port: 5173,
    watch: {
      ignored: ['**/tmp/**', '**/test-results/**', '**/playwright-report/**', '**/dist/**'],
    },
  },
  preview: { host: '127.0.0.1', port: 4173 },
  build: { outDir: 'dist', emptyOutDir: true },
});
