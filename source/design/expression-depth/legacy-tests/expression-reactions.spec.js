import { test, expect } from '@playwright/test';

test.use({ trace: 'off', viewport: { width: 1920, height: 1080 } });

const names = ['喜', '怒', '哀', '乐', '动', '静', '惊', '疑'];
const navigation = page => page.getByRole('navigation', { name: '醒狮八态', exact: true });
const reactionCount = page => page.evaluate(() => window.expressionReactions.length);

async function prepare(page) {
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, bookAutoplay: false }));
    window.expressionReactions = [];
    window.expressionClickPulses = [];
    // Keep native playback, cancellation and computed transforms intact.
    const nativeAnimate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = Reflect.apply(nativeAnimate, this, args);
      if (this.matches('.expression-lion-pose')) window.expressionReactions.push(animation);
      if (this.id === 'expressionLionTrigger') window.expressionClickPulses.push(animation);
      return animation;
    };
  });
  await page.goto('/#/state');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45000 });
  await expect.poll(() => page.locator('#expressionLion').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.locator('.expression-lion-layer.is-current').evaluate(element =>
    Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))));
}

async function select(page, name) {
  const before = await reactionCount(page);
  await navigation(page).getByRole('button', { name, exact: true }).click();
  await expect.poll(() => reactionCount(page), { timeout: 2500 }).toBe(before + 1);
  await expect(page.locator('#chapterStage')).toHaveAttribute('data-expression', name);
}

async function sampleReaction(page) {
  return page.evaluate(async () => {
    const animation = window.expressionReactions.at(-1);
    animation.pause();
    await animation.ready;
    // Freeze the unrelated image crossfade so rectangles measure the pose only.
    const pose = animation.effect.target;
    const entranceRemaining = Math.max(0, ...pose.parentElement.getAnimations().filter(arrival => arrival.playState === 'running')
      .map(arrival => Number(arrival.effect.getComputedTiming().endTime) - Number(arrival.currentTime)));
    for (const arrival of pose.parentElement.getAnimations()) arrival.finish();
    const duration = Number(animation.effect.getTiming().duration);
    const delay = animation.effect.getTiming().delay;
    const samples = [];
    for (let index = 0; index <= 40; index++) {
      animation.currentTime = delay + duration * index / 40;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(pose).transform);
      const box = pose.querySelector('img').getBoundingClientRect();
      samples.push({ x: matrix.e, y: matrix.f, scale: Math.hypot(matrix.a, matrix.b),
        angle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI, top: box.top, left: box.left, width: box.width });
    }
    animation.finish();
    await new Promise(resolve => requestAnimationFrame(resolve));
    return { duration, delay, entranceRemaining, iterations: animation.effect.getTiming().iterations, samples,
      restored: getComputedStyle(pose).transform };
  });
}

test('八态整图动作按语义运动且只播放一次：喜上扬、怒前倾、哀下沉、乐轻弹、静微呼吸', async ({ page }) => {
  await prepare(page);
  const profiles = {};
  for (const name of names) {
    await select(page, name);
    const result = await sampleReaction(page);
    const values = key => result.samples.map(sample => sample[key]);
    profiles[name] = { minY: Math.min(...values('y')), maxY: Math.max(...values('y')),
      minX: Math.min(...values('x')), maxX: Math.max(...values('x')),
      minScale: Math.min(...values('scale')), maxScale: Math.max(...values('scale')),
      minAngle: Math.min(...values('angle')), maxAngle: Math.max(...values('angle')), duration: result.duration };
    expect(result.duration, name).toBeGreaterThanOrEqual(350);
    expect(result.duration, name).toBeLessThanOrEqual(1000);
    expect(result.iterations, name).toBe(1);
    // A short angry lean must remain visible after the 520ms image entrance.
    expect(result.delay, name).toBeGreaterThanOrEqual(result.entranceRemaining - 2);
    expect(result.restored, name).toBe('none');
    // The real image rectangle must move or resize, not only an inert marker.
    expect(Math.max(...values('top')) - Math.min(...values('top')) + Math.max(...values('width')) - Math.min(...values('width')), name).toBeGreaterThan(.5);
  }
  expect(profiles.喜.minY).toBeLessThan(-6);
  expect(profiles.喜.maxY).toBeLessThan(1);
  expect(profiles.怒.maxScale).toBeGreaterThan(1.02);
  expect(Math.max(Math.abs(profiles.怒.minAngle), Math.abs(profiles.怒.maxAngle))).toBeGreaterThan(1);
  expect(profiles.哀.maxY).toBeGreaterThan(8);
  expect(profiles.哀.minY).toBeGreaterThan(-1);
  expect(profiles.哀.duration).toBeGreaterThan(profiles.怒.duration);
  expect(profiles.乐.minY).toBeLessThan(-9);
  expect(profiles.乐.maxY).toBeGreaterThan(1);
  expect(profiles.动.maxX - profiles.动.minX).toBeGreaterThan(8);
  expect(profiles.静.maxScale).toBeGreaterThan(1.003);
  expect(profiles.静.maxScale).toBeLessThan(1.015);
  expect(profiles.静.maxY - profiles.静.minY).toBeLessThan(3);
  expect(profiles.惊.minY).toBeLessThan(-5);
  expect(profiles.惊.minScale).toBeLessThan(.99);
  expect(profiles.疑.maxAngle - profiles.疑.minAngle).toBeGreaterThan(3);
  // Eight identical bounces, even with different durations, cannot pass.
  const trajectories = Object.values(profiles).map(({ duration, ...profile }) => JSON.stringify(
    Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, Math.round(value * 1000) / 1000]))));
  expect(new Set(trajectories).size).toBe(8);
});

