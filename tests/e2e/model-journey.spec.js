import { test, expect } from '@playwright/test';

async function openModel(page, viewport = { width: 1366, height: 768 }) {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const context = Reflect.apply(originalGetContext, this, args);
      if (!context || !/^webgl/.test(args[0]) || context.__journeyTracked) return context;
      context.__journeyTracked = true;
      const canvas = this;
      for (const method of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
        const draw = context[method];
        if (!draw) continue;
        context[method] = function (...drawArgs) {
          if (canvas.closest('#sceneContainer')) canvas.__journeyDraws = (canvas.__journeyDraws || 0) + 1;
          return Reflect.apply(draw, this, drawArgs);
        };
      }
      return context;
    };
  });
  await page.goto('/#/model');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
}

test('造章页签可用键盘切换，保留原部位并暂停隐藏模型，工艺照片保留来源许可', async ({ page }) => {
  await openModel(page);
  const formTab = page.getByRole('tab', { name: '观形', exact: true });
  await expect(formTab).toHaveAttribute('aria-selected', 'true');
  await page.locator('#modelHotspots [data-id="eyes"]').click();
  await expect(page.locator('#modelStage')).toHaveAttribute('data-selected-id', 'eyes');
  const canvas = await page.locator('#sceneContainer canvas').elementHandle();
  await page.locator('#toggleRotate').click();
  await expect.poll(() => canvas.evaluate(node => node.__journeyDraws || 0)).toBeGreaterThan(100);

  await formTab.focus();
  await formTab.press('ArrowRight');
  const typesTab = page.getByRole('tab', { name: '形制', exact: true });
  await expect(typesTab).toBeFocused();
  await expect(typesTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#sceneInteraction')).toBeHidden();
  await expect(page.getByRole('tab', { name: /佛鹤狮/ })).toBeVisible();
  await page.getByRole('tab', { name: /佛鹤狮/ }).click();
  await expect(page.getByText('融合形制', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '形制对照', exact: true }).click();
  await expect(page.getByLabel('左侧醒狮形制')).toBeVisible();
  await expect(page.getByLabel('右侧醒狮形制')).toBeVisible();
  await expect.poll(async () => {
    const before = await canvas.evaluate(node => node.__journeyDraws || 0);
    await page.waitForTimeout(180);
    return (await canvas.evaluate(node => node.__journeyDraws || 0)) - before;
  }).toBe(0);

  await typesTab.focus();
  await typesTab.press('End');
  const craftTab = page.getByRole('tab', { name: '工艺', exact: true });
  await expect(craftTab).toBeFocused();
  await expect(page.getByRole('heading', { name: '扎、扑、画、装', exact: true })).toBeVisible();
  const photo = page.getByRole('img', { name: '广州青砖建筑前陈列的黄色醒狮狮头，能看到彩绘、眉眼和额头镜饰' });
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole('link', { name: '照片来源' })).toHaveAttribute('href', /commons\.wikimedia\.org\/wiki\/File:2020_/);
  await expect(page.getByRole('link', { name: 'CC BY 2.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/2.0/');
  await expect(page.getByText(/照片看不见内部竹架/)).toBeVisible();

  await craftTab.press('Home');
  await expect(formTab).toBeFocused();
  await expect(page.locator('#modelStage')).toHaveAttribute('data-selected-id', 'eyes');
  await expect(page.locator('#panelTitle')).toHaveText('鼓眼与狮眉');
  expect(await canvas.evaluate(node => node === document.querySelector('#sceneContainer canvas'))).toBe(true);
  await expect(page.locator('#modelExpressionLink')).toHaveText(/去神态页观察惊态/);
  await canvas.dispose();
});

test('造章工艺在短电脑窗口保持图片与正文可读并允许局部滚动', async ({ page }) => {
  await openModel(page, { width: 1366, height: 640 });
  await page.getByRole('tab', { name: '工艺', exact: true }).click();
  const panel = page.getByRole('tabpanel', { name: '工艺', exact: true });
  await expect(panel).toBeVisible();
  await expect(page.getByRole('heading', { name: '扎、扑、画、装', exact: true })).toBeInViewport();
  const bounds = await panel.evaluate(node => ({ width: node.clientWidth, contentWidth: node.scrollWidth, height: node.clientHeight, contentHeight: node.scrollHeight, overflowY: getComputedStyle(node).overflowY }));
  expect(bounds.contentWidth).toBeLessThanOrEqual(bounds.width + 1);
  expect(bounds.overflowY).toMatch(/auto|scroll/);
  await page.getByRole('link', { name: '照片来源' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('link', { name: '照片来源' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
