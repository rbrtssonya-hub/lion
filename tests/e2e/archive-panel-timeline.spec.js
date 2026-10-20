import { test, expect } from '@playwright/test';
import { selectSettingsFor } from './settings-navigation.helpers.js';

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

async function bookSettings(page) {
  await page.locator('.site-header [data-action="settings"]').click();
  await selectSettingsFor(page, 'bookTitle');
}

test('标题底板留白能缩小实际高度，不改变文字大小且能保存与复原', async ({ page }) => {
  await openArchive(page, { reduced: true, saved: { navFontSize: 22, navigationTypographyVersion: 2 } });
  await bookSettings(page);
  const spacing = page.getByRole('spinbutton', { name: '标题底板留白数值', exact: true });
  await expect(spacing).toHaveValue('100');
  const measure = () => page.locator('[data-surface="bookTitle"]').evaluate(el => ({
    height: el.getBoundingClientRect().height,
    font: getComputedStyle(el.querySelector('h2')).fontSize,
    padding: parseFloat(getComputedStyle(el).paddingTop) + parseFloat(getComputedStyle(el).paddingBottom),
    gap: parseFloat(getComputedStyle(el).rowGap),
    otherHeight: document.querySelector('[data-surface="cultureTitle"]').getBoundingClientRect().height,
  }));
  const normal = await measure();
  expect(normal.height).toBeLessThan(500);
  await spacing.fill('50'); await spacing.press('Tab');
  const compact = await measure();
  expect(compact.padding).toBeCloseTo(normal.padding / 2, 1);
  expect(compact.gap).toBeCloseTo(normal.gap / 2, 1);
  // Responsive paper padding can be 22px rather than the previous 24px.
  // Verify the actual 50% spacing contract, not a fixed 40px total reduction.
  expect(compact.height).toBeLessThanOrEqual(normal.height - (normal.padding + normal.gap) / 2 + 1);
  expect(compact.font).toBe(normal.font);
  expect(compact.otherHeight).toBe(normal.otherHeight);
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), settingsKey)).toMatchObject({ bookTitleSpacing: 50, navFontSize: 22 });
  await page.reload();
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 35_000 });
  await bookSettings(page);
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

// Compare against the rendered seven platforms in CSS pixels. The role sprite
// travels above their straight track; its independent atlas canvas is excluded.
async function traceMove(page, id) {
  return page.locator('.lion-book-experience').evaluate((book, id) => new Promise(resolve => {
    const nav = book.querySelector('.lion-book-timeline');
    const bounds = nav.getBoundingClientRect();
    const target = nav.querySelector(`[data-book-page="${id}"] .lion-book-game-platform`).getBoundingClientRect();
    const targetX = (target.left + target.right) / 2 - bounds.left;
    const initial = nav.querySelector('.lion-book-guide-character').getBoundingClientRect();
    const baseline = (initial.top + initial.bottom) / 2 - bounds.top;
    const frames = [];
    let started;
    function sample(now) {
      started ??= now;
      const marker = nav.querySelector('.lion-book-guide-character').getBoundingClientRect();
      const center = { x: (marker.left + marker.right) / 2 - bounds.left, y: (marker.top + marker.bottom) / 2 - bounds.top };
      const canvas = nav.querySelector('.lion-book-particles');
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0, red = 0, min = bounds.width, max = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) {
        count++; if (pixels[i - 3] > 130 && pixels[i - 2] < 100) red++;
        const x = ((i - 3) / 4 % canvas.width) / canvas.width * bounds.width;
        min = Math.min(min, x); max = Math.max(max, x);
      }
      frames.push({ ...center, targetX, error: Math.abs(baseline - center.y), count, red, min, max });
      if (now - started < 1750) requestAnimationFrame(sample); else resolve(frames);
    }
    book.querySelector(`[data-book-page="${id}"]`).click();
    requestAnimationFrame(sample);
  }), id);
}

async function placeTimelineWithPaperVisible(page) {
  await page.locator('.lion-book-timeline').evaluate(nav => {
    window.scrollTo({ top: scrollY + nav.getBoundingClientRect().bottom - innerHeight + 24, behavior: 'instant' });
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const exposure = await page.locator('.lion-book-stage').evaluate(stage => {
    const r = stage.getBoundingClientRect();
    return { visible: Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top)), required: Math.min(r.height * .6, innerHeight * .48) };
  });
  expect(exposure.visible).toBeGreaterThan(exposure.required + 10);
}

