import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { PerspectiveCamera, Vector3 } from 'three';
import {
  actions, stage, scene, actionButton, actionVideo, openTheater, selectAction, jsonAttribute,
} from './action-theater.helpers.js';

const intro = page => page.locator('.theater-intro-plane');
const info = (page, id) => page.locator(`.theater-info-plane[data-info-screen="${id}"]`);
const guide = page => jsonAttribute(scene(page), 'data-floor-guide');
const spatial = page => jsonAttribute(scene(page), 'data-spatial-ui');
const distance = (left, right) => Math.hypot(...left.map((value, index) => value - right[index]));
const waitForInfo = async (page, id) => {
  await expect(info(page, id)).toHaveAttribute('data-spatial-visible', 'true');
  await expect.poll(async () => Number(await info(page, id).getAttribute('data-opacity'))).toBeGreaterThan(.95);
  await expect(info(page, id)).toBeVisible();
};
const cameraPose = async page => ({
  position: await jsonAttribute(scene(page), 'data-camera-position'),
  target: await jsonAttribute(scene(page), 'data-camera-target'),
});
const assertSamePose = (before, after) => {
  expect(distance(before.position, after.position)).toBeLessThan(.001);
  expect(distance(before.target, after.target)).toBeLessThan(.001);
};
const radians = degrees => degrees * Math.PI / 180;
const angleDifference = (left, right) => Math.atan2(Math.sin(left - right), Math.cos(left - right));

async function dragToAzimuth(page, degrees) {
  const box = await scene(page).boundingBox();
  const current = Number(await scene(page).getAttribute('data-camera-azimuth'));
  const desired = radians(degrees);
  // OrbitControls' authored rotateSpeed is .42. Its horizontal orbit uses
  // element height, and dragging left increases this camera's azimuth.
  const dx = -angleDifference(desired, current) * box.height / (2 * Math.PI * .42);
  const startX = box.x + box.width * .5;
  const y = box.y + box.height * .6;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + dx, y, { steps: 12 });
  await page.mouse.up();
  await expect(scene(page)).toHaveAttribute('data-camera-state', 'idle');
  await expect.poll(async () => Math.abs(angleDifference(Number(await scene(page).getAttribute('data-camera-azimuth')), desired)), { timeout: 10_000 }).toBeLessThan(radians(.6));
  await page.waitForTimeout(1100); // Let residual inertia and the 500ms observation gate settle.
  return Number(await scene(page).getAttribute('data-camera-azimuth'));
}

