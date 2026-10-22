import { expect, test } from '@playwright/test';
import { assetPaths } from '../../src/config/assetPaths.js';
import { hdriDefaults } from '../../src/config/hdri.js';
import { settingsPanel, selectSettingsPage } from './settings-navigation.helpers.js';

const storageKey = 'nanfeng-lion:developer-settings:v1';
const modelCanvas = page => page.locator('#sceneContainer canvas');
const theaterCanvas = page => page.locator('#chapterStage canvas');
const labels = {
  hdriIntensity: 'HDRI强度', hdriRotation: 'HDRI水平旋转',
  hdriExposure: 'HDRI曝光补偿', hdriLightIntensity: '辅助灯光强度',
};

test.use({ viewport: { width: 1920, height: 1080 } });
test.setTimeout(150_000);

async function prepare(page, settings = {}) {
  // Seed once per browser session. A subsequent reload must read what the user
  // actually saved, rather than having an init script overwrite the evidence.
  await page.addInitScript(({ settings, storageKey }) => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    if (!sessionStorage.getItem('lion:hdri-e2e:seeded')) {
      localStorage.setItem(storageKey, JSON.stringify({ carouselAutoplay: false, pushPage: false, ...settings }));
      sessionStorage.setItem('lion:hdri-e2e:seeded', '1');
    }
  }, { settings, storageKey });
}

async function waitStartup(page) {
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 65_000 });
}

async function openSettings(page) {
  if (!await settingsPanel(page).isVisible()) await page.locator('.site-navigation [data-action="settings"]').click();
  await expect(settingsPanel(page)).toBeVisible();
  await selectSettingsPage(page, 'HDRI');
}

async function edit(page, name, value) {
  const input = settingsPanel(page).getByRole('spinbutton', { name: `${labels[name]}数值`, exact: true });
  await input.fill(String(value));
  await input.press('Tab');
  await expect(input).toHaveValue(String(value));
}

async function applied(canvas) {
  return JSON.parse(await canvas.getAttribute('data-hdri-settings') || 'null');
}

async function expectApplied(canvas, values) {
  await expect.poll(() => applied(canvas), { timeout: 30_000 }).toMatchObject(values);
}

async function expectCompleteHair(canvas) {
  await expect(canvas).toHaveAttribute('data-full-hair-drawn-groups', '33');
  await expect(canvas).toHaveAttribute('data-full-hair-drawn-strands', '2295421');
  await expect(canvas).toHaveAttribute('data-full-hair-drawn-points', '19957105');
}

async function renderedPixels(page, canvas, bounds, { clockPaused = false } = {}) {
  if (clockPaused) await page.clock.runFor(48);
  else await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const clip = await canvas.boundingBox();
  expect(clip).not.toBeNull();
  // The compositor is authoritative: WebGL need not preserve its drawing
  // buffer. Do not replace any material, hide hair, or introduce test geometry.
  const png = await page.screenshot({ clip, animations: 'disabled' });
  const sample = await page.evaluate(async ({ url, bounds }) => {
    const image = new Image(); image.src = url; await image.decode();
    const sample = document.createElement('canvas');
    sample.width = image.width; sample.height = image.height;
    const context = sample.getContext('2d'); context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, sample.width, sample.height).data;
    const pixels = [];
    for (let y = Math.floor(sample.height * bounds.top); y < sample.height * bounds.bottom; y += 3) {
      for (let x = Math.floor(sample.width * bounds.left); x < sample.width * bounds.right; x += 3) {
        const index = (y * sample.width + x) * 4;
        pixels.push(data[index], data[index + 1], data[index + 2]);
      }
    }
    return { width: sample.width, height: sample.height, pixels };
  }, { url: `data:image/png;base64,${png.toString('base64')}`, bounds });
  return { ...sample, png };
}

function difference(first, second) {
  expect([second.width, second.height, second.pixels.length]).toEqual([first.width, first.height, first.pixels.length]);
  let absolute = 0, changed = 0, firstLight = 0, secondLight = 0;
  for (let index = 0; index < first.pixels.length; index += 3) {
    let delta = 0;
    for (let channel = 0; channel < 3; channel++) {
      delta += Math.abs(second.pixels[index + channel] - first.pixels[index + channel]);
      firstLight += first.pixels[index + channel]; secondLight += second.pixels[index + channel];
    }
    absolute += delta;
    if (delta > 24) changed++;
  }
  return {
    meanAbsolute: absolute / first.pixels.length,
    changedFraction: changed / (first.pixels.length / 3),
    lightIncrease: (secondLight - firstLight) / first.pixels.length,
  };
}

