import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

test.use({ trace: 'off', viewport: { width: 1920, height: 1080 } });
const reviewDirectory = resolve(process.env.CRAFT_CAROUSEL_REVIEW_DIR || 'source/reviews/craft-carousel/2026-10-26');
const stages = [
  { id: 'zha', step: '扎', title: '竹篾立骨', asset: 'zha.png', text: '将竹篾扎成狮头骨架，让眉眼、额头与狮嘴的轮廓逐渐立起。' },
  { id: 'pu', step: '扑', title: '覆纸成胚', asset: 'pu.png', text: '在骨架上覆纱、纸或布，逐步形成狮胚，让起伏的轮廓连成完整表面。' },
  { id: 'hua', step: '画', title: '落笔生彩', asset: 'hua.png', text: '待狮胚干燥后描绘色彩与纹样，眉眼、额头和面颊的神采随笔触显现。' },
  { id: 'zhuang', step: '装', title: '添饰成狮', asset: 'zhuang.png', text: '为彩绘狮头装上绒毛、绒球、镜饰等配件，丰富质感，完成外观装饰。' },
];

async function openCraft(page, settings = {}, viewport = { width: 1920, height: 1080 }) {
  await page.setViewportSize(viewport);
  await page.addInitScript(value => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({
      hdriEnabled: false, carouselAutoplay: false, carouselTransitionDuration: 300, ...value,
    }));
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const context = Reflect.apply(native, this, args);
      if (!context || !/^webgl/.test(args[0]) || context.__craftTracked) return context;
      context.__craftTracked = true;
      const canvas = this;
      for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
        const draw = context[name];
        if (!draw) continue;
        context[name] = function (...drawArgs) {
          if (canvas.matches('.culture-depth-canvas')) canvas.__craftDraws = (canvas.__craftDraws || 0) + 1;
          return Reflect.apply(draw, this, drawArgs);
        };
      }
      return context;
    };
  }, settings);
  await page.goto('/#/model');
  await page.getByRole('tab', { name: '工艺', exact: true }).click();
  const section = page.locator('.model-craft');
  const gallery = section.locator('.culture-depth-gallery');
  await expect(page.getByRole('region', { name: '醒狮工艺图文轮播', exact: true })).toBeVisible();
  await expect.poll(() => section.locator('img.model-craft-photo').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  return { section, gallery, canvas: gallery.locator('canvas') };
}

