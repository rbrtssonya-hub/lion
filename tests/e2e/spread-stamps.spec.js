import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { settingsPanel, selectSettingsPage } from './settings-navigation.helpers.js';

test.use({ trace: 'off', viewport: { width: 1920, height: 1080 } });
test.setTimeout(150_000);

const groups = [
  { id: 'guangdong', name: '广东', stamps: ['foshan', 'guangzhou', 'heshan', 'suixi'] },
  { id: 'china', name: '中国', stamps: ['beijing', 'tianyang', 'quanzhou', 'hongkong'] },
  { id: 'world', name: '世界', stamps: ['singapore', 'kualalumpur', 'sanfrancisco', 'london'] },
];
const board = page => page.locator('.spread-stamp-board');
const host = page => page.locator('.spread-stamp-host');
const canvas = page => host(page).locator('canvas[data-renderer="regional-stamp-webgl"]');
const stamp = (page, id) => host(page).locator(`.spread-stamp-hit[data-stamp="${id}"]`);
const diagnostics = page => host(page).evaluate(node => node.getStampDiagnostics?.());

async function open(page, { reduced = true, settings = {}, instrument = false, unavailable = false, alphaProbe = false } = {}) {
  const errors = [], missing = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && new URL(response.url()).pathname.includes('/assets/')) missing.push(response.url());
  });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.addInitScript(({ settings, instrument, unavailable, alphaProbe }) => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({
      carouselAutoplay: false, bookAutoplay: false, pushPage: true, ...settings,
    }));
    if (unavailable) {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return /^webgl|^experimental-webgl/.test(type) ? null : Reflect.apply(original, this, [type, ...args]);
      };
      window.__restoreStampWebGL = () => { HTMLCanvasElement.prototype.getContext = original; };
    }
    if (alphaProbe) {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        const gl = Reflect.apply(original, this, [type, ...args]);
        if (!gl || !/^webgl/.test(type) || gl.__stampAlphaObserved) return gl;
        gl.__stampAlphaObserved = true;
        const target = this;
        for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
          const draw = gl[name];
          if (!draw) continue;
          gl[name] = function (...values) {
            const result = Reflect.apply(draw, this, values);
            if (target.dataset.renderer !== 'regional-stamp-webgl' || gl.getParameter(gl.FRAMEBUFFER_BINDING) !== null) return result;
            const progress = Number(target.parentElement?.dataset.progress ?? 0), now = performance.now();
            if (now - (target.__lastAlphaProbeAt ?? -Infinity) > 50 || progress === 1 && target.__lastAlphaProgress !== 1) {
              // Read immediately after a real default-framebuffer draw: a WebGL
              // buffer need not remain readable after browser composition.
              const rgba = new Uint8Array(4);
              gl.readPixels(2, 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
              window.__stampAlphaProbe = { rgba: [...rgba], progress, defaultFramebuffer: true, width: gl.drawingBufferWidth, height: gl.drawingBufferHeight };
              target.__lastAlphaProbeAt = now; target.__lastAlphaProgress = progress;
            }
            return result;
          };
        }
        return gl;
      };
    }
    if (!instrument) return;
    window.__stampNativeListeners = [];
    const originalAdd = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;
    const observed = target => target instanceof Element && target.matches('.spread-stamp-host, .spread-stamp-hit, .spread-stamp-focus-ui .close-focus, canvas.exhibition-canvas');
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (observed(this)) window.__stampNativeListeners.push({ target: this, type, listener, capture: typeof options === 'boolean' ? options : Boolean(options?.capture), removed: false });
      return Reflect.apply(originalAdd, this, [type, listener, options]);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      const entry = [...window.__stampNativeListeners].reverse().find(item => !item.removed && item.target === this && item.type === type && item.listener === listener && item.capture === capture);
      if (entry) entry.removed = true;
      return Reflect.apply(originalRemove, this, [type, listener, options]);
    };
    window.__stampResizeObservers = [];
    const OriginalObserver = window.ResizeObserver;
    window.ResizeObserver = class extends OriginalObserver {
      constructor(callback) { super(callback); this.__record = { targets: [], disconnected: false }; window.__stampResizeObservers.push(this.__record); }
      observe(target, options) { this.__record.targets.push(target); this.__record.disconnected = false; return super.observe(target, options); }
      disconnect() { this.__record.disconnected = true; return super.disconnect(); }
    };
  }, { settings, instrument, unavailable, alphaProbe });
  await page.goto('/#/spread');
  await expect(board(page)).toBeVisible();
  await expect(board(page)).toHaveAttribute('data-stamp-status', unavailable ? 'error' : 'ready', { timeout: 65_000 });
  if (!unavailable) await expect(canvas(page)).toHaveAttribute('data-shader-ready', 'true');
  return { errors, missing };
}

