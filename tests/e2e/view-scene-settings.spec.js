import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { assetPaths } from '../../src/config/assetPaths.js';
import { settingsPanel, selectSettingsPage } from './settings-navigation.helpers.js';

const storageKey = 'nanfeng-lion:developer-settings:v1';
const model = page => page.locator('#sceneContainer canvas');
const theater = page => page.locator('#chapterStage canvas');
const json = async (canvas, attribute) => JSON.parse(await canvas.getAttribute(attribute) || 'null');
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
const forestBytes = readFileSync(new URL('../../source/public/assets/environments/forest.exr', import.meta.url));

test.use({ viewport: { width: 1920, height: 1080 } });
test.setTimeout(180_000);

async function prepare(page, route = 'model', settings = {}) {
  await page.addInitScript(({ storageKey, settings }) => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    if (!sessionStorage.getItem('lion:view-scene-test:seeded')) {
      localStorage.setItem(storageKey, JSON.stringify({ carouselAutoplay: false, pushPage: false, ...settings }));
      sessionStorage.setItem('lion:view-scene-test:seeded', '1');
    }
  }, { storageKey, settings });
  await page.goto(`/#/${route}`);
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 70_000 });
  await expect(model(page)).toHaveAttribute('data-full-hair-groups', '33', { timeout: 45_000 });
  const canvas = route === 'action' ? theater(page) : model(page);
  if (route === 'action') await expect(canvas).toHaveAttribute('data-scene-ready', 'true', { timeout: 60_000 });
  await expect(canvas).toHaveAttribute('data-hdri-state', 'ready', { timeout: 45_000 });
  return canvas;
}

async function openSettings(page, name) {
  if (!await settingsPanel(page).isVisible()) await page.locator('.site-navigation [data-action="settings"]').click();
  await selectSettingsPage(page, name);
}

async function closeSettings(page) {
  await settingsPanel(page).getByRole('button', { name: '保存设置', exact: true }).click();
}

async function edit(page, label, value) {
  const input = settingsPanel(page).getByRole('spinbutton', { name: `${label}数值`, exact: true });
  await input.fill(String(value));
  await input.press('Tab');
  await expect(input).toHaveValue(String(value));
}

async function zoom(page, canvas, delta) {
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * .30, box.y + box.height * .45);
  for (let index = 0; index < 7; index++) {
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(70);
  }
}

async function polarAngle(canvas) {
  const position = await json(canvas, 'data-camera-position');
  const target = await json(canvas, 'data-camera-target');
  const offset = position.map((value, index) => value - target[index]);
  return Math.acos(Math.max(-1, Math.min(1, offset[1] / Math.hypot(...offset)))) * 180 / Math.PI;
}

async function dragVertically(page, canvas, from, to) {
  const box = await canvas.boundingBox();
  // The bottom-left playback panel covers the lower quarter of the canvas.
  // Start in the clear central column, and prove the real pointer hits WebGL.
  const x = box.x + box.width * .44;
  expect(await canvas.evaluate((element, point) => document.elementFromPoint(point.x, point.y) === element,
    { x, y: box.y + box.height * from })).toBe(true);
  await page.mouse.move(x, box.y + box.height * from);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height * to, { steps: 18 });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-camera-state', 'idle');
}

async function expectSource(canvas, suffix, resolution) {
  await expect(canvas).toHaveAttribute('data-hdri-source', suffix);
  await expect(canvas).toHaveAttribute('data-hdri-state', 'ready', { timeout: 45_000 });
  if (resolution) await expect(canvas).toHaveAttribute('data-hdri-resolution', resolution);
}

async function chooseUrl(page, url) {
  await settingsPanel(page).getByLabel('HDRI来源', { exact: true }).selectOption('url');
  await settingsPanel(page).getByRole('textbox', { name: 'HDRI文件链接', exact: true }).fill(url);
  await settingsPanel(page).getByRole('button', { name: '应用HDRI链接', exact: true }).click();
}

