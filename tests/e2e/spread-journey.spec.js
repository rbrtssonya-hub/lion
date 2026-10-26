import { test, expect } from '@playwright/test';
import { assetPaths } from '../../src/config/assetPaths.js';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ pushPage: true, carouselAutoplay: false }));
  });
});

async function openSpread(page) {
  await page.goto('/#/spread');
  await expect(page.locator('#spreadStage')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('tab', { name: '世界', exact: true }).click();
}

test('地图点击与键盘选择切换真实地点，选中态和当前照片同步', async ({ page }) => {
  await openSpread(page);
  await expect(page.getByText('所收录案例分布示意', { exact: true })).toBeVisible();
  const hongKong = page.getByRole('button', { name: '选择香港案例', exact: true });
  await hongKong.focus();
  await page.keyboard.press('Enter');
  await expect(hongKong).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#spreadPlaceTitle')).toHaveText('香港');
  await expect(page.locator('.spread-photo-caption')).toContainText('香港九龙公园');
  await expect(page.locator('.spread-photo-year')).toHaveText('拍摄年 · 2009');
  const singapore = page.getByRole('button', { name: '选择新加坡案例', exact: true });
  await singapore.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#spreadPlaceTitle')).toHaveText('新加坡');
  await page.getByRole('button', { name: '选择旧金山案例', exact: true }).click();
  await expect(page.locator('.spread-photo-caption')).toContainText('美国旧金山唐人街');
});

test('同地点照片切换保留原图注、作者、CC许可与来源', async ({ page }) => {
  await openSpread(page);
  await page.getByRole('button', { name: '选择新加坡案例', exact: true }).click();
  await expect(page.locator('.spread-photo')).toHaveAttribute('alt', /安祥路/);
  await expect(page.locator('.spread-photo-credit a').first()).toHaveText('Red Eyes Black Dragon 92');
  await page.getByRole('button', { name: '下一幅照片', exact: true }).click();
  await expect(page.locator('.spread-photo')).toHaveAttribute('alt', /白色狮头近景/);
  await expect(page.locator('.spread-photo-credit a').first()).toHaveText('Eustaquio Santimano');
  await expect(page.locator('.spread-photo-credit a').last()).toHaveText('CC BY 2.0');
  await expect(page.locator('.spread-photo-credit a').last()).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/2.0/');
  await page.getByRole('button', { name: '下一幅照片', exact: true }).click();
  await expect(page.locator('.spread-photo-caption')).toContainText('ABC砖厂熟食中心');
  await expect(page.locator('.spread-photo-count')).toHaveText('03 / 03');
  await page.getByRole('button', { name: '上一幅照片', exact: true }).click();
  await expect(page.locator('.spread-photo-count')).toHaveText('02 / 03');
});

test('图片失败仍显示说明与原始许可，可切换到下一幅正常照片', async ({ page }) => {
  await page.route(`**/${assetPaths.cultureFoshan}`, route => route.abort());
  await openSpread(page);
  await expect(page.getByText('实景照片暂未载入')).toBeVisible();
  await expect(page.locator('.spread-photo-caption')).toContainText('广东佛山');
  await expect(page.locator('.spread-photo-credit')).toContainText('David Chen');
  await page.getByRole('button', { name: '下一幅照片', exact: true }).click();
  await expect(page.locator('.spread-photo')).toHaveAttribute('alt', /广州青砖/);
  await expect.poll(() => page.locator('.spread-photo').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.getByText('实景照片暂未载入')).toHaveCount(0);
});

test('三个电脑窗口地图与图文同屏、无横向溢出，设置推开保留当前阅读', async ({ page }) => {
  await openSpread(page);
  for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.locator('#spreadStage').evaluate(stage => {
      const rect = stage.getBoundingClientRect();
      const map = stage.querySelector('.spread-map').getBoundingClientRect();
      const card = stage.querySelector('.spread-case').getBoundingClientRect();
      return rect.bottom <= innerHeight + 2 && map.width > 300 && card.width > 320
        && stage.scrollWidth <= stage.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth;
    })).toBe(true);
    await expect(page.locator('.spread-photo-credit')).toBeInViewport();
    await expect(page.getByRole('button', { name: '返回戏台', exact: true })).toBeInViewport();
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.getByRole('button', { name: '选择埃德蒙顿案例', exact: true }).click();
  await page.locator('.site-navigation [data-action="settings"]').click();
  await expect(page.getByRole('region', { name: '开发者参数设置' })).toBeVisible();
  await expect.poll(() => page.locator('#spreadStage').evaluate(stage => stage.scrollWidth - stage.clientWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('#spreadPlaceTitle')).toHaveText('埃德蒙顿');
  await expect(page.locator('.spread-photo-credit')).toContainText('Kurt Bauschardt');
  await expect(page.locator('.spread-photo-credit')).toBeInViewport();
  // The shared settings guard intentionally closes the panel on outside click.
  await page.locator('.settings-outside-guard').click({ position: { x: 20, y: 140 } });
  await expect(page.getByRole('region', { name: '开发者参数设置' })).toHaveCount(0);
  await page.getByRole('button', { name: '选择香港案例', exact: true }).click();
  await expect(page.locator('#spreadPlaceTitle')).toHaveText('香港');
});