async function review(page, name) {
  const directory = process.env.SPREAD_STAMP_REVIEW_DIR;
  if (!directory) return;
  mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: resolve(directory, `transparent-${name}-1920.png`) });
}

async function expectTransparent(page, focused = false) {
  const state = await diagnostics(page);
  expect(state.renderer.alpha).toBe(true); expect(state.renderer.clearAlpha).toBe(0);
  expect(state.background.transparentBackground).toBe(true);
  expect(state.background.passes.staticPaper).toBe(0);
  expect(state.background.passes.transparentClear).toBeGreaterThan(0);
  await expect(board(page)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect.poll(() => page.evaluate(() => window.__stampAlphaProbe?.rgba)).toEqual([0, 0, 0, 0]);
  if (focused) await expect.poll(() => page.evaluate(() => window.__stampAlphaProbe?.progress)).toBe(1);
  return page.evaluate(() => window.__stampAlphaProbe);
}

async function level(page, group) {
  await page.getByRole('tab', { name: group.name, exact: true }).click();
  await expect(board(page)).toHaveAttribute('data-stamp-level', group.id);
  await expect(page.locator('.spread-map')).toHaveAttribute('data-map-level', group.id);
  await expect.poll(async () => (await diagnostics(page)).visibleIds.slice().sort()).toEqual(group.stamps.slice().sort());
  await expect(page.locator('.spread-map')).toHaveAttribute('data-map-motion', /idle|failed/);
}

async function focus(page, id) {
  await stamp(page, id).click();
  await expect(board(page)).toHaveAttribute('data-stamp-phase', 'focused');
  await expect(stamp(page, id)).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await diagnostics(page)).selected).toBe(id);
}

async function settledPose(page, id) {
  await expect.poll(async () => {
    const item = (await diagnostics(page)).poses.find(item => item.id === id);
    return item && item.corners.flat().every(Number.isFinite);
  }).toBe(true);
  return stamp(page, id).boundingBox();
}

async function ensureCompleteBoard(page) {
  await expect.poll(() => host(page).evaluate(node => {
    const bounds = node.getBoundingClientRect();
    const buttons = [...node.querySelectorAll('.spread-stamp-hit:not([hidden])')];
    return buttons.length === 4 && buttons.every(button => {
      const rect = button.getBoundingClientRect();
      const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      return rect.width > 70 && rect.height > 70 && rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1
        && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1
        && document.elementFromPoint(center.x, center.y) === button;
    });
  }), { message: '四张完整错落邮票及其真实中心命中区域' }).toBe(true);
}

async function pixels(page, bounds) {
  const png = await page.screenshot({ clip: bounds, animations: 'disabled' });
  return page.evaluate(async url => {
    const image = new Image(); image.src = url; await image.decode();
    const sampled = document.createElement('canvas'); sampled.width = 48; sampled.height = 48;
    const ctx = sampled.getContext('2d'); ctx.drawImage(image, 0, 0, 48, 48);
    return [...ctx.getImageData(0, 0, 48, 48).data];
  }, `data:image/png;base64,${png.toString('base64')}`);
}
function difference(first, second) {
  let absolute = 0;
  for (let i = 0; i < first.length; i++) if (i % 4 !== 3) absolute += Math.abs(first[i] - second[i]);
  return absolute / (first.length / 4 * 3);
}

