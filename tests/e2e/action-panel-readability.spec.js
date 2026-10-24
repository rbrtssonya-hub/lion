import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { openTheater, prepare, scene, actionVideo, selectAction } from './action-theater.helpers.js';
import { selectSettingsFor } from './settings-navigation.helpers.js';

const reviewDir = process.env.READABILITY_REVIEW_DIR;

async function capture(page, name) {
  if (!reviewDir) return;
  mkdirSync(reviewDir, { recursive: true });
  await page.screenshot({ path: resolve(reviewDir, `${name}.png`), fullPage: !name.startsWith('home-') });
}

async function expectReadableLayout(page, compact = false) {
  const theater = page.locator('#actionTheater');
  await expect(theater).toHaveAttribute('data-compact-layout', String(compact));
  await expect.poll(() => page.evaluate(compact => {
    const box = selector => document.querySelector(selector).getBoundingClientRect();
    const title = box('.theater-topline'), reading = box('#theaterObservation');
    const pairs = ['.theater-topline', '#theaterObservation', '.theater-view-tools', '.theater-bottom', '.action-theater .sound-control-widget'];
    const boxes = pairs.map(box);
    const overlap = boxes.some((a, i) => boxes.slice(i + 1).some(b =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2));
    return Math.abs(reading.left - title.left) <= 1 && Math.abs(reading.top - title.bottom - 16) <= 1
      && !overlap && reading.bottom <= box('.theater-bottom').top - 8
      && (compact || reading.right < innerWidth / 2)
      && document.documentElement.scrollWidth <= innerWidth + 1;
  }, compact), { message: 'Title and reading form a 16px left stack without crossing controls' }).toBe(true);
  const fonts = await page.evaluate(() => {
    const size = selector => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    const button = document.querySelector('.theater-view-tools button').getBoundingClientRect();
    return {
      kicker: size('.theater-topline .chapter-identity__phase'), hint: size('.theater-topline .chapter-identity__description'),
      tool: size('.theater-view-tools button'), label: size('.theater-caption.is-current .theater-caption-kicker'),
      name: size('.theater-caption.is-current h2'), body: size('.theater-caption.is-current .theater-description'),
      keyword: size('.theater-caption.is-current .theater-keywords'), buttonHeight: button.height,
      lineHeight: parseFloat(getComputedStyle(document.querySelector('.theater-caption.is-current .theater-description')).lineHeight),
    };
  });
  for (const [key, min, max] of [['kicker', 14, 16], ['hint', 16, 18], ['tool', 16, 18],
    ['label', 14, 16], ['name', 28, 34], ['body', 18, 22], ['keyword', 14, 16]]) {
    expect(fonts[key], key).toBeGreaterThanOrEqual(min);
    expect(fonts[key], key).toBeLessThanOrEqual(max);
  }
  expect(fonts.lineHeight / fonts.body).toBeCloseTo(1.75, 2);
  expect(fonts.buttonHeight).toBeGreaterThanOrEqual(44);
}

test('动作标题与解读在左上形成可读信息区，电脑尺寸改变不重建画布或视频', async ({ page }) => {
  test.setTimeout(150_000);
  await openTheater(page, { reducedMotion: 'reduce' });
  const retained = await scene(page).elementHandle();
  const video = await actionVideo(page, 'tanqing').elementHandle();
  for (const [width, height] of [[1920, 1080], [1024, 768], [795, 768], [1366, 768], [2560, 1440], [3840, 2160]]) {
    await page.setViewportSize({ width, height });
    await expectReadableLayout(page);
    expect(await retained.evaluate(node => node === document.querySelector('#theaterSceneContainer canvas'))).toBe(true);
    expect(await video.evaluate(node => node === document.querySelector('video[data-action-id="tanqing"]'))).toBe(true);
    await capture(page, `action-${width}x${height}`);
  }
});

