import { test, expect } from '@playwright/test';
import { actions, scene, stage, openTheater } from './action-theater.helpers.js';
import { selectSettingsFor } from './settings-navigation.helpers.js';

test.setTimeout(180_000);
const panel = (page, kind, id = 'tanqing') => page.locator(`.theater-spatial-layer [data-spatial-panel="${kind}"][data-screen-id="${id}"]`);
const tau = Math.PI * 2;
const angularDistance = (a, b) => Math.abs(((a - b + Math.PI) % tau + tau) % tau - Math.PI);
const positionDistance = (a, b) => {
  const before = JSON.parse(a), after = JSON.parse(b);
  return Math.hypot(...after.map((value, axis) => value - before[axis]));
};

async function nextFrames(page, count = 2) {
  await page.evaluate(count => new Promise(resolve => {
    const next = () => --count <= 0 ? resolve() : requestAnimationFrame(next);
    requestAnimationFrame(next);
  }), count);
}

async function startSampling(page) {
  await page.evaluate(() => {
    const canvas = document.querySelector('#theaterSceneContainer canvas');
    const nodes = [...document.querySelectorAll('.theater-spatial-layer [data-spatial-panel]')];
    const frames = [];
    const sample = now => {
      if (!window.__spatialSampling) return;
      const data = canvas.dataset;
      frames.push({
        time: now, frame: Number(data.frameId), spatialFrame: Number(data.spatialFrameId),
        position: data.cameraPosition, azimuth: Number(data.cameraAzimuth), active: data.activeScreen,
        appActive: document.querySelector('#chapterStage')?.dataset.activeAction,
        heading: document.querySelector('#theaterActionName')?.textContent,
        pressed: document.querySelector('.theater-action-nav [aria-pressed="true"]')?.dataset.actionId,
        scores: JSON.parse(data.screenScores || '[]'),
        panels: nodes.map(node => ({
          kind: node.dataset.spatialPanel, id: node.dataset.screenId,
          transform: node.style.transform, frame: Number(node.dataset.spatialFrame), visible: node.dataset.visible,
        })),
      });
      window.__spatialSampleRaf = requestAnimationFrame(sample);
    };
    window.__spatialFrames = frames;
    window.__spatialSampling = true;
    window.__spatialSampleRaf = requestAnimationFrame(sample);
  });
}