test('HDRI独立设置页补齐旧偏好，显式保存并只重置HDRI参数', async ({ page }) => {
  await prepare(page, { panelWidth: 372, headerTransparency: 37 });
  await page.goto('/#/state'); await waitStartup(page); await openSettings(page);
  const ranges = {
    hdriIntensity: ['0', '3', '0.05'], hdriRotation: ['-180', '180', '1'],
    hdriExposure: ['-2', '2', '0.1'], hdriLightIntensity: ['0', '2', '0.05'],
  };
  for (const [name, [min, max, step]] of Object.entries(ranges)) {
    const input = settingsPanel(page).getByRole('spinbutton', { name: `${labels[name]}数值`, exact: true });
    await expect(input).toHaveValue(String(hdriDefaults[name]));
    await expect(input).toHaveAttribute('min', min); await expect(input).toHaveAttribute('max', max); await expect(input).toHaveAttribute('step', step);
  }
  const toggle = settingsPanel(page).getByRole('checkbox', { name: 'HDRI环境照明', exact: true });
  await expect(toggle).toBeChecked();
  const chosen = { hdriEnabled: false, hdriIntensity: 1.65, hdriRotation: -83, hdriExposure: 0.7, hdriLightIntensity: 0.45 };
  await toggle.uncheck();
  for (const name of Object.keys(labels)) await edit(page, name, chosen[name]);
  await settingsPanel(page).getByRole('button', { name: '保存设置', exact: true }).click();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey)).toMatchObject(chosen);
  await page.reload(); await waitStartup(page); await openSettings(page);
  await expect(settingsPanel(page).getByRole('checkbox', { name: 'HDRI环境照明', exact: true })).not.toBeChecked();
  for (const name of Object.keys(labels)) await expect(settingsPanel(page).getByRole('spinbutton', { name: `${labels[name]}数值`, exact: true })).toHaveValue(String(chosen[name]));
  await settingsPanel(page).getByRole('button', { name: '恢复HDRI默认参数', exact: true }).click();
  await settingsPanel(page).getByRole('button', { name: '保存设置', exact: true }).click();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey)).toMatchObject({ ...Object.fromEntries(Object.entries(hdriDefaults).filter(([name]) => name !== 'hdriFile')), panelWidth: 372, headerTransparency: 37 });
});

