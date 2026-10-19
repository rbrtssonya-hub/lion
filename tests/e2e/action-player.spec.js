import { test, expect } from '@playwright/test';
import { actions, stage, scene, actionButton, actionVideo, openTheater, selectAction } from './action-theater.helpers.js';

const play = page => page.getByRole('button', { name: '播放动作视频', exact: true });
const pause = page => page.getByRole('button', { name: '暂停动作视频', exact: true });
const ensurePlaying = async page => { if (await play(page).isVisible()) await play(page).click(); };
const ensurePaused = async page => { if (await pause(page).isVisible()) await pause(page).click(); };
const videos = page => stage(page).locator('video');
const running = page => videos(page).evaluateAll(elements => elements.filter(element => !element.paused).length);
const audio = page => videos(page).evaluateAll(elements => elements.filter(element => !element.paused && !element.muted).map(element => element.dataset.actionId));

test('用户四段真实视频推进，暂停、拖动进度和继续观看保留当前位置', async ({ page }) => {
  await openTheater(page);
  await ensurePlaying(page);
  for (const { id } of actions) await expect.poll(() => actionVideo(page, id).evaluate(video => !video.paused && video.currentTime > .1)).toBe(true);
  await pause(page).click();
  await expect.poll(() => running(page)).toBe(0);
  const timeline = page.getByRole('slider', { name: '当前动作播放进度', exact: true });
  await timeline.fill('3.2');
  await expect.poll(() => actionVideo(page, 'tanqing').evaluate(video => video.currentTime)).toBeGreaterThanOrEqual(3.1);
  await ensurePlaying(page);
  await expect.poll(() => actionVideo(page, 'tanqing').evaluate(video => !video.paused && video.currentTime >= 3.2)).toBe(true);
});

test('四屏保持独立播放实例，只有当前主屏可开启声音且切屏不重载视频', async ({ page }) => {
  test.setTimeout(120_000);
  await openTheater(page);
  const retained = await actionVideo(page, 'tanqing').elementHandle();
  await ensurePlaying(page);
  await page.getByRole('button', { name: '开启声音', exact: true }).click();
  await expect.poll(() => audio(page)).toEqual(['tanqing']);
  for (const { id } of actions.slice(1)) {
    await selectAction(page, id);
    await expect.poll(() => audio(page)).toEqual([id]);
    await expect.poll(() => running(page)).toBe(4);
  }
  expect(await retained.evaluate(video => video.isConnected && video === document.querySelector('video[data-action-id="tanqing"]'))).toBe(true);
  expect(await retained.evaluate(video => video.currentTime)).toBeGreaterThan(.1);
  await page.getByRole('button', { name: '关闭声音', exact: true }).click();
  await expect.poll(() => audio(page)).toEqual([]);
});

test('快速选择最终动作不会恢复旧主屏声音或重置已播放进度', async ({ page }) => {
  await openTheater(page);
  await ensurePlaying(page);
  await page.getByRole('button', { name: '开启声音', exact: true }).click();
  await actionVideo(page, 'tanqing').evaluate(video => { video.currentTime = 3; });
  for (const id of ['doumao', 'tuqiu', 'meihuazhuang', 'doumao']) await actionButton(page, id).click();
  await expect(scene(page)).toHaveAttribute('data-active-screen', 'doumao');
  await expect.poll(() => audio(page)).toEqual(['doumao']);
  expect(await actionVideo(page, 'tanqing').evaluate(video => video.currentTime)).toBeGreaterThanOrEqual(3);
});

test('原生播放promise迟到时暂停保持生效，下一次手势可继续播放', async ({ page }) => {
  await page.addInitScript(() => {
    const actual = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const result = actual.call(this);
      return this.dataset.actionId ? result.then(() => new Promise(resolve => setTimeout(resolve, 600))) : result;
    };
  });
  await openTheater(page);
  await ensurePaused(page);
  await play(page).click();
  await pause(page).click();
  await page.waitForTimeout(750); // The deliberately delayed play results have now arrived.
  await expect.poll(() => running(page)).toBe(0);
  await ensurePlaying(page);
  await expect.poll(() => running(page)).toBe(4);
});

test('等待原生play时隐藏页面不会留下后台播放或迟到恢复', async ({ page }) => {
  await page.addInitScript(() => {
    const actual = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      return this.dataset.actionId ? new Promise(resolve => setTimeout(resolve, 450)).then(() => actual.call(this)) : actual.call(this);
    };
  });
  await openTheater(page);
  await ensurePaused(page);
  await play(page).click();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(650);
  await expect.poll(() => running(page)).toBe(0);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => running(page)).toBe(4);
  await pause(page).click();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => running(page)).toBe(0);
});

