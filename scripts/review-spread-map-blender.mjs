import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const origin = process.env.JOURNEY_REVIEW_ORIGIN || 'http://127.0.0.1:4186';
const output = fileURLToPath(new URL('../source/reviews/spread-map-levels/2026-10-28-blender/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const report = { origin, checks: [], screenshots: [], errors: [] };
try {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      if (window !== top) return;
      sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`${origin}/#/spread`);
    await page.waitForFunction(() => document.querySelector('.spread-map')?.dataset.mapLevel === 'guangdong');
    for (const [id, name] of [['guangdong', '广东'], ['china', '中国'], ['world', '世界']]) {
      await page.getByRole('tab', { name, exact: true }).click();
      await page.evaluate(async () => {
        await document.fonts.ready;
        await document.querySelector('.spread-photo')?.decode().catch(() => {});
        await document.querySelector('.spread-map-render')?.decode();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      const check = await page.locator('.spread-map').evaluate(map => {
        const frame = map.querySelector('.spread-world').getBoundingClientRect();
        const labels = [...map.querySelectorAll('.spread-map-place')].map(node => {
          const r = node.getBoundingClientRect();
          return { name: node.textContent, inside: r.left >= frame.left - 1 && r.right <= frame.right + 1 && r.top >= frame.top - 1 && r.bottom <= frame.bottom + 1 };
        });
        return { level: map.dataset.mapLevel, width: frame.width, height: frame.height, labels, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(check.level, id);
      assert(!check.overflow && check.labels.every(label => label.inside));
      assert(check.width > 200 && check.height > 120);
      const imageName = `${id}-${viewport.width}.png`;
      await page.screenshot({ path: `${output}/${imageName}` });
      report.checks.push({ viewport, ...check }); report.screenshots.push(imageName);
    }
    await context.close();
  }
  assert.equal(report.errors.length, 0);
  report.status = 'passed';
} finally {
  await browser.close();
  await writeFile(`${output}/capture.json`, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ status: report.status, screenshots: report.screenshots.length, errors: report.errors.length }));
