import { test, expect } from '@playwright/test';
import { assetPaths } from '../../src/config/assetPaths.js';

async function open(page, route = 'entry', viewport = { width: 1440, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    if (window !== top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    if (!sessionStorage.getItem('four-chapter-seeded')) {
      localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, navigationTypographyVersion: 2 }));
      sessionStorage.setItem('four-chapter-seeded', '1');
    }
  });
  await page.goto(`/#/${route}`);
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60000 });
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
}

test('four chapter navigation preserves the expression deep link and browser history', async ({ page }) => {
  await open(page);
  const lettering = page.locator('.site-navigation .site-nav-lettering');
  await expect(lettering).toHaveCount(5);
  for (const image of await lettering.all()) {
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
  }
  const expectedLabels = [
    [page.locator('.site-navigation [data-route=\"entry\"] .site-nav-lettering'), assetPaths.navLabelXu],
    [page.locator('.site-navigation [data-route=\"model\"] .site-nav-lettering'), assetPaths.navLabelZao],
    [page.locator('.site-navigation [data-route=\"action\"] .site-nav-lettering'), assetPaths.navLabelWu],
    [page.locator('.site-navigation [data-route=\"spread\"] .site-nav-lettering'), assetPaths.navLabelChuan],
    [page.locator('.site-navigation [data-action=\"settings\"] .site-nav-lettering'), assetPaths.navLabelSettings],
  ];
  for (const [image, path] of expectedLabels) {
    expect(await image.evaluate((element, expectedPath) => element.src.endsWith(expectedPath), path)).toBe(true);
  }
  await page.evaluate(() => { location.hash = '#/state'; });
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  await expect(page.locator('.site-header')).toHaveAttribute('data-nav-mode', 'compact');
  await expect(page.locator('.site-navigation [data-route] .site-nav-heading strong')).toHaveText(['序', '造', '舞', '传']);
  await expect(lettering).toHaveCount(5);
  for (const image of await lettering.all()) {
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
  }
  await expect(page.locator('.site-navigation [data-route="action"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-chapter-identity="state"]')).toContainText('03');
  await page.locator('.site-navigation [data-route="spread"]').click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'spread');
  await expect(page.getByText('所收录案例分布示意', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  await expect(page.locator('.site-navigation [data-route="action"]')).toHaveAttribute('aria-current', 'page');
});

test('the seven page book keeps chapter shortcuts and an auxiliary source dialog', async ({ page }) => {
  await open(page);
  await page.locator('#enterWork').click();
  await expect(page.locator('.home-archive-scene')).toHaveAttribute('data-open', 'true');
  await expect(page.locator('.lion-book-timeline button')).toHaveCount(7);
  await expect(page.locator('.home-page #homeCulture')).toHaveCount(0);
  await expect(page.locator('.home-page #homeLionTypes')).toHaveCount(0);
  const trigger = page.getByRole('button', { name: '资料与许可', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '资料与许可' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.home-culture-photo-license')).toHaveCount(8);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.locator('.home-archive-nav [data-chapter-link="model"]').click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'model');
});

test('legacy aliases and unknown addresses keep their existing fallback behavior', async ({ page }) => {
  await open(page, 'state');
  for (const [hash, expected] of [['#state', 'state'], ['#/structure', 'model'], ['#/intro', 'entry'], ['#/unknown', 'entry']]) {
    await page.evaluate(value => { location.hash = value; }, hash);
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', expected);
  }
});

test('the spread surface participates in chapter material saving and settings push layout', async ({ page }) => {
  await open(page, 'spread');
  await page.locator('[data-action="settings"]').click();
  const panel = page.getByRole('region', { name: '开发者参数设置', exact: true });
  await panel.getByRole('tab', { name: '章节', exact: true }).click();
  await panel.getByRole('tab', { name: '传章', exact: true }).click();
  const group = panel.locator('.developer-settings-group:visible').first();
  if (await group.getAttribute('open') === null) await group.locator('summary').click();
  const opacity = panel.getByRole('spinbutton', { name: '传章案例底板透明度数值', exact: true });
  await opacity.fill('37');
  await opacity.press('Tab');
  await expect(page.locator('#spreadPlaceCard')).toHaveCSS('--surface-opacity', '0.63');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await panel.getByRole('button', { name: '保存设置', exact: true }).click();
  await page.reload();
  await expect(page.locator('#spreadPlaceCard')).toHaveCSS('--surface-opacity', '0.63');
  await expect(page.locator('[data-route="spread"][aria-current="page"]')).toBeVisible();
});

test('source dialog renders saved surface materials after moving out of the home exhibit', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const key = 'nanfeng-lion:developer-settings:v1';
    localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)), cultureSourcesColor: '#123456', cultureSourcesTransparency: 50, cultureSourceCardColor: '#654321', cultureSourceCardTransparency: 25 }));
  });
  await page.reload();
  await page.locator('#enterWork').click();
  await page.getByRole('button', { name: '资料与许可', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '资料与许可' });
  await expect(dialog.locator('[data-surface="cultureSources"]')).toHaveCSS('background-color', 'rgba(18, 52, 86, 0.5)');
  await expect(dialog.locator('[data-surface="cultureSourceCard"]').first()).toHaveCSS('background-color', 'rgba(101, 67, 33, 0.75)');
});
