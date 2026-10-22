import { test, expect, chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const storageKey = 'nanfeng-lion:developer-settings:v1';
const settleLayout = page => page.evaluate(async () => {
  await document.fonts.ready;
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
});

async function withinPage(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const boxes = await page.locator('.site-header').evaluate(header => {
    const bounds = header.getBoundingClientRect();
    return [...header.querySelectorAll('.site-brand-capsule, .site-nav-item')].map(node => {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, header: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom } };
    });
  });
  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(box.header.left - 1);
    expect(box.right).toBeLessThanOrEqual(box.header.right + 1);
    expect(box.top).toBeGreaterThanOrEqual(box.header.top - 1);
    expect(box.bottom).toBeLessThanOrEqual(box.header.bottom + 1);
  }
}

test('视频失败提示按当前容器和电脑高度限制，极高底板仍可重试和继续', async ({ page }) => {
  await page.addInitScript(key => {
    if (window !== top) return;
    localStorage.setItem(key, JSON.stringify({ videoOverlayHeight: 900, videoOverlayWidth: 100 }));
  }, storageKey);
  await page.route('**/assets/intro/entry-intro.mp4', route => route.abort());
  await page.goto('/');
  const notice = page.locator('.home-page .video-status');
  await expect(notice).toBeVisible();
  for (const [width, height] of [[640, 360], [675, 403], [1024, 600], [1366, 768], [1920, 1080], [3840, 2160]]) {
    await page.setViewportSize({ width, height });
    await settleLayout(page);
    const box = await notice.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    for (const button of await notice.getByRole('button').all()) {
      await expect(button).toBeInViewport();
      await button.click({ trial: true });
    }
    expect(await notice.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  }
  await notice.getByRole('button', { name: '重试', exact: true }).click();
  await expect(notice).toBeVisible();
});

test('四章的设置推开均按真实页面余宽回退，缩放和resize不更改保存偏好', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(key => {
    if (window !== top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem(key, JSON.stringify({ panelWidth: 460, pushPage: true, carouselAutoplay: false }));
  }, storageKey);
  for (const route of ['entry', 'model', 'action', 'state']) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await test.step(`${route}: open`, async () => { await page.goto(`/#/${route}`); });
    await page.locator('.site-header [data-action="settings"]').click();
    const saved = await page.evaluate(key => localStorage.getItem(key), storageKey);
    const panel = page.getByRole('region', { name: '开发者参数设置', exact: true });
    for (const [width, height] of [[1360, 600], [1376, 600], [1920, 1080], [900, 600]]) {
      await page.setViewportSize({ width, height });
      await settleLayout(page);
      const push = await panel.evaluate(node => node.closest('.site-shell').clientWidth - node.getBoundingClientRect().width >= 900);
      await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', push ? 'push' : 'overlay');
      await withinPage(page);
      expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(saved);
    }
    await panel.getByRole('button', { name: '保存设置', exact: true }).click();
  }
});

test('真实Chrome浏览器125、150、200%缩放下四章保留导航、内容和设置入口', async ({ baseURL }, testInfo) => {
  test.setTimeout(240_000);
  // A disposable persistent profile permits Chrome's own zoom setting. CSS
  // zoom and device metrics do not prove native desktop zoom behavior.
  const context = await chromium.launchPersistentContext(testInfo.outputPath('native-zoom-profile'), {
    channel: testInfo.project.use.channel || 'chromium', headless: true, viewport: null, deviceScaleFactor: undefined,
    args: ['--window-size=1366,900'], reducedMotion: 'reduce',
  });
  try {
    await context.addInitScript(key => {
      if (window !== top || !location.protocol.startsWith('http')) return;
      sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
      localStorage.setItem(key, JSON.stringify({ carouselAutoplay: false }));
    }, storageKey);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL);
    const baseline = await page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio }));
    const browserSettings = await context.newPage();
    await browserSettings.goto('chrome://settings/appearance');
    const observations = [];
    for (const scale of [1.25, 1.5, 2]) {
      await browserSettings.evaluate(value => new Promise(resolve => chrome.settingsPrivate.setDefaultZoom(value, resolve)), scale);
      await page.bringToFront();
      for (const route of ['entry', 'model', 'action', 'state']) {
        await page.goto(`${baseURL}/#/${route}`);
        await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBeCloseTo(baseline.dpr * scale, 1);
        await settleLayout(page);
        const metrics = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio, cssZoom: getComputedStyle(document.documentElement).zoom }));
        expect(metrics.width).toBeLessThanOrEqual(Math.ceil(baseline.width / scale) + 1);
        expect(metrics.cssZoom).toBe('1');
        await withinPage(page);
        const target = page.locator(route === 'entry' ? '.entry-cta' : route === 'model' ? '#resetView' : route === 'action' ? '.theater-action-nav button' : '#expressionLionTrigger').first();
        await expect(target).toBeVisible({ timeout: 45_000 });
        await target.scrollIntoViewIfNeeded();
        await target.click({ trial: true });
        await page.evaluate(() => scrollTo(0, 0));
        await page.locator('.site-header [data-action="settings"]').click();
        const panel = page.getByRole('region', { name: '开发者参数设置', exact: true });
        await expect(panel).toBeVisible();
        const save = panel.getByRole('button', { name: '保存设置', exact: true });
        await save.scrollIntoViewIfNeeded();
        await save.click({ trial: true });
        await save.click();
        observations.push({ scale, route, ...metrics });
      }
    }
    expect(errors).toEqual([]);
    const reportPath = testInfo.outputPath('native-desktop-zoom.json');
    await writeFile(reportPath, JSON.stringify(observations, null, 2) + '\n');
    await testInfo.attach('native-desktop-zoom.json', { path: reportPath, contentType: 'application/json' });
  } finally { await context.close(); }
});
