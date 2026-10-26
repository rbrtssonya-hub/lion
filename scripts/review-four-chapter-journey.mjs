import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const origin = process.env.JOURNEY_REVIEW_ORIGIN || 'http://127.0.0.1:4186';
const output = fileURLToPath(new URL('../source/reviews/four-chapter-journey/2026-10-26/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const report = { origin, checks: [], images: [], errors: [] };
try {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      if (window !== top) return;
      sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
      sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
      localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, navigationTypographyVersion: 2, hdriEnabled: true }));
    });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    const capture = async name => {
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].filter(image => image.checkVisibility()).map(image => image.decode().catch(() => {})));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      const bounds = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: innerWidth,
        navigation: [...document.querySelectorAll('.site-navigation button')].map(button => {
          const r = button.getBoundingClientRect(); return { x: r.x, right: r.right, y: r.y, bottom: r.bottom };
        }) }));
      assert(bounds.scrollWidth <= bounds.width + 1, `${name}: horizontal overflow`);
      assert(bounds.navigation.every(r => r.x >= -1 && r.right <= viewport.width + 1 && r.y >= -1 && r.bottom <= viewport.height + 1), `${name}: navigation outside viewport`);
      const image = `${name}-${viewport.width}.png`;
      await page.screenshot({ path: `${output}/${image}` });
      report.images.push(image); report.checks.push({ name, viewport, ...bounds });
    };
    await page.goto(`${origin}/#/entry`);
    await page.locator('#enterWork').click();
    await page.waitForFunction(() => document.querySelector('.home-exhibit')?.dataset.open === 'true');
    await page.waitForFunction(() => document.querySelector('.lion-book-experience')?.dataset.bookReady === 'true', null, { timeout: 60000 });
    await page.locator('.lion-book-timeline button').last().waitFor();
    await page.locator('#homeLionBook').evaluate(element => element.scrollIntoView({ block: 'nearest' }));
    await capture('book');
    if (viewport.width === 1440) {
      await page.getByRole('button', { name: '资料与许可', exact: true }).click();
      await capture('sources');
      await page.keyboard.press('Escape');
    }
    for (const route of ['model', 'action', 'state', 'spread']) {
      await page.evaluate(value => { location.hash = `/${value}`; }, route);
      await page.waitForFunction(value => document.querySelector('#react-app')?.dataset.route === value, route);
      if (route === 'model') await page.waitForFunction(() => document.querySelector('#modelStatus')?.textContent.includes('模型已载入'), null, { timeout: 60000 });
      if (route === 'action') await page.waitForFunction(() => document.querySelector('#actionTheater')?.dataset.sceneState === 'ready', null, { timeout: 60000 });
      await capture(route);
      if (route === 'model' && viewport.width === 1440) {
        for (const [tab, name] of [['形制', 'types'], ['工艺', 'craft'], ['观形', null]]) {
          await page.getByRole('tab', { name: tab, exact: true }).click();
          if (name) await capture(name);
        }
      }
    }
    await context.close();
  }
  assert.equal(report.errors.length, 0, 'No page errors during production review');
  report.status = 'passed';
} finally {
  await browser.close();
  await writeFile(`${output}/capture.json`, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ status: report.status, screenshots: report.images.length, errors: report.errors.length }));
