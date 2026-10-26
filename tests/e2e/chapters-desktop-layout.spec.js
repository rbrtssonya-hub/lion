import { test, expect } from '@playwright/test';

const windows = [[640, 360], [675, 403], [640, 480], [900, 600], [1366, 768], [1920, 1080], [2560, 1080], [3840, 2160]];

async function open(page, route, settings = {}) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(settings => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({
      pushPage: false, bookAutoplay: false, carouselAutoplay: false, ...settings,
    }));
  }, settings);
  await page.goto(`/#/${route}`);
  await expect(page.locator(route === 'model' ? '#modelStage' : '#chapterStage')).toBeVisible();
  await page.addStyleTag({ content: '.xiaoxing-companion { display: none !important; }' });
  await page.evaluate(() => document.fonts.ready);
}

async function resize(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.evaluate(() => { window.scrollTo({ top: 0, behavior: 'instant' }); });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function noHorizontalOverflow(page, selector) {
  // The actual projected model labels update on the renderer's next draw after
  // ResizeObserver. Check its settled content rather than the old frame's chips.
  await expect.poll(() => page.locator(selector).evaluate(element => Math.max(
    element.scrollWidth - element.clientWidth,
    document.documentElement.scrollWidth - innerWidth,
  )), { message: `${selector} content fits its actual width` }).toBeLessThanOrEqual(1);
}

async function noOverlap(page, selectors) {
  const overlaps = await page.evaluate(selectors => {
    const boxes = selectors.map(selector => ({ selector, box: document.querySelector(selector).getBoundingClientRect() }));
    const result = [];
    for (let left = 0; left < boxes.length; left += 1) for (let right = left + 1; right < boxes.length; right += 1) {
      const a = boxes[left], b = boxes[right];
      if (Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left) > 2 &&
          Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top) > 2) result.push([a.selector, b.selector]);
    }
    return result;
  }, selectors);
  expect(overlaps).toEqual([]);
}

test('结构在矮窄到4K电脑窗口重排，模型与独立滚动图鉴都保持可操作', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page, 'model');
  await expect(page.locator('#resetView')).toBeEnabled({ timeout: 45_000 });
  const canvas = await page.locator('#sceneContainer canvas').elementHandle();
  for (const [width, height] of windows) {
    await resize(page, width, height);
    await noHorizontalOverflow(page, '.model-layout');
    await noHorizontalOverflow(page, '#structurePanel');
    const bounds = await page.evaluate(() => {
      const scene = document.querySelector('.scene-column').getBoundingClientRect();
      const panel = document.querySelector('#structurePanel').getBoundingClientRect();
      return { sceneWidth: scene.width, sceneHeight: scene.height, stacked: panel.top >= scene.bottom, canvas: document.querySelector('#sceneContainer canvas').isConnected };
    });
    expect(bounds.sceneWidth).toBeGreaterThan(300);
    expect(bounds.sceneHeight).toBeGreaterThanOrEqual(330);
    expect(bounds.stacked).toBe(width <= 900);
    expect(await canvas.evaluate(element => element === document.querySelector('#sceneContainer canvas'))).toBe(true);
  }
  await resize(page, 675, 403);
  await page.locator('[data-part-id="lion_cloth"] button, button[data-part-id="lion_cloth"]').last().click();
  await expect(page.locator('#modelStage')).toHaveAttribute('data-selected-id', 'lion_cloth');
  await expect(page.locator('#structureBoundary p')).toBeVisible();
  await page.locator('#nextStructurePart').click();
  await expect(page.locator('#modelStage')).toHaveAttribute('data-selected-id', 'outer_shell');
});

test('结构最窄自定义纸张和最高高度保留六部件目录、正文与页脚', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page, 'model', { modelOverlayWidth: 40, modelOverlayHeight: 900, structureAtlasVersion: 1 });
  for (const [width, height] of [[640, 360], [1000, 480], [1920, 1080]]) {
    await resize(page, width, height);
    await noHorizontalOverflow(page, '#structurePanel');
    await noHorizontalOverflow(page, '#modelDetailContent');
    await expect(page.locator('.structure-part-directory button')).toHaveCount(6);
    await page.locator('button[data-part-id="lion_cloth"]').click();
    await expect(page.locator('#modelStage')).toHaveAttribute('data-selected-id', 'lion_cloth');
    await page.locator('#nextStructurePart').click();
    await expect(page.locator('#modelStage')).toHaveAttribute('data-selected-id', 'outer_shell');
  }
});

test('神态浏览、详情与三组对照在电脑窗口矩阵完整可读，无文字横向裁切', async ({ page }) => {
  await open(page, 'state');
  for (const [width, height] of windows) {
    await resize(page, width, height);
    await noHorizontalOverflow(page, '.expression-page');
    await expect(page.locator('.expression-state-button')).toHaveCount(8);
    const image = await page.locator('.expression-lion-stage').boundingBox();
    expect(image.width).toBeGreaterThan(280);
    expect(image.height).toBeGreaterThan(300);
    await page.locator('#expressionLionTrigger').click();
    await noHorizontalOverflow(page, '#expressionStateCopy');
    await expect(page.locator('#expressionEmotionCue')).not.toBeEmpty();
    await page.getByRole('button', { name: '返回神态简介', exact: false }).click();
  }
  await resize(page, 640, 360);
  await page.getByRole('button', { name: '神态对照', exact: true }).click();
  for (const tab of await page.getByRole('tablist', { name: '神态对照组合' }).getByRole('tab').all()) {
    await tab.click();
    await expect(page.locator('.expression-comparison-card')).toHaveCount(2);
    await noHorizontalOverflow(page, '.expression-comparison');
    for (const card of await page.locator('.expression-comparison-card').all()) {
      const dimensions = await card.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth }));
      expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
      await expect(card.locator('dl>div')).toHaveCount(3);
    }
  }
});