async function traceChoice(page, input) {
  return page.locator('.lion-book-experience').evaluate((book, input) => new Promise(resolve => {
    const nav = book.querySelector('.lion-book-timeline');
    const marker = nav.querySelector('.lion-book-guide-character');
    const read = () => ({ time: performance.now() - start, x: marker.getBoundingClientRect().x,
      index: Number(book.dataset.bookIndex), turning: book.dataset.bookTurning,
      selected: nav.querySelector('[aria-current="step"]')?.dataset.bookPage,
      title: book.querySelector('.lion-book-reading h3').textContent });
    const start = performance.now();
    const frames = [read()];
    const perform = value => {
      if (value.id) nav.querySelector(`[data-book-page="${value.id}"]`).click();
      else book.dispatchEvent(new KeyboardEvent('keydown', { key: value.key, bubbles: true }));
    };
    perform(input);
    for (const next of input.sequence || []) setTimeout(() => perform(next), next.after);
    const sample = () => {
      frames.push(read());
      if (performance.now() - start < 1150 + (input.sequence?.at(-1)?.after || 0)) requestAnimationFrame(sample);
      else resolve(frames);
    };
    requestAnimationFrame(sample);
  }), input);
}

test('相邻、跨页与反向点击都立即启动狮头，纸面未提交时详情保持真实页', async ({ page }) => {
  await openArchive(page);
  await placeTimelineWithPaperVisible(page);
  const book = page.locator('.lion-book-experience');
  const metrics = [];
  for (const [id, index, adjacent] of [['origin', 1, true], ['spread', 4, false], ['martial', 3, true]]) {
    const frames = await traceChoice(page, { id });
    const first = frames.find(frame => Math.abs(frame.x - frames[0].x) > 1);
    expect(first, `${id} must start moving`).toBeTruthy();
    expect(first.time, `${id} click-to-motion`).toBeLessThan(150);
    expect(frames.slice(1).every(frame => frame.selected === id)).toBe(true);
    if (adjacent) {
      const duringTurn = frames.find(frame => frame.turning === 'true' && Math.abs(frame.x - frames[0].x) > 1);
      expect(duringTurn, `${id} marker starts before paper commits`).toBeTruthy();
      expect(duringTurn.index).toBe(frames[0].index);
      expect(duringTurn.title).toBe(frames[0].title);
    }
    await expect(book).toHaveAttribute('data-book-index', String(index));
    await expect(book).toHaveAttribute('data-book-turning', 'false');
    metrics.push({ id, firstMotionMs: Math.round(first.time) });
  }
  console.log(`timeline click latency: ${JSON.stringify(metrics)}`);
});

test('快速相邻往返不被旧提交抢回，外层键盘即时反馈且当前页重复点击不锁定狮头', async ({ page }) => {
  await openArchive(page);
  await placeTimelineWithPaperVisible(page);
  const book = page.locator('.lion-book-experience');
  const nav = book.locator('.lion-book-timeline');
  // Selecting the already committed page cannot leave an unresolved request.
  await nav.locator('[data-book-page="cover"]').click();
  const reverse = await traceChoice(page, { id: 'origin', sequence: [{ id: 'cover', after: 80 }] });
  expect(reverse.filter(frame => frame.time >= 100).every(frame => frame.selected === 'cover')).toBe(true);
  await expect(book).toHaveAttribute('data-book-index', '0');
  await expect(book).toHaveAttribute('data-book-turning', 'false');
  const forward = await traceChoice(page, { id: 'origin', sequence: [{ id: 'formation', after: 60 }, { id: 'martial', after: 120 }] });
  expect(forward.filter(frame => frame.time >= 140).every(frame => frame.selected === 'martial')).toBe(true);
  await expect(book).toHaveAttribute('data-book-index', '3');
  await expect(book).toHaveAttribute('data-book-turning', 'false');
  const keyboard = await traceChoice(page, { key: 'ArrowRight' });
  expect(keyboard.find(frame => Math.abs(frame.x - keyboard[0].x) > 1)?.time).toBeLessThan(150);
  expect(keyboard.slice(1).every(frame => frame.selected === 'spread')).toBe(true);
  await expect(book).toHaveAttribute('data-book-index', '4');
  await expect(book).toHaveAttribute('data-book-turning', 'false');
  await nav.locator('[data-book-page="spread"]').focus();
  await page.keyboard.press('Enter');
  await expect(book).toHaveAttribute('data-book-index', '4');
  await page.keyboard.press('Space');
  await expect(book).toHaveAttribute('data-book-index', '4');
});