test('结构页真实EXR强度、旋转和曝光改变像素，同一画布保留完整毛发', async ({ page }, testInfo) => {
  const requests = [], errors = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page, { hdriLightIntensity: 0 });
  await page.goto('/#/model'); await waitStartup(page);
  const canvas = modelCanvas(page), original = await canvas.elementHandle();
  await expect(canvas).toHaveAttribute('data-hdri-state', 'ready'); await expectCompleteHair(canvas);
  await openSettings(page);
  const bounds = { left: .18, right: .82, top: .16, bottom: .87 };
  await edit(page, 'hdriIntensity', 0);
  const unlit = await renderedPixels(page, canvas, bounds);
  await edit(page, 'hdriIntensity', 3);
  const bright = await renderedPixels(page, canvas, bounds);
  const intensity = difference(unlit, bright);
  expect(intensity.lightIncrease).toBeGreaterThan(8);
  await edit(page, 'hdriIntensity', 1); await edit(page, 'hdriExposure', -2);
  const lowExposure = await renderedPixels(page, canvas, bounds);
  await edit(page, 'hdriExposure', 2);
  const highExposure = await renderedPixels(page, canvas, bounds);
  const exposure = difference(lowExposure, highExposure);
  expect(exposure.lightIncrease).toBeGreaterThan(5);
  await edit(page, 'hdriExposure', 0); await edit(page, 'hdriRotation', 0);
  const firstDirection = await renderedPixels(page, canvas, bounds);
  await edit(page, 'hdriRotation', 120);
  await expectApplied(canvas, { hdriRotation: 120, hdriLightIntensity: 0 });
  await expect(canvas).toHaveAttribute('data-hdri-state', 'ready');
  await expect(canvas).toHaveAttribute('data-hdri-rotation', '120');
  const rotated = await renderedPixels(page, canvas, bounds);
  const rotation = difference(firstDirection, rotated);
  expect(rotation.meanAbsolute).toBeGreaterThan(1);
  expect(rotation.changedFraction).toBeGreaterThan(.02);
  await settingsPanel(page).getByRole('checkbox', { name: 'HDRI环境照明', exact: true }).uncheck();
  await expect(canvas).toHaveAttribute('data-hdri-state', 'disabled');
  const disabled = await renderedPixels(page, canvas, bounds);
  const enabled = difference(disabled, rotated);
  expect(enabled.lightIncrease).toBeGreaterThan(8);
  await settingsPanel(page).getByRole('checkbox', { name: 'HDRI环境照明', exact: true }).check();
  await expect(canvas).toHaveAttribute('data-hdri-state', 'ready');
  await edit(page, 'hdriIntensity', 0);
  const beforeAuxiliary = await renderedPixels(page, canvas, bounds);
  await edit(page, 'hdriLightIntensity', 2);
  const afterAuxiliary = await renderedPixels(page, canvas, bounds);
  const auxiliary = difference(beforeAuxiliary, afterAuxiliary);
  expect(auxiliary.lightIncrease).toBeGreaterThan(5);
  expect(await original.evaluate(node => node === document.querySelector('#sceneContainer canvas'))).toBe(true);
  await expectCompleteHair(canvas);
  expect(requests.filter(path => path.endsWith(assetPaths.lionForestHdri))).toHaveLength(1);
  expect(requests.filter(path => path.endsWith(assetPaths.model))).toHaveLength(1);
  expect(errors).toEqual([]);
  await testInfo.attach('structure-pixel-metrics', { body: JSON.stringify({ intensity, exposure, rotation, enabled, auxiliary }, null, 2), contentType: 'application/json' });
  for (const [name, image] of Object.entries({ 'intensity-zero': unlit, 'intensity-three': bright, 'rotation-zero': firstDirection, 'rotation-120': rotated, 'exposure-minus-two': lowExposure, 'exposure-plus-two': highExposure })) {
    await testInfo.attach(`structure-${name}`, { body: image.png, contentType: 'image/png' });
  }
});

