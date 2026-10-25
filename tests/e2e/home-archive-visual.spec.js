import { test, expect } from '@playwright/test';
import { expectExhibitFrame, selectHomeExhibit } from './home-exhibit.helpers.js';

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
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45000 });
  await selectHomeExhibit(page);
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-ready', 'true');
  await page.evaluate(() => document.fonts.ready);
}

test('书册与文化图鉴实际解码同一醒狮背景，首屏视频不被替换', async ({ page }) => {
  await openArchive(page);
  const scene = page.locator('.home-archive-scene');
  await expect(scene).toHaveCount(1, { timeout: 1500 });
  const background = await scene.evaluate(async element => {
    const css = getComputedStyle(element);
    const url = getComputedStyle(element.querySelector('.archive-background-layer')).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
    const image = new Image();
    image.src = url;
    await image.decode();
    return { url, width: image.naturalWidth, height: image.naturalHeight, filter: css.filter,
      bookInside: element.contains(document.querySelector('#homeLionBook')),
      cultureInside: element.contains(document.querySelector('#homeCulture')) };
  });
  expect(new URL(background.url).pathname).toMatch(/\/assets\/backgrounds\/home-archive-ink-2026-10-20\.png$/);
  expect(background).toMatchObject({ width: 1152, height: 2048, filter: 'none', bookInside: true, cultureInside: true });
  expect(background.url).not.toContain('/assets/assets/');
  for (const selector of ['#homeLionBook', '#homeCulture']) {
    const painted = await page.locator(selector).evaluate(element => getComputedStyle(element).backgroundColor);
    expect(painted).toBe('rgba(0, 0, 0, 0)');
  }
  await expect(page.locator('#entryLionVideo')).toHaveAttribute('src', /home-lion-loop\.mp4$/);
  await expect(page.locator('.entry-gate .home-archive-scene')).toHaveCount(0);
  await expect(page.locator('.site-header [data-route="entry"]')).toHaveAttribute('aria-current', 'page');
});

test('独立展区不再跨区叠放探头装饰，四个一屏和完整许可均可通过侧栏访问', async ({ page }) => {
  await openArchive(page);
  await expect(page.locator('.home-archive-peek, .home-archive-next')).toHaveCount(0);
  for (const [width, height] of [[1366, 768], [1920, 1080], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    for (const id of ['homeLionBook', 'homeCulture', 'homeLionTypes', 'homeCultureSources']) {
      const section = await selectHomeExhibit(page, id);
      await expectExhibitFrame(page, id);
      await expect(page.locator('.home-archive-panel').filter({ visible: true })).toHaveCount(1);
      await expect(section.locator('h2').first()).toBeInViewport();
      expect(await section.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    }
  }
  const provenance = page.locator('.archive-provenance');
  await expect(page.locator('#homeCultureSources details')).toHaveCount(0);
  await expect(provenance).toContainText('历史或实物鉴定证据');
  await expect(provenance.locator('a[href*="threeui-"]')).toHaveCount(2);
  await expect(provenance.getByRole('link', { name: /ThreeUI/ })).toHaveAttribute('href', /threeui-LICENSE\.txt$/);
  await expect(provenance.getByRole('link', { name: '字体许可' })).toHaveAttribute('href', /threeui-FONT-LICENSES\.txt$/);
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
        ornamentCount: head.querySelectorAll('.lion-archive-ornament').length,
      };
    });
    expect(layout.title.bottom <= layout.preface.top + 1 || layout.title.right <= layout.preface.left + 1).toBe(true);
    expect(layout.preface.right).toBeLessThanOrEqual(layout.pageRight);
    expect(layout.heading.bottom).toBeLessThanOrEqual(layout.stage.top);
    expect(layout.scroll).toBeLessThanOrEqual(layout.viewport);
    expect(layout.bodyFont).toBeGreaterThanOrEqual(16);
    expect(layout.ornamentCount).toBe(0);
    expect(layout.ornamentsReady).toBe(true);
  }
  await page.getByRole('region', { name: '开发者参数设置' }).getByRole('button', { name: '保存设置', exact: true }).click();
  await selectHomeExhibit(page);
  const book = page.locator('.lion-book-experience');
  await book.locator('[data-book-page="formation"]').click();
  await expect(book).toHaveAttribute('data-book-index', '2');
  await expect(book.locator('.lion-book-reading h3')).toHaveText('南狮形成 · 民间技艺');
  await expect(book.locator('.lion-book-reading-copy>a').first()).toHaveAttribute('href', 'https://www.gzsqw.org.cn/c/sdfzpc/gfwh/2861.jhtml');
  await selectHomeExhibit(page, 'homeCulture');
  await expect(page.locator('#homeCulture .lion-archive-ornament')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#homeCulture .is-active .home-culture-credit')).toContainText('摄影：');
});
