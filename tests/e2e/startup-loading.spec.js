import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1920, height: 1080 } });

test('冷启动等待真实模型准备，书册不提前快翻，章节复用已编译画布', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let modelRequests = 0;
  await page.route('**/lion-overall.glb', async route => {
    modelRequests++;
    await gate;
    await route.continue();
  });
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toBeVisible();
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-ready', 'true');
  expect(await page.evaluate(() => sessionStorage.getItem('nanfeng-lion:book-intro-seen:v1'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('nanfeng-lion:intro-seen:v1'))).toBeNull();
  expect(await page.locator('#introVideo').evaluate(video => video.paused)).toBe(true);
  await expect(page.locator('.site-page')).toHaveAttribute('inert', '');
  release();
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator('#modelStatus')).toContainText('模型已载入');
  const canvas = await page.locator('#sceneContainer canvas').elementHandle();
  const warmedRequests = modelRequests;
  await page.locator('.site-nav-item[data-route="model"]').click();
  await expect(page.locator('#modelStage')).toBeVisible();
  await expect(page.locator('#loadingPanel')).toHaveCount(0);
  await page.locator('.site-nav-item[data-route="state"]').click();
  await expect(page.locator('#modelStage')).toBeHidden();
  await page.locator('.site-nav-item[data-route="model"]').click();
  expect(await canvas.evaluate(node => node === document.querySelector('#sceneContainer canvas'))).toBe(true);
  expect(modelRequests).toBe(warmedRequests);
});

test('模型网络失败展示预览状态并完成加载，无永久挡屏', async ({ page }) => {
  await page.route('**/lion-overall.glb', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toHaveAttribute('data-failures', /醒狮模型/, { timeout: 60_000 });
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await page.locator('.site-nav-item[data-route="model"]').click();
  await expect(page.locator('#modelStatus')).toContainText('模型载入失败');
  await expect(page.locator('#modelFallback')).toBeVisible();
  await expect(page.getByRole('button', { name: '重新载入', exact: true })).toBeVisible();
});

test('模型下载途中丢失WebGL上下文仍结束加载并保留重试', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/lion-overall.glb', async route => { await gate; await route.continue().catch(() => {}); });
  await page.goto('/');
  const canvas = page.locator('#sceneContainer canvas');
  await expect(canvas).toHaveCount(1);
  await canvas.evaluate(node => {
    const gl = node.getContext('webgl2') || node.getContext('webgl');
    gl.getExtension('WEBGL_lose_context').loseContext();
  });
  await expect(page.locator('#startupLoading')).toHaveAttribute('data-failures', /醒狮模型/, { timeout: 60_000 });
  release();
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await page.locator('.site-nav-item[data-route="model"]').click();
  await expect(page.locator('#modelFallback')).toBeVisible();
  await expect(page.getByRole('button', { name: '重新载入', exact: true })).toBeVisible();
});

test('同一导航底板随往返变宽缩窄，五项图案始终被底板覆盖', async ({ page }) => {
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ navigationDuration: 1400 }));
  });
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  const surface = await page.locator('.site-navigation > .navigation-surface').elementHandle();
  const full = await surface.boundingBox();
  await page.locator('.site-nav-item[data-route="state"]').click();
  await expect(page.locator('.site-header')).toHaveAttribute('data-nav-animating', 'true');
  await expect.poll(() => surface.evaluate(node => node.getAnimations().some(animation => animation.playState === 'running'))).toBe(true);
  await expect(page.locator('.site-header')).toHaveAttribute('data-nav-animating', 'false');
  const compact = await surface.boundingBox();
  expect(compact.width).toBeLessThan(full.width * .65);
  const enclosed = await page.locator('.site-navigation').evaluate(nav => {
    const b = nav.querySelector('.navigation-surface').getBoundingClientRect();
    return [...nav.querySelectorAll('.site-nav-symbol')].every(node => {
      const r = node.getBoundingClientRect();
      return r.left >= b.left && r.right <= b.right && r.top >= b.top && r.bottom <= b.bottom;
    });
  });
  expect(enclosed).toBe(true);
  await page.locator('.site-nav-item[data-route="entry"]').click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await expect(page.locator('.site-header')).toHaveAttribute('data-nav-animating', 'false');
  expect(await surface.evaluate(node => node === document.querySelector('.site-navigation > .navigation-surface'))).toBe(true);
  expect((await surface.boundingBox()).width).toBeCloseTo(full.width, 0);
});

test('导航字体请求悬挂时总准备预算到期，保留字体回退并结束加载', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/*.woff', async route => { await gate; await route.continue().catch(() => {}); });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#startupLoading')).toBeVisible();
    await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
    await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-ready', 'true');
    await expect(page.locator('#startupLoading')).toHaveAttribute('data-failures', /图像与章节/, { timeout: 40_000 });
    await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator('.site-page')).not.toHaveAttribute('inert');
    await expect(page.locator('.site-nav-heading strong')).toHaveText(['首页', '结构', '动作', '神态', '设置']);
  } finally {
    release();
  }
});

test('当前首页视频首帧纳入准备，超时保留封面与重试且复用同一video', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/*.mp4', async route => { await gate; await route.continue().catch(() => {}); });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
    const video = page.locator('#introVideo');
    const original = await video.elementHandle();
    expect(await video.evaluate(node => node.readyState)).toBe(0);
    await expect(page.locator('#startupLoading')).toBeVisible();
    await expect(page.locator('#startupLoading')).toHaveAttribute('data-ready', 'false');
    await expect(page.locator('#startupLoading')).toHaveAttribute('data-failures', /首页影像/, { timeout: 40_000 });
    await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator('.video-status')).toContainText('视频准备较慢，请重试');
    expect(await video.evaluate(node => Boolean(node.poster) && node.paused)).toBe(true);
    release();
    await expect.poll(() => video.evaluate(node => node.readyState)).toBeGreaterThanOrEqual(2);
    // Delayed data and startupReady must not silently retire the failure UI.
    await expect(page.locator('.video-status')).toContainText('视频准备较慢，请重试');
    await expect(page.getByRole('button', { name: '重试', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await expect(page.locator('.video-status')).toHaveCount(0);
    await expect.poll(() => video.evaluate(node => node.paused)).toBe(false);
    expect(await original.evaluate(node => node === document.querySelector('#introVideo'))).toBe(true);
  } finally {
    release();
  }
});
