import { test, expect } from '@playwright/test';
import { assetPaths } from '../../src/config/assetPaths.js';
import { settingsPanel, selectSettingsPage } from './settings-navigation.helpers.js';

test.use({ trace: 'off' });
test.setTimeout(120_000);
const board = page => page.locator('#spreadPlaceCard.spread-stamp-board');
const stamp = (page, id) => board(page).locator(`.spread-stamp-hit[data-stamp="${id}"]`);
const canvas = page => board(page).locator('canvas[data-renderer="regional-stamp-webgl"]');

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ pushPage: true, bookAutoplay: false, carouselAutoplay: false }));
  });
});

async function openSpread(page, { expectedStatus = 'ready', region = '世界' } = {}) {
  await page.goto('/#/spread');
  await expect(page.locator('#spreadStage')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(board(page)).toHaveAttribute('data-stamp-status', expectedStatus, { timeout: 65_000 });
  await page.getByRole('tab', { name: region, exact: true }).click();
  await expect(page.locator('.spread-map')).toHaveAttribute('data-map-motion', /idle|failed/);
}

test('地图与键盘选城同步到对应邮票，香港和旧金山异名映射可往返', async ({ page }) => {
  await openSpread(page);
  await expect(page.getByText('所收录案例分布示意', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '中国', exact: true }).click();
  const hongKong = page.getByRole('button', { name: '选择香港邮票', exact: true });
  await hongKong.focus();
  await page.keyboard.press('Enter');
  await expect(hongKong).toHaveAttribute('aria-pressed', 'true');
  await expect(stamp(page, 'hongkong')).toHaveAttribute('data-map-selected', 'true');
  await stamp(page, 'hongkong').focus();
  await page.keyboard.press('Enter');
  await expect(board(page)).toHaveAttribute('data-stamp-phase', 'focused');
  await expect(stamp(page, 'hongkong')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(board(page)).toHaveAttribute('data-stamp-phase', /idle|hovering/);
  await page.getByRole('tab', { name: '世界', exact: true }).click();
  const singapore = page.getByRole('button', { name: '选择新加坡邮票', exact: true });
  await singapore.focus();
  await page.keyboard.press('Space');
  await expect(stamp(page, 'singapore')).toHaveAttribute('data-map-selected', 'true');
  await stamp(page, 'sanfrancisco').click();
  await expect(board(page)).toHaveAttribute('data-stamp-phase', 'focused');
  await expect(page.getByRole('button', { name: '选择旧金山邮票', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(stamp(page, 'sanfrancisco')).toHaveAttribute('data-map-selected', 'true');
  await expect(page.locator('#spreadStage > .sr-only[role="status"]')).toContainText('当前城市：旧金山');
});

test('右侧只展示地域艺术邮票，聚焦完整放大并保留AI标注与返回操作', async ({ page }) => {
  await openSpread(page);
  await expect(board(page).locator('.spread-stamp-note')).toBeVisible();
  await expect(board(page).locator('.spread-stamp-note')).toContainText('AI辅助艺术邮票 · 非历史发行邮票');
  await expect(page.locator('.spread-figure, .spread-photo, .spread-photo-controls, .spread-case-reading, .spread-place-heading')).toHaveCount(0);
  await expect(board(page).locator('.spread-stamp-hit:visible')).toHaveCount(4);
  const originalCanvas = await canvas(page).elementHandle();
  const initial = await stamp(page, 'london').boundingBox();
  await stamp(page, 'london').click();
  await expect(board(page)).toHaveAttribute('data-stamp-phase', 'focused');
  const enlarged = await stamp(page, 'london').boundingBox();
  const frame = await board(page).boundingBox();
  expect(enlarged.width).toBeGreaterThan(initial.width * 1.2);
  expect(enlarged.height).toBeGreaterThan(initial.height * 1.2);
  expect(enlarged.x).toBeGreaterThanOrEqual(frame.x - 1);
  expect(enlarged.y).toBeGreaterThanOrEqual(frame.y - 1);
  expect(enlarged.x + enlarged.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
  expect(enlarged.y + enlarged.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
  expect(enlarged.width / enlarged.height).toBeCloseTo(40 / 75, 2);
  await page.getByRole('button', { name: '返回本组邮票', exact: true }).click();
  await expect(board(page)).toHaveAttribute('data-stamp-phase', /idle|hovering/);
  await expect(board(page).locator('.spread-stamp-hit:visible')).toHaveCount(4);
  expect(await originalCanvas.evaluate(node => node === document.querySelector('.spread-stamp-host canvas'))).toBe(true);
});

test('票面图片失败时明确回退，切组和地图仍可用，重试后恢复当前组WebGL', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const failedAsset = `**/${assetPaths.spreadStampFoshan}`;
  await page.route(failedAsset, route => route.abort());
  await openSpread(page, { expectedStatus: 'error', region: '中国' });
  await expect(board(page)).toHaveAttribute('data-stamp-level', 'china');
  await expect(board(page).locator('.spread-stamp-fallback-item')).toHaveCount(4);
  await expect(board(page).locator('.spread-stamp-error')).toContainText('已显示静态邮票');
  await page.getByRole('button', { name: '选择香港邮票', exact: true }).click();
  await expect(page.getByRole('button', { name: '选择香港邮票', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.unroute(failedAsset);
  await page.getByRole('button', { name: '重新载入光影', exact: true }).click();
  await expect(board(page)).toHaveAttribute('data-stamp-status', 'ready', { timeout: 65_000 });
  await expect(canvas(page)).toHaveAttribute('data-shader-ready', 'true');
  await expect(board(page).locator('.spread-stamp-hit:visible')).toHaveCount(4);
  await expect(stamp(page, 'hongkong')).toHaveAttribute('data-map-selected', 'true');
  await stamp(page, 'hongkong').click();
  await expect(board(page)).toHaveAttribute('data-stamp-phase', 'focused');
  expect(errors).toEqual([]);
});

test('三个电脑窗口地图与四枚邮票同屏，邮票设置推开后仍可聚焦并保留选城', async ({ page }) => {
  await openSpread(page);
  for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.locator('#spreadStage').evaluate(stage => {
      const rect = stage.getBoundingClientRect();
      const map = stage.querySelector('.spread-map').getBoundingClientRect();
      const card = stage.querySelector('.spread-stamp-board').getBoundingClientRect();
      return rect.bottom <= innerHeight + 2 && map.width > 300 && card.width > 320
        && stage.scrollWidth <= stage.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth;
    })).toBe(true);
    await expect(board(page).locator('.spread-stamp-note')).toBeInViewport();
    await expect(board(page).locator('.spread-stamp-hit:visible')).toHaveCount(4);
    await expect(page.getByRole('button', { name: '返回戏台', exact: true })).toBeInViewport();
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole('button', { name: '选择旧金山邮票', exact: true }).click();
  await expect(stamp(page, 'sanfrancisco')).toHaveAttribute('data-map-selected', 'true');
  const originalCanvas = await canvas(page).elementHandle();
  await page.locator('.site-navigation [data-action="settings"]').click();
  await selectSettingsPage(page, '邮票');
  await expect(settingsPanel(page)).toBeVisible();
  await expect(page.locator('.settings-outside-guard')).toHaveCount(0);
  await expect.poll(() => page.locator('#spreadStage').evaluate(stage => stage.scrollWidth - stage.clientWidth)).toBeLessThanOrEqual(1);
  await expect(stamp(page, 'sanfrancisco')).toHaveAttribute('data-map-selected', 'true');
  await stamp(page, 'sanfrancisco').click();
  await expect(board(page)).toHaveAttribute('data-stamp-phase', 'focused');
  await expect(settingsPanel(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(board(page)).toHaveAttribute('data-stamp-phase', /idle|hovering/);
  await expect(settingsPanel(page)).toBeVisible();
  await settingsPanel(page).getByRole('button', { name: '取消', exact: true }).click();
  await expect(settingsPanel(page)).toHaveCount(0);
  expect(await originalCanvas.evaluate(node => node === document.querySelector('.spread-stamp-host canvas'))).toBe(true);
  await page.getByRole('tab', { name: '中国', exact: true }).click();
  await page.getByRole('button', { name: '选择香港邮票', exact: true }).click();
  await expect(stamp(page, 'hongkong')).toHaveAttribute('data-map-selected', 'true');
});