test('播放受浏览器阻止时给出可恢复状态，下一次点击可播放真实媒体', async ({ page }) => {
  await page.addInitScript(() => {
    const actual = HTMLMediaElement.prototype.play;
    let allowed = false;
    document.addEventListener('pointerdown', event => { if (event.isTrusted) allowed = true; }, { capture: true });
    HTMLMediaElement.prototype.play = function () {
      if ((this.dataset.actionId === 'tanqing' || this.src.endsWith('/tanqing.mp4')) && !allowed) return Promise.reject(new DOMException('test-only denied gesture', 'NotAllowedError'));
      return actual.call(this);
    };
  });
  await openTheater(page);
  await expect(stage(page)).toContainText(/点击.*播放|播放.*允许|播放.*阻止/);
  await ensurePlaying(page);
  await expect.poll(() => actionVideo(page, 'tanqing').evaluate(video => !video.paused && video.currentTime > .1)).toBe(true);
});

test('真实视频请求失败能在当前主屏重试，其他场景与按钮仍可使用', async ({ page }) => {
  let fail = true;
  await page.route('**/assets/action/videos/doumao.mp4', route => fail ? route.fulfill({ status: 503, body: 'test-only media failure' }) : route.continue());
  await openTheater(page);
  await selectAction(page, 'doumao');
  await ensurePlaying(page);
  await expect(stage(page)).toContainText(/无法播放|载入失败|加载失败/);
  fail = false;
  await page.getByRole('button', { name: '重试当前动作视频', exact: true }).click();
  await expect.poll(() => actionVideo(page, 'doumao').evaluate(video => !video.paused && video.readyState >= 2)).toBe(true);
});

test('全屏使用当前巨幕场景，退出后四屏播放和页面控制仍有效', async ({ page }) => {
  await openTheater(page);
  await ensurePlaying(page);
  await page.getByRole('button', { name: '全屏观看动作空间', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement?.querySelector('canvas')))).toBe(true);
  await expect.poll(() => actionVideo(page, 'tanqing').evaluate(video => !video.paused)).toBe(true);
  await page.evaluate(() => document.exitFullscreen());
  await pause(page).click();
  await expect.poll(() => running(page)).toBe(0);
});

test('循环播放到结尾连续进入下一轮，切屏不从零重建实例', async ({ page }) => {
  await openTheater(page);
  await ensurePlaying(page);
  await expect(actionVideo(page, 'tanqing')).toHaveJSProperty('loop', true);
  await actionVideo(page, 'tanqing').evaluate(video => { video.currentTime = video.duration - .12; });
  await expect.poll(() => actionVideo(page, 'tanqing').evaluate(video => !video.paused && video.currentTime < 2)).toBe(true);
  await selectAction(page, 'doumao');
  await expect.poll(() => running(page)).toBe(4);
});

test('离开动作页释放四个媒体元素与画布，返回后只有一套场景', async ({ page }) => {
  await openTheater(page);
  await ensurePlaying(page);
  const retainedVideos = await videos(page).elementHandles();
  const retainedCanvas = await scene(page).elementHandle();
  await page.locator('.site-header [data-route="state"]').click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  for (const video of retainedVideos) expect(await video.evaluate(element => ({ connected: element.isConnected, paused: element.paused, muted: element.muted, src: element.getAttribute('src') }))).toEqual({ connected: false, paused: true, muted: true, src: null });
  expect(await retainedCanvas.evaluate(element => element.isConnected)).toBe(false);
  await expect.poll(() => retainedCanvas.evaluate(element => (element.getContext('webgl2') || element.getContext('webgl')).isContextLost())).toBe(true);
  await page.locator('.site-header [data-route="action"]').click();
  await expect(scene(page)).toHaveAttribute('data-active-screen', 'tanqing', { timeout: 45_000 });
  await expect(stage(page).locator('canvas')).toHaveCount(1);
  await expect(videos(page)).toHaveCount(4);
  await expect.poll(() => running(page)).toBe(4);
});

test('延迟播放期间离页不会让已释放的旧媒体在后台启动', async ({ page }) => {
  await page.addInitScript(() => {
    const actual = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      return this.dataset.actionId ? new Promise(resolve => setTimeout(resolve, 500)).then(() => actual.call(this)) : actual.call(this);
    };
  });
  await openTheater(page);
  await ensurePaused(page);
  const retained = await videos(page).elementHandles();
  await play(page).click();
  await page.locator('.site-header [data-route="state"]').click();
  await page.waitForTimeout(750);
  for (const video of retained) expect(await video.evaluate(element => ({ connected: element.isConnected, paused: element.paused, muted: element.muted, src: element.getAttribute('src'), readyState: element.readyState, error: element.error?.code }))).toMatchObject({ connected: false, paused: true, muted: true, src: null });
});
