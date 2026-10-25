import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { assetPaths } from '../../src/config/assetPaths.js';
import catalog from '../../src/data/lion-interactive-parts.json' with { type: 'json' };
import { selectSettingsPage } from './settings-navigation.helpers.js';

test.use({ viewport: { width: 1920, height: 1080 } });
const canvas = page => page.locator('#sceneContainer canvas');
const value = (page, key) => canvas(page).evaluate((node, key) => node.dataset[key], key);
const number = async (page, key) => Number(await value(page, key));
const data = async (page, key) => JSON.parse(await value(page, key));
const button = (page, name) => page.getByRole('button', { name, exact: true });
const partButton = (page, id) => page.locator(`.lx-part-list [data-part-id="${id}"]`);

async function prepare(page) {
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ bookAutoplay: false, carouselAutoplay: false }));
  });
  await page.goto('/#/model');
  await expect(canvas(page)).toHaveAttribute('data-scene-ready', 'true', { timeout: 70_000 });
  await expect(page.locator('#modelStatus')).toContainText('已就绪');
  await expect(canvas(page)).toHaveCount(1);
}

async function settled(page) {
  await expect.poll(async () => {
    const before = await value(page, 'cameraPosition');
    await page.waitForTimeout(220);
    return before === await value(page, 'cameraPosition');
  }).toBe(true);
}

async function screenshot(page, name) {
  const directory = resolve('source/reviews/model/2026-10-26-interactive');
  mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: resolve(directory, name + '.png'), fullPage: true });
}

test('指定模型实际绘制完整毛发，目录与真实表面点选同步且不会整狮高亮', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page);
  await expect(canvas(page)).toHaveAttribute('data-source-model', /lion-kobi\.glb$/);
  await expect(canvas(page)).toHaveAttribute('data-full-hair-groups', '33');
  await expect(canvas(page)).toHaveAttribute('data-full-hair-strands', '2289801');
  await expect(canvas(page)).toHaveAttribute('data-full-hair-points', '19929005');
  await expect(canvas(page)).toHaveAttribute('data-full-hair-drawn-groups', '33');
  await expect(canvas(page)).toHaveAttribute('data-full-hair-drawn-strands', '2289801');
  await expect(page.locator('.lx-part-list [data-part-id]')).toHaveCount(catalog.parts.length);
  await settled(page);
  await screenshot(page, 'desktop-overall');
  // Pixel evidence verifies an actual coloured render, independent of labels.
  const png = await canvas(page).screenshot({ omitBackground: true });
  const painted = await page.evaluate(async base64 => {
    const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
    const sample = document.createElement('canvas'); sample.width = image.width; sample.height = image.height;
    const context = sample.getContext('2d'); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    let red = 0, opaque = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] > 100) opaque++;
      if (pixels[i] > pixels[i + 1] * 1.35 && pixels[i] > pixels[i + 2] * 1.25 && pixels[i] > 65) red++;
    }
    return { red, opaque };
  }, png.toString('base64'));
  expect(painted.opaque).toBeGreaterThan(20_000);
  expect(painted.red).toBeGreaterThan(8_000);
  await button(page, '隐藏标注').click();
  const projections = await data(page, 'partProjections');
  const pick = projections.find(part => part.pickable && part.visible);
  expect(pick).toBeTruthy();
  const box = await canvas(page).boundingBox();
  await page.mouse.click(box.x + pick.x, box.y + pick.y);
  await expect(partButton(page, pick.id)).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas(page)).toHaveAttribute('data-selected-part', pick.id);
  await expect.poll(() => data(page, 'highlightedParts')).toEqual([pick.id]);
  await expect(page.locator('.lx-detail-title')).toHaveText(catalog.parts.find(part => part.id === pick.id).name);
  await partButton(page, pick.id).click();
  await expect(canvas(page)).toHaveAttribute('data-selected-part', '');
  await partButton(page, 'ear_l').click();
  await expect(canvas(page)).toHaveAttribute('data-selected-part', 'ear_l');
  await button(page, '仅看当前部件').click();
  await expect.poll(() => data(page, 'visibleParts')).toEqual(['ear_l']);
  await button(page, '单独分离部件').click();
  await expect.poll(() => number(page, 'transformError')).toBeGreaterThan(.01);
  await button(page, '显示全部部件').click();
  await page.locator('#resetView').click();
  await expect.poll(() => number(page, 'transformError')).toBe(0);
  await settled(page);
  const start = await value(page, 'cameraPosition');
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .55);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * .5 + 100, box.y + box.height * .55 + 30, { steps: 12 }); await page.mouse.up();
  await expect.poll(() => value(page, 'cameraPosition')).not.toBe(start);
  await expect(canvas(page)).toHaveAttribute('data-selected-part', '');
  const distance = await number(page, 'cameraDistance');
  await page.mouse.wheel(0, -300);
  await expect.poll(() => number(page, 'cameraDistance')).toBeLessThan(distance);
  await page.locator('#toggleRotate').click();
  await expect(page.locator('#toggleRotate')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#resetView').click();
  await page.locator('.site-navigation [data-action="settings"]').click();
  const settings = await selectSettingsPage(page, '视角');
  const fov = settings.getByRole('spinbutton', { name: '结构镜头视野数值', exact: true });
  await fov.fill('48'); await fov.press('Tab');
  await expect.poll(async () => (await data(page, 'cameraLimits')).fov).toBe(48);
  expect(errors).toEqual([]);
});

