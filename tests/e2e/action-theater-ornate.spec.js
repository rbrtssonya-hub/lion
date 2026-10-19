import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { scene, openTheater, jsonAttribute } from './action-theater.helpers.js';

const reviewDir = resolve(process.env.ACTION_THEATER_REVIEW_DIR || 'source/reviews/action-theater/2026-10-19-ornate');
const composition = page => jsonAttribute(scene(page), 'data-composition');

// These values are projected from current world geometry, rather than design
// constants. A screenshot review remains necessary to assess visual occlusion.
test('红金剧场初始真实投影满足主狮和低矮完整舞台的构图比例', async ({ page }, testInfo) => {
  await openTheater(page);
  await expect.poll(async () => (await composition(page))?.lion?.heightRatio).toBeGreaterThanOrEqual(.32);
  const current = await composition(page);
  expect(current.lion.heightRatio).toBeLessThanOrEqual(.42);
  expect(current.stage.widthRatio).toBeGreaterThanOrEqual(.60);
  expect(current.stage.widthRatio).toBeLessThanOrEqual(.75);
  expect(Math.abs(current.lion.worldMinY - current.stage.worldTopY)).toBeLessThan(.025);
  for (const bounds of [current.lion, current.stage]) {
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(1);
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.bottom).toBeLessThanOrEqual(1);
  }
  await testInfo.attach('actual-initial-composition', { body: JSON.stringify(current, null, 2), contentType: 'application/json' });
  mkdirSync(reviewDir, { recursive: true });
  await page.screenshot({ path: resolve(reviewDir, 'action-theater-initial-three-screens-1920.png') });
});

test('初始三面真巨幕可见且后方第四屏保持16比9可供环绕观看', async ({ page }) => {
  await openTheater(page);
  const current = await composition(page);
  expect(Object.keys(current.screens).sort()).toEqual(['doumao', 'meihuazhuang', 'tanqing', 'tuqiu']);
  for (const screen of Object.values(current.screens)) {
    expect(screen.worldWidth / screen.worldHeight).toBeCloseTo(16 / 9, 5);
    expect(screen.worldWidth).toBeGreaterThan(12);
    expect(screen.worldHeight).toBeGreaterThan(7);
  }
  for (const id of ['tanqing', 'doumao', 'meihuazhuang']) {
    expect(current.screens[id].inFront).toBe(true);
    expect(current.screens[id].visible).toBe(true);
  }
  expect(current.screens.tuqiu.inFront).toBe(false);
  expect(current.screens.tuqiu.visible).toBe(false);
});

test('真实梁架红柱与重复金饰采用实例，石材反射实际更新并在平面模式暂停', async ({ page }) => {
  await openTheater(page);
  await expect.poll(async () => (await composition(page))?.reflection?.passes).toBeGreaterThan(0);
  const current = await composition(page);
  const components = current.architecture.components;
  expect(components.Theater_Column_Red_Lacquer).toBeGreaterThanOrEqual(4);
  expect(components.Theater_Continuous_RedGold_Beam).toBeGreaterThanOrEqual(12);
  expect(components.Theater_Continuous_Carved_Lintel).toBeGreaterThan(100);
  expect(components.Theater_Screen_Thick_Black_Upright).toBe(8);
  expect(components.Theater_Screen_Thick_Black_Crossbar).toBe(8);
  expect(current.architecture.instancedDraws).toBeGreaterThan(0);
  expect(current.architecture.gridVisibleCount).toBe(0);
  expect(current.architecture.stoneRoughness).toBeGreaterThan(.1);
  expect(current.reflection.enabled).toBe(true);
  expect(current.reflection.size).toBeLessThanOrEqual(1024);
  expect(current.reflection.maxHz).toBeLessThanOrEqual(20);
  expect(current.reflection.blurTaps).toBeGreaterThan(1);
  const firstPasses = current.reflection.passes;
  await expect.poll(async () => (await composition(page)).reflection.passes).toBeGreaterThan(firstPasses);
  await page.getByRole('button', { name: '平面观看', exact: true }).click();
  await expect(scene(page)).toHaveAttribute('data-render-state', 'inactive');
  const pausedPasses = (await composition(page)).reflection.passes;
  await page.waitForTimeout(350);
  expect((await composition(page)).reflection.passes).toBe(pausedPasses);
});

test('三种桌面画幅信息面板避开主狮头部并保留完整操作区域', async ({ page }, testInfo) => {
  await openTheater(page);
  for (const [width, height] of [[1920, 1080], [1366, 768], [900, 900]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(async () => {
      const state = await composition(page);
      if (!state?.lion) return false;
      const canvas = await scene(page).boundingBox();
      const panel = await page.locator('#theaterObservation').boundingBox();
      if (Math.abs(state.quality.width - canvas.width) > 1 || Math.abs(state.quality.height - canvas.height) > 1) return false;
      if (state.stage.left < 0 || state.stage.right > 1 || state.stage.top < 0 || state.stage.bottom > 1) return false;
      // The upper region contains the elevated head of the preserved model.
      const lion = state.lion;
      const head = { left: canvas.x + lion.left * canvas.width, right: canvas.x + lion.right * canvas.width, top: canvas.y + lion.top * canvas.height, bottom: canvas.y + (lion.top + lion.heightRatio * .65) * canvas.height };
      return panel.x + panel.width <= head.left || panel.x >= head.right || panel.y + panel.height <= head.top || panel.y >= head.bottom;
    }).toBe(true);
    await expect(page.locator('#theaterControls')).toBeVisible();
    await expect(page.locator('.theater-action-nav button')).toHaveCount(4);
    await testInfo.attach(`actual-composition-${width}`, { body: JSON.stringify(await composition(page), null, 2), contentType: 'application/json' });
  }
});
