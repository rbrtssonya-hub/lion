import { test, expect } from '@playwright/test';
import { expandSettingsGroups, selectSettingsFor, settingsPages } from './settings-navigation.helpers.js';

const sizes = [[1024, 768], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160], [1280, 600], [900, 600]];
async function open(page, route = '') {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    if (window !== top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, navigationTypographyVersion: 2 }));
  });
  await page.goto(`/${route}`);
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60000 });
}
async function noHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test('类型展开按内容余宽重排，侧轨透明且首页左右留白对称', async ({ page }) => {
  await open(page);
  const types = page.locator('#homeLionTypes');
  await types.locator('.heritage-type-image').click();
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await types.scrollIntoViewIfNeeded();
    await expect.poll(() => types.evaluate(section => {
      const root = section.querySelector('.heritage-inner');
      const image = section.querySelector('.heritage-figure').getBoundingClientRect();
      const copy = section.querySelector('.heritage-type-copy').getBoundingClientRect();
      return root.clientWidth >= 760 ? image.right <= copy.left + 2 : image.bottom <= copy.top + 2;
    }), { message: `${width}x${height}: reveal uses actual content width` }).toBe(true);
    await noHorizontalOverflow(page);
    const center = await types.locator('.heritage-inner').evaluate(node => {
      const a = node.getBoundingClientRect(), b = node.closest('.site-page').getBoundingClientRect();
      return Math.abs(a.left + a.right - b.left - b.right) / 2;
    });
    expect(center).toBeLessThan(2);
    const rail = page.getByRole('navigation', { name: '首页章节导航' });
    await expect(rail).toBeVisible();
    const railBox = await rail.boundingBox();
    const headerBottom = await page.locator('.site-header').evaluate(node => node.getBoundingClientRect().bottom);
    expect(railBox.y).toBeGreaterThanOrEqual(headerBottom + 8);
    expect(railBox.y + railBox.height).toBeLessThanOrEqual(height - 8);
    expect(await rail.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  }
  await types.getByRole('button', { name: '形制对照', exact: true }).click();
  await expect(types.locator('.heritage-comparison-card')).toHaveCount(2);
  for (const card of await types.locator('.heritage-comparison-card').all()) {
    await expect(card).toBeVisible();
    expect(await card.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  }
});

test('结构图鉴按电脑余宽保留模型阅读双栏，画布热点与末尾资料可达', async ({ page }) => {
  await open(page, '#/model');
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.locator('#modelStage').evaluate(stage => {
      const a = stage.querySelector('.scene-column').getBoundingClientRect();
      const b = stage.querySelector('.structure-panel').getBoundingClientRect();
      const w = stage.closest('.site-page').clientWidth;
      return w >= 850 ? a.right <= b.left + 2 : a.bottom <= b.top + 2;
    }), { message: `${width}x${height}: model layout follows available width` }).toBe(true);
    await noHorizontalOverflow(page);
    await page.locator('#resetView').click();
    await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-focus-state', 'idle');
    await page.locator('#modelHotspots button[data-id="mouth"]').click();
    await expect(page.locator('#modelStage')).toHaveAttribute('data-selected-id', 'mouth');
    await expect(page.locator('#structureBoundary p')).toBeVisible();
  }
});

test('神态浏览与对照在宽窄及低高度电脑保持可读、没有横向溢出', async ({ page }) => {
  await open(page, '#/state');
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await noHorizontalOverflow(page);
    await page.getByRole('navigation', { name: '醒狮八态', exact: true }).getByRole('button', { name: '疑', exact: true }).click();
    await page.locator('#expressionLionTrigger').click();
    await page.getByRole('button', { name: '返回神态简介', exact: false }).click();
    await page.getByRole('button', { name: '神态对照', exact: true }).click();
    await expect(page.locator('.expression-comparison-card')).toHaveCount(2);
    for (const card of await page.locator('.expression-comparison-card').all()) {
      expect(await card.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
      await card.locator('dd').last().scrollIntoViewIfNeeded();
      await expect(card.locator('dd').last()).toBeInViewport();
    }
    await noHorizontalOverflow(page);
    await page.getByRole('button', { name: '八态浏览', exact: true }).click();
  }
});

test('低高度电脑加载页仍呈现全部必要文案和真实进度', async ({ page }) => {
  for (const [width, height] of [[1280, 500], [683, 512], [700, 520], [701, 520]]) {
  await page.setViewportSize({ width, height });
  await page.goto('/assets/loading/index.html');
  for (const selector of ['.eyebrow', '.subtitle', '.status', '.number', '.note', '.bottom']) {
    await expect(page.locator(selector)).toBeVisible();
    expect(await page.locator(selector).evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(14);
  }
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await noHorizontalOverflow(page);
  }
});

test('桌面缩放后的窄余宽将神态目录移到上方，保留全部八态与正文', async ({ page }) => {
  await open(page, '#/state');
  for (const [width, height] of [[853, 600], [683, 512]]) {
    await page.setViewportSize({ width, height });
    const nav = page.getByRole('navigation', { name: '醒狮八态', exact: true });
    await expect.poll(async () => {
      const a = await nav.boundingBox(), b = await page.locator('#expressionObservation').boundingBox();
      return a.y + a.height <= b.y + 2;
    }).toBe(true);
    await expect(nav.getByRole('button')).toHaveCount(8);
    await nav.getByRole('button', { name: '惊', exact: true }).click();
    await page.locator('#expressionLionTrigger').click();
    await page.locator('#expressionMotionCue').scrollIntoViewIfNeeded();
    await expect(page.locator('#expressionMotionCue')).toBeInViewport();
    await noHorizontalOverflow(page);
  }
});

test('设置面板按900px余宽回退且不覆盖保存偏好，窄面板可操作十页', async ({ page }) => {
  await open(page);
  await page.locator('.site-header [data-action="settings"]').click();
  const panel = page.getByRole('region', { name: '开发者参数设置' });
  await selectSettingsFor(page, 'panelWidth');
  const savedBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('nanfeng-lion:developer-settings:v1')));
  const field = panel.getByRole('spinbutton', { name: '设置面板宽度数值', exact: true });
  for (const [width, height] of [[1024, 768], [1366, 768], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    for (const panelWidth of [280, 460, 760]) {
      await field.fill(String(panelWidth)); await field.press('Tab');
      const shell = await page.locator('.site-shell').evaluate(node => node.clientWidth);
      await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', shell - panelWidth >= 900 ? 'push' : 'overlay');
      expect(await panel.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
      await noHorizontalOverflow(page);
    }
  }
  await field.fill('280'); await field.press('Tab');
  const tabs = panel.getByRole('tablist', { name: '设置分类', exact: true }).getByRole('tab');
  await expect(tabs).toHaveCount(settingsPages.length);
  for (const tab of await tabs.all()) {
    await tab.click(); await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expandSettingsGroups(page);
    const lastControl = panel.locator('.developer-settings-page:visible').locator('input:visible,select:visible,button:visible').last();
    await lastControl.scrollIntoViewIfNeeded(); await expect(lastControl).toBeInViewport();
  }
  const savedAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('nanfeng-lion:developer-settings:v1')));
  expect(savedAfter.pushPage).toBe(savedBefore.pushPage);
  expect(savedAfter.headerHeight).toBe(savedBefore.headerHeight);
  expect(savedAfter.navFontSize).toBe(savedBefore.navFontSize);
});
