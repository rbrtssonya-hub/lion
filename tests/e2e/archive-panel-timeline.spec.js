import { test, expect } from '@playwright/test';

const settingsKey = 'nanfeng-lion:developer-settings:v1';

async function openArchive(page, { reduced = false, saved = {} } = {}) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.addInitScript(({ key, saved }) => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ carouselAutoplay: false, ...saved }));
  }, { key: settingsKey, saved });
  await page.goto('/');
  await page.locator('#homeLionBook').scrollIntoViewIfNeeded();
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-ready', 'true');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 35_000 });
  await page.evaluate(() => document.fonts.ready);
}

async function appearance(page) {
  await page.locator('.site-header [data-action="settings"]').click();
  await page.getByRole('tab', { name: '外观', exact: true }).click();
}

test('标题底板留白能缩小实际高度，不改变文字大小且能保存与复原', async ({ page }) => {
  await openArchive(page, { reduced: true, saved: { navFontSize: 22, navigationTypographyVersion: 2 } });
  await appearance(page);
  const spacing = page.getByRole('spinbutton', { name: '标题底板留白数值', exact: true });
  await expect(spacing).toHaveValue('100');
  const measure = () => page.locator('[data-surface="bookTitle"]').evaluate(el => ({
    height: el.getBoundingClientRect().height,
    font: getComputedStyle(el.querySelector('h2')).fontSize,
    otherHeight: document.querySelector('[data-surface="cultureTitle"]').getBoundingClientRect().height,
  }));
  const normal = await measure();
  expect(normal.height).toBeLessThan(500);
  await spacing.fill('50'); await spacing.press('Tab');
  const compact = await measure();
  expect(compact.height).toBeLessThan(normal.height - 40);
  expect(compact.font).toBe(normal.font);
  expect(compact.otherHeight).toBe(normal.otherHeight);
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), settingsKey)).toMatchObject({ bookTitleSpacing: 50, navFontSize: 22 });
  await page.reload();
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 35_000 });
  await appearance(page);
  await expect(spacing).toHaveValue('50');
  await page.getByRole('button', { name: '恢复默认参数' }).click();
  await expect(spacing).toHaveValue('100');
  await expect(page.getByRole('spinbutton', { name: '书册标题底板最小高度数值', exact: true })).toHaveValue('0');
});