test('传章每组只呈现对应四枚完整地域邮票，旧右栏清空且三个异名城市双向对应', async ({ page }) => {
  const { errors, missing } = await open(page);
  await expect(page.locator('.spread-case-reading, .spread-figure, .spread-photo-controls, #spreadPlaceTitle, .spread-empty')).toHaveCount(0);
  for (const group of groups) {
    await level(page, group);
    const ids = await host(page).locator('.spread-stamp-hit:visible').evaluateAll(nodes => nodes.map(node => node.dataset.stamp).sort());
    expect(ids).toEqual(group.stamps.slice().sort());
    await ensureCompleteBoard(page);
    await expect(board(page)).toContainText('AI辅助艺术邮票');
    if (group.id === 'guangdong' || group.id === 'world') await review(page, group.id);
  }
  for (const [group, mapId, artId] of [[groups[1], 'hong-kong', 'hongkong'], [groups[2], 'kuala-lumpur', 'kualalumpur'], [groups[2], 'san-francisco', 'sanfrancisco']]) {
    await level(page, group);
    await page.locator(`.spread-map-place[data-place="${mapId}"]`).click();
    await expect(stamp(page, artId)).toHaveAttribute('data-map-selected', 'true');
    await focus(page, artId);
    await expect(page.locator(`.spread-map-place[data-place="${mapId}"]`)).toHaveAttribute('aria-pressed', 'true');
    await host(page).getByRole('button', { name: '返回本组邮票', exact: true }).click();
    await expect(board(page)).toHaveAttribute('data-stamp-phase', /idle|hovering/);
  }
  expect(errors).toEqual([]); expect(missing).toEqual([]);
});

