import { expect, test } from '@playwright/test';
import { assetPaths } from '../../src/config/assetPaths.js';

test('结构与巨幕分别绘制对应完整模型，每份模型和毛发只下载一次', async ({ page }) => {
  const requests = [], errors = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/#/model');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator('#modelStatus')).toContainText('已就绪');
  const model = page.locator('#sceneContainer canvas');
  await expect(model).toHaveAttribute('data-scene-ready', 'true');
  await expect(page.locator('.lx-part-list [data-part-id]')).toHaveCount(17);
  for (const [key, value] of [['groups', '33'], ['strands', '2289801'], ['points', '19929005']]) {
    await expect(model).toHaveAttribute(`data-full-hair-${key}`, value);
    await expect(model).toHaveAttribute(`data-full-hair-drawn-${key}`, value);
  }
  await expect(model).toHaveAttribute('data-source-model', new RegExp('lion-kobi\\.glb$'));
  await page.locator('.lx-part-list [data-part-id="ear_l"]').click();
  await expect(model).toHaveAttribute('data-focused-part', 'ear_l');
  await expect(model).toHaveAttribute('data-highlighted-parts', '["ear_l"]');
  await page.locator('#resetView').click();
  await expect(model).toHaveAttribute('data-focused-part', 'overall');
  await page.locator('.site-header [data-route="action"]').click();
  const theater = page.locator('#chapterStage canvas');
  await expect(theater).toHaveAttribute('data-scene-ready', 'true', { timeout: 45_000 });
  for (const [key, value] of [['groups', '33'], ['strands', '2295421'], ['points', '19957105']]) {
    await expect(theater).toHaveAttribute(`data-full-hair-${key}`, value);
    await expect(theater).toHaveAttribute(`data-full-hair-drawn-${key}`, value);
  }
  await expect(theater).toHaveAttribute('data-source-model', new RegExp('lion-user-full\\.glb$'));
  await expect(page.locator('#chapterStage video')).toHaveCount(4);
  for (const [key, path] of Object.entries(assetPaths)) {
    if (['model', 'modelHairKobi', 'actionLionModel', 'modelHair'].includes(key) || /^lion(?:Kobi)?Hair\d+$/.test(key)) {
      expect(requests.filter(request => request.endsWith(`/${path}`)), `${key}: download once for its chapter`).toHaveLength(1);
    }
  }
  expect(errors).toEqual([]);
});

test('新结构模型完整毛发请求失败会退出加载，并可重试恢复全部毛发', async ({ page }) => {
  const failing = `**/${assetPaths.lionKobiHair33}`;
  await page.route(failing, route => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.goto('/#/model');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator('#modelStatus')).toContainText('模型未能载入');
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(0);
  await page.unroute(failing);
  await page.getByRole('button', { name: '重新载入模型', exact: true }).click();
  await expect(page.locator('#modelStatus')).toContainText('已就绪', { timeout: 45_000 });
  const model = page.locator('#sceneContainer canvas');
  await expect(model).toHaveAttribute('data-source-model', /lion-kobi\.glb$/);
  for (const [key, value] of [['groups', '33'], ['strands', '2289801'], ['points', '19929005']]) {
    await expect(model).toHaveAttribute(`data-full-hair-${key}`, value);
    await expect(model).toHaveAttribute(`data-full-hair-drawn-${key}`, value);
  }
});
