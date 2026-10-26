import { test, expect } from '@playwright/test';
import { actions, actionButton, actionVideo, openTheater } from './action-theater.helpers.js';

test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } });

const theater = page => page.locator('#actionTheater');
const videos = page => theater(page).locator('video');
const start = page => page.getByRole('button', { name: '顺序观赏', exact: true });
const stop = page => page.getByRole('button', { name: '停止顺序观赏', exact: true });
const runningIds = page => videos(page).evaluateAll(nodes => nodes.filter(node => !node.paused).map(node => node.dataset.actionId));

// Seek the supplied media near its own end, then let native playback emit ended.
// A timer or a dispatched DOM event cannot stand in for finishing a clip.
async function finishClip(page, id) {
  const video = actionVideo(page, id);
  await expect.poll(() => video.evaluate(node => node.readyState >= 2 && Number.isFinite(node.duration) && !node.paused)).toBe(true);
  await video.evaluate(node => { node.currentTime = Math.max(0, node.duration - .15); });
}

test('舞章首屏可进入八态，未主动开启时仍保留原四屏循环', async ({ page }) => {
  await openTheater(page, { width: 1366, height: 768 });
  await expect(page.getByRole('button', { name: '看狮头 · 八态', exact: true })).toBeInViewport();
  await expect(start(page)).toBeInViewport();
  expect(await videos(page).evaluateAll(nodes => nodes.map(node => node.loop))).toEqual([true, true, true, true]);
  await expect.poll(() => runningIds(page)).toEqual(['tanqing', 'doumao', 'tuqiu', 'meihuazhuang']);
  await expect(stop(page)).toHaveCount(0);
});

test('主动顺序观赏按四段真实视频结束推进，末幕停止并可去传章', async ({ page }) => {
  await openTheater(page);
  await start(page).click();
  await expect(stop(page)).toBeVisible();
  expect(await videos(page).evaluateAll(nodes => nodes.map(node => node.loop))).toEqual([false, false, false, false]);
  for (let index = 0; index < actions.length; index += 1) {
    const { id } = actions[index];
    await expect(theater(page)).toHaveAttribute('data-active-action', id);
    await expect.poll(() => runningIds(page)).toEqual([id]);
    await expect.poll(() => actionVideo(page, id).evaluate(node => node.currentTime)).toBeLessThan(3);
    await finishClip(page, id);
    if (index < actions.length - 1) await expect(theater(page)).toHaveAttribute('data-active-action', actions[index + 1].id);
  }
  await expect(page.getByRole('button', { name: '去看狮行远方', exact: true })).toBeVisible();
  await expect.poll(() => runningIds(page)).toEqual([]);
  await expect(stop(page)).toHaveCount(0);
  await page.getByRole('button', { name: '去看狮行远方', exact: true }).click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'spread');
});

test('停止及点选单幕恢复循环，保留静音和音量偏好', async ({ page }) => {
  await openTheater(page);
  await page.getByRole('button', { name: '关闭声音', exact: true }).click();
  const preferredVolume = await actionVideo(page, 'tanqing').evaluate(node => node.volume);
  await start(page).click();
  await finishClip(page, 'tanqing');
  await expect(theater(page)).toHaveAttribute('data-active-action', 'doumao');
  await stop(page).click();
  await expect(start(page)).toBeVisible();
  expect(await videos(page).evaluateAll(nodes => nodes.map(node => node.loop))).toEqual([true, true, true, true]);
  await expect.poll(() => runningIds(page)).toEqual(['tanqing', 'doumao', 'tuqiu', 'meihuazhuang']);
  expect(await videos(page).evaluateAll(nodes => nodes.every(node => node.muted))).toBe(true);
  expect(await actionVideo(page, 'doumao').evaluate(node => node.volume)).toBe(preferredVolume);
  await start(page).click();
  await actionButton(page, 'tuqiu').click();
  await expect(stop(page)).toHaveCount(0);
  await expect(theater(page)).toHaveAttribute('data-active-action', 'tuqiu');
  expect(await actionVideo(page, 'tuqiu').evaluate(node => node.loop)).toBe(true);
});

test('顺序观赏隐藏后暂停，恢复只播放当前幕且不会凭事件跳幕', async ({ page }) => {
  await openTheater(page);
  await start(page).click();
  await expect.poll(() => runningIds(page)).toEqual(['tanqing']);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    document.querySelector('video[data-action-id="tanqing"]').dispatchEvent(new Event('ended'));
  });
  await expect.poll(() => runningIds(page)).toEqual([]);
  await expect(theater(page)).toHaveAttribute('data-active-action', 'tanqing');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => runningIds(page)).toEqual(['tanqing']);
  await expect(theater(page)).toHaveAttribute('data-active-action', 'tanqing');
});

test('从戏台进入八态释放旧媒体，返回戏台恢复默认循环而不续播顺序模式', async ({ page }) => {
  await openTheater(page, { reducedMotion: 'reduce' });
  await start(page).click();
  const retained = await videos(page).elementHandles();
  await page.getByRole('button', { name: '看狮头 · 八态', exact: true }).click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  await expect(page.getByRole('button', { name: '返回戏台', exact: true })).toBeInViewport();
  for (const node of retained) expect(await node.evaluate(video => ({ connected: video.isConnected, paused: video.paused, muted: video.muted, src: video.getAttribute('src') }))).toEqual({ connected: false, paused: true, muted: true, src: null });
  await page.getByRole('button', { name: '返回戏台', exact: true }).click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'action');
  await expect(start(page)).toBeVisible();
  await expect(stop(page)).toHaveCount(0);
  await expect(videos(page)).toHaveCount(4);
  expect(await videos(page).evaluateAll(nodes => nodes.map(node => node.loop))).toEqual([true, true, true, true]);
});
