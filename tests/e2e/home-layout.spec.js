import { test, expect } from '@playwright/test';

const viewports = [[1920, 1080], [1440, 960], [414, 896], [390, 844], [375, 812]];

for (const [width, height] of viewports) {
  test(`首页在 ${width}×${height} 下完整显示标题、文案与五个入口`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.entry-title-art')).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(image => image.decode()));
    });

    const layout = await page.evaluate(() => {
      const box = element => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      };
      const selectors = ['.entry-header', '.entry-title-art', '.entry-motto', '.entry-english', '.entry-cta', '.entry-bottom-nav'];
      const boxes = Object.fromEntries(selectors.map(selector => [selector, box(document.querySelector(selector))]));
      return {
        scrollWidth: document.documentElement.scrollWidth,
        boxes,
        content: [...document.querySelectorAll('.entry-bottom-item')].map(item =>
          [item, ...item.querySelectorAll('.entry-icon, b, strong, small')].map(box)),
      };
    });
    expect(layout.scrollWidth).toBeLessThanOrEqual(width);
    for (const bounds of Object.values(layout.boxes)) {
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
    }
    const { boxes } = layout;
    for (const [upper, lower] of [
      ['.entry-header', '.entry-title-art'], ['.entry-title-art', '.entry-motto'],
      ['.entry-motto', '.entry-english'], ['.entry-english', '.entry-cta'],
      ['.entry-cta', '.entry-bottom-nav'],
    ]) expect(boxes[upper].y + boxes[upper].height).toBeLessThanOrEqual(boxes[lower].y + 1);
    const bottom = boxes['.entry-bottom-nav'];
    for (const content of layout.content) for (const bounds of content) {
      expect(bounds.y).toBeGreaterThanOrEqual(bottom.y);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    }
    await expect(page.locator('.entry-motto')).toHaveText('广府醒狮的结构、动作与神态');
    await expect(page.getByRole('button', { name: '进入醒狮档案', exact: true })).toBeInViewport();
    await expect(page.locator('.entry-bottom-item')).toHaveCount(5);
    for (const item of await page.locator('.entry-bottom-item').all()) await expect(item).toBeInViewport();
    await page.screenshot({ path: test.info().outputPath(`home-${width}x${height}.png`), fullPage: true });
  });
}

test('首页视频加载失败保留封面，重试后恢复静音循环播放', async ({ page }) => {
  await page.route('**/assets/entry/home-lion-loop.mp4', route => route.abort('failed'));
  await page.goto('/');
  const video = page.locator('#entryLionVideo');
  await expect(page.locator('.video-status')).toContainText('视频暂时无法播放');
  expect(await video.evaluate(video => ({
    poster: video.poster.endsWith('/assets/entry/home-cover.png'),
    autoplay: video.autoplay, loop: video.loop, muted: video.muted, playsInline: video.playsInline,
  }))).toEqual({ poster: true, autoplay: true, loop: true, muted: true, playsInline: true });
  await page.unroute('**/assets/entry/home-lion-loop.mp4');
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.locator('.video-status')).toHaveCount(0);
  await expect.poll(() => video.evaluate(video => video.readyState)).toBeGreaterThanOrEqual(2);
  await expect.poll(() => video.evaluate(video => !video.paused)).toBe(true);
});
