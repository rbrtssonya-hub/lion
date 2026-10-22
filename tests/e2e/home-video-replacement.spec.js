import { test, expect } from '@playwright/test';

// This suite verifies media identity and natural playback. Native permission
// denial and muted fallback are exercised independently in video-audio.spec.js.
test.use({ viewport: { width: 1920, height: 1080 },
  launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
});

test('new entry plays to its natural end, then the new home clip really loops', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => {
    if (window !== top) return;
    sessionStorage.clear();
    window.homeMediaEvents = [];
    window.entryNavigationFrames = [];
    const sampleNavigation = () => {
      const intro = document.querySelector('.prewarmed-page[data-active="true"] .home-page[data-intro-active="true"]');
      const header = document.querySelector('.site-header');
      if (intro && header) entryNavigationFrames.push(getComputedStyle(header).visibility);
      if (!entryNavigationFrames.length || intro) requestAnimationFrame(sampleNavigation);
    };
    requestAnimationFrame(sampleNavigation);
    for (const type of ['playing', 'ended']) document.addEventListener(type, e => {
      if (e.target instanceof HTMLVideoElement) homeMediaEvents.push({ type, id: e.target.id, time: e.target.currentTime });
    }, true);
  });
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45000 });
  const intro = page.locator('#introVideo');
  await expect(intro).toHaveAttribute('src', /assets\/intro\/entry-intro\.mp4$/);
  await expect.poll(() => intro.evaluate(video => video.readyState)).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.site-header')).toBeHidden();
  await expect(page.locator('.lion-topbar-resize-handle')).toBeHidden();
  const firstFrame = await intro.boundingBox();
  expect(firstFrame.y).toBe(0);
  expect(firstFrame.height).toBe(1080);
  const metadata = await intro.evaluate(video => ({ width: video.videoWidth, height: video.videoHeight, duration: video.duration, loop: video.loop, muted: video.muted, volume: video.volume }));
  expect(metadata).toMatchObject({ width: 2560, height: 1440, loop: false, muted: false, volume: .25 });
  expect(metadata.duration).toBeCloseTo(6.584, 2);
  await testInfo.attach('entry-1920', { body: await page.screenshot(), contentType: 'image/png' });
  await expect(page.locator('#entryLionVideo')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.site-header')).toBeVisible();
  await expect(page.locator('.lion-topbar-resize-handle')).toBeVisible();
  expect(await page.evaluate(() => entryNavigationFrames.length > 0 && entryNavigationFrames.every(value => value === 'hidden'))).toBe(true);
  expect(await page.evaluate(() => homeMediaEvents.some(e => e.id === 'introVideo' && e.type === 'ended' && e.time > 6.5))).toBe(true);
  const loop = page.locator('#entryLionVideo');
  await expect.poll(() => loop.evaluate(video => video.readyState)).toBeGreaterThanOrEqual(2);
  expect(await loop.evaluate(video => ({ width: video.videoWidth, height: video.videoHeight, loop: video.loop, muted: video.muted, volume: video.volume }))).toEqual({ width: 2560, height: 1440, loop: true, muted: false, volume: .25 });
  expect(await loop.evaluate(video => video.duration)).toBeCloseTo(10.356009, 2);
  await testInfo.attach('loop-1920', { body: await page.screenshot(), contentType: 'image/png' });
  const wrapped = await loop.evaluate(video => new Promise(resolve => {
    let previous = video.currentTime;
    const timer = setTimeout(() => { video.removeEventListener('timeupdate', watch); resolve(false); }, 22000);
    function watch() {
      if (previous > video.duration - 1 && video.currentTime < 1) { clearTimeout(timer); video.removeEventListener('timeupdate', watch); resolve(true); }
      previous = video.currentTime;
    }
    video.addEventListener('timeupdate', watch);
  }));
  expect(wrapped).toBe(true);
  expect(errors).toEqual([]);
});

test('replacement keeps skip, replay, route pause and refresh without automatic intro replay', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45000 });
  const header = await page.locator('.site-header').elementHandle();
  await expect(page.locator('.site-header')).toBeHidden();
  await page.locator('#skipIntro').click();
  await expect(page.locator('.site-header')).toBeVisible();
  const loop = page.locator('#entryLionVideo');
  await expect.poll(() => loop.evaluate(video => !video.paused && video.currentTime > .1)).toBe(true);
  await page.locator('#replayIntro').click();
  await expect(page.locator('#introVideo')).toHaveAttribute('src', /assets\/intro\/entry-intro\.mp4$/);
  await expect(page.locator('.site-header')).toBeHidden();
  await expect(page.locator('.lion-topbar-resize-handle')).toBeHidden();
  await page.locator('#skipIntro').click();
  await expect(page.locator('.site-header')).toBeVisible();
  expect(await header.evaluate(element => element === document.querySelector('.site-header'))).toBe(true);
  await expect(loop).toBeVisible();
  await page.locator('.site-header [data-route="state"]').click();
  await expect.poll(() => loop.evaluate(video => video.paused)).toBe(true);
  await page.locator('.site-header [data-route="entry"]').click();
  await expect(page.locator('#introVideo')).toHaveCount(0);
  await expect.poll(() => loop.evaluate(video => !video.paused)).toBe(true);
  await page.reload();
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45000 });
  await expect(page.locator('#introVideo')).toHaveCount(0);
  await expect(loop).toHaveAttribute('src', /assets\/entry\/home-lion-loop\.mp4$/);
});