test('空间牌匾随四向相机投影，地面引导空闲收起且可恢复，360度回看不重建视频', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openTheater(page);
  await expect(intro(page)).toHaveAttribute('data-spatial-visible', 'true');
  await expect(intro(page)).toBeVisible();
  await waitForInfo(page, 'tanqing');
  await expect(page.locator('.site-header [data-route="action"]')).toBeVisible();
  await expect.poll(async () => (await guide(page))?.mode).toBe('expanded');
  const anchors = (await spatial(page)).map(({ id, kind, position }) => ({ id, kind, position }));
  expect(anchors).toHaveLength(9);
  const initialIntroTransform = await intro(page).evaluate(element => element.style.transform);
  expect(initialIntroTransform).toContain('matrix3d(');
  const initialIntroBox = await intro(page).boundingBox();
  await expect.poll(async () => (await guide(page))?.mode, { timeout: 9000 }).toBe('quiet');
  await page.getByRole('button', { name: '显示空间操作引导' }).hover();
  await expect.poll(async () => (await guide(page))?.opacity).toBeGreaterThan(.9);
  const floor = await guide(page);
  expect(floor.floorY).toBeGreaterThan(0);
  expect(floor.radius).toBeGreaterThan(4.7);
  const canvasBounds = await scene(page).boundingBox();
  const composition = await jsonAttribute(scene(page), 'data-composition');
  const pose = await cameraPose(page);
  const camera = new PerspectiveCamera(composition.quality.fov, canvasBounds.width / canvasBounds.height, .12, 45);
  camera.position.fromArray(pose.position); camera.lookAt(new Vector3(...pose.target)); camera.updateMatrixWorld();
  const compassPoint = new Vector3(...floor.panels.find(panel => panel.kind === 'compass').position).project(camera);
  const compass = { x: canvasBounds.x + (compassPoint.x + 1) * canvasBounds.width / 2,
    y: canvasBounds.y + (1 - compassPoint.y) * canvasBounds.height / 2 };
  const controls = await page.locator('.theater-bottom').boundingBox();
  expect(compass.x + 50 < controls.x || compass.x - 50 > controls.x + controls.width
    || compass.y + 25 < controls.y || compass.y - 25 > controls.y + controls.height).toBe(true);

  // Freeze playback through the real shared control. Selecting screens must
  // retain every original node and paused timestamp, not rebuild decoders.
  await page.getByRole('button', { name: '暂停动作视频', exact: true }).click();
  await expect.poll(() => stage(page).locator('video').evaluateAll(videos => videos.every(video => video.paused))).toBe(true);
  const videos = await stage(page).locator('video[data-action-id]').elementHandles();
  for (const video of videos) await video.evaluate(element => { element.currentTime = Math.min(2, element.duration / 3); });
  const times = await Promise.all(videos.map(video => video.evaluate(element => element.currentTime)));
  const reviewNames = ['front', 'right', 'back', 'left'];
  const directionEvidence = [];
  for (const [index, { id, name }] of actions.entries()) {
    await actionButton(page, id).click();
    await expect(page.locator('#actionTheater')).toHaveAttribute('data-active-action', id, { timeout: 1000 });
    await expect.poll(async () => (await jsonAttribute(scene(page), 'data-screen-detection'))?.manualLock).toBe(true);
    await expect(scene(page)).toHaveAttribute('data-camera-state', 'idle');
    await waitForInfo(page, id);
    await expect(page.locator('#theaterActionName')).toHaveText(name);
    await expect.poll(async () => (await spatial(page)).filter(record => record.kind === 'info' && record.visible).map(record => record.id)).toEqual([id]);
    const states = await spatial(page);
    expect(states.map(({ id, kind, position }) => ({ id, kind, position }))).toEqual(anchors);
    if (index > 0) await expect(intro(page)).toHaveAttribute('data-spatial-visible', 'false');
    await page.getByRole('button', { name: '显示空间操作引导' }).click();
    await expect.poll(async () => {
      const floor = await guide(page);
      const azimuth = Number(await scene(page).getAttribute('data-camera-azimuth'));
      return !floor.aligning && Math.abs(Math.atan2(Math.sin(floor.azimuth - azimuth), Math.cos(floor.azimuth - azimuth))) < .04;
    }).toBe(true);
    await expect.poll(async () => (await guide(page))?.opacity).toBeGreaterThan(.95);
    const screenshot = await page.screenshot();
    if (process.env.ACTION_SPATIAL_REVIEW_DIR) {
      const directory = path.resolve(process.env.ACTION_SPATIAL_REVIEW_DIR);
      await mkdir(directory, { recursive: true });
      await page.screenshot({ path: path.join(directory, `${reviewNames[index]}.png`) });
    }
    await testInfo.attach(`${reviewNames[index]}-spatial-ui`, { body: screenshot, contentType: 'image/png' });
    directionEvidence.push({ id, camera: await cameraPose(page), planes: states, floor: await guide(page) });
  }
  await selectAction(page, 'tanqing');
  await waitForInfo(page, 'tanqing');
  await expect(intro(page)).toHaveAttribute('data-spatial-visible', 'true');
  const returnedIntroBox = await intro(page).boundingBox();
  for (const key of ['x', 'y', 'width', 'height']) expect(Math.abs(returnedIntroBox[key] - initialIntroBox[key])).toBeLessThan(.5);
  for (const [index, video] of videos.entries()) {
    expect(await video.evaluate((element, id) => element.isConnected && element === document.querySelector(`video[data-action-id="${id}"]`), actions[index].id)).toBe(true);
    expect(await video.evaluate(element => element.currentTime)).toBeCloseTo(times[index], 2);
  }
  expect(errors).toEqual([]);
  await testInfo.attach('spatial-four-directions', { body: JSON.stringify(directionEvidence, null, 2), contentType: 'application/json' });
});