async function stopSampling(page, testInfo, label) {
  const samples = await page.evaluate(() => {
    window.__spatialSampling = false;
    cancelAnimationFrame(window.__spatialSampleRaf);
    return window.__spatialFrames;
  });
  await testInfo.attach(label, { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
  return samples;
}

// OrbitControls maps horizontal movement to angle using the canvas height.
// Every motion below is a trusted browser mouse gesture, with capture retained
// until mouse.up; evaluating scene APIs would miss input/render ordering bugs.
async function dragDegrees(page, degrees, { steps = 12, release = true } = {}) {
  const bounds = await scene(page).boundingBox();
  const delta = degrees / 360 * bounds.height / .42;
  const startX = degrees >= 0 ? bounds.x + bounds.width * .88 : bounds.x + bounds.width * .12;
  const y = await scene(page).evaluate((canvas, { startX, bounds }) => {
    for (const fraction of [.48, .40, .33, .57, .65, .25]) {
      const candidate = bounds.y + bounds.height * fraction;
      if (document.elementFromPoint(startX, candidate) === canvas) return candidate;
    }
    throw new Error('No uncovered canvas point available for an actual camera drag');
  }, { startX, bounds });
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX - delta, y, { steps });
  if (release) await page.mouse.up();
  return { x: startX - delta, y };
}

function assertFrameSynchronization(samples) {
  const frames = samples.filter(sample => sample.frame > 0);
  expect(frames.length).toBeGreaterThan(4);
  const failures = [];
  for (const sample of frames) {
    if (sample.spatialFrame !== sample.frame || sample.appActive !== sample.active || sample.pressed !== sample.active
      || sample.heading !== actions.find(action => action.id === sample.active)?.name) failures.push({ frame: sample.frame, spatialFrame: sample.spatialFrame, active: sample.active, appActive: sample.appActive, pressed: sample.pressed, heading: sample.heading });
    for (const current of sample.panels) {
      if (current.frame !== sample.frame || !/matrix3d\(/.test(current.transform)) failures.push({ frame: sample.frame, panel: current });
    }
  }
  let movingFrames = 0;
  for (let index = 1; index < frames.length; index += 1) {
    const before = frames[index - 1], current = frames[index];
    if (positionDistance(before.position, current.position) < 1e-7) continue;
    movingFrames += 1;
    // Fading/occluded planes may be visually absent between walls. Their
    // interaction projection still follows this camera, ready for re-entry.
    for (const item of current.panels) {
      const previous = before.panels.find(candidate => candidate.kind === item.kind && candidate.id === item.id);
      if (item.transform === previous.transform) failures.push({ frame: current.frame, cameraMoved: true, panel: item });
    }
  }
  expect(failures.slice(0, 20), 'every sampled frame synchronizes camera, world projections and discrete selection').toEqual([]);
  expect(movingFrames).toBeGreaterThan(2);
}

test('真实快速左拖90度第一帧同步透视与当前内容，继续旋转180度世界面板自然出入视野', async ({ page }, testInfo) => {
  await openTheater(page);
  await expect(panel(page, 'title')).toBeVisible();
  await expect(panel(page, 'screen', 'tanqing')).toBeVisible();
  await page.screenshot({ path: 'tmp/action-spatial-ui-initial-1920.png' });
  const fixedTitlePosition = await panel(page, 'title').getAttribute('data-world-position');
  const initial = Number(await scene(page).getAttribute('data-camera-azimuth'));
  await startSampling(page);
  await dragDegrees(page, 90, { steps: 16 });
  await nextFrames(page, 3);
  const quarter = Number(await scene(page).getAttribute('data-camera-azimuth'));
  expect(angularDistance(initial, quarter)).toBeGreaterThan(1.4);
  expect(angularDistance(initial, quarter)).toBeLessThan(1.75);
  await expect(scene(page)).not.toHaveAttribute('data-active-screen', 'tanqing');
  // The title has its own fixed inward yaw, so a quarter turn may still see
  // its front face. Its world anchor must stay fixed throughout the orbit.
  await expect(panel(page, 'title')).toHaveAttribute('data-world-position', fixedTitlePosition);
  await dragDegrees(page, 180, { steps: 24 });
  await nextFrames(page, 3);
  const half = Number(await scene(page).getAttribute('data-camera-azimuth'));
  expect(angularDistance(quarter, half)).toBeGreaterThan(2.95);
  await expect(panel(page, 'title')).toHaveAttribute('data-world-position', fixedTitlePosition);
  await expect(panel(page, 'title')).toBeHidden();
  const samples = await stopSampling(page, testInfo, 'actual-mouse-90-and-180-degree-frames');
  assertFrameSynchronization(samples);
  expect(new Set(samples.map(sample => sample.active)).size).toBeGreaterThanOrEqual(3);
  for (const id of actions.map(action => action.id)) {
    const screenSamples = samples.flatMap(sample => sample.panels.filter(item => item.kind === 'screen' && item.id === id));
    expect(screenSamples.some(item => item.visible === 'true')).toBe(true);
    expect(screenSamples.some(item => item.visible === 'false')).toBe(true);
  }
  const stopped = await scene(page).getAttribute('data-camera-position');
  await nextFrames(page, 6);
  expect(positionDistance(await scene(page).getAttribute('data-camera-position'), stopped)).toBeLessThan(1e-7);
});

test('真实边界往返使用角度迟滞，快速反向即时切换且没有过时队列', async ({ page }, testInfo) => {
  await openTheater(page);
  await startSampling(page);
  const cursor = await dragDegrees(page, 45, { steps: 12, release: false });
  const height = (await scene(page).boundingBox()).height;
  const smallMotion = height / .42 * 2 / 360;
  await nextFrames(page, 2);
  const boundaryActive = await scene(page).getAttribute('data-active-screen');
  for (let index = 0; index < 8; index += 1) {
    await page.mouse.move(cursor.x + (index % 2 ? smallMotion : -smallMotion), cursor.y, { steps: 2 });
    await nextFrames(page, 1);
    expect(await scene(page).getAttribute('data-active-screen')).toBe(boundaryActive);
  }
  await page.mouse.move(cursor.x - height / .42 * 45 / 360, cursor.y, { steps: 7 });
  await nextFrames(page, 1);
  await expect(scene(page)).not.toHaveAttribute('data-active-screen', boundaryActive);
  await page.mouse.move(cursor.x + height / .42 * 45 / 360, cursor.y, { steps: 7 });
  await nextFrames(page, 1);
  await expect(scene(page)).toHaveAttribute('data-active-screen', 'tanqing');
  await page.mouse.up();
  await nextFrames(page, 4);
  const samples = await stopSampling(page, testInfo, 'actual-boundary-hysteresis-frames');
  assertFrameSynchronization(samples);
  const changed = samples.filter((sample, index) => index > 0 && sample.active !== samples[index - 1].active);
  expect(changed.length).toBeGreaterThanOrEqual(2);
  for (const sample of changed) {
    const previous = samples[samples.indexOf(sample) - 1];
    const from = sample.scores.find(score => score.id === previous.active);
    const to = sample.scores.find(score => score.id === sample.active);
    expect(to?.visible).toBe(true);
    expect(to?.frontFacing).toBe(true);
    if (from?.visible && from.frontFacing) expect((from.angle - to.angle) * 180 / Math.PI).toBeGreaterThanOrEqual(7 - .001);
  }
});

test('空间按钮实际透视命中不误拖相机，醒狮自转不触发观察切换', async ({ page }) => {
  await openTheater(page);
  const screenPanel = panel(page, 'screen');
  await expect(screenPanel).toHaveAttribute('data-interactive', 'true');
  const button = screenPanel.locator('button').first();
  await expect(button).toBeVisible();
  const before = await scene(page).getAttribute('data-camera-position');
  const bounds = await button.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 8, bounds.y + bounds.height / 2 + 3, { steps: 3 });
  await page.mouse.up();
  await nextFrames(page, 4);
  expect(positionDistance(await scene(page).getAttribute('data-camera-position'), before)).toBeLessThan(1e-7);
  await expect(scene(page)).toHaveAttribute('data-camera-state', 'idle');
  const firstRotation = Number(await scene(page).getAttribute('data-lion-rotation'));
  await expect.poll(async () => angularDistance(Number(await scene(page).getAttribute('data-lion-rotation')), firstRotation)).toBeGreaterThan(.15);
  expect(positionDistance(await scene(page).getAttribute('data-camera-position'), before)).toBeLessThan(1e-7);
  await expect(scene(page)).toHaveAttribute('data-active-screen', 'tanqing');
  const autoRotate = page.getByRole('button', { name: '醒狮自动旋转', exact: true });
  await autoRotate.click();
  await expect(autoRotate).toHaveAttribute('aria-pressed', 'false');
  await expect(scene(page)).toHaveAttribute('data-auto-rotating', 'false');
  // The model stops in the rendering frame, while heavy lion diagnostics
  // publish separately. Qualify two actual diagnostic snapshots after pause;
  // a fixed frame count would read stale data on high-refresh displays.
  const pausedFrame = Number(await scene(page).getAttribute('data-frame-id'));
  await expect.poll(async () => Number(await scene(page).getAttribute('data-rendered-frames'))).toBeGreaterThan(pausedFrame);
  const paused = await scene(page).evaluate(node => ({ rotation: node.dataset.lionRotation, diagnosticFrame: Number(node.dataset.renderedFrames) }));
  await expect.poll(async () => Number(await scene(page).getAttribute('data-rendered-frames'))).toBeGreaterThan(paused.diagnosticFrame);
  expect(await scene(page).getAttribute('data-lion-rotation')).toBe(paused.rotation);
  expect(positionDistance(await scene(page).getAttribute('data-camera-position'), before)).toBeLessThan(1e-7);
});

test('视频play迟到不阻塞快速观察反馈，离页释放空间面板与回调后重入只有一套', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const actual = HTMLMediaElement.prototype.play;
    window.__releaseSpatialPlay = [];
    HTMLMediaElement.prototype.play = function () {
      const result = actual.call(this);
      if (!this.dataset.actionId) return result;
      return Promise.resolve(result).then(() => new Promise(resolve => window.__releaseSpatialPlay.push(resolve)));
    };
  });
  await openTheater(page);
  await expect.poll(() => page.evaluate(() => window.__releaseSpatialPlay.length)).toBeGreaterThan(0);
  await startSampling(page);
  await dragDegrees(page, 90, { steps: 10 });
  await nextFrames(page, 2);
  const selected = await scene(page).getAttribute('data-active-screen');
  expect(selected).not.toBe('tanqing');
  await expect(page.locator('#theaterActionName')).toHaveText(actions.find(action => action.id === selected).name);
  await page.evaluate(() => window.__releaseSpatialPlay.splice(0).forEach(resolve => resolve()));
  await nextFrames(page, 3);
  await expect(scene(page)).toHaveAttribute('data-active-screen', selected);
  assertFrameSynchronization(await stopSampling(page, testInfo, 'late-play-immediate-observation-frames'));
  const retained = await page.locator('.theater-spatial-layer').elementHandle();
  const retainedCanvas = await scene(page).elementHandle();
  await page.locator('.site-header [data-route="state"]').click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  expect(await retained.evaluate(node => node.isConnected)).toBe(false);
  expect(await retainedCanvas.evaluate(node => node.isConnected)).toBe(false);
  await expect.poll(() => retainedCanvas.evaluate(node => (node.getContext('webgl2') || node.getContext('webgl')).isContextLost())).toBe(true);
  await page.locator('.site-header [data-route="action"]').click();
  await expect(scene(page)).toHaveAttribute('data-active-screen', 'tanqing', { timeout: 60_000 });
  await expect(stage(page).locator('canvas')).toHaveCount(1);
  await expect(page.locator('.theater-spatial-layer')).toHaveCount(1);
  await expect(stage(page).locator('video')).toHaveCount(4);
});

