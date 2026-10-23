import { test, expect } from '@playwright/test';
import { openTheater, actionVideo, selectAction } from './action-theater.helpers.js';

// Chrome trace screencasts can stall four concurrent 1440p video decoders on
// software-rendered desktop runners. Only this natural-playback test disables
// tracing; failure screenshots and the other player regression traces remain.
test.use({ trace: 'off', launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } });

test('循环播放到结尾连续进入下一轮，切屏不从零重建实例', async ({ page }) => {
  test.setTimeout(90_000);
  await openTheater(page);
  const play = page.getByRole('button', { name: '播放动作视频', exact: true });
  if (await play.isVisible()) await play.click();
  const retained = await actionVideo(page, 'tanqing').elementHandle();
  await expect(actionVideo(page, 'tanqing')).toHaveJSProperty('loop', true);
  await expect.poll(() => actionVideo(page, 'tanqing').evaluate(video => !video.paused && video.currentTime > .1)).toBe(true);
  // Observe the native wrap rather than sparsely sampling its first seconds
  // or artificially seeking into the last GOP of four concurrent decoders.
  await actionVideo(page, 'tanqing').evaluate(video => {
    video.dataset.nativeLoopWrapped = 'false';
    const onSeeking = () => {
      if (video.currentTime >= 2 || video.paused) return;
      video.removeEventListener('seeking', onSeeking);
      video.dataset.nativeLoopWrapped = 'true';
    };
    video.addEventListener('seeking', onSeeking);
  });
  await expect.poll(() => actionVideo(page, 'tanqing').evaluate(video => video.dataset.nativeLoopWrapped),
    { timeout: 45_000 }).toBe('true');
  await selectAction(page, 'doumao');
  await expect.poll(() => page.locator('#chapterStage video').evaluateAll(nodes => nodes.filter(node => !node.paused).length)).toBe(4);
  expect(await retained.evaluate(node => node === document.querySelector('video[data-action-id="tanqing"]'))).toBe(true);
});
