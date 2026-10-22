import { test, expect, chromium } from '@playwright/test';
import { recordVideoAudio, expectLowVolumeWithoutOverlap } from './video-audio.helpers.js';

// Trace snapshots evaluate with userGesture:true and invalidate autoplay-policy
// checks. This file observes the native document through gesture-free CDP.
test.use({ viewport: { width: 1920, height: 1080 }, trace: 'off',
  launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
});

const waitForStartup = async page => {
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
};
const soundState = video => video.evaluate(element => ({ muted: element.muted, volume: element.volume }));

test.describe('有声自动播放获准', () => {
  test('首页低音量播放，静音选择跨入场和循环保留，后台及离页停止播放', async ({ page }) => {
    test.setTimeout(120_000);
    await recordVideoAudio(page);
    await waitForStartup(page);
    const intro = page.locator('#introVideo');
    await expect.poll(() => intro.evaluate(video => !video.paused)).toBe(true);
    expect(await soundState(intro)).toEqual({ muted: false, volume: .25 });
    const controlBounds = await page.locator('.sound-control-widget-home').boundingBox();
    const heroBounds = await page.locator('.entry-gate').boundingBox();
    const rightGap = heroBounds.x + heroBounds.width - controlBounds.x - controlBounds.width;
    const bottomGap = heroBounds.y + heroBounds.height - controlBounds.y - controlBounds.height;
    expect(rightGap).toBeGreaterThanOrEqual(20);
    expect(rightGap).toBeLessThanOrEqual(48);
    expect(bottomGap).toBeGreaterThanOrEqual(18);
    expect(bottomGap).toBeLessThanOrEqual(48);
    await page.screenshot({ path: test.info().outputPath('home-sound-control.png') });
    await page.locator('#toggleHomeAudio').click();
    await expect.poll(() => soundState(intro)).toEqual({ muted: true, volume: .25 });
    await page.locator('#skipIntro').click();
    const loop = page.locator('#entryLionVideo');
    await expect.poll(() => soundState(loop)).toEqual({ muted: true, volume: .25 });
    await page.locator('#toggleHomeAudio').click();
    await expect.poll(() => soundState(loop)).toEqual({ muted: false, volume: .25 });
    await page.locator('#replayIntro').click();
    await expect.poll(() => soundState(intro)).toEqual({ muted: false, volume: .25 });
    await page.locator('#skipIntro').click();
    await expect.poll(() => loop.evaluate(video => !video.paused && video.currentTime > .1)).toBe(true);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect.poll(() => loop.evaluate(video => video.paused)).toBe(true);
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await expect.poll(() => loop.evaluate(video => !video.paused)).toBe(true);
    await page.locator('.site-header [data-route="state"]').click();
    await expect.poll(() => loop.evaluate(video => video.paused)).toBe(true);
    await page.locator('.site-header [data-route="entry"]').click();
    await expect.poll(() => loop.evaluate(video => !video.paused && !video.muted && video.volume === .25)).toBe(true);
    await expectLowVolumeWithoutOverlap(page);
  });

  test('首页启声确认未决时点击关闭立即静音，迟到播放确认不恢复声音', async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      if (window !== window.top) return;
      sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
      const nativePlay = HTMLMediaElement.prototype.play;
      const audit = window.homeAudioConfirmation = { denied: false, held: false, fulfilled: false, release: null };
      HTMLMediaElement.prototype.play = function () {
        if (this.id !== 'entryLionVideo') return nativePlay.call(this);
        if (!this.muted && !audit.denied) {
          audit.denied = true;
          return Promise.reject(new DOMException('test-only initial audible denial', 'NotAllowedError'));
        }
        const result = nativePlay.call(this);
        if (!this.muted && !audit.held) {
          audit.held = true;
          const confirmation = new Promise(resolve => { audit.release = resolve; });
          return result.then(() => confirmation).then(() => { audit.fulfilled = true; });
        }
        return result;
      };
    });
    await waitForStartup(page);
    const video = page.locator('#entryLionVideo');
    const control = page.locator('#toggleHomeAudio');
    await expect(control).toHaveAttribute('data-audio-state', 'awaiting-gesture');
    await expect.poll(() => video.evaluate(element => element.muted && !element.paused && element.currentTime > .1)).toBe(true);
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => page.evaluate(() => ({ held: window.homeAudioConfirmation.held, fulfilled: window.homeAudioConfirmation.fulfilled })))
      .toEqual({ held: true, fulfilled: false });
    await expect(control).toHaveAttribute('data-audio-state', 'enabled');
    await expect(control).toHaveAccessibleName('关闭声音');
    await control.click();
    await expect.poll(() => soundState(video)).toEqual({ muted: true, volume: .25 });
    await expect(control).toHaveAttribute('data-audio-state', 'muted');
    expect(await page.evaluate(() => sessionStorage.getItem('nanfeng-lion:media-audio:v1'))).toBe('muted');
    await page.evaluate(() => window.homeAudioConfirmation.release());
    await expect.poll(() => page.evaluate(() => window.homeAudioConfirmation.fulfilled)).toBe(true);
    await expect.poll(() => video.evaluate(element => element.muted && !element.paused && element.volume === .25)).toBe(true);
    await expect(control).toHaveAttribute('data-audio-state', 'muted');
  });
});

