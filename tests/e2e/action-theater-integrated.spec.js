import { test, expect } from '@playwright/test';
import { actions, stage, scene, actionVideo, prepare, jsonAttribute } from './action-theater.helpers.js';
import { assetPaths } from '../../src/config/assetPaths.js';

const runningMedia = page => page.locator('video').evaluateAll(videos => videos.filter(video => !video.paused).map(video => video.dataset.actionId || video.id).sort());
const waitForTheater = async page => {
  await expect(scene(page)).toHaveAttribute('data-active-screen', 'tanqing', { timeout: 45_000 });
  await expect.poll(async () => Number(await scene(page).getAttribute('data-rendered-frames'))).toBeGreaterThan(0);
  await expect(stage(page).locator('canvas')).toHaveCount(1);
  await expect(stage(page).locator('video[data-action-id]')).toHaveCount(4);
  await expect.poll(async () => {
    const bindings = await jsonAttribute(scene(page), 'data-video-bindings');
    return actions.every(({ id }) => bindings?.[id]?.bound && bindings[id].width === 2560 && bindings[id].height === 1440);
  }).toBe(true);
};

test('合并后首页媒体与四面巨幕往返保持独立播放实例，离页释放后仅重建一套动作画布', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page);
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  const home = page.locator('#entryLionVideo');
  await expect.poll(() => home.evaluate(video => video.readyState)).toBeGreaterThanOrEqual(2);
  expect(await home.evaluate(video => ({ width: video.videoWidth, height: video.videoHeight, loop: video.loop, muted: video.muted }))).toEqual({ width: 2560, height: 1440, loop: true, muted: true });
  expect(await home.evaluate(video => video.duration)).toBeCloseTo(14.000998, 2);
  await expect(home).toHaveAttribute('src', new RegExp(`${assetPaths.home.replaceAll('.', '\\.')}$`));
  await expect.poll(() => runningMedia(page)).toEqual(['entryLionVideo']);
  await home.evaluate(video => { video.currentTime = 2; });
  await expect.poll(() => home.evaluate(video => video.currentTime)).toBeGreaterThanOrEqual(1.9);
  const homeElement = await home.elementHandle();

  await page.locator('.site-header [data-route="action"]').click();
  await waitForTheater(page);
  await expect.poll(() => home.evaluate(video => video.paused)).toBe(true);
  expect(await homeElement.evaluate(video => video.isConnected && video === document.querySelector('#entryLionVideo'))).toBe(true);
  const pausedHomeTime = await home.evaluate(video => video.currentTime);
  await expect.poll(() => runningMedia(page)).toEqual(actions.map(action => action.id).sort());
  const oldCanvas = await scene(page).elementHandle();
  const oldVideos = await stage(page).locator('video[data-action-id]').elementHandles();
  for (const { id } of actions) await expect.poll(() => actionVideo(page, id).evaluate(video => video.currentTime > .1)).toBe(true);

  await page.locator('.site-brand-capsule').click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await expect(page.locator('#chapterStage canvas, #chapterStage video[data-action-id]')).toHaveCount(0);
  expect(await oldCanvas.evaluate(canvas => canvas.isConnected)).toBe(false);
  await expect.poll(() => oldCanvas.evaluate(canvas => (canvas.getContext('webgl2') || canvas.getContext('webgl')).isContextLost())).toBe(true);
  for (const video of oldVideos) expect(await video.evaluate(element => ({ connected: element.isConnected, paused: element.paused, muted: element.muted, src: element.getAttribute('src') }))).toEqual({ connected: false, paused: true, muted: true, src: null });
  expect(await homeElement.evaluate(video => video.isConnected && video === document.querySelector('#entryLionVideo'))).toBe(true);
  await expect.poll(() => runningMedia(page)).toEqual(['entryLionVideo']);
  await expect.poll(() => home.evaluate(video => video.currentTime)).toBeGreaterThan(pausedHomeTime + .1);
  await expect(page.locator('#introVideo')).toHaveCount(0);
  await expect(page.locator('#homeLionTypes, #homeInheritors, #homeCultureSources')).toHaveCount(3);

  await page.locator('.site-header [data-route="action"]').click();
  await waitForTheater(page);
  expect(await oldCanvas.evaluate(canvas => canvas === document.querySelector('#chapterStage canvas'))).toBe(false);
  await expect.poll(() => runningMedia(page)).toEqual(actions.map(action => action.id).sort());
  expect(errors).toEqual([]);
  await testInfo.attach('integrated-home-theater-lifecycle', { body: JSON.stringify({ homeAsset: assetPaths.home, homeDuration: await home.evaluate(video => video.duration), pausedHomeTime, sameHomeElement: await homeElement.evaluate(video => video.isConnected && video === document.querySelector('#entryLionVideo')), actionCanvasCount: await stage(page).locator('canvas').count(), actionVideoCount: await stage(page).locator('video[data-action-id]').count(), activeDecodersByMediaState: await runningMedia(page), previousCanvasDisposed: await oldCanvas.evaluate(canvas => !canvas.isConnected && (canvas.getContext('webgl2') || canvas.getContext('webgl')).isContextLost()), composition: await jsonAttribute(scene(page), 'data-composition') }, null, 2), contentType: 'application/json' });
});