test('电脑三种画幅与真实900像素设置推开完整显示世界牌，解说避开模式栏且控件命中准确', async ({ page }, testInfo) => {
  await openTheater(page, { settings: { panelWidth: 760, pushPage: true } });
  const layouts = [];
  const readLayout = () => page.evaluate(() => {
    const canvas = document.querySelector('#theaterSceneContainer canvas');
    const title = document.querySelector('[data-spatial-panel="title"]');
    const caption = document.querySelector('[data-spatial-panel="caption"][data-active="true"]');
    const mode = document.querySelector('.theater-mode-panel');
    const rect = node => {
      const { left, top, right, bottom, width, height } = node.getBoundingClientRect();
      return { left, top, right, bottom, width, height };
    };
    const frame = rect(canvas), titleRect = rect(title), captionRect = rect(caption), modeRect = rect(mode);
    const inside = box => box.left >= frame.left - 2 && box.right <= frame.right + 2
      && box.top >= frame.top - 2 && box.bottom <= frame.bottom + 2;
    const clear = captionRect.right <= modeRect.left || captionRect.left >= modeRect.right
      || captionRect.bottom <= modeRect.top || captionRect.top >= modeRect.bottom;
    return {
      canvas: frame, title: titleRect, caption: captionRect, mode: modeRect,
      titleVisible: title.dataset.visible === 'true', captionVisible: caption.dataset.visible === 'true',
      titleInside: inside(titleRect), captionInside: inside(captionRect), captionClearOfMode: clear,
      sameFrame: title.dataset.spatialFrame === canvas.dataset.frameId && caption.dataset.spatialFrame === canvas.dataset.frameId,
    };
  });
  const checkLayout = async label => {
    await nextFrames(page, 3);
    await expect.poll(readLayout, { message: `${label}: initial world plaques must remain complete and avoid the mode panel` }).toMatchObject({
      titleVisible: true, captionVisible: true, titleInside: true, captionInside: true, captionClearOfMode: true, sameFrame: true,
    });
    layouts.push({ label, ...await readLayout() });
  };
  for (const [width, height] of [[1920, 1080], [1366, 768], [900, 900]]) {
    await page.setViewportSize({ width, height });
    await checkLayout(`${width}x${height}`);
  }
  await page.setViewportSize({ width: 1675, height: 1000 });
  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
  await selectSettingsFor(page, 'panelWidth');
  await expect(page.getByRole('checkbox', { name: '设置面板推开页面', exact: true })).toBeChecked();
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await expect.poll(() => page.getByRole('region', { name: '开发者参数设置', exact: true }).evaluate(node => node.getBoundingClientRect().width)).toBeCloseTo(760, 0);
  await expect.poll(() => page.locator('.site-page').evaluate(node => node.getBoundingClientRect().width)).toBeCloseTo(900, 0);
  await checkLayout('1675x1000, 760px settings, 900px pushed page');
  const hitAreas = await page.evaluate(() => [...document.querySelectorAll([
    '.theater-mode-panel button', '.theater-action-nav button', '.theater-compass button',
    '#theaterControls button', '#theaterControls input', '.theater-view-tools button',
    '[data-spatial-panel="screen"][data-screen-id="tanqing"] button',
  ].join(','))].filter(node => !node.disabled).map(node => {
    const bounds = node.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2, y = bounds.top + bounds.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { label: node.getAttribute('aria-label'), x, y, hit: hit === node || node.contains(hit), target: hit?.tagName };
  }));
  expect(hitAreas.length).toBeGreaterThanOrEqual(13);
  expect(hitAreas.filter(control => !control.hit)).toEqual([]);
  await page.getByRole('button', { name: '观看探青采青', exact: true }).click();
  await expect(scene(page)).toHaveAttribute('data-active-screen', 'tanqing');
  const autoRotate = page.getByRole('button', { name: '醒狮自动旋转', exact: true });
  await autoRotate.click();
  await expect(autoRotate).toHaveAttribute('aria-pressed', 'false');
  await expect(scene(page)).toHaveAttribute('data-auto-rotating', 'false');
  await testInfo.attach('actual-desktop-world-panel-bounds-and-hit-areas', {
    body: JSON.stringify({ layouts, hitAreas }, null, 2), contentType: 'application/json',
  });
});