async function expectStage(section, index) {
  const stage = stages[index];
  await expect(section).toHaveAttribute('data-craft-index', String(index));
  await expect(section).toHaveAttribute('data-craft-current-id', stage.id);
  await expect(section.locator('#model-craft-title')).toHaveText(`${stage.step} · ${stage.title}`);
  await expect(section.locator('.model-craft-description')).toHaveText(stage.text);
  await expect(section.locator('img.model-craft-photo')).toHaveAttribute('src', new RegExp(`/assets/craft/${stage.asset}$`));
  await expect(section.locator('img.model-craft-photo')).toHaveAttribute('alt', new RegExp(`^${stage.step}工序示意：`));
  await expect.poll(() => section.locator('img.model-craft-photo').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(section.locator('figcaption strong')).toHaveText(new RegExp(`^${stage.step} ·`));
  await expect(section.getByRole('button', { name: `查看${stage.step}工序`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(section.locator('.model-craft-stages button[aria-pressed="true"]')).toHaveCount(1);
}

async function snapshot(page, name) {
  await mkdir(reviewDirectory, { recursive: true });
  await page.mouse.move(1850, 100);
  await page.waitForTimeout(600); // Capture the finished depth-camera transition.
  await page.screenshot({ path: resolve(reviewDirectory, name) });
}

test('四道工序的独立图片、图注与正文一一对应，切换保留同一纵深画布', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const { section, gallery, canvas } = await openCraft(page);
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready', { timeout: 35_000 });
  const original = await canvas.elementHandle();
  await expect.poll(() => canvas.evaluate(node => node.__craftDraws || 0)).toBeGreaterThan(0);
  for (let index = 0; index < stages.length; index += 1) {
    await section.getByRole('button', { name: `查看${stages[index].step}工序`, exact: true }).click();
    await expectStage(section, index);
    await expect(section.locator('figcaption')).toContainText('AI辅助绘制');
    if (index) await snapshot(page, `craft-${stages[index].id}-1920x1080.png`);
  }
  expect(await original.evaluate(node => node === document.querySelector('.model-craft .culture-depth-canvas'))).toBe(true);
  await expect(section.getByRole('link', { name: /南海博物馆 · 佛鹤狮头制作/ })).toHaveAttribute('href', 'https://www.nhmuseum.org/fei-yi/1575.html');
  await expect(section.locator('.model-craft-note')).toContainText('非实拍');
  expect(errors).toEqual([]);
  await original.dispose();
});

test('上一道下一道循环，前景图片真实点击及方向键HomeEnd每次同步切换一道', async ({ page }) => {
  const { section, gallery } = await openCraft(page);
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready', { timeout: 35_000 });
  await section.getByRole('button', { name: '上一道', exact: true }).click();
  await expectStage(section, 3);
  await section.getByRole('button', { name: '下一道', exact: true }).click();
  await expectStage(section, 0);
  const box = await gallery.boundingBox();
  await page.mouse.click(box.x + box.width * .42, box.y + box.height * .5);
  await expectStage(section, 1);
  const action = section.getByRole('button', { name: '下一张工艺图片', exact: true });
  await action.focus();
  await action.press('ArrowRight');
  await expectStage(section, 2);
  await action.press('ArrowLeft');
  await expectStage(section, 1);
  await action.press('End');
  await expectStage(section, 3);
  await action.press('Home');
  await expectStage(section, 0);
  await action.press('Enter');
  await expectStage(section, 1);
  // Labels and source text are outside the photo's hit area and must never
  // pass a pointer click through to the canvas beneath them.
  await section.locator('.model-craft-photo-label').click();
  await expectStage(section, 1);
  await section.locator('.model-craft-depth-axis span').last().click();
  await expectStage(section, 1);
  await section.locator('.model-craft-description').click();
  await expectStage(section, 1);
});

test('自动轮播受暂停按钮、前景悬停和键盘聚焦控制，离开后恢复', async ({ page }) => {
  const { section, gallery } = await openCraft(page, { carouselAutoplay: true, carouselInterval: 2, carouselResumeDelay: 1 });
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready', { timeout: 35_000 });
  await page.mouse.move(1850, 100);
  await expect(section).toHaveAttribute('data-craft-playing', 'true');
  const start = await section.getAttribute('data-craft-index');
  await expect(section).not.toHaveAttribute('data-craft-index', start, { timeout: 5000 });
  await section.getByRole('button', { name: '暂停轮播', exact: true }).click();
  await expect(section).toHaveAttribute('data-craft-playing', 'false');
  const paused = await section.getAttribute('data-craft-index');
  await page.waitForTimeout(2300);
  await expect(section).toHaveAttribute('data-craft-index', paused);
  await section.getByRole('button', { name: '播放轮播', exact: true }).click();
  await page.mouse.move(1850, 100);
  await expect(section).toHaveAttribute('data-craft-playing', 'true');
  const box = await gallery.boundingBox();
  await page.mouse.move(box.x + box.width * .42, box.y + box.height * .5);
  await expect(section).toHaveAttribute('data-craft-status', 'focused');
  const hovered = await section.getAttribute('data-craft-index');
  await page.waitForTimeout(2300);
  await expect(section).toHaveAttribute('data-craft-index', hovered);
  await page.mouse.move(1850, 100);
  await expect(section).toHaveAttribute('data-craft-playing', 'true');
  await page.keyboard.press('Tab');
  const action = section.getByRole('button', { name: '下一张工艺图片', exact: true });
  await action.focus();
  await expect(section).toHaveAttribute('data-craft-status', 'focused');
  const focused = await section.getAttribute('data-craft-index');
  await page.waitForTimeout(2300);
  await expect(section).toHaveAttribute('data-craft-index', focused);
  await page.getByRole('tab', { name: '工艺', exact: true }).focus();
  await expect(section).toHaveAttribute('data-craft-playing', 'true');
});

test('小游戏弹层、隐藏页签和离开章节均暂停轮播及纵深绘制', async ({ page }) => {
  const { section, gallery, canvas } = await openCraft(page, { carouselAutoplay: true, carouselInterval: 2, carouselResumeDelay: 1 });
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready', { timeout: 35_000 });
  async function expectStopped() {
    await expect(section).toHaveAttribute('data-craft-playing', 'false');
    const index = await section.getAttribute('data-craft-index');
    await page.waitForTimeout(150);
    const draws = await canvas.evaluate(node => node.__craftDraws || 0);
    await page.waitForTimeout(2300);
    await expect(section).toHaveAttribute('data-craft-index', index);
    expect(await canvas.evaluate(node => node.__craftDraws || 0)).toBe(draws);
  }
  await section.getByRole('button', { name: '体验鼓点采青', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '鼓点采青', exact: true })).toBeVisible();
  await expectStopped();
  await page.getByRole('button', { name: '关闭小游戏', exact: true }).click();
  await page.getByRole('tab', { name: '形制', exact: true }).click();
  await expectStopped();
  await page.getByRole('tab', { name: '工艺', exact: true }).click();
  await page.mouse.move(1850, 100);
  await expect.poll(() => canvas.evaluate(node => node.__craftDraws || 0)).toBeGreaterThan(10);
  await page.evaluate(() => { location.hash = '#/state'; });
  await expect(page.locator('main')).toHaveAttribute('data-route', 'state');
  await expectStopped();
});

for (const mode of ['reduced-motion', 'unavailable-webgl']) {
  test(`${mode}保留等比静态图片、对应文字和可用切换`, async ({ page }) => {
    if (mode === 'reduced-motion') await page.emulateMedia({ reducedMotion: 'reduce' });
    else await page.addInitScript(() => {
      const native = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return /webgl/.test(type) ? null : native.call(this, type, ...args);
      };
    });
    const { section, gallery } = await openCraft(page, { carouselAutoplay: true });
    await expect(gallery).toHaveAttribute('data-depth-state', mode === 'reduced-motion' ? 'static' : 'fallback');
    if (mode === 'reduced-motion') await expect(section).toHaveAttribute('data-craft-playing', 'false');
    await expect(section.locator('img.model-craft-photo')).toHaveCSS('opacity', '1');
    await section.getByRole('button', { name: '下一张工艺图片', exact: true }).click();
    await expectStage(section, 1);
    await section.getByRole('button', { name: '查看装工序', exact: true }).click();
    await expectStage(section, 3);
    expect(await section.locator('img.model-craft-photo').evaluate(image => getComputedStyle(image).objectFit)).toBe('contain');
    await expect(section.getByRole('button', { name: '体验鼓点采青', exact: true })).toBeVisible();
  });
}

for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768]]) {
  test(`轮播图文、四工序与两个小游戏在 ${width}×${height} 一屏完整呈现`, async ({ page }) => {
    const { section, gallery } = await openCraft(page, {}, { width, height });
    await expect(gallery).toHaveAttribute('data-depth-state', 'ready', { timeout: 35_000 });
    for (const target of [gallery, section.locator('#model-craft-title'), section.locator('.model-craft-description'),
      section.locator('.model-craft-observations'), section.locator('.model-craft-stages'), section.locator('.model-craft-navigation'),
      section.locator('.model-craft-note'), section.locator('figcaption'),
      section.getByRole('button', { name: '体验鼓点采青', exact: true }), section.getByRole('button', { name: '挑战梅花桩', exact: true })]) {
      await expect(target).toBeInViewport({ ratio: 1 });
    }
    const layout = await section.evaluate(node => {
      const panel = node.closest('[role="tabpanel"]');
      return { documentFits: document.documentElement.scrollWidth <= innerWidth + 1,
        panelFits: panel.scrollHeight <= panel.clientHeight + 1,
        bodyFontSize: parseFloat(getComputedStyle(node.querySelector('.model-craft-description')).fontSize) };
    });
    expect(layout).toEqual({ documentFits: true, panelFits: true, bodyFontSize: expect.any(Number) });
    expect(layout.bodyFontSize).toBeGreaterThanOrEqual(17);
    for (const label of ['上一道', '下一道', '播放轮播', '查看扎工序', '查看扑工序', '查看画工序', '查看装工序', '体验鼓点采青', '挑战梅花桩']) {
      // This also checks that the floating assistant does not cover controls.
      await section.getByRole('button', { name: label, exact: true }).click({ trial: true });
    }
    await snapshot(page, `craft-zha-${width}x${height}.png`);
  });
}
