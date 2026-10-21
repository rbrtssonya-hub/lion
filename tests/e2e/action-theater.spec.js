import { test, expect } from '@playwright/test';
import { actions, stage, scene, actionButton, actionVideo, openTheater, selectAction, prepare, jsonAttribute, canvasPixels } from './action-theater.helpers.js';
import { assetPaths } from '../../src/config/assetPaths.js';
import { THEATER_ORBIT } from '../../src/services/actionTheaterMath.js';

const sixFrames = page => page.evaluate(() => new Promise(resolve => {
  let frames = 6;
  const next = () => --frames ? requestAnimationFrame(next) : resolve();
  requestAnimationFrame(next);
}));

test('巨幕厅实际载入独立场景、四面真视频纹理及可见彩色像素', async ({ page }) => {
  const errors = [], failed = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
  page.on('request', request => requests.push(request.url()));
  await openTheater(page);
  await expect(stage(page).locator('canvas')).toHaveCount(1);
  await expect(stage(page).locator('video')).toHaveCount(4);
  await expect.poll(async () => {
    const bindings = await jsonAttribute(scene(page), 'data-video-bindings');
    return actions.every(({ id }) => bindings?.[id]?.bound && bindings[id].width === 2560 && bindings[id].height === 1440);
  }, { timeout: 30_000 }).toBe(true);
  const pixels = await canvasPixels(page);
  expect(pixels.width).toBeGreaterThan(500);
  expect(pixels.bright / pixels.count).toBeGreaterThan(.05);
  expect(pixels.colored / pixels.count).toBeGreaterThan(.02);
  expect(requests.some(url => new URL(url).pathname.endsWith(assetPaths.actionTheaterScene))).toBe(true);
  for (const { id } of actions) expect(requests.some(url => url.includes(`/action/videos/${id}.mp4`))).toBe(true);
  expect(errors).toEqual([]); expect(failed).toEqual([]);
});

test('中央模型按36秒均速自转，摄像机静置且不继承模型旋转', async ({ page }) => {
  await openTheater(page);
  await expect(scene(page)).toHaveAttribute('data-camera-state', 'idle');
  const first = { rotation: Number(await scene(page).getAttribute('data-lion-rotation')), position: await jsonAttribute(scene(page), 'data-camera-position'), time: Date.now() };
  await expect.poll(async () => {
    const current = Number(await scene(page).getAttribute('data-lion-rotation'));
    return (current - first.rotation + 2 * Math.PI) % (2 * Math.PI);
  }).toBeGreaterThan(.12);
  const last = { rotation: Number(await scene(page).getAttribute('data-lion-rotation')), position: await jsonAttribute(scene(page), 'data-camera-position'), time: Date.now() };
  const angularSpeed = ((last.rotation - first.rotation + 2 * Math.PI) % (2 * Math.PI)) / ((last.time - first.time) / 1000);
  expect(angularSpeed).toBeGreaterThan(.10); expect(angularSpeed).toBeLessThan(.25);
  expect(Math.hypot(...last.position.map((value, index) => value - first.position[index]))).toBeLessThan(.01);
});

