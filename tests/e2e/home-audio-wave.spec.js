import { test, expect } from '@playwright/test';
import { sampleWave, expectContinuousWave } from './sound-wave.helpers.js';

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

test('连续单线波浪在固定窗持续右行，悬停和循环不掉线，静音压平并正确停止与清理', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.locator('#replayIntro').click();
  await page.locator('#skipIntro').click();
  const toggle = page.locator('#toggleHomeAudio');
  const widget = toggle.locator('..');
  const flow = toggle.locator('.sound-wave-flow');
  const window = toggle.locator('.sound-wave-window');
  const amplitude = toggle.locator('.sound-wave-amplitude');
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
  const [hoverFrames] = await Promise.all([sampleWave(window, 650), toggle.hover()]);
  expectContinuousWave(expect, hoverFrames);
  const [leaveFrames] = await Promise.all([sampleWave(window, 650), page.mouse.move(700, 300)]);
  expectContinuousWave(expect, leaveFrames);
  await testInfo.attach('actual-hover-painted-stroke-frames', { body: JSON.stringify(hoverFrames, null, 2), contentType: 'application/json' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(widget).toHaveAttribute('data-wave-playing', 'false');
  await expect.poll(() => amplitude.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m22)).toBeCloseTo(.0001, 5);
  const flat = await sampleWave(window);
  expectContinuousWave(expect, flat);
  expect(flat.every(frame => frame.spread < .02)).toBe(true);
  const stopped = await waveFrames(flow);
  expect(Math.max(...stopped.map(frame => frame.x)) - Math.min(...stopped.map(frame => frame.x))).toBeLessThan(.01);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(movingRight(await waveFrames(flow)).some(value => value > .01)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await waveFrames(flow);
  expect(new Set(reduced.map(frame => frame.x)).size).toBe(1);
  expect(await flow.evaluate(element => element.getAnimations().length)).toBe(0);
  expect(await amplitude.evaluate(element => getComputedStyle(element).transitionProperty)).toBe('none');
  // The global reduce-motion rule uses an !important 0.01ms duration.
  expect(await amplitude.evaluate(element => Number.parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(.0001);
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

test('连续启停在压平过渡中直接反向，无自行描线或断缝且保留媒体实例', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => { if (window === window.top) sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'); });
  await page.goto('/');
  const toggle = page.locator('#toggleHomeAudio');
  if (await toggle.getAttribute('aria-pressed') !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const window = toggle.locator('.sound-wave-window');
  const video = await page.locator('#entryLionVideo').elementHandle();
  const before = await video.evaluate(element => element.currentTime);
  const [frames] = await Promise.all([
    sampleWave(window, 1000),
    (async () => { for (let index = 0; index < 8; index++) await toggle.click(); })(),
  ]);
  expectContinuousWave(expect, frames);
  expect(frames.some(frame => frame.amplitude > 0 && frame.amplitude < 1)).toBe(true);
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(before + .1);
  expect(await video.evaluate(element => element === document.querySelector('#entryLionVideo'))).toBe(true);
  await testInfo.attach('actual-interrupted-amplitude-frames', { body: JSON.stringify(frames, null, 2), contentType: 'application/json' });
});
