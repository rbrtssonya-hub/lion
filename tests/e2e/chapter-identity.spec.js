import { test, expect } from '@playwright/test';
import { assetPaths } from '../../src/config/assetPaths.js';

const chapters = [
  ['entry', '01', '溯源'], ['model', '02', '观形'],
  ['action', '03', '传神'], ['spread', '04', '远播'],
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false }));
  });
});

for (const size of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }]) {
  test(`四章共有章号和标题识别，内容在${size.width}桌面内可读`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#/state');
    for (const [route, number, phase] of chapters) {
      await page.evaluate(route => { location.hash = `/${route}`; }, route);
      const identity = page.locator(`.chapter-identity[data-chapter-identity="${route}"]`);
      await expect(identity).toBeVisible();
      await expect(identity.locator('.chapter-identity__number')).toHaveText(`${number} / 04`);
      await expect(identity.locator('.chapter-identity__phase')).toHaveText(phase);
      expect(await identity.evaluate(element => {
        const r = element.getBoundingClientRect();
        const page = element.closest('.site-page').getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.left >= page.left && r.right <= page.right + 1 && r.bottom <= innerHeight;
      })).toBe(true);
      if (route === 'entry') {
        expect(await identity.evaluate(element => {
          const a = element.getBoundingClientRect();
          const b = document.querySelector('.entry-playback-tools').getBoundingClientRect();
          return a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
        }), '首页章号必须完整避让重播工具').toBe(true);
      }
    }
    await page.evaluate(() => { location.hash = '/state'; });
    const expressionIdentity = page.locator('.chapter-identity[data-chapter-identity="state"]');
    await expect(expressionIdentity.locator('.chapter-identity__number')).toHaveText('03 / 04');
    await expect(expressionIdentity.locator('.chapter-identity__phase')).toHaveText('传神');
  });
}

test('章节先轻收再换景，快速往返及动态减少偏好立即收束最新章节', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/#/state');
  await expect(page.locator('#expressionLion')).toBeVisible();
  await expect(page.locator('[data-chapter-identity="model"]')).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
  const samples = await page.evaluate(async () => {
    const main = document.querySelector('#react-app');
    const samples = [];
    location.hash = '/model';
    const start = performance.now();
    while (performance.now() - start < 850) {
      const line = document.querySelector('.chapter-transition-line');
      const title = main.querySelector('[data-chapter-identity="model"] .chapter-identity__title');
      const paper = main.querySelector('.structure-atlas-masthead');
      samples.push({ phase: main.dataset.chapterPhase, route: main.dataset.route,
        line: line ? Number(getComputedStyle(line).opacity) : 0,
        title: title ? Number(getComputedStyle(title).opacity) : 1,
        paper: paper ? Number(getComputedStyle(paper).opacity) : 1 });
      await new Promise(requestAnimationFrame);
    }
    return samples;
  });
  expect(samples.some(s => s.route === 'state' && s.phase === 'leaving')).toBe(true);
  expect(samples.some(s => s.line > .1)).toBe(true);
  expect(samples.some(s => s.route === 'model' && s.phase === 'revealing')).toBe(true);
  expect(samples.some(s => s.route === 'model' && s.title < .8 && s.paper < .8)).toBe(true);
  await expect(page.locator('#react-app')).toHaveAttribute('data-chapter-phase', 'idle');
  await expect.poll(() => page.locator('[data-chapter-identity="model"] .chapter-identity__title')
    .evaluate(element => Number(getComputedStyle(element).opacity))).toBe(1);
  await expect.poll(() => page.locator('.structure-atlas-masthead')
    .evaluate(element => Number(getComputedStyle(element).opacity))).toBe(1);
  await page.evaluate(async () => {
    location.hash = '/action';
    await new Promise(resolve => setTimeout(resolve, 45));
    location.hash = '/state';
  });
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  await expect(page.locator('#react-app')).toHaveAttribute('data-chapter-phase', 'idle');
  await page.evaluate(() => { location.hash = '/model'; });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'model');
  await expect(page.locator('#react-app')).toHaveAttribute('data-chapter-phase', 'idle');
  expect(await page.locator('.chapter-transition-line').evaluate(element => Number(getComputedStyle(element).opacity))).toBe(0);
});

test('剧场载入后仍能看到标题与舞台光层的进入', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#/action');
  await page.waitForFunction(() => document.querySelector('#actionTheater')?.dataset.sceneState === 'ready', null, { timeout: 45_000 });
  const frames = await page.evaluate(async () => {
    const frames = [];
    const title = document.querySelector('[data-chapter-identity="action"] .chapter-identity__title');
    const light = document.querySelector('.theater-vignette');
    const start = performance.now();
    while (performance.now() - start < 600) {
      const css = getComputedStyle(light, '::after');
      frames.push({ title: Number(getComputedStyle(title).opacity), light: Number(css.opacity), content: css.content });
      await new Promise(requestAnimationFrame);
    }
    return frames;
  });
  expect(frames.some(frame => frame.title < .9)).toBe(true);
  expect(frames.some(frame => frame.content !== 'none' && frame.light > .05 && frame.light < .95)).toBe(true);
  await expect.poll(() => page.locator('[data-chapter-identity="action"] .chapter-identity__title')
    .evaluate(element => Number(getComputedStyle(element).opacity))).toBe(1);
});

test('后台模型等待不遮挡首页和神态，准备后仍复用原画布', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let requests = 0;
  await page.route(`**/${assetPaths.model}`, async route => { requests++; await gate; await route.continue(); });
  try {
    await page.goto('/');
    await expect(page.locator('#entryLionVideo')).toBeVisible();
    await expect.poll(() => page.locator('#entryLionVideo').evaluate(video => video.currentTime)).toBeGreaterThan(.1);
    await page.evaluate(() => { location.hash = '/state'; });
    await expect(page.locator('#expressionLion')).toBeVisible();
    release();
    await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
    await page.locator('.site-nav-item[data-route="model"]').click();
    await expect(page.locator('#resetView')).toBeEnabled();
    await expect(page.locator('#resetView')).toBeVisible();
    const canvas = await page.locator('#sceneContainer canvas').elementHandle();
    await page.evaluate(() => { location.hash = '/state'; });
    await expect(page.locator('#expressionLion')).toBeVisible();
    await page.locator('.site-nav-item[data-route="model"]').click();
    await expect(page.locator('#resetView')).toBeVisible();
    expect(await canvas.evaluate(node => node === document.querySelector('#sceneContainer canvas'))).toBe(true);
    expect(requests).toBe(1);
  } finally { release(); }
});
