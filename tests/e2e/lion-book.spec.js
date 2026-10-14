import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { lionBookPages } from '../../src/data/lion-book.js';

async function view(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  // Wait for the parent and sandbox compositor to agree on the new viewport.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function openBook(page, { reduced = false, ready = true, url = '/' } = {}) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => { if (window === window.top) sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'); });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto(url);
  await page.locator('#homeLionBook').scrollIntoViewIfNeeded();
  const book = page.locator('.lion-book-experience');
  if (ready) await expect(book).toHaveAttribute('data-book-ready', 'true');
  if (ready) {
    await view(page, page.locator('.lion-book-stage'));
    await expect(book).toHaveAttribute('data-book-intro', 'done');
  }
  return { book, frame: page.frameLocator('#homeLionBook iframe') };
}

async function settled(book, frame, index) {
  await expect(book).toHaveAttribute('data-book-index', String(index));
  await expect(book).toHaveAttribute('data-book-turning', 'false');
  await expect(frame.locator('#sbBook>.sb-full img')).toHaveAttribute('src', new RegExp(`/${lionBookPages[index].file}$`));
  await expect(book.locator('[aria-current="step"]')).toHaveAttribute('data-book-page', lionBookPages[index].id);
}

async function drag(page, frame, direction, distance = .57, release = true) {
  await view(page, page.locator('.lion-book-stage'));
  const rect = await frame.locator('#sbBook').boundingBox();
  const startX = rect.x + rect.width * (direction === 'next' ? .88 : .12);
  const y = rect.y + rect.height * .56;
  await page.mouse.move(startX, y);
  await page.waitForTimeout(160);
  await page.mouse.down();
  const endX = startX + rect.width * distance * (direction === 'next' ? -1 : 1);
  await page.mouse.move(endX, y, { steps: 18 });
  if (release) await page.mouse.up();
  return { endX, y };
}

test('史册位于首屏与照片之间，官方Sketchbook加载七幅醒狮页且没有原背景和放大镜', async ({ page }) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  const { book, frame } = await openBook(page);
  await settled(book, frame, 0);
  await expect(page.locator('#homeLionBook iframe')).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(page.locator('#homeLionBook iframe')).toHaveAttribute('title', /岭南醒狮志/);
  await expect(frame.locator('#loupe, #zoomWrap, #loupeBtn, #zIn, #zOut, .wash, .botany')).toHaveCount(0);
  await expect(book.locator('.lion-book-timeline button')).toHaveCount(7);
  const resources = await frame.locator('body').evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
  for (const pageData of lionBookPages) expect(resources.some(url => url.endsWith(`/assets/lion-book/${pageData.file}`))).toBe(true);
  expect([...requests, ...resources].some(url => /bg-wash|marina-bay|gardens-by|merlion|instrument-serif|newsreader/.test(url))).toBe(false);
  const positions = await page.evaluate(() => ['.entry-gate', '#homeLionBook', '#homeCulture'].map(selector => document.querySelector(selector).getBoundingClientRect().top));
  expect(positions[0]).toBeLessThan(positions[1]);
  expect(positions[1]).toBeLessThan(positions[2]);
  await page.waitForTimeout(1800);
  await settled(book, frame, 0);
  expect(errors).toEqual([]);
});

test('真实拖拽生成18层双面卷曲，短拖取消、长拖提交与反向翻阅同步时间线', async ({ page }) => {
  const { book, frame } = await openBook(page);
  const { endX, y } = await drag(page, frame, 'next', .15, false);
  await expect(frame.locator('.curl .strip')).toHaveCount(18);
  await expect(frame.locator('.curl .face.front')).toHaveCount(18);
  await expect(frame.locator('.curl .face.back')).toHaveCount(18);
  const curl = await frame.locator('#sb3d').evaluate(element => ({ angle: element.style.getPropertyValue('--tt'), delta: element.style.getPropertyValue('--td'), shade: element.style.getPropertyValue('--shade') }));
  expect(parseFloat(curl.angle)).toBeGreaterThan(10);
  expect(parseFloat(curl.delta)).toBeGreaterThan(.5);
  expect(parseFloat(curl.shade)).toBeGreaterThan(.2);
  const before = await page.locator('.lion-book-stage').screenshot();
  // A stationary final input removes flick velocity; below 42% the original engine cancels.
  await page.waitForTimeout(160);
  await page.mouse.move(endX, y);
  await page.mouse.up();
  await settled(book, frame, 0);
  await drag(page, frame, 'next');
  await settled(book, frame, 1);
  const after = await page.locator('.lion-book-stage').screenshot();
  expect(after.equals(before)).toBe(false);
  await drag(page, frame, 'prev');
  await settled(book, frame, 0);
});

test('五个历史节点与序终卷可选，图像、文案、来源及当前节点一致', async ({ page }) => {
  const { book, frame } = await openBook(page);
  await view(page, book.locator('.lion-book-timeline'));
  for (let index = 0; index < lionBookPages.length; index += 1) {
    const pageData = lionBookPages[index];
    await book.locator(`[data-book-page="${pageData.id}"]`).click();
    await settled(book, frame, index);
    await expect(book.locator('.lion-book-reading h3')).toHaveText(pageData.title);
    await expect(book.locator('.lion-book-reading-copy>p')).toHaveText(pageData.description);
    await expect(book.locator('.lion-book-reading-copy>a').first()).toHaveAttribute('href', pageData.sourceUrl);
  }
  await expect(book.locator('.lion-book-provenance')).toContainText('AI辅助绘制');
});

