import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const parts = JSON.parse(readFileSync(new URL('../../src/data/lion-structure.json', import.meta.url), 'utf8')).hotspots;

async function openModel(page) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, navigationTypographyVersion: 2 }));
  });
  await page.goto('/#/model');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
}

async function expectCurrent(page, index, focus = true) {
  const part = parts[index];
  const directory = page.getByRole('navigation', { name: '结构部件目录', exact: true });
  await expect(directory.locator('[aria-current="true"]')).toHaveAttribute('data-part-id', part.id);
  await expect(directory.locator('[tabindex="0"]')).toHaveCount(1);
  await expect(directory.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(index + 1));
  await expect(page.locator('#panelTitle')).toHaveText(part.name);
  await expect(page.locator('#modelStage')).toHaveAttribute('data-selected-id', part.id);
  if (focus) {
    await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-focused-part', part.id);
    await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-focus-state', 'idle');
    await expect(page.locator(`#modelHotspots [data-id="${part.id}"]`)).toHaveAttribute('aria-pressed', 'true');
  }
}

test('结构侧边目录六部件与模型、前后翻阅和复原共用选中状态', async ({ page }) => {
  await openModel(page);
  const directory = page.getByRole('navigation', { name: '结构部件目录', exact: true });
  await expect(directory.getByRole('button')).toHaveCount(parts.length);
  await expectCurrent(page, 0, false);
  for (let index = 0; index < parts.length; index += 1) {
    await directory.getByRole('button', { name: `查看${parts[index].name}`, exact: true }).click();
    await expectCurrent(page, index);
    await expect(page.locator('#modelDetailContent')).toHaveJSProperty('scrollTop', 0);
  }
  await page.locator('#nextStructurePart').click();
  await expectCurrent(page, 0);
  await page.locator('#previousStructurePart').click();
  await expectCurrent(page, 5);
  await page.locator('#resetView').click();
  await expectCurrent(page, 0, false);
  await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-focused-part', 'overall');
  await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-focus-state', 'idle');
  await page.locator('#modelHotspots [data-id="eyes"]').click();
  await expectCurrent(page, 1);
});

test('结构目录支持方向键、首末键与循环选择，键盘焦点跟随当前部件', async ({ page }) => {
  await openModel(page);
  const directory = page.getByRole('navigation', { name: '结构部件目录', exact: true });
  await directory.locator('[aria-current="true"]').focus();
  for (const [key, index] of [['ArrowDown', 1], ['End', 5], ['ArrowDown', 0], ['ArrowUp', 5], ['Home', 0], ['ArrowRight', 1], ['ArrowLeft', 0]]) {
    await page.keyboard.press(key);
    await expectCurrent(page, index);
    await expect(directory.locator('[aria-current="true"]')).toBeFocused();
  }
});

test('电脑窗口、低高度与设置推开时侧边目录保持独立可用', async ({ page }) => {
  await openModel(page);
  const directory = page.getByRole('navigation', { name: '结构部件目录', exact: true });
  for (const [width, height] of [[900, 900], [1366, 768], [1920, 1080], [1280, 600]]) {
    await page.setViewportSize({ width, height });
    const bounds = await directory.boundingBox();
    const content = await page.locator('#modelDetailContent').boundingBox();
    const panel = await page.locator('#structurePanel').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(panel.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(content.x + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(panel.y + panel.height + 1);
    await page.locator('#resetView').click();
    await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-focused-part', 'overall');
    await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-focus-state', 'idle');
    await page.screenshot({ path: test.info().outputPath(`structure-directory-${width}x${height}.png`), fullPage: true });
    await directory.getByRole('button', { name: `查看${parts[5].name}`, exact: true }).click();
    await expectCurrent(page, 5);
    const active = await directory.locator('[aria-current="true"]').boundingBox();
    expect(active.y).toBeGreaterThanOrEqual(bounds.y - 1);
    expect(active.y + active.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
    await page.locator('#modelDetailContent').evaluate(node => { node.scrollTop = node.scrollHeight; });
    expect((await directory.boundingBox()).y).toBeCloseTo(bounds.y, 1);
    await expect(page.locator('#nextStructurePart')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await directory.getByRole('button', { name: `查看${parts[2].name}`, exact: true }).click();
  await expectCurrent(page, 2);
  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  const panel = await page.locator('#structurePanel').boundingBox();
  const settings = await page.locator('#developerSettingsPanel').boundingBox();
  expect(panel.x + panel.width).toBeLessThanOrEqual(settings.x + 1);
  // The settings guard intentionally owns input; retain the actual selection
  // made before opening it while verifying the pushed reading layout.
  await expectCurrent(page, 2);
  await page.screenshot({ path: test.info().outputPath('structure-directory-settings-push.png'), fullPage: true });
});
