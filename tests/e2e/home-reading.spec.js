import { test, expect } from '@playwright/test';
import { selectSettingsFor } from './settings-navigation.helpers.js';

const settingsKey = 'nanfeng-lion:developer-settings:v1';
const panels = ['.lion-book-heading', '.lion-book-reading', '.home-culture-intro', '.home-culture-slide.is-active .home-culture-copy'];

async function openReading(page, saved) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(({ key, saved }) => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    if (saved && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(saved));
  }, { key: settingsKey, saved });
  await page.goto('/');
  await page.locator('#homeLionBook').scrollIntoViewIfNeeded();
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-ready', 'true');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 35_000 });
  await page.evaluate(() => document.fonts.ready);
}

async function fills(page) {
  return page.evaluate(selectors => selectors.map(selector => {
    const node = document.querySelector(selector), css = getComputedStyle(node);
    const title = ['bookTitle', 'cultureTitle'].includes(node.dataset.surface);
    const paper = title ? getComputedStyle(node, '::before') : css;
    const channels = paper.backgroundColor.match(/[\d.]+/g).map(Number);
    return { title, rgb: channels.slice(0, 3), alpha: channels[3] ?? 1, opacity: Number(css.opacity), blur: paper.backdropFilter,
      border: css.borderColor, shadow: css.boxShadow, radius: parseFloat(css.borderRadius) };
  }), panels);
}

test('两处主标题按整区居中，简介在下方且正文适度放大，侧栏余宽900仍可读', async ({ page }) => {
  await openReading(page);
  for (const [width, height] of [[1920, 1080], [2560, 1440], [1366, 768], [1024, 768], [1255, 900]]) {
    await page.setViewportSize({ width, height });
    if (width === 1255) await page.locator('.site-header [data-action="settings"]').click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const layout = await page.evaluate(() => {
      const box = element => element.getBoundingClientRect();
      const headings = [['.lion-book-inner', '#lion-book-title', '.lion-book-preface'], ['.home-culture-inner', '#home-culture-title', '.home-culture-intro-copy']].map(([outer, title, copy]) => {
        const range = document.createRange(); range.selectNodeContents(document.querySelector(title));
        const text = range.getBoundingClientRect(); const parent = box(document.querySelector(outer));
        return { textCenter: (text.left + text.right) / 2, center: (parent.left + parent.right) / 2,
          textBottom: text.bottom, copyTop: box(document.querySelector(copy)).top,
          font: parseFloat(getComputedStyle(document.querySelector(title)).fontSize) };
      });
      const bodyFonts = ['.lion-book-preface>span:last-child', '.lion-book-reading-copy>p', '.home-culture-intro-copy>p:nth-child(2)', '.is-active .home-culture-text'].map(selector => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize));
      return { headings, bodyFonts, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        available: box(document.querySelector('.site-page')).width };
    });
    for (const heading of layout.headings) {
      expect(Math.abs(heading.textCenter - heading.center)).toBeLessThan(2);
      expect(heading.copyTop).toBeGreaterThan(heading.textBottom + 12);
    }
    if (width === 1920) {
      expect(layout.headings[0].font).toBeGreaterThanOrEqual(72);
      expect(layout.headings[1].font).toBeGreaterThanOrEqual(66);
    }
    for (const font of layout.bodyFonts) expect(font).toBeGreaterThanOrEqual(18);
    expect(layout.overflow).toBeLessThanOrEqual(0);
    if (width === 1255) expect(layout.available).toBe(900);
  }
});