test('当前态可重播，主狮头保留可调放大与解读，快速切换取消旧整图动作', async ({ page }) => {
  await prepare(page);
  await select(page, '喜');
  await sampleReaction(page);
  await select(page, '喜');
  await page.evaluate(() => { window.expressionReactions.at(-1).pause(); window.expressionReactions.at(-1).currentTime = 200; });
  expect(await page.locator('.expression-lion-layer.is-current .expression-lion-pose').evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).f)).toBeLessThan(-1);
  await page.locator('#expressionLionTrigger').evaluate(element => element.click());
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'details');
  const pulse = await page.evaluate(async () => {
    const animation = window.expressionClickPulses.at(-1);
    animation.pause(); await animation.ready;
    const duration = Number(animation.effect.getTiming().duration);
    let peak = 1;
    for (let index = 0; index <= 128; index++) {
      animation.currentTime = duration * index / 128;
      peak = Math.max(peak, new DOMMatrixReadOnly(getComputedStyle(animation.effect.target).transform).a);
    }
    return peak;
  });
  expect(pulse).toBeCloseTo(1.08, 2);
  await select(page, '怒');
  await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'overview');
  await expect.poll(() => page.evaluate(() => window.expressionClickPulses.at(-1).playState)).toBe('idle');
  await page.evaluate(() => {
    window.expressionReactions.at(-1).pause();
    window.expressionReactions.at(-1).currentTime = 100;
    [...document.querySelectorAll('.expression-state-button')].find(button => button.textContent.trim() === '哀').click();
    [...document.querySelectorAll('.expression-state-button')].find(button => button.textContent.trim() === '疑').click();
  });
  await expect(page.locator('#chapterStage')).toHaveAttribute('data-expression', '疑');
  await expect.poll(() => page.evaluate(() => window.expressionReactions.slice(0, -1).every(animation => animation.playState === 'idle'))).toBe(true);
  const profile = await sampleReaction(page);
  expect(Math.max(...profile.samples.map(sample => sample.angle))).toBeGreaterThan(3);
  expect(await page.locator('.expression-lion-layer.is-current .expression-lion-pose').evaluate(element => getComputedStyle(element).transform)).toBe('none');
});

test('神态对照隐藏、离页和运行时减少动态立即取消动作，重新允许动态后可再次触发', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page);
  await select(page, '静');
  await page.evaluate(() => window.expressionReactions.at(-1).pause());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => window.expressionReactions.at(-1).playState)).toBe('idle');
  const before = await reactionCount(page);
  await navigation(page).getByRole('button', { name: '哀', exact: true }).click();
  await expect(page.locator('#chapterStage')).toHaveAttribute('data-expression', '哀');
  expect(await reactionCount(page)).toBe(before);
  expect(await page.locator('.expression-lion-layer.is-current .expression-lion-pose').evaluate(element => getComputedStyle(element).transform)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await select(page, '哀');
  await page.evaluate(() => window.expressionReactions.at(-1).pause());
  await page.getByRole('button', { name: '神态对照', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.expressionReactions.at(-1).playState)).toBe('idle');
  await page.getByRole('button', { name: '八态浏览', exact: true }).click();
  expect(await reactionCount(page)).toBe(before + 1);
  await select(page, '惊');
  await page.evaluate(() => { window.expressionReactions.at(-1).pause(); location.hash = '#/entry'; });
  await expect(page.locator('#expressionLion')).toHaveCount(0);
  expect(await page.evaluate(() => { const animation = window.expressionReactions.at(-1); return animation.playState === 'idle' && !animation.effect.target.isConnected; })).toBe(true);
  expect(errors).toEqual([]);
});
