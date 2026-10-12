import { test, expect } from '@playwright/test';

test('首页文化图文可自然向下滚动，照片加载并逐段呈现', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const culture = page.locator('#homeCulture');
  await expect(culture.getByRole('heading', { name: /一头醒狮，\s*一方风土/ })).toBeVisible();
  const stories = culture.locator('.home-culture-story');
  await expect(stories).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight * 1.5)).toBe(true);
  await expect(culture.locator('button, a[href^="#"], a[href*="#/model"], a[href*="#/action"], a[href*="#/state"]')).toHaveCount(0);
  const first = stories.first();
  const before = await first.evaluate((element) => {
    const style = getComputedStyle(element);
    return { opacity: Number(style.opacity), offsetY: style.transform === 'none' ? 0 : new DOMMatrixReadOnly(style.transform).m42 };
  });
  expect(before.opacity < 1 || Math.abs(before.offsetY) > 1).toBe(true);
  await page.mouse.move(960, 80);
  await page.mouse.wheel(0, 850);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);

  for (const story of await stories.all()) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const position = await story.evaluate((element) => ({ top: element.getBoundingClientRect().top, viewport: innerHeight }));
      if (position.top < position.viewport * 0.7) break;
      await page.mouse.wheel(0, 600);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }
    await expect(story).toBeInViewport();
    await expect(story).toHaveClass(/is-visible/);
    await expect.poll(() => story.evaluate((element) => Number(getComputedStyle(element).opacity))).toBe(1);
    await expect.poll(() => story.evaluate((element) => {
      const transform = getComputedStyle(element).transform;
      return transform === 'none' ? 0 : Math.abs(new DOMMatrixReadOnly(transform).m42);
    })).toBeLessThan(1);
    const photo = story.locator('.home-culture-photo');
    await expect(photo).toHaveCount(1);
    await expect(photo).toHaveAttribute('alt', /\S/);
    await expect.poll(() => photo.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(story.locator('p').first()).not.toBeEmpty();
  }
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('home-culture-scrolled.png'), fullPage: true });
});

test('减少动态效果时文化内容立即可读，手机页面仍能自然滚动', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const reveals = page.locator('#homeCulture [data-culture-reveal]');
  expect(await reveals.count()).toBeGreaterThanOrEqual(4);
  await expect.poll(() => reveals.evaluateAll((elements) => elements.every((element) => {
    const style = getComputedStyle(element);
    return Number(style.opacity) === 1 && style.transform === 'none' && style.animationName === 'none';
  }))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight * 1.5)).toBe(true);
  await page.mouse.move(190, 80);
  await page.mouse.wheel(0, 800);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