test('真实鼠标按住拖动不切屏，松开稳定500毫秒后才关联新巨幕，静置不反复变化', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await openTheater(page);
  const box = await scene(page).boundingBox();
  await page.evaluate(() => {
    const canvas = document.querySelector('#chapterStage canvas');
    window.spatialSelectionTimeline = { releasedAt: null, changes: [] };
    const observer = new MutationObserver(() => {
      const timeline = window.spatialSelectionTimeline;
      const id = canvas.dataset.activeScreen;
      if (timeline.changes.at(-1)?.id !== id) timeline.changes.push({ id, at: performance.now() });
    });
    observer.observe(canvas, { attributes: true, attributeFilter: ['data-active-screen'] });
    document.addEventListener('pointerup', () => { window.spatialSelectionTimeline.releasedAt = performance.now(); }, { once: true, capture: true });
  });
  const initialPosition = await jsonAttribute(scene(page), 'data-camera-position');
  await page.mouse.move(box.x + box.width * .65, box.y + box.height * .55);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .25, box.y + box.height * .55, { steps: 18 });
  await expect(scene(page)).toHaveAttribute('data-camera-state', 'dragging');
  await page.waitForTimeout(900); // A held pointer must suppress even a stable new candidate.
  await expect(scene(page)).toHaveAttribute('data-active-screen', 'tanqing');
  expect(distance(initialPosition, await jsonAttribute(scene(page), 'data-camera-position'))).toBeGreaterThan(1);
  await page.mouse.up();
  await expect(scene(page)).not.toHaveAttribute('data-active-screen', 'tanqing');
  const id = await scene(page).getAttribute('data-active-screen');
  await waitForInfo(page, id);
  const detection = await jsonAttribute(scene(page), 'data-screen-detection');
  expect(detection.manualLock).toBe(false);
  expect(detection.metrics.find(metric => metric.id === id).visible).toBe(true);
  await page.waitForTimeout(1500); // Cover several independent idle observation windows.
  await expect(scene(page)).toHaveAttribute('data-active-screen', id);
  await expect(page.locator('#theaterActionName')).toHaveText(actions.find(action => action.id === id).name);
  const timeline = await page.evaluate(() => window.spatialSelectionTimeline);
  const selectionsAfterRelease = timeline.changes.filter(change => change.id !== 'tanqing');
  expect(selectionsAfterRelease).toHaveLength(1);
  expect(selectionsAfterRelease[0].at - timeline.releasedAt).toBeGreaterThanOrEqual(480);
  await testInfo.attach('real-drag-selection-timeline', { body: JSON.stringify({ timeline, detection }, null, 2), contentType: 'application/json' });
});

