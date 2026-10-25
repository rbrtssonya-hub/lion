import { test, expect } from '@playwright/test';
import { returnToHomeHero, selectHomeExhibit } from './home-exhibit.helpers.js';

const settingsKey = 'nanfeng-lion:developer-settings:v1';
const windows = [[640, 360], [675, 403], [640, 480], [800, 600], [1024, 640], [1280, 720], [1366, 768], [1920, 1080], [2560, 1080], [3840, 2160]];
test.use({ trace: 'off' });

async function openHome(page, width, height, saved = {}, intro = false) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(({ key, saved, intro }) => {
    if (window !== top) return;
    if (!intro) sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    localStorage.setItem(key, JSON.stringify({ carouselAutoplay: false, bookAutoplay: false, bookInkEnabled: false, ...saved }));
  }, { key: settingsKey, saved, intro });
  // This suite measures the real home and book. The unrelated model chapter
  // must not spend GPU/memory while a matrix of desktop windows is inspected.
  await page.route('**/lion-user-full.glb', route => route.abort());
  await page.goto('/');
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-ready', 'true', { timeout: 30_000 });
}

async function alignSection(page, id) { await selectHomeExhibit(page, id); }

async function expectTextFits(page) {
  const violations = await page.locator('.home-page').evaluate(root => {
    const errors = [], bounds = root.getBoundingClientRect();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode, element = text.parentElement;
      if (!text.textContent.trim() || element.closest('.sr-only, [hidden], [aria-hidden="true"], svg')) continue;
      if (!element.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
      const range = document.createRange(); range.selectNodeContents(text);
      const paper = element.closest('.archive-reading-panel, .home-culture-source-card, .home-culture-copy, .heritage-copy, .heritage-form-note article, .heritage-source-group, .home-culture-photo-license, .home-culture-sources-heading, .lion-book-reading-title, .lion-book-reading-copy');
      const box = paper?.getBoundingClientRect();
      for (const rect of range.getClientRects()) {
        if (rect.width < 1 || rect.height < 1) continue;
        if (rect.left < bounds.left - 2 || rect.right > bounds.right + 2 || (box && (rect.left < box.left - 2 || rect.right > box.right + 2))) {
          errors.push({ text: text.textContent.trim().slice(0, 60), class: element.className, rect: [rect.left, rect.right], paper: box && [box.left, box.right] });
        }
      }
    }
    return errors;
  });
  expect(violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}

async function expectHomeGeometry(page, height) {
  const hero = await page.locator('.final-home').boundingBox();
  expect(hero.y).toBeCloseTo(0, 0);
  expect(hero.height).toBe(height);
  const header = await page.locator('.site-header').boundingBox();
  for (const selector of ['#enterWork', '.entry-motto', '.entry-english', '#replayIntro']) {
    const rect = await page.locator(selector).boundingBox();
    expect(rect.y, selector).toBeGreaterThanOrEqual(header.height - 1);
    expect(rect.y + rect.height, selector).toBeLessThanOrEqual(height + 1);
  }
  const horizontal = await page.locator('.home-page').evaluate(root => {
    const bounds = root.getBoundingClientRect();
    return ['.entry-title-art', '#enterWork', '.entry-cta-cloud-left', '.entry-cta-cloud-right', '.entry-motto', '.entry-english', '#replayIntro'].map(selector => {
      const rect = root.querySelector(selector).getBoundingClientRect();
      return { selector, left: rect.left, right: rect.right, min: bounds.left, max: bounds.right };
    });
  });
  for (const rect of horizontal) {
    expect(rect.left, rect.selector).toBeGreaterThanOrEqual(rect.min - 1);
    expect(rect.right, rect.selector).toBeLessThanOrEqual(rect.max + 1);
  }
  await page.locator('#enterWork').click();
  await expect(page.locator('.home-archive-nav')).toBeVisible();
  const rail = await page.locator('.home-archive-nav').boundingBox();
  expect(rail.y).toBeGreaterThanOrEqual(header.height - 1);
  expect(rail.y + rail.height).toBeLessThanOrEqual(height + 1);
  const railLabels = await page.locator('.home-archive-nav button span').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
  for (let i = 1; i < railLabels.length; i++) expect(railLabels[i].top).toBeGreaterThanOrEqual(railLabels[i - 1].bottom - 1);
  const stage = await page.locator('.lion-book-stage').boundingBox();
  expect(stage.height).toBeLessThanOrEqual(Math.max(200, height - header.height - 40) + 1);
  const platforms = await page.locator('.lion-book-game-platform').evaluateAll(nodes => nodes.map(node => {
    const parent = node.closest('button').getBoundingClientRect(), rect = node.getBoundingClientRect();
    return rect.left >= parent.left - 1 && rect.right <= parent.right + 1;
  }));
  expect(platforms).toEqual(Array(7).fill(true));
  const book = await page.locator('.lion-book-stage iframe').elementHandle();
  const frame = await book.contentFrame();
  // The authored plate includes transparent margins outside the iframe. The
  // original page zones follow the visible paper, so inspect those hit areas.
  const frameGeometry = await frame.locator('.sb-next').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight };
  });
  expect(frameGeometry.left).toBeGreaterThanOrEqual(-1);
  expect(frameGeometry.right).toBeLessThanOrEqual(frameGeometry.width + 1);
  expect(frameGeometry.top).toBeGreaterThanOrEqual(-1);
  expect(frameGeometry.bottom).toBeLessThanOrEqual(frameGeometry.height + 1);
}

