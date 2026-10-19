import { test, expect } from '@playwright/test';

async function open(page, width = 1920, height = 1080) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => {
    if (window !== top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, navigationTypographyVersion: 2 }));
  });
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45000 });
}

test('archive uses the supplied proportionate background and mounted five-section rail', async ({ page }) => {
  await open(page);
  const scene = page.locator('.home-archive-scene');
  await expect(scene).toHaveAttribute('style', /home-archive-ink-2026-10-20\.png/);
  await expect(scene.locator('.archive-background-layer')).toHaveCount(3);
  await page.locator('#homeLionBook').scrollIntoViewIfNeeded();
  await expect(page.getByRole('navigation', { name: '首页章节导航' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '首页章节导航' }).getByRole('button')).toHaveCount(5);
});

test('paper texture follows opacity and only approved small ornaments replace repeated brand mascots', async ({ page }) => {
  await open(page);
  const panel = page.locator('[data-surface="bookTitle"]');
  const texture = () => panel.evaluate(el => ({ image: getComputedStyle(el, '::after').backgroundImage, opacity: getComputedStyle(el, '::after').opacity }));
  expect((await texture()).image).toContain('home-archive-ink-2026-10-20.png');
  expect(Number((await texture()).opacity)).toBeGreaterThan(0);
  await panel.evaluate(el => el.style.setProperty('--surface-opacity', '0'));
  expect(Number((await texture()).opacity)).toBe(0);
  const ornaments = page.locator('.home-archive-scene .lion-archive-ornament img, .home-culture-sources-emblem img');
  await expect(ornaments).toHaveCount(6);
  for (const image of await ornaments.all()) {
    await expect(image).toHaveAttribute('src', /archive-ornament-(peeking|paw|tail)\.png$/);
    const box = await image.boundingBox();
    expect(box.width).toBeLessThanOrEqual(48);
    expect(box.height).toBeLessThanOrEqual(48);
  }
});

test('decorative microcopy is removed while sources and centralized provenance remain usable', async ({ page }) => {
  await open(page);
  await expect(page.locator('.lion-book-overline, .home-culture-overline, .lion-book-figure-meta, .lion-book-provenance')).toHaveCount(0);
  const sources = page.locator('#homeCultureSources');
  await sources.getByText('图像说明与工程许可', { exact: true }).click();
  await expect(sources.getByRole('link', { name: /ThreeUI/ })).toHaveAttribute('href', /threeui-LICENSE/);
  await expect(sources).toContainText('AI辅助');
  await expect(sources.getByRole('link', { name: /照片来源/ })).toHaveCount(6);
  await sources.getByText('摄影署名与许可', { exact: true }).click();
  await expect(sources.locator('.home-culture-photo-license')).toHaveCount(8);
});

test('desktop archive reserves the rail without overflow or displaced centered title', async ({ page }) => {
  await open(page);
  for (const [width, height] of [[1920,1080], [2560,1440], [1366,768], [1024,768], [900,768]]) {
    await page.setViewportSize({ width, height });
    await page.locator('#homeLionBook').scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator('.home-archive-scene').evaluate(el => {
      const title = el.querySelector('#lion-book-title').getBoundingClientRect();
      const panel = el.querySelector('[data-surface="bookTitle"]').getBoundingClientRect();
      const rail = document.querySelector('.home-archive-nav').getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > innerWidth + 1, overlap: panel.left < rail.right, centered: Math.abs(title.left + title.width / 2 - panel.left - panel.width / 2) < 2 };
    })).toEqual({ overflow: false, overlap: false, centered: true });
  }
});

test('resizing during a smooth sidebar jump still lands below the fixed header', async ({ page }) => {
  await open(page, 1600, 900);
  await page.locator('#homeLionBook').evaluate(el => scrollTo({ top: scrollY + el.getBoundingClientRect().top - 90, behavior: 'instant' }));
  const nav = page.getByRole('navigation', { name: '首页章节导航' });
  await expect(nav).toBeVisible();
  await nav.getByRole('button', { name: '传承人物', exact: true }).click();
  await page.waitForTimeout(120);
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector('#inheritors-title').getBoundingClientRect().top - document.querySelector('.site-header').getBoundingClientRect().bottom - 24))).toBeLessThan(3);
  await expect(nav.getByRole('button', { name: '传承人物', exact: true })).toHaveAttribute('aria-current', 'location');
});

test('Escape from the end of a long type description restores a visible image focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 900, 768);
  const section = page.locator('#homeLionTypes');
  const image = section.getByRole('button', { name: '展开佛山狮介绍', exact: true });
  await image.click();
  const source = section.locator('.heritage-type-copy a').last();
  await source.focus();
  await source.press('Escape');
  await expect(image).toBeFocused();
  await expect.poll(() => image.evaluate(el => {
    const rect = el.getBoundingClientRect(), header = document.querySelector('.site-header').getBoundingClientRect();
    return rect.top >= header.bottom + 12 && rect.bottom <= innerHeight - 12;
  })).toBe(true);
});

test('all main heritage observations and contributions meet the readable 18px minimum', async ({ page }) => {
  await open(page, 900, 768);
  const sizes = await page.locator('.heritage-observations p, .heritage-relation p, .heritage-contributions, .heritage-form-note article p').evaluateAll(nodes => nodes.map(el => parseFloat(getComputedStyle(el).fontSize)));
  expect(sizes.length).toBeGreaterThan(5);
  for (const size of sizes) expect(size).toBeGreaterThanOrEqual(18);
});

test('switching to reduced motion immediately disconnects the visible book observer without scrolling', async ({ page }) => {
  await open(page);
  const nav = page.locator('.lion-book-timeline');
  await nav.scrollIntoViewIfNeeded();
  await expect(nav).toHaveAttribute('data-observing', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(nav).toHaveAttribute('data-observing', 'false');
  await expect(nav).toHaveAttribute('data-playing', 'false');
});