test('结构真实滚轮到达有限远近边界，视角参数原位生效并保存', async ({ page }) => {
  const canvas = await prepare(page), original = await canvas.elementHandle();
  const initial = Number(await canvas.getAttribute('data-camera-distance'));
  const limits = await json(canvas, 'data-camera-limits');
  expect(limits.min).toBeGreaterThan(0);
  expect(limits.max).toBeGreaterThan(initial);
  await zoom(page, canvas, -2000);
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-camera-distance')) - limits.min)).toBeLessThan(.015);
  await zoom(page, canvas, -2000);
  expect(Number(await canvas.getAttribute('data-camera-distance'))).toBeGreaterThanOrEqual(limits.min - .001);
  await zoom(page, canvas, 2000);
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-camera-distance')) - limits.max)).toBeLessThan(.015);
  await openSettings(page, '视角');
  await edit(page, '结构最近观看距离', .75);
  await edit(page, '结构最远观看距离', 3.1);
  await edit(page, '结构镜头视野', 42);
  await expect.poll(() => json(canvas, 'data-view-settings')).toMatchObject({ structureMinDistanceRatio: .75, structureMaxDistanceRatio: 3.1, structureFov: 42 });
  await expect.poll(() => json(canvas, 'data-camera-limits')).toMatchObject({ fov: 42 });
  await closeSettings(page);
  await expect.poll(() => saved(page)).toMatchObject({ structureMinDistanceRatio: .75, structureMaxDistanceRatio: 3.1, structureFov: 42 });
  expect(await original.evaluate(node => node === document.querySelector('#sceneContainer canvas'))).toBe(true);
  const changed = await json(canvas, 'data-camera-limits');
  await zoom(page, canvas, -2000);
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-camera-distance')) - changed.min)).toBeLessThan(.015);
});

