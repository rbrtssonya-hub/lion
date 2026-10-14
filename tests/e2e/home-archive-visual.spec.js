import { test, expect } from '@playwright/test';

async function openArchive(page) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    if (window === window.top) {
      sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
      sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    }
  });
  await page.goto('/');
  await page.locator('#homeLionBook').scrollIntoViewIfNeeded();
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-ready', 'true');
  await page.evaluate(() => document.fonts.ready);
}

test('书册与文化图鉴实际解码同一醒狮背景，首屏视频不被替换', async ({ page }) => {
  await openArchive(page);
  const scene = page.locator('.home-archive-scene');
  await expect(scene).toHaveCount(1, { timeout: 1500 });
  const background = await scene.evaluate(async element => {
    const css = getComputedStyle(element);
    const url = css.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
    const image = new Image();
    image.src = url;
    await image.decode();
    return { url, width: image.naturalWidth, height: image.naturalHeight, filter: css.filter,
      bookInside: element.contains(document.querySelector('#homeLionBook')),
      cultureInside: element.contains(document.querySelector('#homeCulture')) };
  });
  expect(new URL(background.url).pathname).toMatch(/\/assets\/backgrounds\/home-archive-background\.png$/);
  expect(background).toMatchObject({ width: 1536, height: 2048, filter: 'none', bookInside: true, cultureInside: true });
  expect(background.url).not.toContain('/assets/assets/');
  for (const selector of ['#homeLionBook', '#homeCulture']) {
    const painted = await page.locator(selector).evaluate(element => getComputedStyle(element).backgroundColor);
    expect(painted).toBe('rgba(0, 0, 0, 0)');
  }
  await expect(page.locator('#entryLionVideo')).toHaveAttribute('src', /home-lion-loop\.mp4$/);
  await expect(page.locator('.entry-gate .home-archive-scene')).toHaveCount(0);
  await expect(page.locator('.site-header [data-route="entry"]')).toHaveAttribute('aria-current', 'page');
});

test('醒狮装饰和文字在电脑宽度及900px推开空间内完整可读，不遮挡书页交互', async ({ page }) => {
  await openArchive(page);
  for (const [width, height] of [[1024, 768], [1366, 768], [1920, 1080], [2560, 1440], [1255, 900]]) {
    await page.setViewportSize({ width, height });
    if (width === 1255) {
      await page.locator('.site-header [data-action="settings"]').click();
      await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
    }
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const layout = await page.locator('#homeLionBook').evaluate(section => {
      const box = selector => {
        const rect = section.querySelector(selector).getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      };
      const head = section.querySelector('.lion-book-heading');
      const ornament = head.querySelector('.lion-archive-ornament');
      return {
        title: box('h2'), preface: box('.lion-book-preface'), heading: box('.lion-book-heading'), stage: box('.lion-book-stage'),
        pageRight: section.closest('.site-page').getBoundingClientRect().right,
        scroll: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth,
        bodyFont: parseFloat(getComputedStyle(section.querySelector('.lion-book-reading-copy>p')).fontSize),
        ornamentsReady: [...section.querySelectorAll('.lion-archive-ornament img')].every(image => image.complete && image.naturalWidth > 0),
        ornamentHidden: ornament?.getAttribute('aria-hidden'),
      };
    });
    expect(layout.title.right).toBeLessThanOrEqual(layout.preface.left);
    expect(layout.preface.right).toBeLessThanOrEqual(layout.pageRight);
    expect(layout.heading.bottom).toBeLessThanOrEqual(layout.stage.top);
    expect(layout.scroll).toBeLessThanOrEqual(layout.viewport);
    expect(layout.bodyFont).toBeGreaterThanOrEqual(16);
    expect(layout.ornamentHidden).toBe('true');
    expect(layout.ornamentsReady).toBe(true);
  }
  const book = page.locator('.lion-book-experience');
  await book.locator('[data-book-page="formation"]').click();
  await expect(book).toHaveAttribute('data-book-index', '2');
  await expect(book.locator('.lion-book-reading h3')).toHaveText('南狮形成 · 民间技艺');
  await expect(book.locator('.lion-book-reading-copy>a').first()).toHaveAttribute('href', 'https://www.gzsqw.org.cn/c/sdfzpc/gfwh/2861.jhtml');
  await page.locator('#homeCulture').scrollIntoViewIfNeeded();
  await expect(page.locator('#homeCulture .lion-archive-ornament')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#homeCulture .is-active .home-culture-credit')).toContainText('摄影：');
});
