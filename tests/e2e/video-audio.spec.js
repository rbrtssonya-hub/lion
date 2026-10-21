import { test, expect, chromium } from '@playwright/test';
import { recordVideoAudio, expectLowVolumeWithoutOverlap } from './video-audio.helpers.js';

test.use({ viewport: { width: 1920, height: 1080 } });

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
});

test.describe('浏览器实际拦截有声自动播放', () => {
  test('首页不偷偷静音，点击明确入口后低音量有声播放', async ({ baseURL }) => {
    const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=document-user-activation-required', '--disable-features=PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies'] });
    try {
      const page = await browser.newPage({ baseURL, viewport: { width: 1920, height: 1080 } });
      const cdp = await page.context().newCDPSession(page);
      await page.goto('/');
      // Playwright evaluate/locator polling may grant user activation. Observe
      // through CDP without a gesture until Chrome itself has denied autoplay.
      await expect.poll(async () => {
        const { result } = await cdp.send('Runtime.evaluate', {
          expression: `(() => {
            const video = document.querySelector('#introVideo');
            return !document.querySelector('#startupLoading') && !!video && {
              activation: navigator.userActivation.hasBeenActive,
              muted: video.muted, volume: video.volume, paused: video.paused,
              blocked: [...document.querySelectorAll('.video-status button')].some(button => button.textContent === '开启声音并播放'),
            };
          })()`,
          returnByValue: true, userGesture: false,
        });
        return result.value;
      }, { timeout: 60_000 }).toEqual({ activation: false, muted: false, volume: .25, paused: true, blocked: true });
      await page.getByRole('button', { name: '开启声音并播放', exact: true }).click();
      await expect.poll(() => page.locator('#introVideo').evaluate(video => !video.paused && video.currentTime > .1 && !video.muted && video.volume === .25)).toBe(true);
    } finally { await browser.close(); }
  });
});
