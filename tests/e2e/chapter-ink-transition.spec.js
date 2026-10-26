import { test, expect } from '@playwright/test';
import { inflateSync } from 'node:zlib';

// Decode the browser's PNG so a missing fill/mask or gold stroke cannot pass
// merely because an animation name is present in the DOM.
function pngPixels(png) {
  let width, height, channels;
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      expect(data[8]).toBe(8);
      channels = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 0;
      expect(channels).toBeGreaterThan(0);
    }
    if (type === 'IDAT') chunks.push(data);
    offset += length + 12;
  }
  const source = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = source[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const above = y ? pixels[(y - 1) * stride + x] : 0;
      const corner = y && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      const estimate = left + above - corner;
      const distances = [Math.abs(estimate - left), Math.abs(estimate - above), Math.abs(estimate - corner)];
      const paeth = distances[0] <= distances[1] && distances[0] <= distances[2] ? left : distances[1] <= distances[2] ? above : corner;
      const predictor = [0, left, above, Math.floor((left + above) / 2), paeth][filter];
      pixels[y * stride + x] = source[y * (stride + 1) + x + 1] + predictor;
    }
  }
  return { width, height, channels, pixels };
}

async function open(page, reducedMotion = 'no-preference') {
  await page.emulateMedia({ reducedMotion });
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false }));
  });
  await page.goto('/#/state');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
}

for (const size of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }]) {
  test(`朱红毛边与细金边实际绘制，${size.width}桌面首载和结束无墨迹`, async ({ page }, testInfo) => {
    await page.setViewportSize(size);
    await open(page);
    const overlay = page.locator('.chapter-ink-transition');
    await expect(overlay).toHaveCount(0);

    // Freeze timers after the real route change and sample the reveal itself.
    // CSS is paused at its middle frame; the SVG still paints in Chrome.
    const time = new Date('2026-10-26T08:00:00Z');
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    await page.locator('.site-nav-item[data-route="model"]').evaluate(button => button.click());
    await page.clock.runFor(190);
    await expect(overlay).toHaveCount(1);
    await expect(page.locator('#react-app')).toHaveAttribute('data-chapter-phase', 'revealing');
    const geometry = await overlay.evaluate(element => {
      for (const animation of element.getAnimations({ subtree: true })) {
        animation.pause(); animation.currentTime = 225;
      }
      const rect = element.getBoundingClientRect();
      const header = document.querySelector('.site-header').getBoundingClientRect();
      const nav = document.querySelector('.site-nav-item[data-route="state"]');
      const button = nav.getBoundingClientRect();
      const gold = element.querySelector('.chapter-ink-transition__gold');
      const goldSamples = [];
      for (let distance = 8; distance < gold.getTotalLength(); distance += 8) {
        const point = gold.getPointAtLength(distance).matrixTransform(gold.getScreenCTM());
        if (point.x >= rect.left + 8 && point.x < rect.right - 8 && point.y >= rect.top + 8 && point.y < rect.bottom - 8) {
          goldSamples.push({ x: Math.round(point.x - rect.left), y: Math.round(point.y - rect.top) });
        }
      }
      return { top: rect.top, width: rect.width, height: rect.height, headerBottom: header.bottom,
        pointerEvents: getComputedStyle(element).pointerEvents,
        headerClickable: nav.contains(document.elementFromPoint(button.x + button.width / 2, button.y + button.height / 2)), goldSamples };
    });
    expect(geometry.top).toBeCloseTo(geometry.headerBottom, 0);
    expect(geometry.height).toBeGreaterThan(size.height * .7);
    expect(geometry.pointerEvents).toBe('none');
    expect(geometry.headerClickable).toBe(true);
    const screenshot = await overlay.screenshot({ path: testInfo.outputPath('ink-middle.png'), animations: 'allow' });
    await testInfo.attach('实际转场中间帧', { body: screenshot, contentType: 'image/png' });
    const { width, height, channels, pixels } = pngPixels(screenshot);
    let ink = 0, gold = 0;
    const isGold = i => pixels[i] > 180 && pixels[i + 1] > 135 && pixels[i + 1] < 205 && pixels[i + 2] > 65 && pixels[i + 2] < 150 && pixels[i] > pixels[i + 1] * 1.1 && pixels[i + 1] > pixels[i + 2] * 1.35;
    for (let i = 0; i < pixels.length; i += channels) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      if (r > 110 && r < 200 && g > 20 && g < 80 && b < 65 && r > g * 2) ink++;
      if (isGold(i)) gold++;
    }
    expect(ink / (width * height), '朱红墨迹须真实覆盖主视区').toBeGreaterThan(.22);
    // Inspect the actual projected rim, excluding gold in the scene behind it.
    const goldHits = geometry.goldSamples.filter(({ x, y }) => {
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        if (isGold(((y + dy) * width + x + dx) * channels)) return true;
      }
      return false;
    }).length;
    expect(geometry.goldSamples.length).toBeGreaterThan(50);
    expect(goldHits / geometry.goldSamples.length, '墨迹毛边须真实绘制细金线').toBeGreaterThan(.5);
    const edges = [.18, .34, .51, .68, .84].map(part => {
      const y = Math.round(height * part);
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * channels;
        if (pixels[i] > 110 && pixels[i] < 200 && pixels[i + 1] > 20 && pixels[i + 1] < 80 && pixels[i + 2] < 65) return x;
      }
      return width;
    });
    expect(Math.max(...edges) - Math.min(...edges), '墨迹边缘须有笔触起伏').toBeGreaterThan(15);
    await testInfo.attach('墨迹像素和覆盖边界', { body: Buffer.from(JSON.stringify({
      inkRatio: ink / (width * height), goldPixels: gold, goldRimHitRatio: goldHits / geometry.goldSamples.length,
      edgeVariation: Math.max(...edges) - Math.min(...edges), geometry,
    }, null, 2)), contentType: 'application/json' });
    await page.clock.runFor(600);
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'model');
    await expect(page.locator('#react-app')).toHaveAttribute('data-chapter-phase', 'idle');
    await expect(overlay).toHaveCount(0);
  });
}

