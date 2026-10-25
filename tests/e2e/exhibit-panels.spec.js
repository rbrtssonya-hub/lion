import { expect, test } from '@playwright/test';
import { openTheater, selectAction } from './action-theater.helpers.js';

const desktops = [[1366, 768], [1440, 900], [1920, 1080]];

async function openModel(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({
      hdriEnabled: false, carouselAutoplay: false, bookAutoplay: false,
    }));
  });
  await page.goto('/#/model');
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
}

async function expectPanelFamily(page, selectors) {
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  const panels = await page.evaluate(selectors => selectors.map(selector => {
    const element = document.querySelector(selector);
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return { selector, radius: parseFloat(style.borderTopLeftRadius),
      borders: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map(parseFloat),
      background: [style.backgroundColor, style.backgroundImage],
      left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
  }), selectors);
  for (const panel of panels) {
    expect(panel.radius, `${panel.selector} has the same rounded paper edge`).toBeGreaterThanOrEqual(10);
    expect(panel.radius).toBe(panels[0].radius);
    for (const border of panel.borders) expect(border, `${panel.selector} retains its paper outline`).toBeGreaterThanOrEqual(1);
    expect(panel.background, `${panel.selector} shares the chapter's paper material`).toEqual(panels[0].background);
    expect(panel.left).toBeGreaterThanOrEqual(-1);
    expect(panel.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(panel.top).toBeGreaterThanOrEqual(-1);
    expect(panel.bottom).toBeLessThanOrEqual(viewport.height + 1);
    expect(panel.width).toBeGreaterThan(0);
    expect(panel.height).toBeGreaterThan(0);
  }
  for (const [index, panel] of panels.entries()) {
    for (const other of panels.slice(index + 1)) {
      const overlap = Math.min(panel.right, other.right) - Math.max(panel.left, other.left) > 2
        && Math.min(panel.bottom, other.bottom) - Math.max(panel.top, other.top) > 2;
      expect(overlap, `${panel.selector} does not cover ${other.selector}`).toBe(false);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

test('结构基础说明直接可读，部件翻阅仍发现对应形制与工艺', async ({ page }) => {
  test.setTimeout(120_000);
  await openModel(page);
  await expect(page.locator('#structurePanel details')).toHaveCount(0);
  await expect(page.locator('#panelFunction')).toBeVisible();
  await expect(page.locator('#panelMaterial')).toBeVisible();
  await expect(page.locator('#structureBoundary p')).toBeVisible();
  await page.getByRole('button', { name: '查看狮嘴', exact: true }).click();
  await expect(page.locator('#panelTitle')).toHaveText('狮嘴');
  await expect(page.locator('#modelStage')).toHaveAttribute('data-selected-id', 'mouth');
  await expect(page.locator('#panelFunction')).toBeVisible();
  await page.locator('#panelFunction').scrollIntoViewIfNeeded();
  await expect(page.locator('#panelFunction')).toBeInViewport();
});

test('结构标题、阅读与视图操作保持同族圆角纸面且桌面不重叠', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await openModel(page);
  for (const [width, height] of desktops) {
    await page.setViewportSize({ width, height });
    await expectPanelFamily(page, ['.model-scene-heading', '#structurePanel', '.model-scene-tools']);
    await page.screenshot({ path: testInfo.outputPath(`model-${width}x${height}.png`) });
  }
});

test('动作标题、巨幕解读、播放器和视图按钮共享暗纸圆角，切换保持真实内容', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await openTheater(page, { reducedMotion: 'reduce', settings: { hdriEnabled: false } });
  for (const [width, height] of desktops) {
    await page.setViewportSize({ width, height });
    await expectPanelFamily(page, ['.theater-topline', '#theaterObservation', '.theater-bottom', '.theater-view-tools button:first-child', '.theater-view-tools button:last-child']);
    await page.screenshot({ path: testInfo.outputPath(`action-${width}x${height}.png`) });
  }
  await selectAction(page, 'doumao');
  await expect(page.locator('.theater-caption.is-current h2')).toHaveText('抖毛');
  await page.getByRole('button', { name: '平面观看', exact: true }).click();
  await expect(page.locator('#actionTheater')).toHaveAttribute('data-view', 'flat');
  await expect(page.getByRole('slider', { name: '当前动作播放进度', exact: true })).toBeVisible();
});
