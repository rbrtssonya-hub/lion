import { test, expect, chromium } from '@playwright/test';
import { recordVideoAudio, expectLowVolumeWithoutOverlap } from './video-audio.helpers.js';
// Trace snapshots can grant activation even to manually created contexts.
// Keep the native-policy assertions valid under the standard project config.
test.use({ trace: 'off' });
const soundState = video => video.evaluate(element => ({ muted: element.muted, volume: element.volume }));

test.describe('浏览器实际拦截有声自动播放', () => {
  for (const target of ['页面', '线条开关', '键盘开关']) test(`无提示框且画面继续，首次操作${target}后低音量发声并尊重后续静音`, async ({ baseURL }) => {
    test.setTimeout(120_000);
    const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=document-user-activation-required', '--disable-features=PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies'] });
    try {
      const page = await browser.newPage({ baseURL, viewport: { width: 1920, height: 1080 } });
      await recordVideoAudio(page);
      const cdp = await page.context().newCDPSession(page);
      await page.goto('/');
      // Playwright evaluate/locator polling may grant user activation. Observe
      // through CDP without a gesture until Chrome itself has denied autoplay.
      await expect.poll(async () => {
        const { result } = await cdp.send('Runtime.evaluate', {
          expression: `(() => {
            const video = document.querySelector('#introVideo, #entryLionVideo');
            const toggle = document.querySelector('#toggleHomeAudio');
            return !document.querySelector('#startupLoading') && !!video && {
              activation: navigator.userActivation.hasBeenActive,
              muted: video.muted, volume: video.volume, paused: video.paused,
              advancing: video.currentTime > .1,
              overlay: !!document.querySelector('.video-status'),
              pressed: toggle?.getAttribute('aria-pressed'),
              waveState: toggle?.dataset.audioState,
            };
          })()`,
          returnByValue: true, userGesture: false,
        });
        return result.value;
      }, { timeout: 60_000 }).toEqual({ activation: false, muted: true, volume: .25, paused: false, advancing: true, overlay: false, pressed: 'false', waveState: 'awaiting-gesture' });
      if (target === '页面') await page.mouse.click(1100, 350);
      else if (target === '线条开关') await page.locator('#toggleHomeAudio').click();
      else {
        // Still no activation: let the muted intro end naturally before the
        // first keyboard gesture, covering intent across the automatic handoff.
        await expect.poll(async () => {
          const { result } = await cdp.send('Runtime.evaluate', {
            expression: `!!document.querySelector('#entryLionVideo') && !navigator.userActivation.hasBeenActive`,
            returnByValue: true, userGesture: false,
          });
          return result.value;
        }, { timeout: 20_000 }).toBe(true);
        await cdp.send('Runtime.evaluate', { expression: `document.querySelector('#toggleHomeAudio').focus()`, userGesture: false });
        await page.keyboard.press('Enter');
      }
      const current = page.locator('#introVideo, #entryLionVideo');
      await expect.poll(() => current.evaluate(video => !video.paused && !video.muted && video.volume === .25)).toBe(true);
      const toggle = page.locator('#toggleHomeAudio');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(toggle).toHaveAttribute('data-audio-state', 'enabled');
      await expect.poll(() => toggle.locator('.sound-wave-flow').evaluate(element => getComputedStyle(element).animationPlayState)).toBe('running');
      await toggle.click();
      await page.mouse.click(1100, 350);
      await expect.poll(() => soundState(current)).toEqual({ muted: true, volume: .25 });
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await page.locator('#replayIntro').click();
      await page.locator('#skipIntro').click();
      await expect.poll(() => soundState(page.locator('#entryLionVideo'))).toEqual({ muted: true, volume: .25 });
      await expect(page.locator('.video-status')).toHaveCount(0);
      await expectLowVolumeWithoutOverlap(page);
    } finally { await browser.close(); }
  });
});