test('时间线尚在翻页时可移焦真实纸面并继续按键，狮头跟随接管后的提交页', async ({ page }) => {
  await openArchive(page);
  await placeTimelineWithPaperVisible(page);
  const book = page.locator('.lion-book-experience');
  await book.locator('[data-book-page="origin"]').click();
  await expect(book).toHaveAttribute('data-book-turning', 'true');
  await page.frameLocator('#homeLionBook iframe').locator('.sb-next').focus();
  await page.keyboard.press('ArrowRight');
  await expect(book).toHaveAttribute('data-book-index', '2');
  await expect(book).toHaveAttribute('data-book-turning', 'false');
  await expect(book.locator('[aria-current="step"]')).toHaveAttribute('data-book-page', 'formation');
  await expect.poll(() => book.locator('.lion-book-timeline').evaluate(nav => {
    const marker = nav.querySelector('.lion-book-guide-character').getBoundingClientRect();
    const node = nav.querySelector('[aria-current="step"] .lion-book-game-platform').getBoundingClientRect();
    return Math.abs(marker.x + marker.width / 2 - node.x - node.width / 2);
  })).toBeLessThan(2);
});

test('狮头水平行进，离散红金粒子只出现在身后并消散，支持倒向', async ({ page }) => {
  await openArchive(page);
  await page.locator('.lion-book-timeline').scrollIntoViewIfNeeded();
  await expect(page.locator('.lion-book-guide-character img')).toHaveAttribute('src', /adam-poster\.png$/);
  for (const id of ['martial', 'origin']) {
    const frames = await traceMove(page, id);
    const targetX = frames[0].targetX;
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
  await expect(page.locator('.lion-book-guide-character img')).toHaveAttribute('src', /adam-poster\.png$/);
  await expect(page.locator('.lion-book-particles')).not.toBeVisible();
  const offset = await nav.evaluate(el => {
    const marker = el.querySelector('.lion-book-guide-character').getBoundingClientRect();
    const node = el.querySelector('[aria-current="step"] .lion-book-game-platform').getBoundingClientRect();
    return Math.abs((marker.left + marker.right - node.left - node.right) / 2);
  });
  expect(offset).toBeLessThan(2);
});

test('快速反向选择从可见位置接续，离屏暂停且回到视口后完成，不留下旧节点状态', async ({ page }) => {
  await openArchive(page);
  const nav = page.locator('.lion-book-timeline');
  await nav.scrollIntoViewIfNeeded();
  await page.locator('.lion-book-experience').evaluate(book => new Promise(resolve => {
    book.querySelector('[data-book-page="ending"]').click();
    setTimeout(resolve, 150);
  }));
  const before = await nav.locator('.lion-book-guide-character').boundingBox();
  // Retarget 150ms after input, independently of the paper's commit timing.
  await nav.locator('[data-book-page="origin"]').evaluate(button => button.click());
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-index', '1');
  const after = await nav.locator('.lion-book-guide-character').boundingBox();
  expect(Math.abs(before.x - after.x)).toBeLessThan(140);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(nav).toHaveAttribute('data-particles-playing', 'false');
  const paused = await nav.locator('.lion-book-guide-character').getAttribute('style');
  await page.waitForTimeout(250);
  expect(await nav.locator('.lion-book-guide-character').getAttribute('style')).toBe(paused);
  await nav.scrollIntoViewIfNeeded();
  await expect(nav).toHaveAttribute('data-playing', 'true');
  await expect.poll(() => nav.evaluate(el => {
    const marker = el.querySelector('.lion-book-guide-character').getBoundingClientRect();
    const node = el.querySelector('[aria-current="step"] .lion-book-game-platform').getBoundingClientRect();
    return Math.abs(marker.x + marker.width / 2 - node.x - node.width / 2);
  })).toBeLessThan(2);
  await expect(nav.locator('[aria-current="step"]')).toHaveAttribute('data-book-page', 'origin');
  await page.locator('.site-header [data-route="state"]').click();
  // Home is intentionally prewarmed across routes: it must stop, not be destroyed.
  await expect(nav).not.toBeVisible();
  await expect(nav).toHaveAttribute('data-particles-playing', 'false');
  const away = await nav.locator('.lion-book-guide-character').getAttribute('style');
  await page.waitForTimeout(200);
  expect(await nav.locator('.lion-book-guide-character').getAttribute('style')).toBe(away);
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
  await bookSettings(page);
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
