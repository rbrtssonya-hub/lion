import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

// Isolated ports keep an open development session independent of validation.
const preview = process.env.LION_TEST_PREVIEW === '1';
const port = preview ? 4189 : 5189;
export default defineConfig({
  ...base,
  testMatch: 'interactive-lion.spec.js',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}`, trace: 'off' },
  webServer: {
    command: `npm run ${preview ? 'preview' : 'dev'} -- --strictPort --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
