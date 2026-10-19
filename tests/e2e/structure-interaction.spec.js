import { test, expect } from '@playwright/test';

async function trackModelDraws(page) {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const context = Reflect.apply(originalGetContext, this, args);
      if (!context || !/^webgl/.test(args[0]) || context.__modelDrawsTracked) return context;
      context.__modelDrawsTracked = true;
      const canvas = this;
      for (const method of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
        const draw = context[method];
        if (!draw) continue;
        context[method] = function (...drawArgs) {
          if (canvas.closest('#sceneContainer')) canvas.__modelDrawCalls = (canvas.__modelDrawCalls || 0) + 1;
          return Reflect.apply(draw, this, drawArgs);
        };
      }
      return context;
    };
  });
}

async function openModel(page) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/#/model');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-focus-state', 'idle');
}

const drawCount = page => page.locator('#sceneContainer canvas').evaluate(canvas => canvas.__modelDrawCalls || 0);

async function expectSettledCanvas(page) {
  await expect.poll(async () => {
    const before = await drawCount(page);
    await page.waitForTimeout(200);
    return (await drawCount(page)) - before;
  }, { timeout: 12_000 }).toBe(0);
  const before = await drawCount(page);
  await page.waitForTimeout(800);
  expect(await drawCount(page)).toBe(before);
}

test('结构视口静止时停止GPU绘制，拖动、聚焦、自动旋转和重入仍更新画面', async ({ page }) => {
  await trackModelDraws(page);
  await openModel(page);
  expect(await drawCount(page)).toBeGreaterThan(0);
  await expectSettledCanvas(page);

  const frame = await page.locator('.scene-interaction').boundingBox();
  let before = await drawCount(page);
  await page.mouse.move(frame.x + frame.width * .52, frame.y + frame.height * .5);
  await page.mouse.down();
  await page.mouse.move(frame.x + frame.width * .52 + 110, frame.y + frame.height * .5 + 35, { steps: 15 });
  await page.mouse.up();
  await expect.poll(() => drawCount(page)).toBeGreaterThan(before);
  await expect(page.locator('#modelStage')).toHaveAttribute('data-focus-state', 'overall');
  await expectSettledCanvas(page);

  // Losing focus while the pointer is still held must also settle. The later
  // pointer release must not select a part or leave a background render timer.
  await page.mouse.move(frame.x + frame.width * .52, frame.y + frame.height * .5);
  await page.mouse.down();
  await page.mouse.move(frame.x + frame.width * .52 - 70, frame.y + frame.height * .5 + 15, { steps: 8 });
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expectSettledCanvas(page);
  await page.mouse.up();
  await expect(page.locator('#modelStage')).toHaveAttribute('data-focus-state', 'overall');
  await expectSettledCanvas(page);

  before = await drawCount(page);
  await page.locator('#hotspotList [data-id="mouth"]').click();
  await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-focused-part', 'mouth');
  await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-focus-state', 'idle');
  expect(await drawCount(page)).toBeGreaterThan(before);
  await expectSettledCanvas(page);

  before = await drawCount(page);
  await page.locator('#toggleRotate').click();
  await expect(page.locator('#toggleRotate')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => drawCount(page)).toBeGreaterThan(before + 100);
  await page.locator('#toggleRotate').click();
  await expectSettledCanvas(page);

  const canvas = await page.locator('#sceneContainer canvas').elementHandle();
  await page.locator('.site-header .site-navigation [data-route="action"]').click();
  await expect(page.locator('#modelStage')).toBeHidden();
  await expectSettledCanvas(page);
  before = await drawCount(page);
  await page.locator('.site-header .site-navigation [data-route="model"]').click();
  await expect(page.locator('#modelStage')).toBeVisible();
  await expect.poll(() => drawCount(page)).toBeGreaterThan(before);
  expect(await canvas.evaluate(element => element === document.querySelector('#sceneContainer canvas'))).toBe(true);
  await expectSettledCanvas(page);
  await canvas.dispose();
});

test('视口部件标注随模型转动并连接结构锚点，点击同步右侧目录与聚焦', async ({ page }) => {
  await openModel(page);
  const buttons = page.locator('#modelHotspots .model-hotspot[data-id]');
  await expect(buttons).toHaveCount(6);
  await expect(page.locator('#modelHotspots .model-hotspot[data-visible="true"]')).toHaveCount(6);
  const frame = await page.locator('.scene-interaction').boundingBox();
  const observations = await buttons.evaluateAll(elements => elements.map(element => ({
    id: element.dataset.id,
    anchorX: Number(element.dataset.anchorX), anchorY: Number(element.dataset.anchorY),
    bounds: element.getBoundingClientRect().toJSON(),
  })));
  for (const point of observations) {
    expect(Number.isFinite(point.anchorX) && Number.isFinite(point.anchorY)).toBe(true);
    expect(point.anchorX).toBeGreaterThan(0);
    expect(point.anchorX).toBeLessThan(frame.width);
    expect(point.anchorY).toBeGreaterThan(0);
    expect(point.anchorY).toBeLessThan(frame.height);
    expect(point.bounds.left).toBeGreaterThanOrEqual(frame.x - 1);
    expect(point.bounds.right).toBeLessThanOrEqual(frame.x + frame.width + 1);
    expect(point.bounds.top).toBeGreaterThanOrEqual(frame.y - 1);
    expect(point.bounds.bottom).toBeLessThanOrEqual(frame.y + frame.height + 1);
  }
  const eyeBefore = observations.find(point => point.id === 'eyes');
  await page.mouse.move(frame.x + frame.width * .5, frame.y + frame.height * .5);
  await page.mouse.down();
  await page.mouse.move(frame.x + frame.width * .5 + 100, frame.y + frame.height * .5 + 25, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => {
    const eye = page.locator('#modelHotspots [data-id="eyes"]');
    return Math.hypot(Number(await eye.getAttribute('data-anchor-x')) - eyeBefore.anchorX,
      Number(await eye.getAttribute('data-anchor-y')) - eyeBefore.anchorY);
  }).toBeGreaterThan(8);

  for (const id of ['eyes', 'mouth', 'lion_cloth']) {
    await page.locator('#resetView').click();
    await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-focused-part', 'overall');
    await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-focus-state', 'idle');
    const label = page.locator(`#modelHotspots [data-id="${id}"]`);
    await expect(label).toBeVisible();
    await label.click();
    await expect(page.locator('#modelStage')).toHaveAttribute('data-selected-id', id);
    await expect(page.locator(`#hotspotList [data-id="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(label).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-focused-part', id);
    await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-focus-state', 'idle');
  }
});