test('邮票聚焦放大且完整留在透明区域，键盘返回恢复焦点，地图改选关闭旧焦点', async ({ page }, testInfo) => {
  const { errors } = await open(page, { alphaProbe: true });
  await expectTransparent(page);
  const before = await settledPose(page, 'foshan');
  await focus(page, 'foshan');
  const after = await settledPose(page, 'foshan');
  expect(after.width * after.height).toBeGreaterThan(before.width * before.height * 1.25);
  const bounds = await host(page).boundingBox();
  expect(after.x).toBeGreaterThanOrEqual(bounds.x - 1);
  expect(after.y).toBeGreaterThanOrEqual(bounds.y - 1);
  expect(after.x + after.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
  expect(after.y + after.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
  const alpha = await expectTransparent(page, true);
  await testInfo.attach('actual-default-framebuffer-alpha', { body: JSON.stringify(alpha), contentType: 'application/json' });
  await review(page, 'focus');
  await page.keyboard.press('Escape');
  await expect(board(page)).toHaveAttribute('data-stamp-phase', /idle|hovering/);
  await expect(stamp(page, 'foshan')).toBeFocused();
  await focus(page, 'foshan');
  await page.locator('.spread-map-place[data-place="guangzhou"]').click();
  await expect(stamp(page, 'guangzhou')).toHaveAttribute('data-map-selected', 'true');
  await expect.poll(async () => (await diagnostics(page)).selected).toBeNull();
  await ensureCompleteBoard(page);
  expect(errors).toEqual([]);
});

test('真实指针驱动局部光斑与其他票虚化，快速换票保留光场且空隙保持透明', async ({ page }, testInfo) => {
  const { errors } = await open(page, { reduced: false, alphaProbe: true });
  await expectTransparent(page);
  const before = await diagnostics(page), bounds = await host(page).boundingBox();
  const desk = { x: bounds.x + 4, y: bounds.y + 4, width: 20, height: 20 };
  const staticBefore = await pixels(page, desk);
  const button = await stamp(page, 'foshan').boundingBox();
  await page.mouse.move(button.x + button.width * .32, button.y + button.height * .28);
  await expect.poll(async () => (await diagnostics(page)).background.owner).toBe('foshan');
  await expect.poll(async () => (await diagnostics(page)).lightStates.find(item => item.id === 'foshan').amount).toBeGreaterThan(.98);
  await expect.poll(async () => (await diagnostics(page)).lightStates.find(item => item.id === 'guangzhou').blur).toBeGreaterThan(9);
  const firstPointer = (await diagnostics(page)).background.pointer;
  await page.mouse.move(button.x + button.width * .71, button.y + button.height * .7);
  await expect.poll(async () => {
    const value = (await diagnostics(page)).background.pointer;
    return Math.hypot(value[0] - firstPointer[0], value[1] - firstPointer[1]);
  }).toBeGreaterThan(.15);
  for (const id of groups[0].stamps) {
    const rect = await stamp(page, id).boundingBox();
    await page.mouse.move(rect.x + rect.width * .5, rect.y + rect.height * .5);
    await page.waitForTimeout(32);
  }
  await expect.poll(async () => (await diagnostics(page)).background.owner).toBe('suixi');
  await expect.poll(async () => (await diagnostics(page)).lightStates.find(item => item.id === 'suixi').amount).toBeGreaterThan(.98);
  const final = await diagnostics(page);
  expect(final.materials).toEqual(before.materials); expect(final.textures).toEqual(before.textures);
  expect(final.background.texture).toBe(before.background.texture);
  expect(final.background.passes.opticalField).toBeGreaterThan(0);
  expect(final.background.passes.weightedLens).toBe(final.background.passes.opticalField);
  expect(final.background.passes.staticPaper).toBe(0);
  expect(final.background.passes.transparentClear).toBeGreaterThan(final.background.passes.opticalField);
  await expectTransparent(page);
  await review(page, 'hover');
  const backgroundDifference = difference(staticBefore, await pixels(page, desk));
  expect(backgroundDifference, '光影不投到右板纸色背景').toBeLessThan(.15);
  await testInfo.attach('regional-light-passes', { body: JSON.stringify({ passes: final.background.passes, owner: final.background.owner, backgroundDifference }), contentType: 'application/json' });
  expect(errors).toEqual([]);
});

test('六种命名算法在同张邮票上产生不同真实像素，切换保留材质与光场对象', async ({ page }, testInfo) => {
  const { errors } = await open(page, { settings: { panelWidth: 400, stampPinLight: true, stampLightAnimation: false, stampLightFollowPointer: false, stampTiltEnabled: false } });
  await page.locator('.site-navigation [data-action="settings"]').click();
  const panel = await selectSettingsPage(page, '邮票');
  await expect.poll(async () => (await diagnostics(page)).lightStates.find(item => item.id === 'foshan').amount).toBeGreaterThan(.99);
  const original = await diagnostics(page), captures = [], ids = ['legacy-multiply', 'local-add', 'screen', 'soft-light', 'diffuse-transmission', 'luminance'];
  for (const id of ids) {
    await panel.getByLabel('光影预设', { exact: true }).selectOption(id);
    await expect.poll(async () => (await diagnostics(page)).parameters.lightAlgorithm).toBe(id);
    await page.waitForTimeout(220);
    captures.push(await pixels(page, await stamp(page, 'foshan').boundingBox()));
  }
  const pairs = [];
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    const delta = difference(captures[a], captures[b]);
    pairs.push({ first: ids[a], second: ids[b], meanAbsolute: delta });
    expect(delta, `${ids[a]}和${ids[b]}的实际票面像素`).toBeGreaterThan(.025);
  }
  const final = await diagnostics(page);
  expect(final.materials).toEqual(original.materials); expect(final.background.texture).toBe(original.background.texture);
  await testInfo.attach('six-algorithm-pixel-differences', { body: JSON.stringify(pairs), contentType: 'application/json' });
  expect(errors).toEqual([]);
});

test('三种电脑窗口及设置推开后四票保持完整、错落角度稳定并可实际点击', async ({ page }) => {
  const { errors } = await open(page);
  const angles = (await diagnostics(page)).poses.slice(0, 4).map(item => item.rotation[2]);
  expect(angles.every(angle => Math.abs(angle) > .02)).toBe(true);
  for (const size of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
    await page.setViewportSize(size);
    await ensureCompleteBoard(page);
    expect((await diagnostics(page)).poses.slice(0, 4).map(item => item.rotation[2])).toEqual(angles);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  const original = await canvas(page).elementHandle(), originalWidth = (await host(page).boundingBox()).width;
  await page.locator('.site-navigation [data-action="settings"]').click();
  await selectSettingsPage(page, '邮票');
  await expect.poll(async () => (await host(page).boundingBox()).width).toBeLessThan(originalWidth - 50);
  await expect(page.locator('.settings-outside-guard')).toHaveCount(0);
  await ensureCompleteBoard(page);
  await focus(page, 'guangzhou');
  expect(await original.evaluate(node => node === document.querySelector('.spread-stamp-host canvas'))).toBe(true);
  await host(page).getByRole('button', { name: '返回本组邮票', exact: true }).click();
  await expect(board(page)).toHaveAttribute('data-stamp-phase', /idle|hovering/);
  await settingsPanel(page).getByRole('button', { name: '取消', exact: true }).click();
  await ensureCompleteBoard(page);
  expect(errors).toEqual([]);
});

test('真实WebGL上下文丢失回退静态邮票，原位重试完整恢复光影', async ({ page }) => {
  const { errors } = await open(page);
  await focus(page, 'foshan');
  const oldCanvas = await canvas(page).elementHandle();
  await canvas(page).evaluate(node => {
    const gl = node.getContext('webgl2') || node.getContext('webgl');
    const extension = gl.getExtension('WEBGL_lose_context');
    if (!extension) throw Error('WEBGL_lose_context unavailable');
    extension.loseContext();
  });
  await expect(board(page)).toHaveAttribute('data-stamp-status', 'error');
  await expect(canvas(page)).toHaveCount(0);
  await expect(host(page).locator('.spread-stamp-fallback-item')).toHaveCount(4);
  await page.getByRole('button', { name: '重新载入光影', exact: true }).click();
  await expect(board(page)).toHaveAttribute('data-stamp-status', 'ready');
  expect(await oldCanvas.evaluate(node => node !== document.querySelector('.spread-stamp-host canvas'))).toBe(true);
  await ensureCompleteBoard(page);
  await focus(page, 'suixi');
  await expect.poll(async () => (await diagnostics(page)).background.passes.opticalField).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('WebGL初始化不可用仍显示对应地域的四枚真实静态邮票，并能恢复渲染', async ({ page }) => {
  const { errors } = await open(page, { unavailable: true });
  await expect(host(page).locator('.spread-stamp-fallback-item img')).toHaveCount(4);
  await page.getByRole('tab', { name: '世界', exact: true }).click();
  await expect(board(page)).toHaveAttribute('data-stamp-level', 'world');
  const fallback = host(page).locator('.spread-stamp-fallback-item');
  await expect(fallback).toHaveCount(4);
  await expect(fallback.nth(1)).toHaveAttribute('aria-label', '查看吉隆坡静态邮票');
  await fallback.nth(1).click();
  await expect(page.locator('.spread-map-place[data-place="kuala-lumpur"]')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.__restoreStampWebGL());
  await page.getByRole('button', { name: '重新载入光影', exact: true }).click();
  await expect(board(page)).toHaveAttribute('data-stamp-status', 'ready');
  await expect.poll(async () => (await diagnostics(page)).visibleIds.slice().sort()).toEqual(groups[2].stamps.slice().sort());
  expect(errors).toEqual([]);
});

test('后台可见性暂停绘制，跨章释放真实GPU、原生监听与ResizeObserver并可重新进入', async ({ page }) => {
  const { errors } = await open(page, { reduced: false, instrument: true });
  await stamp(page, 'foshan').hover();
  await expect.poll(async () => (await diagnostics(page)).background.fieldUpdates).toBeGreaterThan(1);
  await page.evaluate(() => {
    const target = document.querySelector('.spread-stamp-host');
    window.__oldStamp = { host: target, canvas: target.querySelector('canvas'), diagnostics: target.getStampDiagnostics };
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const pausedFrames = (await diagnostics(page)).renderedFrames;
  await page.waitForTimeout(220);
  expect((await diagnostics(page)).renderedFrames).toBe(pausedFrames);
  expect((await diagnostics(page)).active).toBe(false);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(async () => (await diagnostics(page)).renderedFrames).toBeGreaterThan(pausedFrames);
  expect(await page.evaluate(() => window.__stampNativeListeners.filter(item => !item.removed).length)).toBeGreaterThan(50);
  await page.getByRole('button', { name: '南风有狮，返回首页', exact: true }).click();
  await expect(board(page)).toHaveCount(0);
  const released = await page.evaluate(() => {
    const old = window.__oldStamp, observedNodes = [old.host, old.canvas, ...old.host.querySelectorAll('*')];
    return { connected: old.host.isConnected, contextLost: (old.canvas.getContext('webgl2') || old.canvas.getContext('webgl')).isContextLost(),
      listeners: window.__stampNativeListeners.filter(item => observedNodes.includes(item.target) && !item.removed).length,
      observers: window.__stampResizeObservers.filter(item => item.targets.includes(old.host)).every(item => item.disconnected),
      state: old.diagnostics() };
  });
  expect(released.connected).toBe(false); expect(released.contextLost).toBe(true); expect(released.listeners).toBe(0); expect(released.observers).toBe(true); expect(released.state.disposed).toBe(true);
  const ended = released.state.renderedFrames;
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__oldStamp.diagnostics().renderedFrames)).toBe(ended);
  await page.locator('.site-navigation [data-route="spread"]').click();
  await expect(board(page)).toHaveAttribute('data-stamp-status', 'ready', { timeout: 65_000 });
  await ensureCompleteBoard(page);
  expect(errors).toEqual([]);
});