test.describe('浏览器实际拦截有声自动播放', () => {
  const observe = async cdp => {
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const videos = [...document.querySelectorAll('#introVideo, #entryLionVideo, #actionTheater video')];
        return {
          ready: !document.querySelector('#startupLoading'),
          activation: navigator.userActivation.hasBeenActive,
          advancing: videos.filter(video => !video.paused && video.currentTime > .1).length,
          muted: videos.every(video => video.muted),
          volumes: videos.map(video => video.volume),
          pending: document.querySelector('.sound-control')?.dataset.audioState,
          modal: !!document.querySelector('.video-status'),
          denied: window.videoAudioAudit?.rejections.some(error => error.name === 'NotAllowedError'),
          time: videos.reduce((time, video) => time + video.currentTime, 0),
        };
      })()`,
      returnByValue: true, userGesture: false,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.text);
    return result.value;
  };
  const strictBrowser = () => chromium.launch({ channel: 'chrome',
    ignoreDefaultArgs: ['--autoplay-policy=no-user-gesture-required'],
    args: ['--autoplay-policy=document-user-activation-required', '--disable-features=PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies'],
  });

  test('未激活首页先尝试有声、原生拒绝后静音推进，首个键盘手势启声且不覆盖静音选择', async ({ baseURL }) => {
    test.setTimeout(150_000);
    const browser = await strictBrowser();
    try {
      const page = await browser.newPage({ baseURL, viewport: { width: 1920, height: 1080 } });
      await recordVideoAudio(page);
      const cdp = await page.context().newCDPSession(page);
      await page.goto('/');
      // CDP explicitly avoids granting a gesture during the native-policy check.
      await expect.poll(() => observe(cdp), { timeout: 90_000 }).toMatchObject({
        ready: true, activation: false, advancing: 1, muted: true, volumes: [.25],
        pending: 'awaiting-gesture', modal: false, denied: true,
      });
      const before = (await observe(cdp)).time;
      await expect.poll(async () => (await observe(cdp)).time).toBeGreaterThan(before + .2);
      await page.screenshot({ path: test.info().outputPath('home-autoplay-fallback.png') });
      await page.keyboard.press('ArrowDown');
      const video = page.locator('#introVideo, #entryLionVideo');
      await expect.poll(() => video.evaluate(element => !element.paused && !element.muted && element.volume === .25)).toBe(true);
      await page.locator('#toggleHomeAudio').click();
      await page.keyboard.press('ArrowUp');
      await expect.poll(() => video.evaluate(element => element.muted && !element.paused)).toBe(true);
      if (await page.locator('#skipIntro').count()) await page.locator('#skipIntro').click();
      await page.locator('#replayIntro').click();
      await expect.poll(() => page.locator('#introVideo').evaluate(element => element.muted && !element.paused)).toBe(true);
      await page.locator('.site-header [data-route="action"]').click();
      await expect.poll(() => page.locator('#actionTheater video').evaluateAll(elements => elements.length === 4 && elements.every(element => element.muted))).toBe(true);
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#actionTheater .sound-control')).toHaveAttribute('data-audio-state', 'muted');
      await page.locator('.site-header [data-route="entry"]').click();
      await expectLowVolumeWithoutOverlap(page);
      await page.reload();
      await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
      await expect.poll(() => page.locator('#entryLionVideo').evaluate(element => element.muted && !element.paused)).toBe(true);
      await expectLowVolumeWithoutOverlap(page);
    } finally { await browser.close(); }
  });

  test('未激活动作页静音运行四段真实视频，首次指针手势启声且仅主屏发声', async ({ baseURL }) => {
    test.setTimeout(150_000);
    const browser = await strictBrowser();
    try {
      const page = await browser.newPage({ baseURL, viewport: { width: 1920, height: 1080 } });
      await recordVideoAudio(page);
      const cdp = await page.context().newCDPSession(page);
      await page.goto('/#/action');
      await expect.poll(() => observe(cdp), { timeout: 90_000 }).toMatchObject({
        ready: true, activation: false, advancing: 4, muted: true,
        pending: 'awaiting-gesture', modal: false, denied: true,
      });
      await page.mouse.click(960, 280);
      await expect.poll(() => page.locator('#actionTheater video').evaluateAll(elements =>
        elements.filter(element => !element.paused && !element.muted).map(element => element.dataset.actionId))).toEqual(['tanqing']);
      await expect(page.locator('#actionTheater .sound-control')).toHaveCSS('color', 'rgb(246, 223, 181)');
      await page.screenshot({ path: test.info().outputPath('action-sound-control.png') });
      await page.getByRole('button', { name: '关闭声音', exact: true }).click();
      await page.mouse.click(960, 280);
      await expect.poll(() => page.locator('#actionTheater video').evaluateAll(elements => elements.every(element => element.muted))).toBe(true);
      await expectLowVolumeWithoutOverlap(page);
    } finally { await browser.close(); }
  });
});