test('标题底板40%窄宽与留白极值下标题居中，文字及装饰完整', async ({ page }) => {
  await openArchive(page, { reduced: true, saved: { bookTitleWidth: 40, bookTitleSpacing: 50, pushPage: false } });
  for (const [width, height] of [[1920, 1080], [2560, 1440], [1366, 768], [1024, 768], [900, 768]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const layout = await page.locator('[data-surface="bookTitle"]').evaluate(el => {
      const box = el.getBoundingClientRect();
      const title = el.querySelector('h2').getBoundingClientRect();
      const ornament = el.querySelector('.lion-archive-ornament').getBoundingClientRect();
      return { left: box.left, right: box.right, center: (box.left + box.right) / 2,
        title: { left: title.left, right: title.right, center: (title.left + title.right) / 2 },
        ornament: { left: ornament.left, right: ornament.right },
        overflow: el.scrollWidth - el.clientWidth, pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(Math.abs(layout.title.center - layout.center)).toBeLessThan(2);
    expect(layout.title.left).toBeGreaterThanOrEqual(layout.left);
    expect(layout.title.right).toBeLessThanOrEqual(layout.right);
    expect(layout.ornament.left).toBeGreaterThanOrEqual(layout.left);
    expect(layout.ornament.right).toBeLessThanOrEqual(layout.right);
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.pageOverflow).toBeLessThanOrEqual(0);
  }
});

// Actual marker positions are compared to the rendered SVG, not a duplicated easing function.
async function traceMove(page, id) {
  return page.locator('.lion-book-experience').evaluate((book, id) => new Promise(resolve => {
    const nav = book.querySelector('.lion-book-timeline');
    const frames = [];
    let started;
    function sample(now) {
      started ??= now;
      const marker = nav.querySelector('.lion-book-traveling-lion').getBoundingClientRect();
      const path = nav.querySelector('.lion-book-track-line');
      const matrix = path.getScreenCTM();
      const center = new DOMPoint((marker.left + marker.right) / 2, (marker.top + marker.bottom) / 2).matrixTransform(matrix.inverse());
      let low = 0, high = path.getTotalLength();
      for (let n = 0; n < 24; n++) {
        const middle = (low + high) / 2;
        if (path.getPointAtLength(middle).x < center.x) low = middle; else high = middle;
      }
      const onCurve = path.getPointAtLength((low + high) / 2);
      const canvas = nav.querySelector('.lion-book-particles');
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0, red = 0, min = 1000, max = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) {
        count++; if (pixels[i - 3] > 130 && pixels[i - 2] < 100) red++;
        const x = ((i - 3) / 4 % canvas.width) / canvas.width * 1000;
        min = Math.min(min, x); max = Math.max(max, x);
      }
      frames.push({ x: center.x, y: center.y, arc: (low + high) / 2, error: Math.abs(onCurve.y - center.y),
        count, red, min, max });
      if (now - started < 1750) requestAnimationFrame(sample); else resolve(frames);
    }
    const observer = new MutationObserver(() => {
      observer.disconnect();
      requestAnimationFrame(sample);
    });
    observer.observe(book, { attributes: true, attributeFilter: ['data-book-index'] });
    book.querySelector(`[data-book-page="${id}"]`).click();
  }), id);
}

test('狮头水平行进，离散红金粒子只出现在身后并消散，支持倒向', async ({ page }) => {
  await openArchive(page);
  await page.locator('.lion-book-timeline').scrollIntoViewIfNeeded();
  await expect(page.locator('.lion-book-traveling-lion img')).toHaveAttribute('src', /nav-lion-head\.png$/);
  for (const [id, targetX] of [['martial', 500], ['origin', 60 + 880 / 6]]) {
    const frames = await traceMove(page, id);
    const moving = frames.filter(f => Math.abs(f.x - targetX) > 1);
    expect(moving.length).toBeGreaterThan(4);
    expect(Math.max(...frames.map(f => f.error))).toBeLessThan(1);
    const redFrames = frames.filter(f => f.count > 0);
    expect(redFrames.length).toBeGreaterThan(4);
    expect(redFrames.some(f => f.red > 0)).toBe(true);
    for (const f of redFrames) {
      if (id === 'martial') expect(f.max).toBeLessThanOrEqual(f.x + 4);
      else expect(f.min).toBeGreaterThanOrEqual(f.x - 4);
    }
    expect(frames.at(-1).x).toBeCloseTo(targetX, 1);
    expect(frames.at(-1).count).toBe(0);
  }
});

test('减少动态时狮头直接到节点且没有拖尾，关闭粒子仍可翻阅', async ({ page }) => {
  await openArchive(page, { reduced: true, saved: { bookInkEnabled: false } });
  const nav = page.locator('.lion-book-timeline');
  await nav.scrollIntoViewIfNeeded();
  await nav.locator('[data-book-page="formation"]').click();
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-index', '2');
  await expect(nav).toHaveAttribute('data-particles-enabled', 'false');
  await expect(page.locator('.lion-book-traveling-lion img')).toHaveAttribute('src', /nav-lion-head\.png$/);
  await expect(page.locator('.lion-book-particles')).not.toBeVisible();
  const offset = await nav.evaluate(el => {
    const marker = el.querySelector('.lion-book-traveling-lion').getBoundingClientRect();
    const node = el.querySelector('[aria-current="step"] .lion-book-node').getBoundingClientRect();
    return Math.hypot((marker.left + marker.right - node.left - node.right) / 2, (marker.top + marker.bottom - node.top - node.bottom) / 2);
  });
  expect(offset).toBeLessThan(2);
});

test('快速反向选择从可见位置接续，离屏暂停且回到视口后完成，不留下旧节点状态', async ({ page }) => {
  await openArchive(page);
  const nav = page.locator('.lion-book-timeline');
  await nav.scrollIntoViewIfNeeded();
  await page.locator('.lion-book-experience').evaluate(book => new Promise(resolve => {
    const observer = new MutationObserver(() => { observer.disconnect(); setTimeout(resolve, 150); });
    observer.observe(book, { attributes: true, attributeFilter: ['data-book-index'] });
    book.querySelector('[data-book-page="ending"]').click();
  }));
  const before = await nav.locator('.lion-book-traveling-lion').boundingBox();
  // Retarget before the 650ms marker movement completes; the original paper is already committed.
  await nav.locator('[data-book-page="origin"]').evaluate(button => button.click());
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-index', '1');
  const after = await nav.locator('.lion-book-traveling-lion').boundingBox();
  expect(Math.abs(before.x - after.x)).toBeLessThan(140);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(nav).toHaveAttribute('data-particles-playing', 'false');
  const paused = await nav.locator('.lion-book-traveling-lion').getAttribute('style');
  await page.waitForTimeout(250);
  expect(await nav.locator('.lion-book-traveling-lion').getAttribute('style')).toBe(paused);
  await nav.scrollIntoViewIfNeeded();
  await expect(nav).toHaveAttribute('data-particles-playing', 'true');
  await expect.poll(() => nav.evaluate(el => {
    const marker = el.querySelector('.lion-book-traveling-lion').getBoundingClientRect();
    const node = el.querySelector('[aria-current="step"] .lion-book-node').getBoundingClientRect();
    return Math.abs(marker.x + marker.width / 2 - node.x - node.width / 2);
  })).toBeLessThan(2);
  await expect(nav.locator('[aria-current="step"]')).toHaveAttribute('data-book-page', 'origin');
  await page.locator('.site-header [data-route="state"]').click();
  // Home is intentionally prewarmed across routes: it must stop, not be destroyed.
  await expect(nav).not.toBeVisible();
  await expect(nav).toHaveAttribute('data-particles-playing', 'false');
  const away = await nav.locator('.lion-book-traveling-lion').getAttribute('style');
  await page.waitForTimeout(200);
  expect(await nav.locator('.lion-book-traveling-lion').getAttribute('style')).toBe(away);
  await page.locator('.site-header [data-route="entry"]').click();
  await page.locator('.lion-book-timeline').scrollIntoViewIfNeeded();
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-index', '1');
});

test('存储不可用时底板留白仍即时生效，最大留白与最小高度可独立调整', async ({ page }) => {
  await page.addInitScript(key => {
    const read = Storage.prototype.getItem, write = Storage.prototype.setItem;
    Storage.prototype.getItem = function (name) { if (name === key) throw new DOMException('disabled', 'SecurityError'); return read.call(this, name); };
    Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('disabled', 'SecurityError'); return write.call(this, name, value); };
  }, settingsKey);
  await openArchive(page, { reduced: true });
  await appearance(page);
  const panel = page.locator('[data-surface="bookTitle"]');
  const normal = (await panel.boundingBox()).height;
  const spacing = page.getByRole('slider', { name: '标题底板留白', exact: true });
  await spacing.focus(); await spacing.press('End');
  expect((await panel.boundingBox()).height).toBeGreaterThan(normal + 30);
  await spacing.press('Home');
  expect((await panel.boundingBox()).height).toBeLessThan(normal - 30);
  const height = page.getByRole('spinbutton', { name: '书册标题底板最小高度数值', exact: true });
  await height.fill('900'); await height.press('Tab');
  await expect(panel).toHaveCSS('min-height', '900px');
  expect((await panel.boundingBox()).height).toBeGreaterThanOrEqual(900);
  await height.fill('0'); await height.press('Tab');
  expect((await panel.boundingBox()).height).toBeLessThan(normal - 30);
});