test('分级与自动拆解控制真实变换，反复复原精确回到原始TRS', async ({ page }) => {
  await prepare(page);
  const rest = await data(page, 'partTransforms');
  await button(page, '逐级拆解 ＋').click();
  await expect.poll(() => number(page, 'explodeProgress')).toBe(1);
  const levelOne = await data(page, 'partTransforms');
  expect(levelOne.find(part => part.id === 'head_shell').position).toEqual(rest.find(part => part.id === 'head_shell').position);
  expect(levelOne.find(part => part.id === 'crown').position).not.toEqual(rest.find(part => part.id === 'crown').position);
  await page.locator('[data-level="2"]').click();
  await expect.poll(() => number(page, 'explodeProgress')).toBe(2);
  for (const id of ['head_shell', 'body', 'foreleg_l', 'tail']) {
    const current = (await data(page, 'partTransforms')).find(part => part.id === id);
    expect(current.position).not.toEqual(rest.find(part => part.id === id).position);
  }
  await page.locator('[data-level="3"]').click();
  await expect.poll(() => number(page, 'explodeProgress')).toBe(3);
  await settled(page);
  await screenshot(page, 'desktop-exploded');
  await page.locator('#explodeProgress').fill('1.5');
  await expect.poll(() => number(page, 'explodeProgress')).toBe(1.5);
  await page.locator('#resetView').click();
  await expect.poll(() => number(page, 'explodeProgress')).toBe(0);
  await expect.poll(() => number(page, 'transformError')).toBe(0);
  await button(page, '自动拆解 ▷').click();
  await expect.poll(() => number(page, 'explodeProgress')).toBeGreaterThan(.01);
  await expect.poll(() => number(page, 'explodeProgress'), { timeout: 35_000 }).toBe(3);
  await button(page, '自动复原 ↶').click();
  await expect.poll(() => number(page, 'explodeProgress'), { timeout: 35_000 }).toBe(0);
  for (let cycle = 0; cycle < 2; cycle++) {
    await page.locator('[data-level="3"]').click();
    await expect.poll(() => number(page, 'explodeProgress')).toBe(3);
    await page.locator('[data-level="0"]').click();
    await expect.poll(() => number(page, 'explodeProgress')).toBe(0);
    await expect.poll(() => number(page, 'transformError')).toBe(0);
  }
  expect(await data(page, 'partTransforms')).toEqual(rest);
});

test('动态模式独立运行耳尾，暂停保持姿态、强度与重置有效', async ({ page }) => {
  await prepare(page);
  await page.locator('[data-level="2"]').click();
  await page.getByRole('tab', { name: '动态演示' }).click();
  await expect(page.locator('#modelStage')).toHaveAttribute('data-mode', 'motion');
  await expect.poll(() => number(page, 'explodeProgress')).toBe(0);
  const rest = await data(page, 'partTransforms');
  await page.getByRole('button', { name: /开始 \/ 继续/ }).click();
  await expect.poll(() => number(page, 'motionTime')).toBeGreaterThan(.25);
  await page.getByRole('button', { name: /暂停动作/ }).click();
  await expect(canvas(page)).toHaveAttribute('data-motion-playing', 'false');
  const paused = await data(page, 'partTransforms');
  expect(paused.find(part => part.id === 'ear_l').quaternion).not.toEqual(rest.find(part => part.id === 'ear_l').quaternion);
  expect(paused.find(part => part.id === 'body').quaternion).toEqual(rest.find(part => part.id === 'body').quaternion);
  const time = await number(page, 'motionTime');
  await page.waitForTimeout(400);
  expect(await number(page, 'motionTime')).toBe(time);
  await page.getByRole('slider', { name: '动作强度' }).fill('0');
  await expect.poll(() => number(page, 'transformError')).toBe(0);
  await page.getByRole('slider', { name: '动作强度' }).fill('0.8');
  await page.getByRole('button', { name: /开始 \/ 继续/ }).click();
  await expect.poll(() => number(page, 'motionTime')).toBeGreaterThan(time);
  await button(page, '动作归位 ↶').click();
  await expect.poll(() => number(page, 'motionTime')).toBe(0);
  await expect.poll(() => number(page, 'transformError')).toBe(0);
  await page.getByText('模型与展示说明', { exact: false }).click();
  await expect(page.locator('.lx-resource-note')).toContainText('眼');
  await expect(page.locator('.lx-resource-note a')).toHaveAttribute('href', 'https://www.ihchina.cn/Article/Index/detail?id=24566');
  await screenshot(page, 'desktop-motion');
});