test('矮电脑与620px边界纵向重排，场景后出现完整标题解读和控制', async ({ page }) => {
  test.setTimeout(120_000);
  await openTheater(page, { reducedMotion: 'reduce' });
  for (const [width, height] of [[900, 600], [640, 480], [675, 403]]) {
    await page.setViewportSize({ width, height });
    await expectReadableLayout(page, true);
    const geometry = await page.locator('.theater-topline').evaluate(node => ({
      top: node.getBoundingClientRect().top + scrollY,
      sceneBottom: document.querySelector('#theaterSceneContainer').getBoundingClientRect().bottom + scrollY,
    }));
    expect(geometry.top).toBeGreaterThanOrEqual(geometry.sceneBottom - 1);
    await page.locator('#theaterControls').scrollIntoViewIfNeeded();
    await expect(page.getByRole('slider', { name: '当前动作播放进度', exact: true })).toBeVisible();
    await page.evaluate(() => scrollTo(0, 0));
    await capture(page, `action-compact-${width}x${height}`);
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  const header = await page.locator('.site-header').boundingBox();
  await page.setViewportSize({ width: 1366, height: Math.ceil(header.height) + 619 });
  await expectReadableLayout(page, true);
  await page.setViewportSize({ width: 1366, height: Math.ceil(header.height) + 620 });
  await expectReadableLayout(page, false);
});

test('设置推开后约900px余宽仍左对齐，四动作切换和平面/全屏共用媒体', async ({ page }) => {
  test.setTimeout(150_000);
  await openTheater(page, { width: 1675, height: 1000, reducedMotion: 'reduce', settings: { panelWidth: 760 } });
  const retained = await scene(page).elementHandle();
  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
  await selectSettingsFor(page, 'panelWidth');
  await page.getByRole('checkbox', { name: '设置面板推开页面', exact: true }).check();
  await expect.poll(() => page.locator('.site-page').evaluate(node => node.getBoundingClientRect().width)).toBeCloseTo(900, 0);
  await expectReadableLayout(page);
  await capture(page, 'action-settings-900');
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(page.getByRole('region', { name: '开发者参数设置', exact: true })).toHaveCount(0);
  for (const id of ['doumao', 'tuqiu', 'meihuazhuang', 'tanqing']) {
    await selectAction(page, id);
    await expectReadableLayout(page);
  }
  await page.getByRole('button', { name: '平面观看', exact: true }).click();
  await expect(page.locator('#actionTheater')).toHaveAttribute('data-view', 'flat');
  await expectReadableLayout(page);
  await page.getByRole('button', { name: '全屏观看动作空间', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('actionTheater');
  await expectReadableLayout(page);
  await page.evaluate(() => document.exitFullscreen());
  expect(await retained.evaluate(node => node === document.querySelector('#theaterSceneContainer canvas'))).toBe(true);
});

test('场景失败提示不覆盖左上解读与右上操作，矮窗回退仍可播放', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return /webgl/.test(type) ? null : original.call(this, type, ...args);
    };
  });
  await prepare(page, { reducedMotion: 'reduce' });
  await page.goto('/#/action');
  await expect(page.locator('#actionTheater')).toHaveAttribute('data-view', 'flat');
  for (const [width, height, compact] of [[1920, 1080, false], [900, 600, true]]) {
    await page.setViewportSize({ width, height });
    await expectReadableLayout(page, compact);
    expect(await page.locator('.theater-scene-error').evaluate(node => {
      const a = node.getBoundingClientRect();
      return ['.theater-topline', '#theaterObservation', '.theater-view-tools', '.theater-bottom'].every(selector => {
        const b = document.querySelector(selector).getBoundingClientRect();
        return a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
      });
    })).toBe(true);
  }
});

test('125%与150%缩放等效CSS视口和像素密度保持字号、留白与单画布', async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  // Match both viewport reflow and DPR using browser-owned contexts. Overriding
  // CDP metrics behind Playwright's viewport can crop/clear screenshot output.
  for (const [scale, width, height] of [[1.25, 1536, 864], [1.5, 1280, 720]]) {
    const context = await browser.newContext({ baseURL, viewport: { width, height }, deviceScaleFactor: scale });
    try {
      const page = await context.newPage();
      await openTheater(page, { width, height, reducedMotion: 'reduce' });
      expect(await page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio }))).toEqual({ width, dpr: scale });
      await expectReadableLayout(page);
      await expect(page.locator('#theaterSceneContainer canvas')).toHaveCount(1);
      await capture(page, `action-zoom-equivalent-${scale * 100}`);
    } finally {
      await context.close();
    }
  }
});

test('HDRI与鼓同时失败时提示按列排开，重试恢复而不覆盖解读或工具', async ({ page }) => {
  test.setTimeout(90_000);
  let fail = true;
  await page.route('**/assets/environments/*.exr', route => fail ? route.fulfill({ status: 503, body: 'test-only HDRI failure' }) : route.continue());
  await page.route('**/assets/models/lion-action-drum.glb', route => fail ? route.fulfill({ status: 503, body: 'test-only drum failure' }) : route.continue());
  await openTheater(page, { reducedMotion: 'reduce' });
  await expect(page.locator('.theater-hdri-notice')).toBeVisible();
  await expect(page.locator('.theater-drum-notice')).toBeVisible();
  for (const [width, height, compact] of [[1920, 1080, false], [900, 600, true]]) {
    await page.setViewportSize({ width, height });
    await expectReadableLayout(page, compact);
    const overlaps = await page.evaluate(() => {
      const boxes = ['.theater-hdri-notice', '.theater-drum-notice', '.theater-topline', '#theaterObservation', '.theater-view-tools', '.theater-bottom']
        .map(selector => document.querySelector(selector).getBoundingClientRect());
      return boxes.some((a, i) => boxes.slice(i + 1).some(b =>
        Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2));
    });
    expect(overlaps).toBe(false);
  }
  fail = false;
  await page.getByRole('button', { name: '重新载入 HDRI', exact: true }).click();
  await page.getByRole('button', { name: '重新载入鼓', exact: true }).click();
  await expect(page.locator('.theater-hdri-notice')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('.theater-drum-notice')).toHaveCount(0);
});

test('首页非当前栏目圆点为实心朱红，透明侧栏与狮头跳转保持', async ({ page }) => {
  await prepare(page, { reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await page.locator('#homeLionTypes').scrollIntoViewIfNeeded();
  const nav = page.getByRole('navigation', { name: '首页章节导航', exact: true });
  await expect(nav).toBeVisible();
  const stops = await nav.locator('button:not([aria-current]) i').evaluateAll(nodes => nodes.map(node => {
    const css = getComputedStyle(node), box = node.getBoundingClientRect();
    return { color: css.backgroundColor, border: css.borderColor, width: box.width, height: box.height };
  }));
  expect(stops).toHaveLength(3);
  for (const stop of stops) expect(stop).toEqual({ color: 'rgb(182, 45, 32)', border: 'rgb(143, 35, 27)', width: 8, height: 8 });
  await expect(nav).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  for (const id of ['homeCultureSources', 'homeCulture', 'homeLionBook', 'homeLionTypes']) {
    await nav.locator(`[data-home-section="${id}"]`).click();
    await expect(nav.locator(`[data-home-section="${id}"]`)).toHaveAttribute('aria-current', 'location');
  }
  await capture(page, 'home-solid-red-dots');
});