test('动作真实拖拽可俯视和仰视，设置限幅生效，四鼓和狮头进度标记可用', async ({ page }, testInfo) => {
  const canvas = await prepare(page, 'action');
  await expect(canvas).toHaveAttribute('data-drum-state', 'ready', { timeout: 45_000 });
  await expect(canvas).toHaveAttribute('data-drum-count', '4');
  await dragVertically(page, canvas, .20, .82);
  await expect.poll(() => polarAngle(canvas)).toBeLessThan(50);
  const overhead = await polarAngle(canvas);
  await dragVertically(page, canvas, .92, .03);
  await expect.poll(() => polarAngle(canvas)).toBeGreaterThan(110);
  const underside = await polarAngle(canvas);
  await openSettings(page, '视角');
  await edit(page, '动作俯视角度下限', 30);
  await edit(page, '动作仰视角度上限', 140);
  await edit(page, '动作最近观看距离', 4);
  await edit(page, '动作最远观看距离', 18);
  await edit(page, '动作镜头视野', 62);
  await expect.poll(() => json(canvas, 'data-camera-limits')).toMatchObject({ min: 4, max: 18, minPolar: 30, maxPolar: 140, fov: 62 });
  await closeSettings(page);
  await expect.poll(() => saved(page)).toMatchObject({ actionMinPolarAngle: 30, actionMaxPolarAngle: 140, actionMinDistance: 4, actionMaxDistance: 18, actionFov: 62 });
  await dragVertically(page, canvas, .15, .88);
  await expect.poll(() => polarAngle(canvas)).toBeLessThan(31);
  expect(await polarAngle(canvas)).toBeGreaterThanOrEqual(29.99);
  await dragVertically(page, canvas, .88, .12);
  await expect.poll(() => polarAngle(canvas)).toBeGreaterThan(139);
  expect(await polarAngle(canvas)).toBeLessThanOrEqual(140.01);
  // Return to the authored screen with an actual UI action before using media.
  await page.locator('#chapterStage button[data-action-id="tanqing"]').click();
  await expect(canvas).toHaveAttribute('data-camera-state', 'idle');
  const progress = page.getByRole('slider', { name: '当前动作播放进度', exact: true });
  await expect(progress).toBeEnabled();
  const head = await progress.evaluate(async element => {
    const background = getComputedStyle(element).getPropertyValue('--theater-seek-head').trim();
    const url = background.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
    // An absolute URL is required: the custom property is consumed by a
    // pseudo-element rule in dist/assets/*.css, whose base differs from HTML.
    if (!/^https?:\/\//.test(url ?? '')) throw new Error('Progress thumb URL must be absolute in production CSS');
    const image = new Image(); image.src = url; await image.decode();
    return { url: image.currentSrc || image.src, width: image.naturalWidth, height: image.naturalHeight };
  });
  expect(head.url).toBe(new URL(assetPaths.navLion, page.url()).href);
  expect(head.width).toBeGreaterThan(0);
  expect(head.height).toBeGreaterThan(0);
  const pause = page.getByRole('button', { name: '暂停动作视频', exact: true });
  if (await pause.count()) await pause.click();
  await progress.focus(); await progress.press('Home'); await progress.press('ArrowRight');
  await expect.poll(() => page.locator('#chapterStage video[data-action-id="tanqing"]').evaluate(video => video.currentTime)).toBeGreaterThan(0);
  await testInfo.attach('actual-orbit-and-progress', { body: JSON.stringify({ overhead, underside, head }, null, 2), contentType: 'application/json' });
});

test('真实森林、内置4K和URL环境原位切换，保持相机及完整模型', async ({ page }) => {
  const requests = [];
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  const canvas = await prepare(page), original = await canvas.elementHandle();
  await expectSource(canvas, /\/forest\.exr$/, '1024x512');
  const distance = Number(await canvas.getAttribute('data-camera-distance'));
  await openSettings(page, 'HDRI');
  await settingsPanel(page).getByLabel('HDRI来源', { exact: true }).selectOption('default');
  await expectSource(canvas, /\/citrus_orchard_road_puresky_4k\.exr$/, '4096x2048');
  await settingsPanel(page).getByLabel('HDRI来源', { exact: true }).selectOption('forest');
  await expectSource(canvas, /\/forest\.exr$/, '1024x512');
  await chooseUrl(page, '/assets/environments/forest.exr?view-scene-url=1');
  await expectSource(canvas, /\/forest\.exr\?view-scene-url=1$/, '1024x512');
  await closeSettings(page);
  await expect.poll(() => saved(page)).toMatchObject({ hdriSource: 'url', hdriUrl: '/assets/environments/forest.exr?view-scene-url=1' });
  expect(await original.evaluate(node => node === document.querySelector('#sceneContainer canvas'))).toBe(true);
  expect(Math.abs(Number(await canvas.getAttribute('data-camera-distance')) - distance)).toBeLessThan(.002);
  await expect(canvas).toHaveAttribute('data-full-hair-drawn-groups', '33');
  await expect(canvas).toHaveAttribute('data-full-hair-drawn-strands', '2295421');
  expect(requests.filter(path => path.endsWith(assetPaths.model))).toHaveLength(1);
});

test('本地真实EXR和有效RGBE文件能解码，替换后撤销旧URL且刷新回森林', async ({ page }) => {
  const canvas = await prepare(page);
  await openSettings(page, 'HDRI');
  await settingsPanel(page).getByLabel('HDRI来源', { exact: true }).selectOption('local');
  const input = settingsPanel(page).getByLabel('选择本地HDRI文件', { exact: true });
  await input.setInputFiles({ name: 'local-forest.exr', mimeType: 'image/x-exr', buffer: forestBytes });
  await expect(canvas).toHaveAttribute('data-hdri-name', 'local-forest.exr');
  await expectSource(canvas, /^blob:/, '1024x512');
  const oldExr = await canvas.getAttribute('data-hdri-source');
  // Valid 2:1 Radiance RGBE panorama: 64x32 uncompressed RGBE pixels. The loader
  // supports its flat-pixel form; no project runtime asset or decoder is mocked.
  const header = Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 32 +X 64\n');
  const pixels = Buffer.alloc(64 * 32 * 4);
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = 128; pixels[index + 1] = 100; pixels[index + 2] = 80; pixels[index + 3] = 129;
  }
  await input.setInputFiles({ name: 'view-scene-test.hdr', mimeType: 'image/vnd.radiance', buffer: Buffer.concat([header, pixels]) });
  await expect(canvas).toHaveAttribute('data-hdri-name', 'view-scene-test.hdr');
  await expectSource(canvas, /^blob:/, '64x32');
  const oldHdr = await canvas.getAttribute('data-hdri-source');
  expect(oldHdr).not.toBe(oldExr);
  await expect.poll(() => page.evaluate(url => fetch(url).then(() => false, () => true), oldExr)).toBe(true);
  await closeSettings(page);
  expect(await saved(page)).not.toHaveProperty('hdriFile');
  expect((await saved(page)).hdriSource).toBe('forest');
  await openSettings(page, 'HDRI');
  await settingsPanel(page).getByLabel('HDRI来源', { exact: true }).selectOption('forest');
  await expectSource(canvas, /\/forest\.exr$/, '1024x512');
  await expect.poll(() => page.evaluate(url => fetch(url).then(() => false, () => true), oldHdr)).toBe(true);
  await closeSettings(page);
  await page.reload();
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 70_000 });
  await expectSource(model(page), /\/forest\.exr$/, '1024x512');
});