test('神态40%纸张和32px正文在窄电脑保留可读宽度，900px高度自然延展可达', async ({ page }) => {
  await open(page, 'state', { expressionOverlayWidth: 40, expressionOverlayHeight: 900, expressionOverviewFontSize: 32, expressionDetailFontSize: 32 });
  for (const [width, height] of [[640, 360], [1000, 480], [1280, 720], [1920, 1080]]) {
    await resize(page, width, height);
    await page.locator('#expressionLionTrigger').click();
    const copy = page.locator('#expressionStateCopy');
    expect((await copy.boundingBox()).width).toBeGreaterThanOrEqual(219);
    expect((await copy.boundingBox()).height).toBeGreaterThanOrEqual(900);
    await noHorizontalOverflow(page, '#expressionStateCopy');
    await page.getByRole('button', { name: '返回神态简介', exact: false }).click();
    await expect(copy).toHaveAttribute('data-view', 'overview');
  }
});

test('巨幕场景在小电脑纵排解读与完整播放器，大窗口恢复左上阅读布局并保留同一画布', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page, 'action');
  const stage = page.locator('#actionTheater');
  const scene = page.locator('#theaterSceneContainer canvas');
  await expect(scene).toHaveAttribute('data-scene-ready', 'true', { timeout: 60_000 });
  const canvas = await scene.elementHandle();
  for (const [width, height] of [...windows, [900, 700], [1100, 800]]) {
    await resize(page, width, height);
    const header = await page.locator('.site-header').boundingBox();
    const bounds = await stage.boundingBox();
    const compact = bounds.width < 780 || height - header.height < 620;
    await expect(stage).toHaveAttribute('data-compact-layout', String(compact));
    await noHorizontalOverflow(page, '#actionTheater');
    await noOverlap(page, ['.theater-topline', '.theater-view-tools']);
    await noOverlap(page, ['.theater-observation', '.theater-bottom', '.action-theater .sound-control-widget']);
    if (!compact && bounds.width <= 1100) {
      const excess = await page.locator('.theater-observation').evaluate(element => {
        const css = getComputedStyle(element);
        const content = element.querySelector('.theater-caption.is-current').getBoundingClientRect().height;
        const inset = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
          .reduce((sum, key) => sum + Number.parseFloat(css[key]), 0);
        return element.getBoundingClientRect().height - content - inset;
      });
      // CSSOM resolves auto insets of positioned boxes to used pixels. The
      // actual content height proves the panel is not stretched by two anchors.
      expect(Math.abs(excess)).toBeLessThanOrEqual(1);
    }
    expect((await scene.boundingBox()).height).toBeCloseTo(compact ? Math.max(360, height) : height, 0);
    expect(await canvas.evaluate(element => element === document.querySelector('#theaterSceneContainer canvas'))).toBe(true);
  }
  await resize(page, 675, 403);
  for (const id of ['doumao', 'tuqiu', 'meihuazhuang', 'tanqing']) {
    await page.locator(`.theater-action-nav [data-action-id="${id}"]`).click();
    await expect(scene).toHaveAttribute('data-active-screen', id);
    await expect(stage).toHaveAttribute('data-active-action', id);
  }
  await page.getByRole('button', { name: '平面观看', exact: true }).click();
  await expect(stage).toHaveAttribute('data-view', 'flat');
  await page.getByRole('button', { name: '全屏观看动作空间', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('actionTheater');
  await page.locator('#theaterControls').scrollIntoViewIfNeeded();
  await expect(page.getByRole('slider', { name: '当前动作播放进度', exact: true })).toBeVisible();
  await page.evaluate(() => document.exitFullscreen());
  await expect(scene).toHaveCount(1);
});

test('巨幕失败回退在矮电脑保留视频、错误说明与重试入口，不覆盖播放器', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { return /webgl/.test(type) ? null : original.call(this, type, ...args); };
  });
  await open(page, 'action');
  await resize(page, 640, 360);
  await expect(page.locator('#actionTheater')).toHaveAttribute('data-view', 'flat');
  await expect(page.getByRole('button', { name: '重新载入动作空间', exact: true })).toBeVisible();
  await noHorizontalOverflow(page, '#actionTheater');
  await noOverlap(page, ['.theater-scene-error', '.theater-observation', '.theater-bottom']);
  await page.locator('#theaterControls').scrollIntoViewIfNeeded();
  await expect(page.getByRole('slider', { name: '当前动作播放进度', exact: true })).toBeVisible();
  await expect(page.locator('.theater-action-nav button')).toHaveCount(4);
});