test('真实鼠标环绕驱动主屏和文案，停止拖动后保留视角', async ({ page }) => {
  await openTheater(page);
  const box = await scene(page).boundingBox();
  const initialPosition = await jsonAttribute(scene(page), 'data-camera-position');
  await page.mouse.move(box.x + box.width * .65, box.y + box.height * .55);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .25, box.y + box.height * .55, { steps: 18 });
  await page.mouse.up();
  await expect(scene(page)).not.toHaveAttribute('data-active-screen', 'tanqing');
  await expect(scene(page)).toHaveAttribute('data-camera-state', 'idle');
  await sixFrames(page); // Direct orbit input stops with the pointer; there is no inertia or dwell.
  const id = await scene(page).getAttribute('data-active-screen');
  await expect(actionButton(page, id)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#theaterActionName')).toHaveText(actions.find(action => action.id === id).name);
  const finalPosition = await jsonAttribute(scene(page), 'data-camera-position');
  expect(Math.hypot(...finalPosition.map((value, index) => value - initialPosition[index]))).toBeGreaterThan(1);
  await sixFrames(page);
  const settled = await jsonAttribute(scene(page), 'data-camera-position');
  expect(Math.hypot(...settled.map((value, index) => value - finalPosition[index]))).toBeLessThan(.04);
  expect(await scene(page).getAttribute('data-active-screen')).toBe(id);
  await page.mouse.wheel(0, 8000);
  await expect.poll(async () => Number(await scene(page).getAttribute('data-camera-radius'))).toBeLessThanOrEqual(THEATER_ORBIT.radiusMax + .001);
  expect(Number(await scene(page).getAttribute('data-camera-radius'))).toBeGreaterThanOrEqual(THEATER_ORBIT.radiusMin - .001);
  const limited = await jsonAttribute(scene(page), 'data-camera-position');
  expect(limited[1]).toBeGreaterThanOrEqual(THEATER_ORBIT.heightMin - .001); expect(limited[1]).toBeLessThanOrEqual(THEATER_ORBIT.heightMax + .001);
  const offset = limited.map((value, index) => value - THEATER_ORBIT.target[index]);
  const polar = Math.acos(offset[1] / Math.hypot(...offset));
  expect(polar).toBeGreaterThanOrEqual(THEATER_ORBIT.polarMin - .001);
  expect(polar).toBeLessThanOrEqual(THEATER_ORBIT.polarMax + .001);
});

test('四动作切向独立16:9显示面，主辅亮度即时更新并保留各视频位置', async ({ page }) => {
  test.setTimeout(120_000);
  await openTheater(page);
  await actionVideo(page, 'tanqing').evaluate(video => { video.currentTime = 2; });
  for (const { id, name } of actions.slice(1)) {
    await selectAction(page, id);
    await expect(page.locator('#theaterActionName')).toHaveText(name);
    await expect.poll(async () => {
      const brightness = await jsonAttribute(scene(page), 'data-screen-brightness');
      return actions.every(action => Math.abs(brightness[action.id] - (action.id === id ? 1 : .25)) < .025);
    }).toBe(true);
  }
  await selectAction(page, 'tanqing');
  expect(await actionVideo(page, 'tanqing').evaluate(video => video.currentTime)).toBeGreaterThanOrEqual(1.9);
  await expect.poll(async () => (await jsonAttribute(scene(page), 'data-video-bindings'))?.tanqing?.bound).toBe(true);
});

test('网络场景失败可重载，恢复只生成一个有效WebGL画布', async ({ page }) => {
  let fail = true;
  await page.route(`**/${assetPaths.actionTheaterScene}`, route => fail ? route.abort('failed') : route.continue());
  await prepare(page);
  await page.goto('/#/action');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByRole('button', { name: '重新载入动作空间', exact: true })).toBeVisible();
  await expect(page.locator('#actionTheater')).toHaveAttribute('data-view', 'flat');
  await expect(actionVideo(page, 'tanqing')).toBeVisible();
  await expect.poll(() => actionVideo(page, 'tanqing').evaluate(video => !video.paused && video.currentTime > .1)).toBe(true);
  await expect.poll(() => stage(page).locator('video').evaluateAll(videos => videos.filter(video => !video.paused).length)).toBe(1);
  fail = false;
  await page.getByRole('button', { name: '重新载入动作空间', exact: true }).click();
  await expect(scene(page)).toHaveAttribute('data-active-screen', 'tanqing', { timeout: 45_000 });
  await expect(stage(page).locator('canvas')).toHaveCount(1);
  expect(await scene(page).evaluate(canvas => (canvas.getContext('webgl2') || canvas.getContext('webgl')).isContextLost())).toBe(false);
});
