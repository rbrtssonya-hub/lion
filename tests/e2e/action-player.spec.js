import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const root = resolve(import.meta.dirname, '../..');
let code;
let css;
const videoBytes = readFileSync(resolve(root, 'source/public/assets/entry/home-lion-loop.mp4'));
test.beforeAll(async () => {
  const result = await build({ configFile: false, plugins: [react()], logLevel: 'silent', define: { 'process.env.NODE_ENV': '"production"' },
    build: { write: false, minify: false, lib: { entry: resolve(root, 'tests/fixtures/action-player.jsx'), formats: ['es'] } } });
  const output = (Array.isArray(result) ? result[0] : result).output;
  code = output.find(item => item.type === 'chunk').code;
  css = output.filter(item => item.fileName.endsWith('.css')).map(item => item.source).join('\n');
});
async function mount(page, { fail = () => false, width = 1920, height = 1080, pageWidth = width, header = 88 } = {}) {
  await page.setViewportSize({ width, height });
  await page.route('**/__action-fixture__/**', async route => {
    const url = route.request().url();
    if (url.endsWith('runtime.js')) return route.fulfill({ contentType: 'application/javascript', body: code });
    if (url.endsWith('.mp4')) {
      if (fail(url)) return route.fulfill({ status: 503, body: 'test-only failure' });
      return route.fulfill({ contentType: 'video/mp4', body: videoBytes });
    }
    return route.fulfill({ contentType: 'text/html', body: `<html lang="zh-CN"><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div><script type="module" src="/__action-fixture__/runtime.js"></script></body></html>` });
  });
  await page.goto(`/__action-fixture__/page?pageWidth=${pageWidth}&header=${header}`);
  await expect(page.locator('#actionHero')).toBeVisible();
}
const video = (page, id) => page.locator(`[data-player-id="clip-${id}"] video`);

test('测试媒体：原位播放轻微放大，暂停复原并继续真实当前位置', async ({ page }) => {
  await mount(page);
  await page.locator('#action-clip-entry [data-watch-clip]').click();
  await expect.poll(() => video(page, 'entry').evaluate(el => !el.paused && el.currentTime > .1)).toBe(true);
  await expect(page.locator('[data-player-id="clip-entry"]')).toHaveAttribute('data-playing', 'true');
  await expect.poll(() => page.locator('[data-player-id="clip-entry"]').evaluate(el => getComputedStyle(el).transform)).toContain('1.04');
  const separated = await page.locator('#action-clip-entry').evaluate(el => el.querySelector('.action-player').getBoundingClientRect().right < el.querySelector('.action-clip-copy').getBoundingClientRect().left);
  expect(separated).toBe(true);
  await video(page, 'entry').evaluate(el => el.currentTime = 2);
  await expect.poll(() => video(page, 'entry').evaluate(el => !el.seeking && el.currentTime >= 2)).toBe(true);
  await page.locator('#action-clip-entry').getByRole('button', { name: '暂停入场视频', exact: true }).click();
  await expect(page.locator('[data-player-id="clip-entry"]')).toHaveAttribute('data-playing', 'false');
  await expect.poll(() => page.locator('[data-player-id="clip-entry"]').evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await page.locator('#action-clip-entry [data-watch-clip]').click();
  await expect.poll(() => video(page, 'entry').evaluate(el => !el.paused && el.currentTime >= 2)).toBe(true);
});

test('审查回归：重复观看与迟到播放请求不破坏当前播放和暂停控件', async ({ page }) => {
  await page.addInitScript(() => {
    const actual = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      return actual.call(this).then(() => new Promise(resolve => setTimeout(resolve, 800)));
    };
  });
  await mount(page);
  const row = page.locator('#action-clip-entry');
  await row.locator('[data-watch-clip]').click();
  await expect(video(page, 'entry')).toHaveJSProperty('paused', false);
  await row.locator('[data-watch-clip]').click();
  await expect(row.locator('.action-player')).toHaveAttribute('data-playing', 'true');
  await expect(row.getByRole('button', { name: '暂停入场视频', exact: true })).toBeVisible();
  await row.getByRole('button', { name: '暂停入场视频', exact: true }).click();
  await row.locator('[data-watch-clip]').click();
  await page.waitForTimeout(900); // Older native play promises have now completed.
  await expect(video(page, 'entry')).toHaveJSProperty('paused', false);
  await expect(row.locator('.action-player')).toHaveAttribute('data-playing', 'true');
  await expect.poll(() => row.locator('.action-player').evaluate(el => getComputedStyle(el).transform)).toContain('1.04');
});