test('墨迹不抢导航点击，快速切章和浏览器前进后退都收束到最终目标', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  await page.evaluate(async () => {
    for (const route of ['model', 'action', 'entry', 'state']) {
      document.querySelector(`.site-nav-item[data-route="${route}"]`).click();
      await new Promise(resolve => setTimeout(resolve, 42));
    }
  });
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  await expect(page.locator('#react-app')).toHaveAttribute('data-chapter-phase', 'idle');
  await expect(page.locator('.chapter-ink-transition')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await expect(page.locator('#react-app')).toHaveAttribute('data-chapter-phase', 'idle');
  await page.goForward();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  await expect(page.locator('#react-app')).toHaveAttribute('data-chapter-phase', 'idle');
  await expect(page.locator('.chapter-ink-transition')).toHaveCount(0);
});

test('减少动态即时换章，转场中改变偏好立即清除墨迹与旧等待', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, 'reduce');
  const immediate = await page.evaluate(async () => {
    document.querySelector('.site-nav-item[data-route="model"]').click();
    await new Promise(requestAnimationFrame);
    const main = document.querySelector('#react-app');
    return { route: main.dataset.route, phase: main.dataset.chapterPhase, ink: document.querySelectorAll('.chapter-ink-transition').length };
  });
  expect(immediate).toEqual({ route: 'model', phase: 'idle', ink: 0 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.site-nav-item[data-route="state"]').click();
  await expect(page.locator('.chapter-ink-transition')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  await expect(page.locator('#react-app')).toHaveAttribute('data-chapter-phase', 'idle');
  await expect(page.locator('.chapter-ink-transition')).toHaveCount(0);
  await page.waitForTimeout(800);
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
});

test('侧栏推开时墨迹只覆盖当前页面宽度，顶部始终跟随原顶栏', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await page.waitForTimeout(250);
  const frames = await page.evaluate(async () => {
    document.querySelector('.site-nav-item[data-route="model"]').click();
    const frames = [];
    const start = performance.now();
    while (performance.now() - start < 850) {
      const overlay = document.querySelector('.chapter-ink-transition');
      if (overlay) {
        const ink = overlay.getBoundingClientRect();
        const page = document.querySelector('.site-page').getBoundingClientRect();
        const header = document.querySelector('.site-header').getBoundingClientRect();
        frames.push({ width: ink.width, pageWidth: page.width, top: ink.top, headerBottom: header.bottom });
      }
      await new Promise(requestAnimationFrame);
    }
    return frames;
  });
  expect(frames.length).toBeGreaterThan(5);
  expect(frames.every(frame => Math.abs(frame.width - frame.pageWidth) < 1 && Math.abs(frame.top - frame.headerBottom) < 1)).toBe(true);
  expect(frames[0].width).toBeLessThan(1700);
  await expect(page.locator('.chapter-ink-transition')).toHaveCount(0);
});

test('后台可见性边界收束最新章节并清除墨迹和延时交换', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const state = await page.evaluate(async () => {
    document.querySelector('.site-nav-item[data-route="model"]').click();
    await new Promise(requestAnimationFrame);
    const main = document.querySelector('#react-app');
    const before = main.dataset.chapterPhase;
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(requestAnimationFrame);
    return { before, phase: main.dataset.chapterPhase, route: main.dataset.route,
      ink: document.querySelectorAll('.chapter-ink-transition').length };
  });
  expect(state.before).toBe('leaving');
  expect(state).toMatchObject({ phase: 'idle', route: 'model', ink: 0 });
  await page.evaluate(async () => {
    document.querySelector('.site-nav-item[data-route="state"]').click();
    await new Promise(requestAnimationFrame);
  });
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  await expect(page.locator('#react-app')).toHaveAttribute('data-chapter-phase', 'idle');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(800);
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  await expect(page.locator('.chapter-ink-transition')).toHaveCount(0);
});
