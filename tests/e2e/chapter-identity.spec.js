import { test, expect } from '@playwright/test';
import { assetPaths } from '../../src/config/assetPaths.js';

const chapters = [
  ['entry', '01', '溯源'], ['model', '02', '观形'],
  ['action', '03', '传神'], ['spread', '04', '远播'],
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false }));
  });
});

for (const size of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }]) {
  test(`四章共有章号和标题识别，内容在${size.width}桌面内可读`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#/state');
    for (const [route, number, phase] of chapters) {
      await page.evaluate(route => { location.hash = `/${route}`; }, route);
      const identity = page.locator(`.chapter-identity[data-chapter-identity="${route}"]`);
      await expect(identity).toBeVisible();
      await expect(identity.locator('.chapter-identity__number')).toHaveText(`${number} / 04`);
      await expect(identity.locator('.chapter-identity__phase')).toHaveText(phase);
      expect(await identity.evaluate(element => {
        const r = element.getBoundingClientRect();
        const page = element.closest('.site-page').getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.left >= page.left && r.right <= page.right + 1 && r.bottom <= innerHeight;
      })).toBe(true);
      if (route === 'entry') {
        expect(await identity.evaluate(element => {
          const a = element.getBoundingClientRect();
          const b = document.querySelector('.entry-playback-tools').getBoundingClientRect();
          return a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
        }), '首页章号必须完整避让重播工具').toBe(true);
      }
    }
    await page.evaluate(() => { location.hash = '/state'; });
    const expressionIdentity = page.locator('.chapter-identity[data-chapter-identity="state"]');
    await expect(expressionIdentity.locator('.chapter-identity__number')).toHaveText('03 / 04');
    await expect(expressionIdentity.locator('.chapter-identity__phase')).toHaveText('传神');
  });
}

test('后台模型等待不遮挡首页和神态，准备后仍复用原画布', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let requests = 0;
  await page.route(`**/${assetPaths.model}`, async route => { requests++; await gate; await route.continue(); });
  try {
    await page.goto('/');
    await expect(page.locator('#entryLionVideo')).toBeVisible();
    await expect.poll(() => page.locator('#entryLionVideo').evaluate(video => video.currentTime)).toBeGreaterThan(.1);
    await page.evaluate(() => { location.hash = '/state'; });
    await expect(page.locator('#expressionLion')).toBeVisible();
    release();
    await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
    await page.locator('.site-nav-item[data-route="model"]').click();
    await expect(page.locator('#resetView')).toBeEnabled();
    await expect(page.locator('#resetView')).toBeVisible();
    const canvas = await page.locator('#sceneContainer canvas').elementHandle();
    await page.evaluate(() => { location.hash = '/state'; });
    await expect(page.locator('#expressionLion')).toBeVisible();
    await page.locator('.site-nav-item[data-route="model"]').click();
    await expect(page.locator('#resetView')).toBeVisible();
    expect(await canvas.evaluate(node => node === document.querySelector('#sceneContainer canvas'))).toBe(true);
    expect(requests).toBe(1);
  } finally { release(); }
});
