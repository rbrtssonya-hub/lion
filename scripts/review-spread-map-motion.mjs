import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const origin = process.env.MAP_REVIEW_ORIGIN || 'http://127.0.0.1:4187';
const output = fileURLToPath(new URL('../source/reviews/spread-map-motion/2026-10-28/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const report = { origin, viewport: { width: 1440, height: 900 }, samples: [], errors: [] };
try {
  const context = await browser.newContext({ viewport: report.viewport, reducedMotion: 'no-preference' });
  await context.addInitScript(() => { if (window === top) sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'); });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`${origin}/#/spread`);
  await page.locator('#spreadStage').waitFor();
  await page.getByRole('tab', { name: '世界', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.spread-map')?.dataset.mapMotion === 'moving');
  for (const [seconds, name] of [[1.8, 'forward-guangdong-china'], [4.15, 'forward-china'], [6.2, 'forward-china-world']]) {
    await page.waitForFunction(time => document.querySelector('.spread-map-video[data-direction="forward"]')?.currentTime >= time, seconds);
    const sample = await page.locator('.spread-map-video[data-direction="forward"]').evaluate(video => ({ time: video.currentTime, width: video.videoWidth, height: video.videoHeight, paused: video.paused }));
    assert.equal(sample.width, 1000); assert.equal(sample.height, 650); assert.equal(sample.paused, false);
    await page.screenshot({ path: `${output}/${name}.png` });
    report.samples.push({ name, ...sample });
  }
  await page.waitForFunction(() => document.querySelector('.spread-map')?.dataset.mapMotion === 'idle');
  await page.getByRole('tab', { name: '广东', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.spread-map')?.dataset.mapMotion === 'moving');
  await page.waitForFunction(() => document.querySelector('.spread-map-video[data-direction="reverse"]')?.currentTime >= 2);
  const reverse = await page.locator('.spread-map-video[data-direction="reverse"]').evaluate(video => ({ time: video.currentTime, width: video.videoWidth, height: video.videoHeight, paused: video.paused }));
  assert.equal(reverse.paused, false);
  await page.screenshot({ path: `${output}/reverse-world-china.png` });
  report.samples.push({ name: 'reverse-world-china', ...reverse });
  await page.waitForFunction(() => document.querySelector('.spread-map')?.dataset.mapMotion === 'idle');
  assert.equal(await page.locator('.spread-map').getAttribute('data-map-level'), 'guangdong');
  assert.equal(report.errors.length, 0);
  report.status = 'passed';
  await context.close();
} finally {
  await browser.close();
  await writeFile(`${output}/capture.json`, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report));