test('减少动态仍可手动翻阅，书内方向键与外部Home/End可达且无自动翻页', async ({ page }) => {
  const { book, frame } = await openBook(page, { reduced: true });
  await view(page, book.locator('.lion-book-timeline'));
  await book.locator('[data-book-page="cover"]').focus();
  await page.keyboard.press('ArrowRight');
  await settled(book, frame, 1);
  await frame.locator('.sb-next').focus();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  await page.keyboard.press('ArrowRight');
  await settled(book, frame, 2);
  await expect(frame.locator('.curl')).toHaveCount(0);
  await page.keyboard.press('End');
  await settled(book, frame, 6);
  await book.locator('[data-book-page="ending"]').focus();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  await page.keyboard.press('Home');
  await settled(book, frame, 0);
  await page.waitForTimeout(1800);
  await settled(book, frame, 0);
});

test('书面上的滚轮继续滚动首页，消息伪造不能切换当前史册', async ({ page }) => {
  const { book, frame } = await openBook(page);
  const before = await page.evaluate(() => scrollY);
  await frame.locator('.sb-next').hover();
  await page.mouse.wheel(0, 240);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 100);
  await page.evaluate(() => {
    window.postMessage({ type: 'lion-book:state', channelId: 'wrong', index: 6, ready: true, turning: false }, '*');
    document.querySelector('#homeLionBook iframe').contentWindow.postMessage({ type: 'lion-book:command', channelId: 'wrong', action: 'goTo', index: 6 }, '*');
  });
  await settled(book, frame, 0);
});

test('翻页中离开首页释放旧文档，返回重新打开并可继续翻阅', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let { book, frame } = await openBook(page);
  await drag(page, frame, 'next', .2, false);
  await page.mouse.up();
  const previousFrame = page.frames().find(item => item.url() === 'about:srcdoc');
  await page.locator('.site-header [data-route="state"]').click();
  await expect(page.locator('#homeLionBook iframe')).toHaveCount(0);
  expect(previousFrame.isDetached()).toBe(true);
  await page.locator('.site-header [data-route="entry"]').click();
  await page.locator('#homeLionBook').scrollIntoViewIfNeeded();
  book = page.locator('.lion-book-experience');
  frame = page.frameLocator('#homeLionBook iframe');
  await expect(book).toHaveAttribute('data-book-ready', 'true');
  await view(page, page.locator('.lion-book-stage'));
  await expect(book).toHaveAttribute('data-book-intro', 'done');
  await settled(book, frame, 0);
  await drag(page, frame, 'next');
  await settled(book, frame, 1);
  expect(errors).toEqual([]);
});

test('书页加载失败显示明确错误，重新展开恢复真实引擎', async ({ page, baseURL }) => {
  let failImage = true;
  // A real HTTP failure covers opaque sandbox fetches, which can bypass
  // Playwright route interception. The application and image decoder stay real.
  const server = createServer(async (request, response) => {
    if (failImage && request.url.split('?')[0].endsWith('/assets/lion-book/formation.png')) {
      response.writeHead(503, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      response.end('Unavailable for the loader regression');
      return;
    }
    try {
      const upstream = await fetch(new URL(request.url, baseURL));
      response.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      response.writeHead(502); response.end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const { book, frame } = await openBook(page, { ready: false, url: `http://127.0.0.1:${server.address().port}/` });
    await expect(book.locator('[role="alert"]')).toBeVisible();
    await expect(book).toHaveAttribute('data-book-ready', 'false');
    failImage = false;
    await book.getByRole('button', { name: '重新展开' }).click();
    await expect(book).toHaveAttribute('data-book-ready', 'true');
    await settled(book, frame, 0);
  } finally {
    await page.goto('about:blank');
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('电脑宽度变化与设置推开保持同一本书，照片图鉴和章节仍可使用', async ({ page }) => {
  const { book, frame } = await openBook(page);
  for (const [width, height] of [[1366, 768], [1920, 1080], [2560, 1440]]) {
    await page.setViewportSize({ width, height });
    await view(page, page.locator('.lion-book-stage'));
    await settled(book, frame, 0);
    const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
    expect(dimensions.scroll).toBe(dimensions.width);
    const image = await frame.locator('#sbBook>.sb-full img').boundingBox();
    const viewport = await page.locator('#homeLionBook iframe').boundingBox();
    // Only transparent top/bottom canvas margins may extend outside the host.
    expect(image.x + image.width * .052).toBeGreaterThanOrEqual(viewport.x - 2);
    expect(image.x + image.width * .948).toBeLessThanOrEqual(viewport.x + viewport.width + 2);
    expect(image.y + image.height * .218).toBeGreaterThanOrEqual(viewport.y - 2);
    expect(image.y + image.height * .782).toBeLessThanOrEqual(viewport.y + viewport.height + 2);
  }
  await page.locator('.site-header [data-action="settings"]').click();
  await expect(page.locator('#developerSettingsPanel')).toBeVisible();
  await page.getByRole('tab', { name: '布局', exact: true }).click();
  await page.getByRole('checkbox', { name: '设置面板推开页面' }).check();
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await view(page, book.locator('.lion-book-timeline'));
  await book.locator('[data-book-page="formation"]').click();
  await settled(book, frame, 2);
  await page.locator('#homeCulture').scrollIntoViewIfNeeded();
  await expect(page.locator('#homeCulture .is-active .home-culture-photo')).toBeVisible();
  await page.locator('.site-header [data-route="model"]').click();
  await expect(page.locator('#modelStage')).toBeVisible();
});
