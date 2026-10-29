import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const folder = resolve('source/reviews/dance-entrance/2026-10-29');
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const base = process.env.DANCE_REVIEW_URL || 'http://127.0.0.1:4199';
const report = { base, date: new Date().toISOString(), screenshots: [], errors: [], failed: [] };
try {
  for (const [width, height] of [[1920, 1080], [1440, 900], [1280, 720]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) report.failed.push(r.url()); });
    await page.addInitScript(() => { if (window !== top) return; sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'); sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1'); });
    await page.goto(`${base}/#/action`);
    await page.locator('#startupLoading').waitFor({ state: 'detached', timeout: 60000 });
    await page.locator('.dance-entrance').waitFor();
    await page.locator('.dance-entrance img').evaluateAll(images => Promise.all(images.map(img => img.decode().catch(() => {}))));
    const dimensions = await page.evaluate(async () => {
      const stage = document.querySelector('.dance-entrance');
      const background = getComputedStyle(stage).backgroundImage;
      const backgroundLoaded = await new Promise(resolve => { const img = new Image(); img.onload = () => resolve(img.naturalWidth === 2048); img.onerror = () => resolve(false); img.src = background.slice(5, -2); });
      return { background, backgroundLoaded, overflow: document.documentElement.scrollWidth > innerWidth, pageHeight: document.documentElement.scrollHeight,
        portals: [...stage.querySelectorAll('.portal-card')].map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, transform: getComputedStyle(node).transform }; }),
        links: [...stage.querySelectorAll('.portal-link')].map(node => ({ href: node.getAttribute('href'), bottom: node.getBoundingClientRect().bottom })),
        broken: [...stage.querySelectorAll('img')].filter(img => !img.naturalWidth).map(img => img.src) };
    });
    const filename = `entrance-${width}.png`;
    await page.screenshot({ path: resolve(folder, filename), fullPage: true });
    report.screenshots.push({ filename, width, height, ...dimensions });
    if (width === 1440) {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const b = await page.locator('.dance-portals').boundingBox();
      await page.mouse.move(b.x + b.width * .25, b.y + b.height * .4);
      await page.mouse.down(); await page.mouse.move(b.x + b.width * .53, b.y + b.height * .48, { steps: 16 }); await page.mouse.up();
      await page.waitForTimeout(250);
      await page.screenshot({ path: resolve(folder, 'entrance-rotated.png'), fullPage: true });
      report.dragStayedInEntrance = await page.locator('#react-app').getAttribute('data-route') === 'action';
      await page.getByRole('button', { name: '视角归位', exact: true }).click();
      await page.locator('.site-navigation [data-action="settings"]').click();
      await page.screenshot({ path: resolve(folder, 'entrance-settings.png'), fullPage: true });
    }
    await page.close();
  }
  await writeFile(resolve(folder, 'review.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (report.errors.length || report.failed.length || report.screenshots.some(v => !v.backgroundLoaded || v.overflow || v.broken.length || v.pageHeight > v.height || v.links.some(l => l.bottom > v.height))) process.exitCode = 1;
} finally { await browser.close(); }
