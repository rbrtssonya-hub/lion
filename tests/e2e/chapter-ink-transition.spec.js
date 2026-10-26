import { test, expect } from '@playwright/test';

test('切换四章和神态页时直接显示目标页，不挂载整页转场', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false }));
  });
  await page.goto('/#/state');
  await expect(page.locator('#expressionLion')).toBeVisible();

  for (const route of ['model', 'action', 'spread', 'entry']) {
    await page.locator(`.site-nav-item[data-route="${route}"]`).click();
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
    await expect(page.locator('.chapter-ink-transition, .chapter-transition-line')).toHaveCount(0);
    expect(await page.locator('#react-app').getAttribute('data-chapter-phase')).toBeNull();
  }

  await page.evaluate(() => { location.hash = '/state'; });
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  await expect(page.locator('.chapter-ink-transition, .chapter-transition-line')).toHaveCount(0);
  expect(await page.locator('#react-app').getAttribute('data-chapter-phase')).toBeNull();
});
