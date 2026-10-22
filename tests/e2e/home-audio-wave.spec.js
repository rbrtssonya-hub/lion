import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

// This observes real rendered geometry, not the animation's source text.
const waveFrames = path => path.evaluate(element => new Promise(resolve => {
  const frames = [];
  let start;
  function sample(time) {
    start ??= time;
    frames.push({ elapsed: time - start, d: getComputedStyle(element).d });
    if (time - start >= 220) resolve(frames);
    else requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
}));

test('有声白线真实连续形变，静音与减少动态立即停止，后台及离页安全清理', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await page.locator('#replayIntro').click();
  await page.locator('#skipIntro').click();
  const toggle = page.locator('#toggleHomeAudio');
  const path = toggle.locator('path');
  const video = page.locator('#entryLionVideo');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const frames = await waveFrames(path);
  expect(new Set(frames.map(frame => frame.d)).size).toBeGreaterThan(2);
  const evidence = testInfo.outputPath('actual-wave-frames.json');
  await writeFile(evidence, JSON.stringify(frames, null, 2));
  await testInfo.attach('actual-wave-frames', { path: evidence, contentType: 'application/json' });
  await page.screenshot({ path: testInfo.outputPath('home-animated-wave.png'), animations: 'allow' });
  await toggle.screenshot({ path: testInfo.outputPath('wave-phase-a.png'), animations: 'allow' });
  const first = await path.evaluate(element => getComputedStyle(element).d);
  await expect.poll(() => path.evaluate(element => getComputedStyle(element).d)).not.toBe(first);
  await toggle.screenshot({ path: testInfo.outputPath('wave-phase-b.png'), animations: 'allow' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(path).toHaveAttribute('d', 'M 3 12 H 57');
  expect(await path.evaluate(element => element.getBBox().height)).toBeLessThan(.01);
  expect(new Set((await waveFrames(path)).map(frame => frame.d)).size).toBe(1);
  expect(await path.evaluate(element => element.getAnimations().length)).toBe(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(new Set((await waveFrames(path)).map(frame => frame.d)).size).toBeGreaterThan(2);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(new Set((await waveFrames(path)).map(frame => frame.d)).size).toBe(1);
  expect(await path.evaluate(element => element.getAnimations().length)).toBe(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => video.evaluate(element => element.paused && element.muted)).toBe(true);
  expect(await path.evaluate(element => element.getAnimations().length)).toBe(0);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(new Set((await waveFrames(path)).map(frame => frame.d)).size).toBeGreaterThan(2);
  const retainedPath = await path.elementHandle();
  await page.locator('.site-header [data-route="state"]').click();
  expect(await retainedPath.evaluate(element => !element.isConnected && element.getAnimations().length === 0)).toBe(true);
  await expect.poll(() => video.evaluate(element => element.paused)).toBe(true);
});
