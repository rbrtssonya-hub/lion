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
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-ready', 'true');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 35_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#enterWork').click();
  await expect(page.locator('.home-archive-nav')).toBeVisible();
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

test('画册紧凑题签、完整纸面、七站与说明同屏，正文保持可读且外边界对齐', async ({ page }) => {
  await openReading(page);
  for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.locator('#homeLionBook').evaluate(section =>
      Math.abs(section.getBoundingClientRect().top - document.querySelector('.site-header').getBoundingClientRect().bottom))).toBeLessThan(2);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const layout = await page.evaluate(() => {
      const box = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
      const content = ['.lion-book-heading', '.lion-book-stage', '.lion-book-timeline', '.lion-book-reading'].map(selector => ({ selector, ...box(selector) }));
      const paragraph = document.querySelector('.lion-book-reading-copy>p');
      const range = document.createRange(); range.selectNodeContents(paragraph);
      return { content, header: box('.site-header'), title: box('#lion-book-title'),
        paragraph: range.getBoundingClientRect().toJSON(), bodyFont: parseFloat(getComputedStyle(paragraph).fontSize),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    for (const block of layout.content) {
      expect(block.top, block.selector).toBeGreaterThanOrEqual(layout.header.bottom - 1);
      expect(block.bottom, block.selector).toBeLessThanOrEqual(height + 1);
      expect(Math.abs(block.left - layout.content[0].left), block.selector).toBeLessThan(2);
      expect(Math.abs(block.right - layout.content[0].right), block.selector).toBeLessThan(2);
    }
    expect(layout.content[0].height).toBeLessThanOrEqual(90);
    expect(layout.title.top).toBeGreaterThanOrEqual(layout.content[0].top);
    expect(layout.title.bottom).toBeLessThanOrEqual(layout.content[0].bottom);
    expect(layout.bodyFont).toBeGreaterThanOrEqual(18);
    expect(layout.paragraph.bottom).toBeLessThan(layout.content[3].bottom);
    const paper = await page.frameLocator('#homeLionBook iframe').locator('#sbBook').evaluate(element => {
      const box = element.getBoundingClientRect();
      return { top: box.top + box.height * .218, bottom: box.top + box.height * .782 };
    });
    const iframe = await page.locator('#homeLionBook iframe').boundingBox();
    expect(paper.top + iframe.y).toBeGreaterThanOrEqual(layout.content[1].top - 3);
    expect(paper.bottom + iframe.y).toBeLessThanOrEqual(layout.content[1].bottom + 3);
    expect(layout.overflow).toBeLessThanOrEqual(0);
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
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), settingsKey)).toMatchObject({ navFontSize: 22, helperFontSize: 16, archivePanelTransparency: 35 });
  await page.locator('.site-header [data-action="settings"]').click();
  await selectSettingsFor(page, 'archivePanelTransparency');
  await control.fill('68'); await control.press('Tab');
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)).archivePanelTransparency, settingsKey)).toBe(68);
  // The initializer only seeds empty storage; reload must retain the saved value.
  await page.reload();
  await page.locator('.site-header [data-action="settings"]').click();
  await selectSettingsFor(page, 'archivePanelTransparency');
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

test('每页停留时间和循环开关可预览保存，旧设置补默认且可恢复', async ({ page }) => {
  await openReading(page, { navFontSize: 22, navigationTypographyVersion: 2, bookIntroDuration: 24 });
  await page.locator('.site-header [data-action="settings"]').click();
  await selectSettingsFor(page, 'bookPageInterval');
  const duration = page.getByRole('spinbutton', { name: '每页停留时间数值', exact: true });
  const autoplay = page.getByRole('checkbox', { name: '按页码循环播放', exact: true });
  await expect(duration).toHaveValue('8');
  await expect(autoplay).toBeChecked();
  await expect(page.getByText('画册首次翻阅时长', { exact: true })).toHaveCount(0);
  await duration.fill('24'); await duration.press('Tab');
  await autoplay.uncheck();
  await expect(page.locator('.lion-book-experience')).toHaveAttribute('data-book-playback', 'disabled');
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)).bookPageInterval, settingsKey)).toBe(24);
  await page.reload();
  await page.locator('.site-header [data-action="settings"]').click();
  await selectSettingsFor(page, 'bookPageInterval');
  await expect(duration).toHaveValue('24');
  await expect(autoplay).not.toBeChecked();
  const slider = page.getByRole('slider', { name: '每页停留时间', exact: true });
  await slider.focus(); await slider.press('Home'); await expect(duration).toHaveValue('3');
  await slider.press('End'); await expect(duration).toHaveValue('30');
  await page.getByRole('button', { name: '恢复默认参数' }).click();
  await expect(duration).toHaveValue('8');
  await expect(autoplay).toBeChecked();
});

test('调整循环参数不重建画册，停用后保留当前页且手动翻页仍可用', async ({ page }) => {
  await openReading(page, { bookAutoplay: true, bookPageInterval: 30, pushPage: false });
  const book = page.locator('.lion-book-experience');
  const frame = page.frameLocator('#homeLionBook iframe');
  await frame.locator('body').evaluate(() => { window.sameBookInstance = true; });
  await page.locator('.site-header [data-action="settings"]').click();
  await selectSettingsFor(page, 'bookPageInterval');
  const duration = page.getByRole('spinbutton', { name: '每页停留时间数值', exact: true });
  await duration.fill('3'); await duration.press('Tab');
  expect(await frame.locator('body').evaluate(() => window.sameBookInstance)).toBe(true);
  await page.getByRole('checkbox', { name: '按页码循环播放', exact: true }).uncheck();
  await expect(book).toHaveAttribute('data-book-playback', 'disabled');
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await book.locator('[data-book-page="origin"]').click();
  await expect(book).toHaveAttribute('data-book-index', '1');
  await expect(book).toHaveAttribute('data-book-turning', 'false');
  expect(await frame.locator('body').evaluate(() => ({ sequence: riffle, active: introOn }))).toEqual({ sequence: null, active: false });
});
