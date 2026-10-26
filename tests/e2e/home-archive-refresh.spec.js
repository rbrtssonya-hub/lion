import { test, expect } from '@playwright/test';
import { expectExhibitFrame, selectHomeExhibit } from './home-exhibit.helpers.js';

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

test('archive uses the supplied proportionate background and mounted four-section rail', async ({ page }) => {
  await open(page);
  const scene = page.locator('.home-archive-scene');
  await expect(scene).toHaveAttribute('style', /home-archive-ink-2026-10-20\.png/);
  await expect(scene.locator('.archive-background-layer')).toHaveCount(3);
  await selectHomeExhibit(page);
  await expect(page.getByRole('navigation', { name: '首页章节导航' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '首页章节导航' }).locator('[data-home-section]')).toHaveCount(4);
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
  await expect(ornaments).toHaveCount(4);
  for (const image of await ornaments.all()) {
    await expect(image).toHaveAttribute('src', /archive-ornament-(peeking|paw|tail)\.png$/);
    const id = await image.evaluate(node => node.closest('.home-archive-panel').querySelector('[id]').id);
    await selectHomeExhibit(page, id);
    const box = await image.boundingBox();
    expect(box.width).toBeLessThanOrEqual(48);
    expect(box.height).toBeLessThanOrEqual(48);
  }
});

test('decorative microcopy is removed while sources and centralized provenance remain usable', async ({ page }) => {
  await open(page);
  await expect(page.locator('.lion-book-overline, .home-culture-overline, .lion-book-figure-meta, .lion-book-provenance')).toHaveCount(0);
  const sources = page.locator('#homeCultureSources');
  await selectHomeExhibit(page, 'homeCultureSources');
  await expect(sources.getByRole('link', { name: /ThreeUI/ })).toHaveAttribute('href', /threeui-LICENSE/);
  await expect(sources).toContainText('AI辅助');
  await expect(sources.getByRole('link', { name: /照片来源/ })).toHaveCount(0);
  await expect(sources.getByRole('heading', { name: '人物资料', exact: true })).toHaveCount(0);
  await expect(sources.locator('details')).toHaveCount(0);
  await expect(sources.locator('.home-culture-photo-license')).toHaveCount(8);
});

test('desktop archive reserves the rail and contains the compact title without overflow', async ({ page }) => {
  await open(page);
  for (const [width, height] of [[1920,1080], [2560,1440], [1366,768], [1024,768], [900,768]]) {
    await page.setViewportSize({ width, height });
    await selectHomeExhibit(page);
    await expect.poll(() => page.locator('.home-archive-scene').evaluate(el => {
      const title = el.querySelector('#lion-book-title').getBoundingClientRect();
      const panel = el.querySelector('[data-surface="bookTitle"]').getBoundingClientRect();
      const rail = document.querySelector('.home-archive-nav').getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > innerWidth + 1, overlap: panel.left < rail.right,
        contained: title.left >= panel.left - 1 && title.right <= panel.right + 1 };
    })).toEqual({ overflow: false, overlap: false, contained: true });
  }
});

test('resizing during a smooth sidebar jump still lands below the fixed header', async ({ page }) => {
  await open(page, 1600, 900);
  await selectHomeExhibit(page);
  const nav = page.getByRole('navigation', { name: '首页章节导航' });
  await expect(nav).toBeVisible();
  await nav.getByRole('button', { name: '醒狮种类', exact: true }).click();
  await page.waitForTimeout(120);
  await page.setViewportSize({ width: 1024, height: 900 });
  await expectExhibitFrame(page, 'homeLionTypes');
  await expect(nav.getByRole('button', { name: '醒狮种类', exact: true })).toHaveAttribute('aria-current', 'location');
});

test('Escape from shape comparison restores a visible mode control and the direct basic reading', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 900, 768);
  const section = page.locator('#homeLionTypes');
  await selectHomeExhibit(page, 'homeLionTypes');
  const image = section.getByRole('button', { name: '对照佛山狮形制', exact: true });
  await image.click();
  const source = section.locator('.heritage-comparison-card a').last();
  await source.focus();
  await source.press('Escape');
  const mode = section.getByRole('button', { name: '形制对照', exact: true });
  await expect(mode).toBeFocused();
  await expect(section.locator('.heritage-summary')).toBeVisible();
  await expect.poll(() => mode.evaluate(el => {
    const rect = el.getBoundingClientRect(), header = document.querySelector('.site-header').getBoundingClientRect();
    return rect.top >= header.bottom + 12 && rect.bottom <= innerHeight - 12;
  })).toBe(true);
});

test('all retained type observations and performance descriptions remain readable in the one-screen layout', async ({ page }) => {
  await open(page, 1366, 768);
  const types = page.locator('#homeLionTypes');
  await selectHomeExhibit(page, 'homeLionTypes');
  for (const name of ['佛山狮', '鹤山狮', '佛鹤狮']) {
    await types.getByRole('tab', { name: new RegExp(name) }).click();
    const paragraphs = types.locator('.heritage-observations p, .heritage-form-note article p');
    await expect(paragraphs).toHaveCount(5);
    const sizes = await paragraphs.evaluateAll(nodes => nodes.map(el => parseFloat(getComputedStyle(el).fontSize)));
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(14);
    for (const size of await types.locator('.heritage-observations p').evaluateAll(nodes => nodes.map(el => parseFloat(getComputedStyle(el).fontSize)))) expect(size).toBeGreaterThanOrEqual(16);
    for (const paragraph of await paragraphs.all()) await expect(paragraph).toBeInViewport({ ratio: 1 });
  }
});

test('switching to reduced motion immediately disconnects the visible book observer without scrolling', async ({ page }) => {
  await open(page);
  const nav = page.locator('.lion-book-timeline');
  await selectHomeExhibit(page);
  await expect(nav).toHaveAttribute('data-observing', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(nav).toHaveAttribute('data-observing', 'false');
  await expect(nav).toHaveAttribute('data-playing', 'false');
});