test('搜索分类与离页暂停有效，返回保留同一画布', async ({ page }) => {
  await prepare(page);
  await page.getByRole('searchbox', { name: '搜索部件' }).fill('耳');
  await expect(page.locator('.lx-part-list [data-part-id]')).toHaveCount(2);
  await page.getByRole('searchbox', { name: '搜索部件' }).fill('不存在');
  await expect(page.locator('.lx-empty')).toBeVisible();
  await button(page, '清除筛选').click();
  await page.getByRole('group', { name: '部件分类' }).getByRole('button', { name: '尾部', exact: true }).click();
  await expect(page.locator('.lx-part-list [data-part-id]')).toHaveCount(1);
  const handle = await canvas(page).elementHandle();
  await page.locator('#toggleRotate').click();
  await page.locator('.site-header [data-route="state"]').click();
  await expect(canvas(page)).toHaveAttribute('data-active', 'false');
  const count = await number(page, 'renderCount');
  await page.waitForTimeout(400);
  expect(await number(page, 'renderCount')).toBe(count);
  await page.locator('.site-header [data-route="model"]').click();
  await expect(canvas(page)).toHaveAttribute('data-active', 'true');
  expect(await handle.evaluate(node => node === document.querySelector('#sceneContainer canvas'))).toBe(true);
});

for (const viewport of [{ width: 1366, height: 768 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
  test(`展陈布局与折叠部件面板 ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepare(page);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const bounds = await canvas(page).boundingBox();
    expect(bounds.width).toBeGreaterThan(300);
    expect(bounds.height).toBeGreaterThan(250);
    if (viewport.width <= 1000) {
      await button(page, '部件目录 17').click();
      await expect(page.getByRole('complementary', { name: '醒狮部件目录' })).toBeVisible();
      await partButton(page, 'head_shell').click();
      await expect(page.getByRole('complementary', { name: '部件详情与文化信息' })).toBeVisible();
      await expect(page.locator('.lx-detail-title')).toHaveText('狮头壳与面部');
      await button(page, '收起造型解读').click();
      await expect(page.getByRole('complementary', { name: '部件详情与文化信息' })).toBeHidden();
      if (viewport.width === 390) {
        const cdp = await page.context().newCDPSession(page);
        const before = await value(page, 'cameraPosition');
        const point = { x: bounds.x + bounds.width * .5, y: bounds.y + bounds.height * .62 };
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 0 }] });
        for (let index = 1; index <= 8; index++) await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove', touchPoints: [{ x: point.x + index * 7, y: point.y + index * 2, id: 0 }],
        });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await expect.poll(() => value(page, 'cameraPosition')).not.toBe(before);
        await page.locator('#resetView').click();
        await settled(page);
        const anchor = (await data(page, 'partProjections')).find(part => part.visible && part.pickable);
        const second = { x: bounds.x + anchor.x, y: bounds.y + anchor.y, id: 1 };
        const first = { x: second.x - 24, y: second.y, id: 0 };
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first, second] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...first, x: first.x - 20 }, second] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [second] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await expect(canvas(page)).toHaveAttribute('data-selected-part', '');
        await cdp.detach();
      }
    }
    await page.locator('[data-level="1"]').click();
    await expect.poll(() => number(page, 'explodeProgress')).toBe(1);
    await settled(page);
    await screenshot(page, `layout-${viewport.width}`);
  });
}

test('下载失败与WebGL上下文中断均可重试且只保留一个画布', async ({ page }) => {
  await page.route(`**/${assetPaths.model}`, route => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.goto('/#/model');
  await expect(button(page, '重新载入模型')).toBeVisible();
  await expect(canvas(page)).toHaveCount(0);
  await page.unroute(`**/${assetPaths.model}`);
  await button(page, '重新载入模型').click();
  await expect(canvas(page)).toHaveAttribute('data-scene-ready', 'true', { timeout: 70_000 });
  await canvas(page).evaluate(node => node.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect(button(page, '重新载入模型')).toBeVisible();
  await button(page, '重新载入模型').click();
  await expect(canvas(page)).toHaveAttribute('data-scene-ready', 'true', { timeout: 70_000 });
  await expect(canvas(page)).toHaveCount(1);
});