test('题签与正文默认分层，仍能共享调节透明度且文字不变淡', async ({ page }) => {
  await openReading(page);
  for (const fill of await fills(page)) {
    expect(fill.rgb).toEqual([247, 245, 240]);
    expect(fill.alpha).toBeCloseTo(fill.title ? .65 : .9, 2);
    expect(fill.opacity).toBe(1);
    expect(fill.radius).toBe(fill.title ? 0 : 10);
  }
  await page.locator('.site-header [data-action="settings"]').click();
  const panel = page.getByRole('region', { name: '开发者参数设置' });
  await selectSettingsFor(page, 'archivePanelTransparency');
  const control = panel.getByRole('spinbutton', { name: '首页阅读底板透明度数值', exact: true });
  await expect(control).toHaveValue('35');
  await control.fill('75'); await control.press('Tab');
  await expect.poll(async () => (await fills(page)).map(fill => fill.alpha)).toEqual([.25, .25, .25, .25]);
  for (const fill of await fills(page)) expect(fill.alpha).toBeCloseTo(.25, 2);
  const slider = panel.getByRole('slider', { name: '首页阅读底板透明度', exact: true });
  await slider.focus(); await slider.press('End');
  await expect(control).toHaveValue('100');
  await expect.poll(async () => (await fills(page)).map(fill => fill.alpha)).toEqual([0, 0, 0, 0]);
  for (const fill of await fills(page)) {
    expect(fill.alpha).toBe(0);
    expect(['none', 'blur(0px)']).toContain(fill.blur);
    expect(fill.border).toMatch(/rgba\([^)]*, 0\)$/);
    expect(fill.shadow === 'none' || /^rgba\([^)]*, 0\)/.test(fill.shadow)).toBe(true);
    expect(fill.opacity).toBe(1);
  }
  await slider.press('Home');
  await expect(control).toHaveValue('0');
  await expect.poll(async () => (await fills(page)).map(fill => fill.alpha)).toEqual([1, 1, 1, 1]);
  for (const fill of await fills(page)) expect(fill.alpha).toBe(1);
  await expect(page.locator('#entryLionVideo')).toHaveAttribute('src', /home-lion-loop\.mp4$/);
});

test('旧设置补默认而不覆盖偏好，底板透明度刷新保存并可恢复默认', async ({ page }) => {
  await openReading(page, { navigationTypographyVersion: 2, navFontSize: 22, helperFontSize: 16 });
  await page.locator('.site-header [data-action="settings"]').click();
  await selectSettingsFor(page, 'archivePanelTransparency');
  const control = page.getByRole('spinbutton', { name: '首页阅读底板透明度数值', exact: true });
  await expect(control).toHaveValue('35');
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), settingsKey)).toMatchObject({ navFontSize: 22, helperFontSize: 16, archivePanelTransparency: 35 });
  await control.fill('68'); await control.press('Tab');
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)).archivePanelTransparency, settingsKey)).toBe(68);
  // The initializer only seeds empty storage; reload must retain the saved value.
  await page.reload();
  await page.locator('.site-header [data-action="settings"]').click();
  await expect(control).toHaveValue('68');
  await page.getByRole('button', { name: '恢复默认参数' }).click();
  await expect(control).toHaveValue('35');
});

test('存储被禁用时阅读底板仍可调节', async ({ page }) => {
  await page.addInitScript(key => {
    const read = Storage.prototype.getItem;
    const write = Storage.prototype.setItem;
    Storage.prototype.getItem = function (name) { if (name === key) throw new DOMException('disabled', 'SecurityError'); return read.call(this, name); };
    Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('disabled', 'SecurityError'); return write.call(this, name, value); };
  }, settingsKey);
  await openReading(page);
  await page.locator('.site-header [data-action="settings"]').click();
  await selectSettingsFor(page, 'archivePanelTransparency');
  const control = page.getByRole('spinbutton', { name: '首页阅读底板透明度数值', exact: true });
  await expect(control).toHaveValue('35');
  await control.fill('80'); await control.press('Tab');
  for (const fill of await fills(page)) expect(fill.alpha).toBeCloseTo(.2, 2);
});

