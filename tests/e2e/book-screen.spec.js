import { test, expect } from '@playwright/test';

test.use({ trace: 'off' });

test('首页出现即通过BODY进入画册，不预等书册ready且初始化不报错', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ bookAutoplay: false, carouselAutoplay: false }));
  });
  const errors = [], failedRequests = [], pageRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('request', request => { if (request.url().includes('/assets/lion-book/')) pageRequests.push(request.url()); });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#enterWork')).toBeVisible();
    // This input deliberately precedes all book readiness/font/startup waits.
    await page.keyboard.press('PageDown');
    await expect(page.locator('.home-archive-nav')).toBeVisible();
    await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-ready', 'true');
    await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-error', 'false');
    await page.locator('[data-book-page="origin"]').click();
    await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-index', '1');
    expect(errors).toEqual([]);
    expect(failedRequests.filter(request => request.url.includes('/assets/lion-book/'))).toEqual([]);
  } finally {
    await testInfo.attach('early-book-initialization', { body: JSON.stringify({ errors, failedRequests, pageRequests }, null, 2), contentType: 'application/json' });
  }
});

test('真实书页内向上滚轮直接返回首页，不停在画册与首页之间', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ bookAutoplay: false, carouselAutoplay: false }));
  });
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45000 });
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-ready', 'true');
  await page.locator('#enterWork').click();
  await expect(page.locator('.home-archive-nav')).toBeVisible();
  const stage = await page.locator('.lion-book-stage').boundingBox();
  await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
  const archiveY = await page.evaluate(() => scrollY);
  await page.mouse.wheel(120, -40);
  await page.waitForTimeout(150);
  expect(Math.abs(await page.evaluate(() => scrollY) - archiveY)).toBeLessThan(2);
  await page.mouse.wheel(0, -80);
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 3000 }).toBeLessThan(2);
  await expect(page.locator('.home-archive-nav')).toBeHidden();
  await expect(page.locator('.home-exhibit')).toHaveAttribute('data-open', 'false');
});

test('放大画册真实拖拽保留18层双面卷曲、短拖取消及正反翻页', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ bookAutoplay: false, carouselAutoplay: false }));
  });
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45000 });
  const book = page.locator('.lion-book-experience');
  await expect(book).toHaveAttribute('data-book-ready', 'true');
  await page.locator('#enterWork').click();
  await expect(page.locator('.home-archive-nav')).toBeVisible();
  const frame = page.frameLocator('#homeLionBook iframe');
  const dragPaper = async (direction, fraction, release = true) => {
    const box = await frame.locator('#sbBook').boundingBox();
    const start = box.x + box.width * (direction === 'next' ? .88 : .12);
    const y = box.y + box.height * .56;
    await page.mouse.move(start, y);
    await page.waitForTimeout(150);
    await page.mouse.down();
    const endX = start + box.width * fraction * (direction === 'next' ? -1 : 1);
    await page.mouse.move(endX, y, { steps: 18 });
    if (release) await page.mouse.up();
    return { endX, y };
  };
  const short = await dragPaper('next', .15, false);
  await expect(frame.locator('.curl .strip')).toHaveCount(18);
  await expect(frame.locator('.curl .face.front')).toHaveCount(18);
  await expect(frame.locator('.curl .face.back')).toHaveCount(18);
  expect(await frame.locator('body').evaluate(() => Boolean(drag))).toBe(true);
  // A short drag cancels only after releasing its flick velocity, as in the
  // original paper-engine regression; a quick flick is allowed to commit.
  await page.waitForTimeout(160);
  await page.mouse.move(short.endX, short.y);
  await page.mouse.up();
  await expect.poll(() => frame.locator('body').evaluate(() => ({ index: idx, dragging: Boolean(drag), turning: Boolean(turn) })))
    .toEqual({ index: 0, dragging: false, turning: false });
  await expect(book).toHaveAttribute('data-book-index', '0');
  await expect(book).toHaveAttribute('data-book-turning', 'false');
  await dragPaper('next', .57);
  await expect(book).toHaveAttribute('data-book-index', '1');
  await expect(book).toHaveAttribute('data-book-turning', 'false');
  await dragPaper('previous', .57);
  await expect(book).toHaveAttribute('data-book-index', '0');
  await expect(book).toHaveAttribute('data-book-turning', 'false');
  await expect(frame.locator('.curl .strip')).toHaveCount(0);
});