test('自定义HDRI解码错误显示重试，原画布恢复且不重载模型', async ({ page }) => {
  let broken = true, environmentRequests = 0, modelRequests = 0;
  page.on('request', request => { if (new URL(request.url()).pathname.endsWith(assetPaths.model)) modelRequests++; });
  await page.route('**/retry-view-scene.exr', route => {
    environmentRequests++;
    return route.fulfill({ status: 200, contentType: 'image/x-exr', body: broken ? Buffer.from('not an EXR image') : forestBytes });
  });
  const canvas = await prepare(page), original = await canvas.elementHandle();
  await openSettings(page, 'HDRI');
  await chooseUrl(page, '/retry-view-scene.exr');
  await expect(canvas).toHaveAttribute('data-hdri-state', 'error');
  await closeSettings(page);
  const retry = page.getByRole('button', { name: '重新载入 HDRI', exact: true });
  await expect(retry).toBeVisible();
  broken = false; await retry.click();
  await expectSource(canvas, /\/retry-view-scene\.exr$/, '1024x512');
  await expect(retry).toHaveCount(0);
  expect(environmentRequests).toBe(2);
  expect(modelRequests).toBe(1);
  expect(await original.evaluate(node => node === document.querySelector('#sceneContainer canvas'))).toBe(true);
});

test('动作离页释放WebGL，迟到HDRI不能恢复已移除画布，重入仍正常', async ({ page }) => {
  let pending;
  await page.route('**/slow-view-scene.exr', route => { pending = route; });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const canvas = await prepare(page, 'action'), original = await canvas.elementHandle();
  await openSettings(page, 'HDRI'); await chooseUrl(page, '/slow-view-scene.exr');
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(canvas).toHaveAttribute('data-hdri-state', 'loading');
  await closeSettings(page);
  await page.locator('.site-header [data-route="state"]').click();
  await expect(theater(page)).toHaveCount(0);
  await expect.poll(() => original.evaluate(node => !node.isConnected && (node.getContext('webgl2') || node.getContext('webgl')).isContextLost())).toBe(true);
  const stoppedFrames = await original.getAttribute('data-rendered-frames');
  // The prewarmed structure page remains another legitimate environment owner.
  // Finishing its shared request must never resurrect the disposed theater.
  await pending.fulfill({ status: 200, contentType: 'image/x-exr', body: forestBytes });
  await expect(model(page)).toHaveAttribute('data-hdri-state', 'ready', { timeout: 45_000 });
  await expect(theater(page)).toHaveCount(0);
  expect(await original.getAttribute('data-rendered-frames')).toBe(stoppedFrames);
  await page.locator('.site-header [data-route="action"]').click();
  await expect(theater(page)).toHaveAttribute('data-scene-ready', 'true', { timeout: 60_000 });
  await expectSource(theater(page), /\/slow-view-scene\.exr$/, '1024x512');
  expect(errors).toEqual([]);
});
