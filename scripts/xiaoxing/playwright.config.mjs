import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const port = Number(process.env.XIAOXING_TEST_PORT || 42827);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('XIAOXING_TEST_PORT must be an integer between 1024 and 65535');
const baseURL = `http://127.0.0.1:${port}`;

// Run after npm run build. A private preview owned by this run prevents an
// existing development server or another checkout from silently being reused.
export default defineConfig({
  testDir: path.join(projectRoot, 'tests/e2e'),
  testMatch: ['xiaoxing.spec.js', 'home-exhibit-navigation.spec.js'],
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  outputDir: path.join(projectRoot, 'tmp/xiaoxing-acceptance'),
  use: { baseURL, channel: 'chrome', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chrome-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: { command: `npm run preview -- --strictPort --port ${port}`, url: baseURL,
    cwd: projectRoot, reuseExistingServer: false, timeout: 30_000 },
});
