import { test, expect } from '@playwright/test';

test.use({ trace: 'off' });

// Observe browser-computed transforms and actual clipping geometry. Declared
// keyframes alone cannot prove direction, repetition or a stationary control.
const waveFrames = (flow, duration = 260) => flow.evaluate((element, duration) => new Promise(resolve => {
  const frames = [];
  const window = element.closest('.sound-wave-window');
  let start;
  function sample(time) {
    start ??= time;
    const box = window.getBoundingClientRect();
    const css = getComputedStyle(element);
    frames.push({ elapsed: time - start, x: new DOMMatrixReadOnly(css.transform).m41,
      playState: css.animationPlayState, window: { x: box.x, y: box.y, width: box.width, height: box.height } });
    if (time - start >= duration) resolve(frames);
    else requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
}), duration);

const movingRight = frames => frames.slice(1).map((frame, index) => frame.x - frames[index].x);

test('有声波浪在固定裁剪窗内持续右行，静音滑到直线，减少动态和后台停止并离页清理', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.locator('#replayIntro').click();
  await page.locator('#skipIntro').click();
  const toggle = page.locator('#toggleHomeAudio');
  const widget = toggle.locator('..');
  const flow = toggle.locator('.sound-wave-flow');
  const svg = toggle.locator('.sound-wave-window svg');
  const video = page.locator('#entryLionVideo');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(700, 300);
  const frames = await waveFrames(flow, 1650);
  const differences = movingRight(frames);
  expect(differences.filter(value => value > .01).length).toBeGreaterThan(5);
  expect(differences.filter(value => value < -25).length).toBeGreaterThanOrEqual(1);
  expect(new Set(frames.map(frame => JSON.stringify(frame.window))).size).toBe(1);
  expect(new Set(frames.map(frame => Number(frame.x.toFixed(2)))).size).toBeGreaterThan(5);
  await testInfo.attach('actual-rightward-wave-frames', { body: JSON.stringify(frames, null, 2), contentType: 'application/json' });
  expect(await toggle.locator('.sound-wave-window').evaluate(element => getComputedStyle(element).overflowX)).toBe('hidden');
  const traces = toggle.locator('.sound-wave-traces').first().locator('path');
  await expect.poll(() => traces.first().evaluate(element => Number.parseFloat(getComputedStyle(element).strokeDashoffset))).toBeCloseTo(-176.6, 1);
  await toggle.hover();
  await expect.poll(() => traces.first().evaluate(element => Number.parseFloat(getComputedStyle(element).strokeDashoffset))).toBeCloseTo(0, 1);
  await expect.poll(() => traces.nth(1).evaluate(element => Number.parseFloat(getComputedStyle(element).strokeDashoffset))).toBeCloseTo(176.6, 1);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(widget).toHaveAttribute('data-wave-playing', 'false');
  await expect.poll(() => svg.evaluate(element => {
    const expected = -element.getBoundingClientRect().width * .7 + 23;
    return Math.abs(new DOMMatrixReadOnly(getComputedStyle(element).transform).m41 - expected);
  })).toBeLessThan(.02);
  // The sampled viewport now lies in the straight tail, not the source wave.
  expect(await svg.evaluate(element => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    const scale = element.getBoundingClientRect().width / element.viewBox.baseVal.width;
    const tail = element.querySelector('.sound-wave-tail');
    const length = tail.getTotalLength();
    return [0, 13, 26].map(x => {
      const sourceX = (x - matrix.m41) / scale;
      let low = 0, high = length;
      for (let index = 0; index < 24; index++) {
        const middle = (low + high) / 2;
        if (tail.getPointAtLength(middle).x < sourceX) low = middle; else high = middle;
      }
      return tail.getPointAtLength((low + high) / 2).y;
    });
  }).then(ys => Math.max(...ys) - Math.min(...ys))).toBeLessThan(.02);
  const stopped = await waveFrames(flow);
  expect(Math.max(...stopped.map(frame => frame.x)) - Math.min(...stopped.map(frame => frame.x))).toBeLessThan(.01);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(movingRight(await waveFrames(flow)).some(value => value > .01)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await waveFrames(flow);
  expect(new Set(reduced.map(frame => frame.x)).size).toBe(1);
  expect(await flow.evaluate(element => element.getAnimations().length)).toBe(0);
  expect(await svg.evaluate(element => getComputedStyle(element).transitionProperty)).toBe('none');
  // The global reduce-motion rule uses an !important 0.01ms duration.
  expect(await svg.evaluate(element => Number.parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(.0001);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => video.evaluate(element => element.paused && element.muted)).toBe(true);
  await expect(widget).toHaveAttribute('data-wave-playing', 'false');
  expect(movingRight(await waveFrames(flow)).every(value => Math.abs(value) < .01)).toBe(true);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(movingRight(await waveFrames(flow)).some(value => value > .01)).toBe(true);
  const retained = await flow.elementHandle();
  await page.locator('.site-header [data-route="state"]').click();
  expect(await retained.evaluate(element => !element.isConnected && element.getAnimations().length === 0)).toBe(true);
  await expect.poll(() => video.evaluate(element => element.paused)).toBe(true);
});