for (const width of [640, 900]) {
  test(`最短电脑余窗 ${width}×360 与180px顶栏组合保留完整主视觉和全部入口`, async ({ page }) => {
    await openHome(page, width, 360, { headerHeight: 180 });
    await expectHomeGeometry(page, 360);
    await returnToHomeHero(page);
    const geometry = await page.locator('.home-page').evaluate(root => {
      const header = document.querySelector('.site-header').getBoundingClientRect();
      const selectors = ['.entry-title-art', '#enterWork', '.entry-motto', '.entry-english', '#replayIntro'];
      return { header: header.bottom, boxes: selectors.map(selector => ({ selector, ...root.querySelector(selector).getBoundingClientRect().toJSON() })) };
    });
    for (const box of geometry.boxes) {
      expect(box.top, box.selector).toBeGreaterThanOrEqual(geometry.header - 1);
      expect(box.bottom, box.selector).toBeLessThanOrEqual(360 + 1);
    }
    for (let i = 0; i < geometry.boxes.length; i++) for (const other of geometry.boxes.slice(i + 1)) {
      const box = geometry.boxes[i];
      expect(box.right <= other.left + 1 || other.right <= box.left + 1 || box.bottom <= other.top + 1 || other.bottom <= box.top + 1, `${box.selector} / ${other.selector}`).toBe(true);
    }
  });
}

for (const [width, height] of windows) {
  test(`首页在电脑余窗 ${width}×${height} 保留首屏控件、史册和全部阅读内容`, async ({ page }) => {
    await openHome(page, width, height);
    await expectHomeGeometry(page, height);
    await expectTextFits(page);
    await selectHomeExhibit(page, 'homeLionTypes');
    await expect(page.locator('.heritage-type-copy')).toBeVisible();
    await expectTextFits(page);
    await page.getByRole('button', { name: '形制对照', exact: true }).click();
    await expect(page.locator('.heritage-comparison-card')).toHaveCount(2);
    await expectTextFits(page);
    await selectHomeExhibit(page, 'homeCultureSources');
    await expectTextFits(page);
    await test.info().attach('desktop-layout', { body: JSON.stringify(await page.evaluate(() => ({ viewport: [innerWidth, innerHeight], page: document.querySelector('.site-page').clientWidth, bookStage: document.querySelector('.lion-book-stage').clientHeight, galleryColumns: getComputedStyle(document.querySelector('.home-culture-slide.is-active')).gridTemplateColumns }))), contentType: 'application/json' });
  });
}

