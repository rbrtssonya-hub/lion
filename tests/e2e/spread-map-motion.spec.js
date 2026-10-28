import { test, expect } from '@playwright/test';

const fps = 24;
const chinaTime = 99 / fps;
const worldTime = 203 / fps;

async function openSpread(page, reducedMotion = 'no-preference') {
  await page.emulateMedia({ reducedMotion });
  await page.addInitScript(() => {
    if (window === top) sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/spread');
  await expect(page.locator('#spreadStage')).toBeVisible();
  await expect(page.locator('.spread-map')).toHaveAttribute('data-map-motion', 'idle');
}

const map = page => page.locator('.spread-map');
const video = (page, direction) => page.locator(`.spread-map-video[data-direction="${direction}"]`);
const tab = (page, name) => page.getByRole('tab', { name, exact: true });

async function playbackTime(locator) {
  return locator.evaluate(element => element.currentTime);
}

async function frameSignature(locator) {
  return locator.evaluate(element => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 83;
    const context = canvas.getContext('2d');
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    for (let i = 0; i < pixels.length; i += 8) hash = Math.imul(hash ^ pixels[i], 16777619) >>> 0;
    return hash;
  });
}

async function waitForPlaying(page, direction) {
  await expect(map(page)).toHaveAttribute('data-map-motion', 'moving');
  const active = video(page, direction);
  await expect(active).toBeVisible();
  await expect.poll(() => active.evaluate(element => !element.paused && element.readyState >= 2)).toBe(true);
  return active;
}

test('广东直达世界沿原视频连续运行并经过中国停顿，最后恢复案例选择', async ({ page }) => {
  await openSpread(page);
  await tab(page, '世界').click();
  const forward = await waitForPlaying(page, 'forward');
  await expect(page.locator('.spread-map-place').first()).toBeHidden();
  await expect.poll(() => playbackTime(forward), { timeout: 10_000 }).toBeGreaterThan(1.5);
  const beforeTime = await playbackTime(forward);
  const beforeFrame = await frameSignature(forward);
  await expect.poll(() => playbackTime(forward)).toBeGreaterThan(beforeTime + 0.5);
  const afterFrame = await frameSignature(forward);
  expect(afterFrame).not.toBe(beforeFrame);
  await expect.poll(() => playbackTime(forward), { timeout: 10_000 }).toBeGreaterThan(chinaTime + 0.1);
  await expect(map(page)).toHaveAttribute('data-map-motion', 'moving');
  await expect(map(page)).toHaveAttribute('data-map-motion', 'idle', { timeout: 12_000 });
  expect(await playbackTime(forward)).toBeGreaterThanOrEqual(worldTime - 0.15);
  await expect(page.locator('.spread-map-render')).toHaveAttribute('src', /world\.png/);
  await page.getByRole('button', { name: '选择新加坡邮票', exact: true }).click();
  await expect(page.locator('#spreadPlaceTitle')).toHaveText('新加坡');
});

test('中国镜头返回广东时倒放原运动；快速改目标从当前画面反向', async ({ page }) => {
  await openSpread(page);
  await tab(page, '中国').click();
  const forward = await waitForPlaying(page, 'forward');
  await expect.poll(() => playbackTime(forward), { timeout: 10_000 }).toBeGreaterThan(1.5);
  // Sample at the actual click and reverse `playing` event, rather than after
  // Playwright's auto-wait (which lets the video advance before measuring).
  const originalTime = await page.evaluate(() => {
    const reverse = document.querySelector('.spread-map-video[data-direction="reverse"]');
    reverse.addEventListener('playing', () => { window.__reverseStartTime = reverse.currentTime; }, { once: true });
    const time = document.querySelector('.spread-map-video[data-direction="forward"]').currentTime;
    document.getElementById('spread-level-guangdong').click();
    return time;
  });
  const reverse = await waitForPlaying(page, 'reverse');
  const reverseTime = await playbackTime(reverse);
  const reverseStartTime = await page.evaluate(() => window.__reverseStartTime);
  // Encoded reverse frame time maps to original time by (203 / 24 - time).
  expect(Math.abs((worldTime - reverseStartTime) - originalTime)).toBeLessThan(0.2);
  await expect.poll(() => playbackTime(reverse)).toBeGreaterThan(reverseTime + 0.4);
  await expect(map(page)).toHaveAttribute('data-map-motion', 'idle', { timeout: 10_000 });
  await expect(page.locator('.spread-map-render')).toHaveAttribute('src', /guangdong\.png/);
  await tab(page, '中国').click();
  await waitForPlaying(page, 'forward');
  await expect(map(page)).toHaveAttribute('data-map-motion', 'idle', { timeout: 10_000 });
  await expect(page.locator('.spread-map-render')).toHaveAttribute('src', /china\.png/);
  expect(await playbackTime(forward)).toBeGreaterThanOrEqual(chinaTime - 0.15);
  // A late error from a stopped video must not overwrite the settled state.
  await forward.evaluate(element => element.dispatchEvent(new Event('error')));
  await expect(map(page)).toHaveAttribute('data-map-motion', 'idle');
  await tab(page, '广东').click();
  const returning = await waitForPlaying(page, 'reverse');
  const startedAt = await playbackTime(returning);
  await expect.poll(() => playbackTime(returning)).toBeGreaterThan(startedAt + 0.4);
  await expect(map(page)).toHaveAttribute('data-map-motion', 'idle', { timeout: 10_000 });
});

test('减少动态偏好直接到目标静帧且案例仍可操作', async ({ page }) => {
  await openSpread(page, 'reduce');
  await tab(page, '世界').click();
  await expect(map(page)).toHaveAttribute('data-map-motion', 'idle');
  await expect(page.locator('.spread-map-render')).toHaveAttribute('src', /world\.png/);
  await expect(video(page, 'forward')).toBeHidden();
  await page.getByRole('button', { name: '选择新加坡邮票', exact: true }).click();
  await expect(page.locator('#spreadPlaceTitle')).toHaveText('新加坡');
});

test('动画文件不可用时回退目标静帧并保留案例与后续切换', async ({ page }) => {
  await page.route('**/assets/spread-map/motion-*.mp4', route => route.abort());
  await openSpread(page);
  await tab(page, '中国').click();
  await expect(map(page)).toHaveAttribute('data-map-motion', 'failed', { timeout: 15_000 });
  await expect(page.locator('.spread-map-render')).toHaveAttribute('src', /china\.png/);
  await page.getByRole('button', { name: '选择香港邮票', exact: true }).click();
  await expect(page.locator('#spreadPlaceTitle')).toHaveText('香港');
  await tab(page, '世界').click();
  await expect(map(page)).toHaveAttribute('data-map-motion', 'failed', { timeout: 15_000 });
  await expect(page.locator('.spread-map-render')).toHaveAttribute('src', /world\.png/);
});

test('播放中发生媒体错误后停止镜头并恢复目标案例操作', async ({ page }) => {
  await openSpread(page);
  await tab(page, '中国').click();
  const forward = await waitForPlaying(page, 'forward');
  await forward.evaluate(element => element.dispatchEvent(new Event('error')));
  await expect(map(page)).toHaveAttribute('data-map-motion', 'failed');
  await expect.poll(() => forward.evaluate(element => element.paused)).toBe(true);
  await expect(page.locator('.spread-map-render')).toHaveAttribute('src', /china\.png/);
  await page.getByRole('button', { name: '选择香港邮票', exact: true }).click();
  await expect(page.locator('#spreadPlaceTitle')).toHaveText('香港');
});

test('镜头播放期间离开传章会暂停并释放视频', async ({ page }) => {
  await openSpread(page);
  await tab(page, '世界').click();
  await waitForPlaying(page, 'forward');
  await page.evaluate(() => {
    window.__savedMapVideos = [...document.querySelectorAll('.spread-map-video')];
    location.hash = '#/entry';
  });
  await expect(page.locator('#spreadStage')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__savedMapVideos.every(video => video.paused && !video.isConnected))).toBe(true);
});

test('视频元数据尚未载入时取消目标不会在稍后启动旧运镜', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/spread-map/motion-forward.mp4', async route => {
    await gate;
    await route.continue().catch(() => {});
  });
  try {
    await openSpread(page);
    await tab(page, '世界').click();
    await expect(map(page)).toHaveAttribute('data-map-motion', 'loading');
    await tab(page, '广东').click();
    await expect(map(page)).toHaveAttribute('data-map-motion', 'idle');
    release();
    await expect.poll(() => video(page, 'forward').evaluate(element => element.readyState >= 1)).toBe(true);
    await expect.poll(() => video(page, 'forward').evaluate(element => element.paused)).toBe(true);
    await expect(page.locator('.spread-map-render')).toHaveAttribute('src', /guangdong\.png/);
    await expect(map(page)).toHaveAttribute('data-map-level', 'guangdong');
  } finally {
    release();
  }
});
