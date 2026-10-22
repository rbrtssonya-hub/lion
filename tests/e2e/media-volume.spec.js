import { test, expect } from '@playwright/test';
import { recordVideoAudio } from './video-audio.helpers.js';
import { actions, selectAction } from './action-theater.helpers.js';

test.use({ trace: 'off', viewport: { width: 1920, height: 1080 } });
test.setTimeout(120_000);

const widget = page => page.locator('.sound-control-widget');
const slider = page => widget(page).getByRole('slider', { name: '音量', exact: true });
const toggle = page => widget(page).getByRole('button');
const home = page => page.locator('#entryLionVideo');
const videos = page => page.locator('#chapterStage video');
const mediaCalls = page => page.evaluate(() => ({ play: window.videoAudioAudit.plays.length, load: window.volumeLoadCalls.length }));
const snapshot = locator => locator.evaluate(video => ({ volume: video.volume, muted: video.muted, paused: video.paused }));

async function prepare(page, route = '') {
  await recordVideoAudio(page);
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, bookAutoplay: false }));
    window.volumeLoadCalls = [];
    const nativeLoad = HTMLMediaElement.prototype.load;
    HTMLMediaElement.prototype.load = function () {
      window.volumeLoadCalls.push(this.dataset.actionId || this.id);
      return nativeLoad.call(this);
    };
  });
  await page.goto(route ? `/#/${route}` : '/');
  if (route === 'action') {
    await expect(page.locator('#chapterStage canvas')).toHaveAttribute('data-scene-ready', 'true', { timeout: 70_000 });
    await expect.poll(() => videos(page).evaluateAll(elements => elements.length === 4 && elements.every(video => !video.paused))).toBe(true);
  } else await expect.poll(() => home(page).evaluate(video => !video.paused && video.currentTime > .1)).toBe(true);
  if (await toggle(page).getAttribute('aria-pressed') !== 'true') await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
}

async function expectVolume(page, value) {
  await expect(slider(page)).toHaveValue(String(Math.round(value * 100)));
  const current = await videos(page).count() ? videos(page) : home(page);
  await expect.poll(() => current.evaluateAll(elements => elements.every(video => Math.abs(video.volume - Number(document.querySelector('.sound-volume-slider').value) / 100) < .001))).toBe(true);
  expect(await page.evaluate(() => sessionStorage.getItem('nanfeng-lion:media-volume:v1'))).toBe(String(value));
}

test('真实鼠标和键盘重复调节首页音量，原视频继续推进且不调用play/load或更换元素', async ({ page }) => {
  await prepare(page);
  const original = await home(page).elementHandle();
  const time = await home(page).evaluate(video => video.currentTime);
  const calls = await mediaCalls(page);
  const track = await slider(page).boundingBox();
  await page.mouse.click(track.x + track.width * .42, track.y + track.height / 2);
  const pointerVolume = Number(await slider(page).inputValue()) / 100;
  expect(pointerVolume).toBeGreaterThan(.3);
  expect(pointerVolume).toBeLessThan(.55);
  await expectVolume(page, pointerVolume);
  await slider(page).focus();
  for (let index = 0; index < 8; index++) await slider(page).press('ArrowRight');
  await slider(page).press('ArrowLeft');
  const value = Number(await slider(page).inputValue()) / 100;
  expect(value).toBeCloseTo(pointerVolume + .07, 2);
  await expectVolume(page, value);
  expect(await mediaCalls(page)).toEqual(calls);
  expect(await original.evaluate(element => element === document.querySelector('#entryLionVideo'))).toBe(true);
  await expect.poll(() => home(page).evaluate(video => video.currentTime)).toBeGreaterThan(time + .1);
  await expect.poll(() => snapshot(home(page))).toEqual({ volume: value, muted: false, paused: false });
  expect(await page.evaluate(() => window.videoAudioAudit.overlaps)).toEqual([]);
});

test('音量跨入场自然结束、循环和重播延续，零音量静音并在刷新后恢复最近非零值', async ({ page }) => {
  await prepare(page);
  await slider(page).fill('46');
  await expectVolume(page, .46);
  await page.locator('#replayIntro').click();
  const intro = page.locator('#introVideo');
  await expect.poll(() => snapshot(intro)).toEqual({ volume: .46, muted: false, paused: false });
  await slider(page).fill('57');
  await expect(slider(page)).toHaveValue('57');
  await expect.poll(() => intro.evaluate(video => video.volume)).toBe(.57);
  // Seek the real video close to its end and wait for native ended/handoff.
  await expect.poll(() => intro.evaluate(video => Number.isFinite(video.duration) && video.duration > 1)).toBe(true);
  await intro.evaluate(video => { video.currentTime = video.duration - .15; });
  await expect(intro).toHaveCount(0);
  await expect.poll(() => snapshot(home(page))).toEqual({ volume: .57, muted: false, paused: false });
  await page.locator('#replayIntro').click();
  await expect.poll(() => intro.evaluate(video => video.volume)).toBe(.57);
  await page.locator('#skipIntro').click();
  await expectVolume(page, .57);
  await slider(page).focus();
  await slider(page).press('Home');
  await expectVolume(page, 0);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => snapshot(home(page))).toEqual({ volume: 0, muted: true, paused: false });
  await page.reload();
  await expect(slider(page)).toHaveValue('0');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => snapshot(home(page))).toEqual({ volume: 0, muted: true, paused: false });
  await toggle(page).click();
  await expectVolume(page, .57);
  await expect.poll(() => snapshot(home(page))).toEqual({ volume: .57, muted: false, paused: false });
  await toggle(page).click();
  await page.locator('#replayIntro').click();
  await page.locator('#skipIntro').click();
  await expect.poll(() => snapshot(home(page))).toEqual({ volume: .57, muted: true, paused: false });
  expect(await page.evaluate(() => window.videoAudioAudit.overlaps)).toEqual([]);
});