for (const [width, height] of [[640, 360], [1920, 1080]]) {
  test(`首页纸面40%与900px高度、资料最大字号在 ${width}×${height} 仍可完整阅读`, async ({ page }) => {
    const saved = { sourcesTitleFontSize: 48, sourcesBodyFontSize: 28, sourcesMetaFontSize: 22 };
    for (const prefix of ['bookTitle', 'bookDetails', 'cultureTitle', 'cultureBody', 'cultureSources', 'cultureSourceCard']) {
      saved[`${prefix}Width`] = 40; saved[`${prefix}Height`] = 900;
    }
    await openHome(page, width, height, saved);
    await selectHomeExhibit(page, 'homeCultureSources');
    await expectTextFits(page);
    if (width === 640) {
      const reading = await page.locator('.home-culture-source-description').first().evaluate(element => {
        const node = element.firstChild, lines = new Map();
        for (let i = 0; i < node.length; i++) {
          const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + 1);
          const y = Math.round(range.getBoundingClientRect().top);
          lines.set(y, (lines.get(y) || '') + node.textContent[i]);
        }
        return { paper: element.closest('.home-culture-sources').getBoundingClientRect().width,
          card: element.closest('.home-culture-source-card').getBoundingClientRect().width,
          paragraph: element.getBoundingClientRect().width, font: getComputedStyle(element).fontSize, lines: [...lines.values()] };
      });
      expect(reading.paper).toBeGreaterThanOrEqual(280);
      expect(reading.card).toBeGreaterThanOrEqual(220);
      expect(reading.font).toBe('28px');
      expect(Math.max(...reading.lines.map(line => line.length))).toBeGreaterThanOrEqual(7);
      expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).cultureSourcesWidth, settingsKey)).toBe(40);
      await test.info().attach('requested-width-and-readable-text', { body: JSON.stringify(reading), contentType: 'application/json' });
    }
    await alignSection(page, 'homeCultureSources');
    const lastLink = page.locator('#homeCultureSources a').last();
    await lastLink.scrollIntoViewIfNeeded();
    await lastLink.focus();
    await expect(lastLink).toBeFocused();
  });
}

test('首页设置推开后按真实内容余宽重排，视频与书册实例保留', async ({ page }) => {
  await openHome(page, 1920, 1080, { panelWidth: 760, pushPage: true });
  const video = await page.locator('#entryLionVideo').elementHandle();
  const frame = await page.locator('.lion-book-stage iframe').elementHandle();
  await page.locator('.site-navigation [data-action="settings"]').click();
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await expect.poll(() => page.locator('.site-page').evaluate(el => el.clientWidth)).toBeLessThan(1200);
  await expectTextFits(page);
  expect(await video.evaluate(el => el === document.querySelector('#entryLionVideo'))).toBe(true);
  expect(await frame.evaluate(el => el === document.querySelector('.lion-book-stage iframe'))).toBe(true);
});

test('640×360入场失败提示即使设置900px高度仍能访问继续首页', async ({ page }) => {
  await page.route('**/entry-intro.mp4', route => route.abort());
  await openHome(page, 640, 360, { videoOverlayHeight: 900 }, true);
  await expect(page.locator('.video-status')).toBeVisible();
  const rect = await page.locator('.video-status').boundingBox();
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.y + rect.height).toBeLessThanOrEqual(360);
  await page.getByRole('button', { name: '继续浏览首页', exact: true }).click();
  await expect(page.locator('#entryLionVideo')).toBeVisible();
  await expect(page.locator('.site-header')).toBeVisible();
});

test('窄电脑书页时间线可命中，真实WebGL图鉴重排后保持同一画布与图文联动', async ({ page }) => {
  await openHome(page, 640, 480);
  await page.locator('#enterWork').click();
  await page.locator('[data-book-page="origin"]').click();
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-index', '1');
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-turning', 'false');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await selectHomeExhibit(page, 'homeCulture');
  const gallery = page.locator('.culture-depth-gallery');
  await expect(gallery).toHaveAttribute('data-depth-state', 'ready');
  const canvas = await gallery.locator('canvas').elementHandle();
  await page.mouse.move(1, 300);
  const photo = await gallery.boundingBox();
  await page.mouse.click(photo.x + photo.width * .42, photo.y + photo.height * .5);
  await expect(page.locator('#homeCulture')).toHaveAttribute('data-culture-index', '1');
  await expect(page.locator('.home-culture-slide.is-active h3')).toHaveText('一扎一画，狮有了神采');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect.poll(() => gallery.evaluate(element => element.clientWidth)).toBeGreaterThan(600);
  expect(await canvas.evaluate(element => element === document.querySelector('.culture-depth-gallery canvas'))).toBe(true);
  await expectTextFits(page);
});
