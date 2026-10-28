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
const video = (page, direction, frameRate = 60) => page.locator(`.spread-map-video[data-direction="${direction}"][data-frame-rate="${frameRate}"]`);
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

async function waitForPlaying(page, direction, frameRate = 60) {
  await expect(map(page)).toHaveAttribute('data-map-motion', 'moving');
  const active = video(page, direction, frameRate);
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
  await expect(forward).toHaveAttribute('data-visible', 'true');
  await expect(forward).toBeVisible();
  expect(await forward.evaluate(element => element.paused)).toBe(true);
  // Examine the actual animation's keyframes, instead of relying on a sleep
  // that can race a busy CI browser and miss the 300 ms transition.
  const transition = await page.locator('.spread-map-buttons').evaluate(element => {
    const animation = element.getAnimations().find(item => item.animationName === 'spread-map-points-appear');
    if (!animation) return null;
    animation.pause();
    const duration = animation.effect.getTiming().duration;
    animation.currentTime = 0;
    const start = Number(getComputedStyle(element).opacity);
    animation.currentTime = duration / 2;
    const middle = Number(getComputedStyle(element).opacity);
    animation.currentTime = duration;
    const end = Number(getComputedStyle(element).opacity);
    animation.play();
    return { duration, start, middle, end };
  });
  expect(transition).not.toBeNull();
  expect(transition.duration).toBeGreaterThan(0);
  expect(transition.start).toBeLessThan(transition.middle);
  expect(transition.middle).toBeLessThan(transition.end);
  expect(transition.end).toBe(1);
  await page.getByRole('button', { name: '选择新加坡邮票', exact: true }).click();
  await expect(page.locator('.spread-stamp-hit[data-map-selected="true"]')).toHaveAttribute('data-place', 'singapore');
});