test('共享音量同步四屏且仅主屏发声，调整不重播或重载，静音跨章节保留', async ({ page }) => {
  await prepare(page);
  await slider(page).fill('37');
  await expectVolume(page, .37);
  const originalHome = await home(page).elementHandle();
  await page.locator('.site-navigation [data-route="action"]').click();
  const scene = page.locator('#chapterStage canvas');
  await expect(scene).toHaveAttribute('data-scene-ready', 'true', { timeout: 70_000 });
  const shape = widget(page).locator('.sound-wave-window svg');
  const soundShape = await shape.evaluate(element => ({ width: element.getBoundingClientRect().width, stroke: getComputedStyle(element).strokeWidth }));
  expect(soundShape.width).toBeCloseTo(674.667, 1);
  expect(soundShape.stroke).toBe('8px');
  await toggle(page).hover();
  expect(await toggle(page).evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  await expect.poll(() => videos(page).evaluateAll(elements => elements.length === 4 && elements.every(video => !video.paused))).toBe(true);
  await expectVolume(page, .37);
  const original = await videos(page).elementHandles();
  const calls = await mediaCalls(page);
  await slider(page).focus();
  for (let index = 0; index < 4; index++) await slider(page).press('ArrowRight');
  await expectVolume(page, .41);
  expect(await mediaCalls(page)).toEqual(calls);
  for (let index = 0; index < original.length; index++) expect(await original[index].evaluate((element, index) => element === document.querySelectorAll('#chapterStage video')[index], index)).toBe(true);
  for (const { id } of actions.slice(1, 3)) {
    await selectAction(page, id);
    await expect.poll(() => videos(page).evaluateAll(elements => elements.filter(video => !video.paused && !video.muted && video.volume > 0).map(video => video.dataset.actionId))).toEqual([id]);
  }
  await toggle(page).click();
  await expect.poll(() => videos(page).evaluateAll(elements => elements.every(video => video.muted && video.volume === .41))).toBe(true);
  await page.locator('.site-navigation [data-route="entry"]').click();
  await expect(slider(page)).toHaveValue('41');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => snapshot(home(page))).toEqual({ volume: .41, muted: true, paused: false });
  expect(await originalHome.evaluate(element => element === document.querySelector('#entryLionVideo'))).toBe(true);
  await toggle(page).click();
  await expect.poll(() => snapshot(home(page))).toEqual({ volume: .41, muted: false, paused: false });
  expect(await page.evaluate(() => window.videoAudioAudit.overlaps)).toEqual([]);
});

test('动作暂停时波浪原地停止，调整音量不意外播放，继续后恢复向右流动', async ({ page }) => {
  await prepare(page, 'action');
  await page.getByRole('button', { name: '暂停动作视频', exact: true }).click();
  await expect.poll(() => videos(page).evaluateAll(elements => elements.every(video => video.paused))).toBe(true);
  await expect(widget(page)).toHaveAttribute('data-wave-playing', 'false');
  const flow = widget(page).locator('.sound-wave-flow');
  const stopped = await flow.evaluate(element => new Promise(resolve => {
    const first = new DOMMatrixReadOnly(getComputedStyle(element).transform).m41;
    setTimeout(() => resolve({ first, last: new DOMMatrixReadOnly(getComputedStyle(element).transform).m41 }), 180);
  }));
  expect(stopped.last).toBeCloseTo(stopped.first, 3);
  const calls = await mediaCalls(page);
  await slider(page).focus();
  await slider(page).press('ArrowRight');
  await expectVolume(page, .26);
  await expect.poll(() => videos(page).evaluateAll(elements => elements.every(video => video.paused))).toBe(true);
  expect(await mediaCalls(page)).toEqual(calls);
  await page.getByRole('button', { name: '播放动作视频', exact: true }).click();
  await expect(widget(page)).toHaveAttribute('data-wave-playing', 'true');
  expect(await flow.evaluate(element => getComputedStyle(element).animationPlayState)).toBe('running');
});

test('动作900和640电脑窗口中的音量按钮与滑杆可见可点，不遮挡原播放控件', async ({ page }) => {
  await prepare(page, 'action');
  for (const viewport of [{ width: 900, height: 600 }, { width: 640, height: 360 }]) {
    await page.setViewportSize(viewport);
    await widget(page).scrollIntoViewIfNeeded();
    const bounds = await widget(page).boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
    for (const locator of [toggle(page), slider(page)]) expect(await locator.evaluate(element => {
      const box = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    })).toBe(true);
    const playback = page.locator('#theaterControls');
    const other = await playback.boundingBox();
    expect(bounds.x < other.x + other.width && bounds.x + bounds.width > other.x && bounds.y < other.y + other.height && bounds.y + bounds.height > other.y).toBe(false);
  }
});