for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768]]) {
  test(`画册${width}×${height}完整纸面、七站导航与正文同屏且外边界对齐`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      if (window !== window.top) return;
      sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
      localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ bookAutoplay: false, carouselAutoplay: false }));
    });
    await page.goto('/');
    await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45000 });
    await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-ready', 'true');
    await page.evaluate(() => document.fonts.ready);
    await page.locator('#enterWork').click();
    await expect.poll(() => page.locator('#homeLionBook').evaluate(section => {
      const header = document.querySelector('.site-header').getBoundingClientRect();
      return Math.abs(section.getBoundingClientRect().top - header.bottom);
    })).toBeLessThan(3);
    const frame = page.frameLocator('#homeLionBook iframe');
    const screen = async () => {
      const layout = await page.evaluate(() => {
        const box = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
        const selectors = ['.lion-book-heading', '.lion-book-stage', '.lion-book-timeline', '.lion-book-reading'];
        const blocks = selectors.map(selector => ({ selector, ...box(selector) }));
        const paragraph = document.querySelector('.lion-book-reading-copy>p');
        const copy = document.querySelector('.lion-book-reading');
        const range = document.createRange(); range.selectNodeContents(paragraph);
        return { blocks, header: box('.site-header'), section: box('#homeLionBook'),
          text: range.getBoundingClientRect().toJSON(), font: parseFloat(getComputedStyle(paragraph).fontSize),
          readingOverflow: copy.scrollHeight - copy.clientHeight, scrollY, height: innerHeight };
      });
      for (const block of layout.blocks) {
        expect(block.top, block.selector).toBeGreaterThanOrEqual(layout.header.bottom - 1);
        expect(block.bottom, block.selector).toBeLessThanOrEqual(layout.height + 1);
        expect(Math.abs(block.left - layout.blocks[0].left), block.selector).toBeLessThan(2);
        expect(Math.abs(block.right - layout.blocks[0].right), block.selector).toBeLessThan(2);
      }
      expect(layout.font).toBeGreaterThanOrEqual(18);
      expect(layout.text.bottom).toBeLessThanOrEqual(layout.blocks[3].bottom - 5);
      expect(layout.readingOverflow).toBeLessThanOrEqual(1);
      const paper = await frame.locator('#sbBook').evaluate(element => {
        const rect = element.getBoundingClientRect();
        // The upstream paper occupies this region of the transparent artwork.
        return { left: rect.left + rect.width * .051, right: rect.left + rect.width * .949,
          top: rect.top + rect.height * .218, bottom: rect.top + rect.height * .782 };
      });
      const iframe = await page.locator('#homeLionBook iframe').boundingBox();
      // The enlarged navigation reserves 32px more below the paper; the user
      // explicitly permits a slightly smaller book while all reading stays in view.
      expect(paper.right - paper.left).toBeGreaterThanOrEqual({ 1366: 890, 1440: 1100, 1920: 1500 }[width]);
      expect(paper.top + iframe.y).toBeGreaterThanOrEqual(layout.blocks[1].top - 3);
      expect(paper.bottom + iframe.y).toBeLessThanOrEqual(layout.blocks[1].bottom + 3);
      expect(Math.abs(paper.left + iframe.x - layout.blocks[3].left)).toBeLessThan(8);
      expect(Math.abs(paper.right + iframe.x - layout.blocks[3].right)).toBeLessThan(8);
      return layout;
    };
    const initial = await screen();
    const buttons = await page.locator('.lion-book-timeline button').all();
    for (const [index, button] of buttons.entries()) {
      await button.click();
      await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-index', String(index));
      await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-turning', 'false');
      const layout = await screen();
      expect(Math.abs(layout.scrollY - initial.scrollY)).toBeLessThan(2);
    }
    await page.locator('.lion-book-timeline button').first().click();
    await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-index', '0');
    await page.screenshot({ path: testInfo.outputPath(`book-screen-${width}.png`) });
  });
}