test('审查回归：等待播放时重复请求、隐藏、换源与卸载不会恢复旧播放', async ({ page }) => {
  await page.addInitScript(() => {
    const actual = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      return new Promise(resolve => setTimeout(resolve, 500)).then(() => actual.call(this));
    };
  });
  await mount(page);
  const row = page.locator('#action-clip-entry');
  await row.locator('[data-watch-clip]').click();
  await row.locator('[data-watch-clip]').click();
  await expect.poll(() => video(page, 'entry').evaluate(el => !el.paused)).toBe(true);
  await page.waitForTimeout(600);
  await expect(row.locator('.action-player')).toHaveAttribute('data-playing', 'true');
  await row.getByRole('button', { name: '暂停入场视频', exact: true }).click();
  await row.locator('[data-watch-clip]').click();
  await page.locator('#action-clip-probe').getByRole('button', { name: '全屏观看探步', exact: true }).evaluate(el => el.click());
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.dataset.playerId)).toBe('clip-probe');
  await page.waitForTimeout(650);
  await expect(video(page, 'entry')).toHaveJSProperty('paused', true, { timeout: 1000 });
  await page.evaluate(() => document.exitFullscreen());
  await row.locator('[data-watch-clip]').click();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(650);
  await expect(video(page, 'entry')).toHaveJSProperty('paused', true);
  await expect(row.locator('.action-player')).toHaveAttribute('data-playing', 'false');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await row.locator('[data-watch-clip]').click();
  await page.locator('#fixtureReplace').evaluate(el => el.click());
  await page.waitForTimeout(650);
  await expect(video(page, 'entry')).toHaveJSProperty('paused', true);
  await row.locator('[data-watch-clip]').click();
  const retained = await video(page, 'entry').elementHandle();
  await page.locator('#fixtureUnmount').evaluate(el => el.click());
  await page.waitForTimeout(650);
  expect(await retained.evaluate(el => el.isConnected || !el.paused)).toBe(false);
});

test('审查回归：全屏豁免只属于当前播放器，退出全屏重新检查可见性', async ({ page }) => {
  await mount(page, { height: 2160 });
  const entry = page.locator('#action-clip-entry');
  await entry.locator('[data-watch-clip]').click();
  await expect(video(page, 'entry')).toHaveJSProperty('paused', false);
  await page.locator('#action-clip-probe').getByRole('button', { name: '全屏观看探步', exact: true }).evaluate(el => el.click());
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.dataset.playerId)).toBe('clip-probe');
  await expect(video(page, 'entry')).toHaveJSProperty('paused', true, { timeout: 1000 });
  // A pending/late request must not start hidden audio behind another full screen.
  await entry.locator('[data-watch-clip]').evaluate(el => el.click());
  await page.waitForTimeout(150);
  await expect(video(page, 'entry')).toHaveJSProperty('paused', true, { timeout: 1000 });
  await page.evaluate(() => document.exitFullscreen());
  await entry.locator('[data-watch-clip]').click();
  await entry.getByRole('button', { name: '全屏观看入场', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.dataset.playerId)).toBe('clip-entry');
  await expect(video(page, 'entry')).toHaveJSProperty('paused', false);
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.evaluate(() => document.exitFullscreen());
  await expect(video(page, 'entry')).toHaveJSProperty('paused', true, { timeout: 1000 });
});

test('测试媒体：唯一目录切段暂停首屏旧实例，新片段从起点等待播放', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mount(page);
  const hero = page.locator('#actionHero');
  await hero.getByRole('button', { name: '播放入场视频', exact: true }).last().click();
  const oldVideo = await hero.locator('video').elementHandle();
  await expect.poll(() => oldVideo.evaluate(el => !el.paused && el.currentTime > .1)).toBe(true);
  await page.locator('.action-timeline[data-placement="details"]').getByRole('button', { name: '探步', exact: true }).click();
  expect(await oldVideo.evaluate(el => el.paused)).toBe(true);
  await expect(hero.locator('video')).toHaveJSProperty('paused', true);
  await expect(hero.locator('video')).toHaveJSProperty('currentTime', 0);
  await expect(hero.locator('[data-action-count]')).toHaveText('02 / 04');
  await hero.scrollIntoViewIfNeeded();
  await hero.getByRole('button', { name: '播放探步视频', exact: true }).last().click();
  await expect(hero.locator('video')).toHaveJSProperty('paused', false);
});

test('审查回归：推开余宽900px与顶栏64或180px下真实播放放大不碰撞', async ({ page }) => {
  for (const header of [64, 180]) {
    await mount(page, { width: 1660, height: 1200, pageWidth: 900, header });
    for (const id of ['entry', 'probe', 'turn', 'settle']) {
      await page.locator(`.action-timeline[data-placement="details"] button`).filter({ hasText: { entry: '入场', probe: '探步', turn: '转身', settle: '收势' }[id] }).evaluate(el => el.click());
      const row = page.locator(`#action-clip-${id}`);
      await row.locator('[data-watch-clip]').click();
      await expect(video(page, id)).toHaveJSProperty('paused', false);
      await expect.poll(() => row.locator('.action-player').evaluate(el => getComputedStyle(el).transform)).toContain('1.04');
      const collision = await row.evaluate(el => {
        const player = el.querySelector('.action-player').getBoundingClientRect();
        const copy = el.querySelector('.action-clip-copy').getBoundingClientRect();
        const sticky = document.querySelector('.action-sticky-index').getBoundingClientRect();
        const page = document.querySelector('.site-page').getBoundingClientRect();
        return player.right >= copy.left || player.left < page.left || player.right > page.right || player.top < sticky.bottom;
      });
      expect(collision).toBe(false);
    }
  }
});