test('动作共享HDRI并实时改变实际模型照明，跨章请求复用且退出释放场景', async ({ page }, testInfo) => {
  const requests = [], errors = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-21T12:00:00Z') });
  await prepare(page, { hdriIntensity: .8, hdriRotation: 73, hdriExposure: -.4, hdriLightIntensity: 0 });
  await page.goto('/#/model'); await waitStartup(page);
  await expect(modelCanvas(page)).toHaveAttribute('data-hdri-state', 'ready');
  const structure = await modelCanvas(page).elementHandle();
  await page.locator('.site-header [data-route="action"]').click();
  const canvas = theaterCanvas(page);
  await expect(canvas).toHaveAttribute('data-scene-ready', 'true', { timeout: 50_000 });
  await expect(canvas).toHaveAttribute('data-hdri-state', 'ready');
  await expectApplied(canvas, { hdriIntensity: .8, hdriRotation: 73, hdriExposure: -.4, hdriLightIntensity: 0 });
  await expectCompleteHair(canvas);
  await openSettings(page);
  const original = await canvas.elementHandle();
  await page.locator('#chapterStage video').evaluateAll(videos => videos.forEach(video => video.pause()));
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100));
  // Keep the scene's authored rotation and all geometry intact. Advancing just
  // a few frames isolates light changes from ongoing 36-second stage motion.
  const initialRotation = Number(await canvas.getAttribute('data-lion-rotation'));
  const bounds = { left: .44, right: .56, top: .40, bottom: .65 };
  await edit(page, 'hdriIntensity', 0);
  const dark = await renderedPixels(page, canvas, bounds, { clockPaused: true });
  await edit(page, 'hdriIntensity', 3);
  const lit = await renderedPixels(page, canvas, bounds, { clockPaused: true });
  const intensity = difference(dark, lit);
  expect(intensity.lightIncrease).toBeGreaterThan(8);
  await edit(page, 'hdriExposure', -2);
  const low = await renderedPixels(page, canvas, bounds, { clockPaused: true });
  await edit(page, 'hdriExposure', 2);
  const high = await renderedPixels(page, canvas, bounds, { clockPaused: true });
  const exposure = difference(low, high);
  expect(exposure.lightIncrease).toBeGreaterThan(5);
  await edit(page, 'hdriRotation', -90);
  await page.clock.runFor(200);
  await expectApplied(canvas, { hdriIntensity: 3, hdriRotation: -90, hdriExposure: 2 });
  await expect(canvas).toHaveAttribute('data-hdri-state', 'ready');
  await expect(canvas).toHaveAttribute('data-hdri-rotation', '-90');
  const rotationDelta = (Number(await canvas.getAttribute('data-lion-rotation')) - initialRotation + Math.PI * 2) % (Math.PI * 2);
  expect(rotationDelta).toBeLessThan(.2);
  expect(await original.evaluate(node => node === document.querySelector('#chapterStage canvas'))).toBe(true);
  await expectCompleteHair(canvas);
  await page.clock.resume();
  await settingsPanel(page).getByRole('button', { name: '保存设置', exact: true }).click();
  await page.locator('.site-header [data-route="model"]').click();
  await expect(theaterCanvas(page)).toHaveCount(0);
  await expect.poll(() => original.evaluate(node => !node.isConnected && (node.getContext('webgl2') || node.getContext('webgl')).isContextLost())).toBe(true);
  expect(await structure.evaluate(node => node === document.querySelector('#sceneContainer canvas'))).toBe(true);
  await expectApplied(modelCanvas(page), { hdriIntensity: 3, hdriRotation: -90, hdriExposure: 2 });
  expect(requests.filter(path => path.endsWith(assetPaths.lionForestHdri))).toHaveLength(1);
  for (const [name, path] of Object.entries(assetPaths)) {
    if (name === 'model' || name === 'modelHair' || /^lionHair\d+$/.test(name)) expect(requests.filter(request => request.endsWith(path)), name).toHaveLength(1);
  }
  expect(errors).toEqual([]);
  await testInfo.attach('theater-pixel-metrics', { body: JSON.stringify({ intensity, exposure, rotationDelta }, null, 2), contentType: 'application/json' });
  for (const [name, image] of Object.entries({ 'intensity-zero': dark, 'intensity-three': lit, 'exposure-minus-two': low, 'exposure-plus-two': high })) {
    await testInfo.attach(`theater-${name}`, { body: image.png, contentType: 'image/png' });
  }
});

for (const route of ['model', 'action']) {
  test(`${route === 'model' ? '结构' : '动作'}HDRI下载失败保留模型，原画布重试恢复环境光`, async ({ page }) => {
    let failed = true;
    const requests = [];
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    await page.route(`**/${assetPaths.lionForestHdri}`, route => failed ? route.fulfill({ status: 503, body: 'EXR unavailable' }) : route.continue());
    await prepare(page); await page.goto(`/#/${route}`); await waitStartup(page);
    const canvas = route === 'model' ? modelCanvas(page) : theaterCanvas(page);
    await expect(canvas).toHaveAttribute('data-hdri-state', 'error', { timeout: 50_000 });
    await expectCompleteHair(canvas);
    const original = await canvas.elementHandle();
    const modelRequests = requests.filter(path => path.endsWith(assetPaths.model)).length;
    const retry = page.getByRole('button', { name: '重新载入 HDRI', exact: true });
    await expect(retry).toBeVisible(); failed = false; await retry.click();
    await expect(canvas).toHaveAttribute('data-hdri-state', 'ready', { timeout: 40_000 });
    await expect(retry).toHaveCount(0); await expectCompleteHair(canvas);
    expect(await original.evaluate((node, selector) => node === document.querySelector(selector), route === 'model' ? '#sceneContainer canvas' : '#chapterStage canvas')).toBe(true);
    expect(requests.filter(path => path.endsWith(assetPaths.model))).toHaveLength(modelRequests);
    expect(requests.filter(path => path.endsWith(assetPaths.lionForestHdri)).length).toBeGreaterThanOrEqual(2);
  });
}