test('首次翻阅时长可在首页书册设置调节并保存，旧设置补12秒且可恢复默认', async ({ page }) => {
  await openReading(page, { navFontSize: 22, navigationTypographyVersion: 2 });
  await page.locator('.site-header [data-action="settings"]').click();
  await selectSettingsFor(page, 'bookIntroDuration');
  const duration = page.getByRole('spinbutton', { name: '画册首次翻阅时长数值', exact: true });
  await expect(duration).toHaveValue('12');
  await duration.fill('24'); await duration.press('Tab');
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)).bookIntroDuration, settingsKey)).toBe(24);
  await page.reload();
  await page.locator('.site-header [data-action="settings"]').click();
  await selectSettingsFor(page, 'bookIntroDuration');
  await expect(duration).toHaveValue('24');
  const slider = page.getByRole('slider', { name: '画册首次翻阅时长', exact: true });
  await slider.focus(); await slider.press('Home'); await expect(duration).toHaveValue('3');
  await slider.press('End'); await expect(duration).toHaveValue('30');
  await page.getByRole('button', { name: '恢复默认参数' }).click();
  await expect(duration).toHaveValue('12');
});

async function prepareIntro(page, seconds) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(({ key, seconds }) => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    const settings = { carouselAutoplay: false, pushPage: false };
    if (seconds !== undefined) settings.bookIntroDuration = seconds;
    localStorage.setItem(key, JSON.stringify(settings));
  }, { key: settingsKey, seconds });
  await page.goto('/');
  await page.locator('#homeLionBook').evaluate(element => window.scrollTo({ top: scrollY + element.getBoundingClientRect().top - innerHeight + 150, behavior: 'instant' }));
  const book = page.locator('.lion-book-experience');
  await expect(book).toHaveAttribute('data-book-ready', 'true');
  await expect(book).toHaveAttribute('data-book-intro', 'pending');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 35_000 });
  return { book, frame: page.frameLocator('#homeLionBook iframe') };
}

test('真实浏览器默认首次翻阅约12秒完成七页并回到序卷', async ({ page }) => {
  test.setTimeout(45000);
  const { book, frame } = await prepareIntro(page);
  await frame.locator('body').evaluate(() => {
    window.introTiming = {};
    function sample() {
      if (introOn && !window.introTiming.start) window.introTiming.start = performance.now();
      if (!introOn && window.introTiming.start) { window.introTiming.seconds = (performance.now() - window.introTiming.start) / 1000; return; }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  await page.locator('.lion-book-stage').scrollIntoViewIfNeeded();
  await expect(book).toHaveAttribute('data-book-intro', 'playing');
  expect(await frame.locator('body').evaluate(() => riffle.reduce((sum, leaf) => sum + leaf.dur, 0))).toBeCloseTo(12, 6);
  await expect(book).toHaveAttribute('data-book-intro', 'done', { timeout: 20000 });
  await expect.poll(() => frame.locator('body').evaluate(() => window.introTiming.seconds)).toBeGreaterThan(11.6);
  expect(await frame.locator('body').evaluate(() => window.introTiming.seconds)).toBeLessThan(15);
  await expect(book).toHaveAttribute('data-book-index', '0');
});

test('进行中调整时长不重建画册，结束后调整不重播且手动翻页仍可用', async ({ page }) => {
  const { book, frame } = await prepareIntro(page, 30);
  await page.locator('.lion-book-stage').scrollIntoViewIfNeeded();
  await expect(book).toHaveAttribute('data-book-intro', 'playing');
  await frame.locator('body').evaluate(() => { window.sameBookInstance = true; });
  await page.locator('.site-header [data-action="settings"]').click();
  await selectSettingsFor(page, 'bookIntroDuration');
  const duration = page.getByRole('spinbutton', { name: '画册首次翻阅时长数值', exact: true });
  await duration.fill('3'); await duration.press('Tab');
  await expect.poll(() => frame.locator('body').evaluate(() => spring?.dur)).toBeCloseTo(3 / 7, 6);
  expect(await frame.locator('body').evaluate(() => window.sameBookInstance)).toBe(true);
  await expect(book).toHaveAttribute('data-book-intro', 'done');
  await duration.fill('24'); await duration.press('Tab');
  await expect(book).toHaveAttribute('data-book-intro', 'done');
  expect(await frame.locator('body').evaluate(() => ({ at: riffleAt, active: introOn }))).toEqual({ at: 7, active: false });
  await book.locator('[data-book-page="origin"]').click();
  await expect(book).toHaveAttribute('data-book-index', '1');
  await expect(book).toHaveAttribute('data-book-turning', 'false');
});
