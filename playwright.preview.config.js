import { defineConfig } from '@playwright/test';
import config from './playwright.config.js';
const previewPort = Number(process.env.PLAYWRIGHT_PREVIEW_PORT || 4173);

export default defineConfig({
  ...config,
  use: { ...config.use, baseURL: `http://127.0.0.1:${previewPort}` },
  webServer: {
    command: `npm run preview -- --strictPort --port ${previewPort}`,
    url: `http://127.0.0.1:${previewPort}`,
    reuseExistingServer: !process.env.CI,
  },
});
