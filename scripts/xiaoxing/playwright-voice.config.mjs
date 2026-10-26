import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../../tests/e2e',
  testMatch: 'xiaoxing-reference-voice.spec.js',
  outputDir: '../../test-results/xiaoxing-reference-voice',
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:42833',
    channel: 'chrome',
    ...devices['Desktop Chrome'],
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 42833 --strictPort',
    url: 'http://127.0.0.1:42833',
    reuseExistingServer: !process.env.CI,
  },
});
