import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1920, height: 1080 } });

for (const moduleName of ['ModelPage', 'LionBookExperience']) {
  test(`${moduleName}组件模块悬挂按上限进入预览，不永久挡屏`, async ({ page }) => {
    test.setTimeout(70_000);
    const baseURL = test.info().project.use.baseURL;
    const index = await (await page.request.get(baseURL)).text();
    const production = /src="[^"]*\/assets\/index-/.test(index);
    const pattern = production
      ? new RegExp(`/${moduleName}-[^/]+\\.js(?:\\?.*)?$`)
      : new RegExp(`/src/features/(?:model|home)/${moduleName}\\.jsx(?:\\?.*)?$`);
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route(pattern, async route => { await gate; await route.continue().catch(() => {}); });
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#startupLoading')).toHaveCount(0);
      await expect.poll(() => page.locator('#introVideo').evaluate(video => !video.paused && video.currentTime > .1)).toBe(true);
      await expect(page.locator('.site-page')).not.toHaveAttribute('inert');
      await page.locator('#skipIntro').click();
      if (moduleName === 'ModelPage') {
        await page.locator('.site-nav-item[data-route="model"]').click();
        await expect(page.locator('#modelStatus')).toContainText('模型组件未能准备', { timeout: 40_000 });
        await expect(page.getByRole('button', { name: '重新载入', exact: true })).toBeVisible();
      } else {
        await page.locator('#enterWork').click();
        await expect(page.getByRole('button', { name: '重新展开', exact: true })).toBeVisible({ timeout: 40_000 });
      }
    } finally {
      release();
    }
  });
}
