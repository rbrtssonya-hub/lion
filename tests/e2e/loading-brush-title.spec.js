import { test, expect } from '@playwright/test';

test('加载页用透明横排笔刷标题，语义标题、原背景与真实进度消息保留', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/assets/loading/index.html');
  const title = page.getByRole('heading', { name: '南风有狮', exact: true });
  await expect(title).toBeVisible();
  const brush = title.locator('img');
  await expect(brush).toBeVisible();
  expect(await brush.evaluate(img => ({ decoded: img.complete && img.naturalWidth > 0, width: img.naturalWidth, height: img.naturalHeight }))).toEqual({ decoded: true, width: 2172, height: 724 });
  await expect(page.locator('.painting')).toHaveAttribute('src', './painting.png');
  await expect(page.locator('.eyebrow')).toHaveText('THE QUIET ART OF AWAKENING');
  await page.evaluate(() => window.postMessage({ type: 'lion:startup-progress', progress: .45, complete: false, message: '资料准备中' }, location.origin));
  await expect(page.locator('#status')).toHaveText('资料准备中');
  await expect.poll(async () => Number(await page.locator('#progress').getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  expect(Number(await page.locator('#progress').getAttribute('aria-valuenow'))).toBeLessThanOrEqual(45);
});

test('笔刷图片失败时回退到可读真实文字，不显示破图且加载仍可更新', async ({ page }) => {
  await page.route('**/assets/loading/title-ink.png', route => route.abort());
  await page.goto('/assets/loading/index.html');
  const title = page.getByRole('heading', { name: '南风有狮', exact: true });
  await expect(title.locator('img')).not.toBeVisible();
  await expect(title.locator('span')).toBeVisible();
  await expect(title.locator('span')).toHaveText('南风有狮');
  await page.evaluate(() => window.postMessage({ type: 'lion:startup-progress', progress: .2, complete: false, message: '继续准备资源' }, location.origin));
  await expect(page.locator('#status')).toHaveText('继续准备资源');
});

test('电脑窗口下笔刷字稿保持比例且不溢出加载文字区', async ({ page }) => {
  await page.goto('/assets/loading/index.html');
  for (const [width, height] of [[1920,1080],[2560,1440],[1366,768],[1024,768],[900,768],[1920,400],[2560,520]]) {
    await page.setViewportSize({width,height});
    const brush = page.locator('h1 img');
    await expect(brush).toBeVisible();
    const bounds = await page.locator('.center').boundingBox();
    const image = await brush.boundingBox();
    expect(image.x).toBeGreaterThanOrEqual(bounds.x);
    expect(image.x + image.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
    expect(image.width / image.height).toBeCloseTo(3, 1);
    expect(image.y).toBeGreaterThanOrEqual(0);
    const line = await page.locator('.hairline').boundingBox();
    expect(line.y + line.height).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  }
});
