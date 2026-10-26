import { expect, test } from '@playwright/test';
import { assetPaths } from '../../src/config/assetPaths.js';

test('结构与巨幕都实际绘制完整新狮，跨章复用全部模型与毛发请求', async ({ page }) => {
  const requests = [], errors = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/#/model');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator('#modelStatus')).toContainText('模型已载入');
  const model = page.locator('#sceneContainer canvas');
  for (const [key, value] of [['groups', '33'], ['strands', '2289801'], ['points', '19929005']]) {
    await expect(model).toHaveAttribute(`data-full-hair-${key}`, value);
    await expect(model).toHaveAttribute(`data-full-hair-drawn-${key}`, value);
  }
  await expect(model).toHaveAttribute('data-source-model', new RegExp('lion-user-full\\.glb$'));
  expect(Number(await model.getAttribute('data-render-lines'))).toBe(25_110_448);
  await page.locator('#modelHotspots [data-id="eyes"]').click();
  await expect(model).toHaveAttribute('data-focused-part', 'eyes');
  await page.locator('#resetView').click();
  await expect(model).toHaveAttribute('data-focused-part', 'overall');
  await page.locator('.site-header [data-route="action"]').click();
  const theater = page.locator('#chapterStage canvas');
  await expect(theater).toHaveAttribute('data-scene-ready', 'true', { timeout: 45_000 });
  for (const [key, value] of [['groups', '33'], ['strands', '2289801'], ['points', '19929005']]) {
    await expect(theater).toHaveAttribute(`data-full-hair-${key}`, value);
    await expect(theater).toHaveAttribute(`data-full-hair-drawn-${key}`, value);
  }
  await expect(theater).toHaveAttribute('data-source-model', new RegExp('lion-user-full\\.glb$'));
  await expect(page.locator('#chapterStage video')).toHaveCount(4);
  for (const [key, path] of Object.entries(assetPaths)) {
    if (key === 'model' || key === 'modelHair' || /^lionHair\d+$/.test(key)) {
      expect(requests.filter(request => request.endsWith(`/${path}`)), `${key}: download once for both chapters`).toHaveLength(1);
    }
  }
  expect(errors).toEqual([]);
});

test('完整毛发请求失败会明确退出加载并可重试恢复全量毛发', async ({ page }) => {
  const failing = `**/${assetPaths.lionHair33}`;
  await page.route(failing, route => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.goto('/#/model');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator('#modelStatus')).toContainText('模型载入失败');
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(0);
  await page.unroute(failing);
  await page.getByRole('button', { name: '重新载入', exact: true }).click();
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-full-hair-drawn-strands', '2289801');
});
