import { test, expect } from '@playwright/test';
import { homeCultureStories } from '../../src/data/home-culture.js';

test.use({ trace: 'off', viewport: { width: 1920, height: 1080 } });
test.setTimeout(120_000);

async function openCulture(page) {
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({
      carouselAutoplay: false, carouselTransitionDuration: 300, bookAutoplay: false,
    }));
  });
  await page.goto('/');
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-ready', 'true');
  await page.evaluate(() => document.fonts.ready);
  const carousel = page.locator('#homeCulture'), gallery = carousel.locator('.culture-depth-gallery');
  await gallery.scrollIntoViewIfNeeded();
  await expect(carousel).not.toHaveAttribute('data-culture-status', 'offscreen');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return { carousel, gallery, action: gallery.getByRole('button', { name: '下一张文化照片', exact: true }) };
}

async function placeGallery(page, gallery) {
  await gallery.evaluate(element => {
    const top = document.querySelector('.site-header').getBoundingClientRect().bottom + 16;
    window.scrollBy({ top: element.getBoundingClientRect().top - top, behavior: 'instant' });
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function galleryInputPoint(page, gallery, xRatio, yRatio) {
  // A new story can move the gallery through document scroll anchoring. Canvas
  // screenshots may scroll it as well, so never reuse an earlier story's box.
  await placeGallery(page, gallery);
  const box = await gallery.boundingBox();
  const point = { x: Math.round(box.x + box.width * xRatio), y: Math.round(box.y + box.height * yRatio) };
  const hit = await gallery.evaluate((element, point) => {
    const canvas = element.querySelector('canvas');
    const decorations = [...element.querySelectorAll('.culture-depth-label, .culture-depth-axis, [data-depth-decoration]')]
      .filter(node => { const box = node.getBoundingClientRect(); return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom; });
    return { canvas: document.elementFromPoint(point.x, point.y) === canvas,
      visible: point.x >= 0 && point.x < innerWidth && point.y >= 0 && point.y < innerHeight,
      decorations: decorations.map(node => node.className) };
  }, point);
  expect(hit).toEqual({ canvas: true, visible: true, decorations: [] });
  return point;
}

async function expectSelection(carousel, index) {
  const story = homeCultureStories[index];
  await expect(carousel).toHaveAttribute('data-culture-index', String(index));
  await expect(carousel.locator('.home-culture-slide.is-active')).toHaveAttribute('data-culture-id', story.id);
  await expect(carousel.locator('.is-active .home-culture-title')).toHaveText(story.title);
  await expect(carousel.locator('.is-active .home-culture-photo')).toHaveAttribute('alt', story.photo.alt);
}

async function stableCanvas(page, canvas) {
  await page.mouse.move(1800, 100);
  let previous, final;
  await expect.poll(async () => {
    final = await canvas.screenshot({ style: '.home-archive-scene { background-image: none !important; }' });
    const settled = previous?.equals(final) ?? false;
    previous = final;
    return settled;
  }, { timeout: 5000, intervals: [100] }).toBe(true);
  return final;
}

test('1920/900/640电脑图库右侧后排和余白一次只切一张，前景仍可点且图文画布同步', async ({ page }, testInfo) => {
  const { carousel, gallery, action } = await openCulture(page);
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
  const canvas = gallery.locator('canvas'), original = await canvas.elementHandle();
  let selected = 0;
  for (const [width, height] of [[1920, 1080], [900, 700], [640, 480]]) {
    await page.setViewportSize({ width, height });
    await placeGallery(page, gallery);
    const before = await stableCanvas(page, canvas);
    const rear = await galleryInputPoint(page, gallery, .88, .5);
    const front = await action.boundingBox();
    // Back-row photographs remain visible outside the front photograph's
    // normal DOM footprint. This is a real canvas hit, not the hidden button.
    expect(rear.x).toBeGreaterThan(front.x + front.width + 5);
    await page.mouse.move(rear.x, rear.y);
    await expect(carousel).toHaveAttribute('data-culture-focused', 'false');
    await page.mouse.click(rear.x, rear.y);
    selected = (selected + 1) % homeCultureStories.length;
    await expectSelection(carousel, selected);
    const after = await stableCanvas(page, canvas);
    expect(after.equals(before)).toBe(false);
    await expectSelection(carousel, selected);
    await testInfo.attach(`after-right-photo-${width}`, { body: after, contentType: 'image/png' });
    // Above the photographs (whose normal height is at most 78% of the
    // gallery), the right strip also accepts the user's requested blank area.
    const blank = await galleryInputPoint(page, gallery, .98, .05);
    await page.mouse.click(blank.x, blank.y);
    selected = (selected + 1) % homeCultureStories.length;
    await expectSelection(carousel, selected);
    await expect(carousel).toHaveAttribute('data-culture-focused', 'false');
    await stableCanvas(page, canvas);
    await expectSelection(carousel, selected);
    // The central foreground still advances exactly one with a real pointer.
    const foreground = await galleryInputPoint(page, gallery, .42, .5);
    await page.mouse.click(foreground.x, foreground.y);
    selected = (selected + 1) % homeCultureStories.length;
    await expectSelection(carousel, selected);
    await stableCanvas(page, canvas);
    await expectSelection(carousel, selected);
    expect(await original.evaluate(element => element === document.querySelector('.culture-depth-canvas'))).toBe(true);
  }
});

test('图鉴外文字、图注来源链接及画面上下装饰不误触下一张', async ({ page }) => {
  const { carousel, gallery } = await openCulture(page);
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
  const current = await carousel.getAttribute('data-culture-index');
  await carousel.locator('.is-active .home-culture-copy .home-culture-text').click();
  await expect(carousel).toHaveAttribute('data-culture-index', current);
  await gallery.scrollIntoViewIfNeeded();
  const galleryBox = await gallery.boundingBox();
  await page.mouse.click(galleryBox.x + galleryBox.width * .005, galleryBox.y + galleryBox.height * .5);
  await expect(carousel).toHaveAttribute('data-culture-index', current);
  for (const selector of ['.culture-depth-label', '.culture-depth-axis']) {
    const box = await gallery.locator(selector).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(carousel).toHaveAttribute('data-culture-index', current);
  }
  const link = carousel.locator('.is-active .home-culture-credit a').first();
  const href = await link.getAttribute('href');
  // Preserve the actual link click and popup while keeping this local input
  // regression independent from the availability of a third-party website.
  await page.context().route(href, route => route.fulfill({ status: 200, contentType: 'text/plain', body: 'Reference link fixture' }));
  const opened = page.waitForEvent('popup');
  await link.click();
  const popup = await opened;
  await expect(popup).toHaveURL(href);
  await popup.close();
  await expect(carousel).toHaveAttribute('data-culture-index', current);
  const source = carousel.locator('.is-active .heritage-links a').first();
  const sourceHref = await source.getAttribute('href');
  await page.context().route(sourceHref, route => route.fulfill({ status: 200, contentType: 'text/plain', body: 'Source link fixture' }));
  const sourceOpened = page.waitForEvent('popup');
  await source.click();
  const sourcePopup = await sourceOpened;
  await expect(sourcePopup).toHaveURL(sourceHref);
  await sourcePopup.close();
  await expect(carousel).toHaveAttribute('data-culture-index', current);
});

for (const mode of ['reduced-motion', 'unavailable-webgl']) {
  test(`${mode}保留静态照片按钮，鼠标和键盘每次只切一张且来源正确`, async ({ page }) => {
    if (mode === 'reduced-motion') await page.emulateMedia({ reducedMotion: 'reduce' });
    else await page.addInitScript(() => {
      const native = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return /webgl/.test(type) ? null : native.call(this, type, ...args);
      };
    });
    const { carousel, gallery, action } = await openCulture(page);
    await expect(gallery).toHaveAttribute('data-depth-state', mode === 'reduced-motion' ? 'static' : 'fallback');
    await action.click();
    await expectSelection(carousel, 1);
    const blank = await galleryInputPoint(page, gallery, .98, .05);
    await page.mouse.click(blank.x, blank.y);
    await expectSelection(carousel, 2);
    await action.focus();
    await action.press('Enter');
    await expectSelection(carousel, 3);
    await expect(carousel.locator('.is-active .home-culture-photo')).toBeVisible();
    await expect(carousel.locator('.is-active .home-culture-credit a')).toHaveCount(2);
  });
}
