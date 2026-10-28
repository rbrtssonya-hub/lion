import { test, expect } from '@playwright/test';
import { assetPaths } from '../../src/config/assetPaths.js';

const modelRequestPattern = `**/${assetPaths.model}`;
test.use({ viewport: { width: 1440, height: 900 } });
test.setTimeout(90_000);

async function skipIntro(page) {
  await page.addInitScript(() => {
    if (window === top) sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
  });
}

async function moveTo(page, route) {
  await page.evaluate(target => { location.hash = `#/${target}`; }, route);
}

test('直接进入传章时不预热结构模型，离开后正常载入', async ({ page }) => {
  await skipIntro(page);
  let requests = 0;
  page.on('request', request => { if (request.url().endsWith(`/${assetPaths.model}`)) requests++; });
  await page.goto('/#/spread');
  await expect(page.locator('#spreadStage')).toBeVisible();
  await expect(page.locator('#modelStage')).toHaveCount(0);
  await page.getByRole('tab', { name: '世界', exact: true }).click();
  await expect(page.locator('.spread-map')).toHaveAttribute('data-map-motion', 'moving');
  await expect(page.locator('.spread-map')).toHaveAttribute('data-map-motion', 'idle', { timeout: 15_000 });
  expect(requests).toBe(0);
  await moveTo(page, 'model');
  await expect(page.locator('#modelStage')).toBeVisible();
  await expect(page.locator('#model-reading-panel-form .lion-experience')).toHaveAttribute('data-ready', 'true', { timeout: 80_000 });
  expect(requests).toBe(1);
});

test('首页模型预热未完成时进入传章取消准备，离开后重新载入', async ({ page }) => {
  await skipIntro(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let requests = 0;
  // The model is held by a shared lease. Verify that releasing its last user
  // aborts the fetch signal itself, rather than relying on requestfailed timing
  // while Playwright is deliberately holding the route response.
  await page.addInitScript(modelPath => {
    if (window !== top) return;
    const original = window.fetch;
    window.__modelFetchAborts = 0;
    window.fetch = function (input, init) {
      if (String(input).endsWith(modelPath) && init?.signal) {
        init.signal.addEventListener('abort', () => { window.__modelFetchAborts++; }, { once: true });
      }
      return original.call(this, input, init);
    };
  }, `/${assetPaths.model}`);
  await page.route(modelRequestPattern, async route => {
    requests++;
    if (requests === 1) await gate;
    await route.continue().catch(() => {});
  });
  try {
    await page.goto('/#/entry');
    await expect.poll(() => requests).toBe(1);
    await page.evaluate(() => { window.__prewarmCanvas = document.querySelector('#sceneContainer canvas'); });
    expect(await page.evaluate(() => Boolean(window.__prewarmCanvas))).toBe(true);
    await moveTo(page, 'spread');
    await expect(page.locator('#spreadStage')).toBeVisible();
    await expect(page.locator('#modelStage')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.__modelFetchAborts)).toBe(1);
    expect(await page.evaluate(() => window.__prewarmCanvas.isConnected)).toBe(false);
    release();
    await expect(page.locator('#modelStage')).toHaveCount(0);
    await moveTo(page, 'model');
    await expect(page.locator('#modelStage')).toBeVisible();
    await expect(page.locator('#model-reading-panel-form .lion-experience')).toHaveAttribute('data-ready', 'true', { timeout: 80_000 });
    expect(requests).toBe(2);
  } finally {
    release();
  }
});

test('已准备好的结构模型在传章保留原画布并可复用', async ({ page }) => {
  await skipIntro(page);
  let requests = 0;
  page.on('request', request => { if (request.url().endsWith(`/${assetPaths.model}`)) requests++; });
  await page.goto('/#/model');
  await expect(page.locator('#modelStage')).toBeVisible();
  await expect(page.locator('#model-reading-panel-form .lion-experience')).toHaveAttribute('data-ready', 'true', { timeout: 80_000 });
  const canvas = await page.locator('#sceneContainer canvas').elementHandle();
  expect(canvas).not.toBeNull();
  await moveTo(page, 'spread');
  await expect(page.locator('#spreadStage')).toBeVisible();
  await expect(page.locator('#modelStage')).toBeHidden();
  expect(await canvas.evaluate(element => element.isConnected && element === document.querySelector('#sceneContainer canvas'))).toBe(true);
  await moveTo(page, 'model');
  await expect(page.locator('#modelStage')).toBeVisible();
  expect(await canvas.evaluate(element => element === document.querySelector('#sceneContainer canvas'))).toBe(true);
  expect(requests).toBe(1);
});