test('中国镜头返回广东时倒放原运动；快速改目标从当前画面反向', async ({ page }) => {
  await openSpread(page);
  await tab(page, '中国').click();
  const forward = await waitForPlaying(page, 'forward');
  await expect.poll(() => playbackTime(forward), { timeout: 10_000 }).toBeGreaterThan(1.5);
  // Sample at the actual click and reverse `playing` event, rather than after
  // Playwright's auto-wait (which lets the video advance before measuring).
  const originalTime = await page.evaluate(() => {
    const reverse = document.querySelector('.spread-map-video[data-direction="reverse"][data-frame-rate="60"]');
    reverse.addEventListener('playing', () => { window.__reverseStartTime = reverse.currentTime; }, { once: true });
    const time = document.querySelector('.spread-map-video[data-direction="forward"][data-frame-rate="60"]').currentTime;
    document.getElementById('spread-level-guangdong').click();
    return time;
  });
  const reverse = await waitForPlaying(page, 'reverse');
  const reverseTime = await playbackTime(reverse);
  const reverseStartTime = await page.evaluate(() => window.__reverseStartTime);
  // Reverse 60 fps begins at source time 509 / 60; compare sampled media clocks.
  expect(Math.abs((509 / 60 - reverseStartTime) - originalTime)).toBeLessThan(0.2);
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

test('设置中切换实际帧率与播放速度，播放中换源及反向保持当前位置', async ({ page }) => {
  await openSpread(page);
  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
  const panel = page.getByRole('region', { name: '开发者参数设置', exact: true });
  await panel.getByRole('tablist', { name: '设置分类' }).getByRole('tab', { name: '章节', exact: true }).click();
  await panel.getByRole('tablist', { name: '章节设置分区' }).getByRole('tab', { name: '传章', exact: true }).click();
  await panel.locator('summary').filter({ hasText: '地图动画' }).click();
  const frameRate = panel.getByLabel('地图动画帧率', { exact: true });
  await expect(frameRate).toHaveValue('60');
  await expect(map(page)).toHaveAttribute('data-map-frame-rate', '60');
  await page.evaluate(() => document.getElementById('spread-level-world').click());
  const forward60 = await waitForPlaying(page, 'forward', 60);
  await expect.poll(() => playbackTime(forward60)).toBeGreaterThan(1.4);
  // Sample at the select's real change event and the new media's playing event.
  await page.evaluate(() => {
    const select = [...document.querySelectorAll('select')].find(element => element.value === '60' && [...element.options].some(option => option.value === '24'));
    const from = document.querySelector('.spread-map-video[data-direction="forward"][data-frame-rate="60"]');
    const to = document.querySelector('.spread-map-video[data-direction="forward"][data-frame-rate="24"]');
    select.addEventListener('change', () => { window.__frameSwitchBefore = from.currentTime; }, { once: true });
    to.addEventListener('playing', () => { window.__frameSwitchAfter = to.currentTime; }, { once: true });
  });
  await frameRate.selectOption('24');
  const forward24 = await waitForPlaying(page, 'forward', 24);
  const forwardSwitch = await page.evaluate(() => [window.__frameSwitchBefore, window.__frameSwitchAfter]);
  expect(forwardSwitch.every(Number.isFinite)).toBe(true);
  expect(Math.abs(forwardSwitch[0] - forwardSwitch[1])).toBeLessThan(0.2);
  await expect(map(page)).toHaveAttribute('data-map-frame-rate', '24');
  await expect.poll(() => forward60.evaluate(element => element.paused)).toBe(true);
  await expect.poll(() => playbackTime(forward24)).toBeGreaterThan(forwardSwitch[1] + 0.2);

  // Switch back while moving, then reverse from that exact position.
  await page.evaluate(() => {
    const select = [...document.querySelectorAll('select')].find(element => element.value === '24' && [...element.options].some(option => option.value === '60'));
    const from = document.querySelector('.spread-map-video[data-direction="forward"][data-frame-rate="24"]');
    const to = document.querySelector('.spread-map-video[data-direction="forward"][data-frame-rate="60"]');
    select.addEventListener('change', () => { window.__returnSwitchBefore = from.currentTime; }, { once: true });
    to.addEventListener('playing', () => { window.__returnSwitchAfter = to.currentTime; }, { once: true });
  });
  await frameRate.selectOption('60');
  await waitForPlaying(page, 'forward', 60);
  const returnSwitch = await page.evaluate(() => [window.__returnSwitchBefore, window.__returnSwitchAfter]);
  expect(returnSwitch.every(Number.isFinite)).toBe(true);
  expect(Math.abs(returnSwitch[0] - returnSwitch[1])).toBeLessThan(0.2);
  const reverseStart = await page.evaluate(() => {
    const reverse = document.querySelector('.spread-map-video[data-direction="reverse"][data-frame-rate="60"]');
    reverse.addEventListener('playing', () => { window.__settingsReverseStart = reverse.currentTime; }, { once: true });
    const time = document.querySelector('.spread-map-video[data-direction="forward"][data-frame-rate="60"]').currentTime;
    document.getElementById('spread-level-guangdong').click();
    return time;
  });
  const reverse60 = await waitForPlaying(page, 'reverse', 60);
  const reverseTime = await page.evaluate(() => window.__settingsReverseStart);
  expect(Math.abs((509 / 60 - reverseTime) - reverseStart)).toBeLessThan(0.2);
  await panel.getByLabel('地图动画播放速度数值', { exact: true }).fill('1.5');
  await expect.poll(() => reverse60.evaluate(element => element.playbackRate)).toBe(1.5);
  await expect(map(page)).toHaveAttribute('data-map-motion', 'idle', { timeout: 12_000 });
  await expect(reverse60).toHaveAttribute('data-visible', 'true');

  await frameRate.selectOption('24');
  await panel.getByRole('button', { name: '保存设置', exact: true }).click();
  await page.reload();
  await expect(map(page)).toHaveAttribute('data-map-frame-rate', '24');
  await expect.poll(() => video(page, 'forward', 24).evaluate(element => element.playbackRate)).toBe(1.5);
});

test('减少动态偏好直接到目标静帧且案例仍可操作', async ({ page }) => {
  await openSpread(page, 'reduce');
  await tab(page, '世界').click();
  await expect(map(page)).toHaveAttribute('data-map-motion', 'idle');
  await expect(page.locator('.spread-map-render')).toHaveAttribute('src', /world\.png/);
  await expect(video(page, 'forward')).toBeHidden();
  await page.getByRole('button', { name: '选择新加坡邮票', exact: true }).click();
  await expect(page.locator('.spread-stamp-hit[data-map-selected="true"]')).toHaveAttribute('data-place', 'singapore');
});

test('动画文件不可用时回退目标静帧并保留案例与后续切换', async ({ page }) => {
  await page.route('**/assets/spread-map/motion-*.mp4', route => route.abort());
  await openSpread(page);
  await tab(page, '中国').click();
  await expect(map(page)).toHaveAttribute('data-map-motion', 'failed', { timeout: 15_000 });
  await expect(page.locator('.spread-map-render')).toHaveAttribute('src', /china\.png/);
  await page.getByRole('button', { name: '选择香港邮票', exact: true }).click();
  await expect(page.locator('.spread-stamp-hit[data-map-selected="true"]')).toHaveAttribute('data-place', 'hong-kong');
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
  await expect(forward).toHaveAttribute('data-visible', 'false');
  await expect(page.locator('.spread-map-render')).toHaveAttribute('src', /china\.png/);
  await page.getByRole('button', { name: '选择香港邮票', exact: true }).click();
  await expect(page.locator('.spread-stamp-hit[data-map-selected="true"]')).toHaveAttribute('data-place', 'hong-kong');
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

test('旧的播放请求晚完成时不能暂停后续播放', async ({ page }) => {
  await page.addInitScript(() => {
    if (window !== top) return;
    const play = HTMLMediaElement.prototype.play;
    let delayed = false;
    HTMLMediaElement.prototype.play = function (...args) {
      const started = play.apply(this, args);
      if (!delayed && this.matches('.spread-map-video[data-direction="forward"][data-frame-rate="60"]')) {
        delayed = true;
        return started.then(() => new Promise(resolve => { window.__releaseOldMapPlay = resolve; }));
      }
      return started;
    };
  });
  await openSpread(page);
  await tab(page, '世界').click();
  await expect.poll(() => page.evaluate(() => typeof window.__releaseOldMapPlay)).toBe('function');
  await expect(map(page)).toHaveAttribute('data-map-motion', 'loading');
  await tab(page, '广东').click();
  await expect(map(page)).toHaveAttribute('data-map-motion', 'idle');
  await tab(page, '世界').click();
  const forward = await waitForPlaying(page, 'forward', 60);
  await page.evaluate(() => window.__releaseOldMapPlay());
  // Give the old promise a microtask turn, then check both media state and progress.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  await expect.poll(() => forward.evaluate(element => !element.paused)).toBe(true);
  const start = await playbackTime(forward);
  await expect.poll(() => playbackTime(forward), { timeout: 4000 }).toBeGreaterThan(start + 0.25);
});

test('页面快速隐藏与恢复时旧的恢复播放失败不影响新播放', async ({ page }) => {
  await openSpread(page);
  await tab(page, '世界').click();
  const forward = await waitForPlaying(page, 'forward', 60);
  await expect.poll(() => playbackTime(forward)).toBeGreaterThan(1);
  await page.evaluate(() => {
    const originalPlay = HTMLMediaElement.prototype.play;
    let delayed = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__mapHidden });
    window.__mapHidden = false;
    HTMLMediaElement.prototype.play = function (...args) {
      const result = originalPlay.apply(this, args);
      if (!delayed && this.matches('.spread-map-video[data-direction="forward"][data-frame-rate="60"]')) {
        delayed = true;
        result.catch(() => {});
        return new Promise((resolve, reject) => { window.__rejectOldResume = reject; });
      }
      return result;
    };
    const visibility = value => {
      window.__mapHidden = value;
      document.dispatchEvent(new Event('visibilitychange'));
    };
    visibility(true);
    visibility(false);
    visibility(true);
    visibility(false);
  });
  await expect.poll(() => forward.evaluate(element => !element.paused)).toBe(true);
  await page.evaluate(() => window.__rejectOldResume(new DOMException('Playback interrupted by pause', 'AbortError')));
  await expect(map(page)).toHaveAttribute('data-map-motion', 'moving');
  const before = await playbackTime(forward);
  await expect.poll(() => playbackTime(forward), { timeout: 4000 }).toBeGreaterThan(before + 0.25);
});

// Shorten only the map's 12-second watchdog; the product timeout remains unchanged.
async function shortenMapWatchdog(page) {
  await page.addInitScript(() => {
    if (window !== top) return;
    const timeout = window.setTimeout;
    window.setTimeout = (callback, delay, ...args) => timeout(callback, delay === 12000 ? 1200 : delay, ...args);
  });
}

test('地图媒体请求停滞时超时回退静图并恢复案例操作', async ({ page }) => {
  await shortenMapWatchdog(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/spread-map/motion-forward-60.mp4', async route => {
    await gate;
    await route.abort().catch(() => {});
  });
  try {
    await openSpread(page);
    await tab(page, '中国').click();
    await expect(map(page)).toHaveAttribute('data-map-motion', 'loading');
    await expect(map(page)).toHaveAttribute('data-map-motion', 'failed', { timeout: 6000 });
    await expect(page.locator('.spread-map-render')).toHaveAttribute('src', /china\.png/);
    await expect(video(page, 'forward', 60)).toHaveAttribute('data-visible', 'false');
    await page.getByRole('button', { name: '选择香港邮票', exact: true }).click();
    await expect(page.locator('.spread-stamp-hit[data-map-selected="true"]')).toHaveAttribute('data-place', 'hong-kong');
    release();
    await expect(map(page)).toHaveAttribute('data-map-motion', 'failed');
    await expect.poll(() => video(page, 'forward', 60).evaluate(element => element.paused)).toBe(true);
  } finally {
    release();
  }
});

test('播放请求悬而未决时超时回退，晚到的成功不会重启动画', async ({ page }) => {
  await shortenMapWatchdog(page);
  await page.addInitScript(() => {
    if (window !== top) return;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      if (this.matches('.spread-map-video[data-direction="forward"][data-frame-rate="60"]')) {
        const started = play.apply(this, args);
        return started.then(() => new Promise(resolve => { window.__releaseTimedOutMapPlay = resolve; }));
      }
      return play.apply(this, args);
    };
  });
  await openSpread(page);
  await expect.poll(() => video(page, 'forward', 60).evaluate(element => element.readyState >= 2)).toBe(true);
  await tab(page, '中国').click();
  await expect.poll(() => page.evaluate(() => typeof window.__releaseTimedOutMapPlay)).toBe('function');
  await expect(map(page)).toHaveAttribute('data-map-motion', 'failed', { timeout: 6000 });
  await expect(page.locator('.spread-map-render')).toHaveAttribute('src', /china\.png/);
  await expect(video(page, 'forward', 60)).toHaveAttribute('data-visible', 'false');
  await expect.poll(() => video(page, 'forward', 60).evaluate(element => element.paused)).toBe(true);
  await page.evaluate(() => window.__releaseTimedOutMapPlay());
  // Flush the late play promise before checking that the failure state remains.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  await expect(map(page)).toHaveAttribute('data-map-motion', 'failed');
  await expect.poll(() => video(page, 'forward', 60).evaluate(element => element.paused)).toBe(true);
  await page.getByRole('button', { name: '选择香港邮票', exact: true }).click();
  await expect(page.locator('.spread-stamp-hit[data-map-selected="true"]')).toHaveAttribute('data-place', 'hong-kong');
});

test('视频元数据尚未载入时取消目标不会在稍后启动旧运镜', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/spread-map/motion-forward-60.mp4', async route => {
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