test('空间播放按钮、信息牌、进度拖动和面板滚轮隔离相机，场景缩放及醒狮自转独立工作', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openTheater(page);
  await waitForInfo(page, 'tanqing');
  const original = await cameraPose(page);
  await info(page, 'tanqing').locator('h2').click();
  await info(page, 'tanqing').hover();
  await page.mouse.wheel(0, 600);
  await expect(scene(page)).toHaveAttribute('data-camera-state', 'idle');
  assertSamePose(original, await cameraPose(page));

  await page.getByRole('button', { name: '暂停探青采青巨幕', exact: true }).click();
  await expect.poll(() => actionVideo(page, 'tanqing').evaluate(video => video.paused)).toBe(true);
  assertSamePose(original, await cameraPose(page));
  await page.getByRole('button', { name: '播放探青采青巨幕', exact: true }).click();
  await expect.poll(() => actionVideo(page, 'tanqing').evaluate(video => !video.paused)).toBe(true);
  assertSamePose(original, await cameraPose(page));
  await page.getByRole('button', { name: '暂停动作视频', exact: true }).click();
  const seek = page.getByRole('slider', { name: '当前动作播放进度' });
  await expect(seek).toBeEnabled();
  const seekBox = await seek.boundingBox();
  await page.mouse.move(seekBox.x + seekBox.width * .2, seekBox.y + seekBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(seekBox.x + seekBox.width * .65, seekBox.y + seekBox.height / 2, { steps: 8 });
  await page.mouse.up();
  const duration = await actionVideo(page, 'tanqing').evaluate(video => video.duration);
  await expect.poll(() => actionVideo(page, 'tanqing').evaluate(video => video.currentTime)).toBeGreaterThan(duration * .5);
  assertSamePose(original, await cameraPose(page));
  await seek.hover();
  await page.mouse.wheel(0, 600);
  assertSamePose(original, await cameraPose(page));

  const playPlane = page.locator('.theater-play-plane[data-play-screen="tanqing"]');
  await expect(playPlane).toHaveAttribute('data-spatial-visible', 'true');
  await page.getByRole('button', { name: '选择探青采青巨幕播放', exact: true }).click();
  await expect.poll(() => actionVideo(page, 'tanqing').evaluate(video => !video.paused)).toBe(true);
  assertSamePose(original, await cameraPose(page));
  await expect.poll(async () => (await jsonAttribute(scene(page), 'data-screen-detection'))?.manualLock).toBe(true);

  const rotation = Number(await scene(page).getAttribute('data-lion-rotation'));
  await expect.poll(async () => (Number(await scene(page).getAttribute('data-lion-rotation')) - rotation + 2 * Math.PI) % (2 * Math.PI)).toBeGreaterThan(.15);
  await expect(scene(page)).toHaveAttribute('data-active-screen', 'tanqing');
  await expect.poll(async () => (await jsonAttribute(scene(page), 'data-screen-detection'))?.manualLock).toBe(true);
  await page.getByRole('button', { name: '醒狮自转 · 开', exact: true }).click();
  await expect(scene(page)).toHaveAttribute('data-lion-rotating', 'false');
  const stoppedRotation = Number(await scene(page).getAttribute('data-lion-rotation'));
  await page.waitForTimeout(400);
  expect(Number(await scene(page).getAttribute('data-lion-rotation'))).toBeCloseTo(stoppedRotation, 3);
  assertSamePose(original, await cameraPose(page));

  const box = await scene(page).boundingBox();
  const radius = Number(await scene(page).getAttribute('data-camera-radius'));
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .55);
  await page.mouse.wheel(0, -500);
  await expect.poll(async () => Number(await scene(page).getAttribute('data-camera-radius'))).toBeLessThan(radius - .1);
  await waitForInfo(page, 'tanqing');
  expect((await spatial(page)).find(record => record.kind === 'info' && record.id === 'tanqing').occluded).toBe(false);
  // Flat fallback retains one accessible title and reuses the same media.
  await page.getByRole('button', { name: '平面观看', exact: true }).click();
  await expect(page.locator('#theaterActionName')).toHaveCount(1);
  await expect(page.locator('#theaterActionName')).toBeVisible();
  await page.getByRole('button', { name: '返回巨幕', exact: true }).click();
  await expect(page.locator('#theaterActionName')).toHaveCount(1);
  await waitForInfo(page, 'tanqing');
  expect(errors).toEqual([]);
});

test('真实鼠标在两巨幕43至47度交界往返保持主屏，明确转至90度才自动切换', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await openTheater(page);
  await page.evaluate(() => {
    const canvas = document.querySelector('#chapterStage canvas');
    window.spatialBoundaryTimeline = [{ id: canvas.dataset.activeScreen, at: performance.now() }];
    new MutationObserver(() => {
      const records = window.spatialBoundaryTimeline;
      const id = canvas.dataset.activeScreen;
      if (records.at(-1)?.id !== id) records.push({ id, at: performance.now() });
    }).observe(canvas, { attributes: true, attributeFilter: ['data-active-screen'] });
  });
  const samples = [];
  for (const degrees of [43, 47, 44, 46]) {
    const actual = await dragToAzimuth(page, degrees);
    expect(Math.abs(angleDifference(actual, radians(degrees)))).toBeLessThan(radians(.6));
    await expect(scene(page)).toHaveAttribute('data-active-screen', 'tanqing');
    const detection = await jsonAttribute(scene(page), 'data-screen-detection');
    expect(detection.manualLock).toBe(false);
    expect(detection.pendingId).toBe(null);
    samples.push({ targetDegrees: degrees, actualDegrees: actual * 180 / Math.PI, detection });
  }
  expect(await page.evaluate(() => window.spatialBoundaryTimeline.map(record => record.id))).toEqual(['tanqing']);
  await dragToAzimuth(page, 90);
  await expect(scene(page)).toHaveAttribute('data-active-screen', 'meihuazhuang');
  await waitForInfo(page, 'meihuazhuang');
  const timeline = await page.evaluate(() => window.spatialBoundaryTimeline);
  expect(timeline.map(record => record.id)).toEqual(['tanqing', 'meihuazhuang']);
  await testInfo.attach('real-mouse-boundary-hysteresis', {
    body: JSON.stringify({ samples, deliberateTurn: await jsonAttribute(scene(page), 'data-screen-detection'), timeline }, null, 2),
    contentType: 'application/json',
  });
});