test('测试媒体：真实进度音量、单视频互斥和滚出视口暂停', async ({ page }) => {
  await mount(page);
  await page.locator('#action-clip-entry [data-watch-clip]').click();
  await expect.poll(() => video(page, 'entry').evaluate(el => el.readyState)).toBeGreaterThanOrEqual(2);
  await page.locator('#action-clip-entry input').fill('1.5');
  await expect.poll(() => video(page, 'entry').evaluate(el => el.currentTime)).toBeGreaterThanOrEqual(1.5);
  await page.locator('#action-clip-entry').getByRole('button', { name: '关闭入场声音', exact: true }).click();
  await expect(video(page, 'entry')).toHaveJSProperty('muted', true);
  await page.locator('#action-clip-probe [data-watch-clip]').click();
  await expect.poll(() => video(page, 'probe').evaluate(el => !el.paused)).toBe(true);
  await expect(video(page, 'entry')).toHaveJSProperty('paused', true);
  expect(await page.locator('video').evaluateAll(els => els.filter(el => !el.paused).length)).toBe(1);
  await page.locator('#action-clip-settle').scrollIntoViewIfNeeded();
  await expect(video(page, 'probe')).toHaveJSProperty('paused', true);
});

test('测试媒体：实际网络失败保留海报，重试恢复播放', async ({ page }) => {
  let failed = true;
  await mount(page, { fail: url => failed && url.endsWith('probe.mp4') });
  await page.locator('#action-clip-probe [data-watch-clip]').click();
  await expect(page.locator('#action-clip-probe .action-player-message')).toContainText('视频暂时无法播放');
  await expect(page.locator('#action-clip-probe .action-poster')).toBeVisible();
  failed = false;
  await page.locator('#action-clip-probe').getByRole('button', { name: '重试', exact: true }).click();
  await expect.poll(() => video(page, 'probe').evaluate(el => !el.paused && el.readyState >= 2)).toBe(true);
});

test('测试媒体：播放阻止与迟到promise不留下错误放大或重复播放', async ({ page }) => {
  await page.addInitScript(() => {
    const actual = HTMLMediaElement.prototype.play;
    let blocked = true;
    HTMLMediaElement.prototype.play = function () {
      if (blocked) { blocked = false; return Promise.reject(new DOMException('test-only blocked', 'NotAllowedError')); }
      return actual.call(this).then(() => new Promise(resolve => setTimeout(resolve, 350)));
    };
  });
  await mount(page);
  await page.locator('#action-clip-entry [data-watch-clip]').click();
  await expect(page.locator('#action-clip-entry .action-player-message')).toContainText('播放未获允许');
  await page.locator('#action-clip-entry [data-watch-clip]').click();
  await page.locator('#action-clip-probe [data-watch-clip]').click();
  await expect.poll(() => video(page, 'probe').evaluate(el => !el.paused)).toBe(true);
  await page.waitForTimeout(400); // Covers the deliberately delayed native-play promise.
  expect(await page.locator('video').evaluateAll(els => els.filter(el => !el.paused).length)).toBe(1);
});

test('测试媒体：隐藏、结束与离页暂停，不自动恢复且可全屏', async ({ page }) => {
  await mount(page);
  await page.locator('#action-clip-entry [data-watch-clip]').click();
  await expect.poll(() => video(page, 'entry').evaluate(el => !el.paused)).toBe(true);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(video(page, 'entry')).toHaveJSProperty('paused', true);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(video(page, 'entry')).toHaveJSProperty('paused', true);
  await page.locator('#action-clip-entry [data-watch-clip]').click();
  await page.locator('#action-clip-entry').getByRole('button', { name: '全屏观看入场', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await page.evaluate(() => document.exitFullscreen());
  await video(page, 'entry').evaluate(el => el.currentTime = el.duration - .05);
  await expect(page.locator('[data-player-id="clip-entry"]')).toHaveAttribute('data-playing', 'false');
  await page.locator('#action-clip-entry [data-watch-clip]').click();
  await expect.poll(() => video(page, 'entry').evaluate(el => !el.paused)).toBe(true);
  const retained = await video(page, 'entry').elementHandle();
  await page.locator('#fixtureUnmount').evaluate(el => el.click());
  expect(await retained.evaluate(el => el.isConnected)).toBe(false);
  expect(await retained.evaluate(el => el.paused)).toBe(true);
});
