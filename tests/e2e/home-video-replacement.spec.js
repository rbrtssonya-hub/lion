import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1920, height: 1080 } });

test('new entry plays to its natural end, then the new home clip really loops', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => {
    if (window !== top) return;
    sessionStorage.clear();
    window.homeMediaEvents = [];
    for (const type of ['playing', 'ended']) document.addEventListener(type, e => {
      if (e.target instanceof HTMLVideoElement) homeMediaEvents.push({ type, id: e.target.id, time: e.target.currentTime });
    }, true);
  });
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45000 });
  const intro = page.locator('#introVideo');
  await expect(intro).toHaveAttribute('src', /assets\/intro\/entry-intro\.mp4$/);
  const metadata = await intro.evaluate(video => ({ width: video.videoWidth, height: video.videoHeight, duration: video.duration, loop: video.loop, muted: video.muted }));
  expect(metadata).toMatchObject({ width: 2560, height: 1440, loop: false, muted: true });
  expect(metadata.duration).toBeCloseTo(6.584, 2);
  await testInfo.attach('entry-1920', { body: await page.screenshot(), contentType: 'image/png' });
  await expect(page.locator('#entryLionVideo')).toBeVisible({ timeout: 20000 });
  expect(await page.evaluate(() => homeMediaEvents.some(e => e.id === 'introVideo' && e.type === 'ended' && e.time > 6.5))).toBe(true);
  const loop = page.locator('#entryLionVideo');
  await expect.poll(() => loop.evaluate(video => video.readyState)).toBeGreaterThanOrEqual(2);
  expect(await loop.evaluate(video => ({ width: video.videoWidth, height: video.videoHeight, loop: video.loop, muted: video.muted }))).toEqual({ width: 2560, height: 1440, loop: true, muted: true });
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
  await page.locator('#skipIntro').click();
  const loop = page.locator('#entryLionVideo');
  await expect.poll(() => loop.evaluate(video => !video.paused && video.currentTime > .1)).toBe(true);
  await page.locator('#replayIntro').click();
  await expect(page.locator('#introVideo')).toHaveAttribute('src', /assets\/intro\/entry-intro\.mp4$/);
  await page.locator('#skipIntro').click();
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
