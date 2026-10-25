import { test, expect } from '@playwright/test';
import { selectSettingsFor } from './settings-navigation.helpers.js';

async function openHeritage(page, url = '/') {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    if (window !== top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, bookAutoplay: false, navigationTypographyVersion: 2 }));
  });
  await page.goto(url);
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45000 });
  await page.locator('#enterWork').click();
  await page.locator('.home-archive-nav [data-home-section="homeLionTypes"]').click();
  return page.locator('#homeLionTypes');
}

test('type artwork and its complete basic reading share the screen without hiding observations', async ({ page }) => {
  const types = await openHeritage(page);
  await expect(types.locator('.heritage-heading .lion-archive-ornament img')).toHaveAttribute('src', /archive-ornament-peeking\.png$/);
  await expect(types.getByRole('tab')).toHaveCount(3);
  const copy = types.locator('.heritage-copy');
  await expect(copy).toBeVisible();
  await expect(copy.getByRole('heading', { name: '佛山狮', exact: true })).toBeVisible();
  await expect(types.getByRole('list', { name: '观察重点' }).getByRole('listitem')).toHaveCount(3);
  await expect(copy.getByRole('button')).toHaveCount(0);
  await expect(types.locator('.heritage-hotspot, .heritage-point-list button')).toHaveCount(0);
  const image = await types.locator('.heritage-figure').boundingBox();
  const text = await copy.boundingBox();
  expect(image.x + image.width).toBeLessThanOrEqual(text.x + 1);
  await expect(types.getByRole('heading', { name: '传统地狮' })).toBeInViewport();
  await expect(types.getByRole('heading', { name: '高桩表演' })).toBeInViewport();
});

test('Enter and Space on artwork open a real comparison; Escape restores an available mode control', async ({ page }) => {
  const types = await openHeritage(page);
  for (const key of ['Enter', 'Space']) {
    await types.locator('.heritage-type-image').press(key);
    await expect(types).toHaveAttribute('data-reading-mode', 'compare');
    await expect(types.locator('.heritage-comparison-card')).toHaveCount(2);
    await expect(types.getByRole('combobox', { name: '左侧醒狮形制' })).toHaveValue('foshan');
    await expect(types.getByRole('combobox', { name: '右侧醒狮形制' })).toHaveValue('heshan');
    await page.keyboard.press('Escape');
    await expect(types).toHaveAttribute('data-reading-mode', 'single');
    await expect(types.getByRole('button', { name: '形制对照', exact: true })).toBeFocused();
    await expect(types.locator('.heritage-summary')).toBeVisible();
  }
});

test('type tabs and local keyboard keep the visible artwork, classification and observations synchronized', async ({ page }) => {
  const types = await openHeritage(page);
  const carouselIndex = await page.locator('#homeCulture').getAttribute('data-culture-index');
  const hash = new URL(page.url()).hash;
  for (const [name, id, kind, observation] of [
    ['佛山狮', 'foshan', '传统流派', '腰马与功架'],
    ['鹤山狮', 'heshan', '传统流派', '猫步与鼓点'],
    ['佛鹤狮', 'fut-hok', '融合形制', '制作与舞台'],
  ]) {
    await types.getByRole('tab', { name: new RegExp(name) }).click();
    await expect(types.locator('.heritage-copy')).toBeVisible();
    await expect(types.locator('.heritage-figure img')).toHaveAttribute('src', new RegExp(`lion-types/${id}\\.png$`));
    await expect(types.locator('.heritage-copy .heritage-kind')).toHaveText(kind);
    await expect(types.getByRole('list', { name: '观察重点' })).toContainText(observation);
  }
  await types.getByRole('tab', { selected: true }).press('Home');
  await expect(types.getByRole('tab').first()).toBeFocused();
  await types.getByRole('tab').first().press('End');
  await expect(types.getByRole('tab').last()).toBeFocused();
  await expect(types.locator('.heritage-copy')).toBeVisible();
  expect(await page.locator('#homeCulture').getAttribute('data-culture-index')).toBe(carouselIndex);
  expect(new URL(page.url()).hash).toBe(hash);
});

test('failed artwork keeps basic reading available and can still open the comparison', async ({ page }) => {
  await page.route('**/assets/lion-types/**', route => route.abort());
  const types = await openHeritage(page);
  for (const name of ['佛山狮', '鹤山狮']) {
    await types.getByRole('tab', { name: new RegExp(name) }).click();
    await expect(types.locator('.heritage-image-fallback')).toBeVisible();
    await expect(types.getByRole('list', { name: '观察重点' }).getByRole('listitem')).toHaveCount(3);
    await types.locator('.heritage-type-image').press('Enter');
    await expect(types.locator('.heritage-comparison-card')).toHaveCount(2);
    await page.keyboard.press('Escape');
  }
});

test('reading material controls retain independent transparency, corner radius and unchanged text sizes', async ({ page }) => {
  const types = await openHeritage(page);
  const copy = types.locator('.heritage-copy');
  const fonts = () => types.locator('.heritage-summary, .heritage-observations p').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).fontSize));
  const initialFonts = await fonts();
  expect(initialFonts).toHaveLength(4);
  await page.locator('.site-header [data-action="settings"]').click();
  const settings = page.getByRole('region', { name: '开发者参数设置' });
  await selectSettingsFor(page, 'cultureBody');
  for (const [name, value] of [['文化正文底板宽度数值', '80'], ['文化正文底板圆角数值', '22'], ['文化正文底板透明度数值', '100']]) {
    const input = settings.getByRole('spinbutton', { name, exact: true });
    await input.fill(value); await input.press('Tab');
  }
  await expect(copy).toHaveCSS('background-color', 'rgba(247, 245, 240, 0)');
  await expect(copy).toHaveCSS('border-radius', '22px');
  await expect(copy).toHaveCSS('--surface-width', '80%');
  await expect(copy).toHaveCSS('opacity', '1');
  await expect(copy).toHaveCSS('backdrop-filter', 'none');
  await settings.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect.poll(fonts).toEqual(initialFonts);
  for (const name of ['佛山狮', '鹤山狮', '佛鹤狮']) {
    await types.getByRole('tab', { name: new RegExp(name) }).click();
    await expect(copy).toHaveCSS('border-radius', '22px');
    await expect.poll(fonts).toEqual(initialFonts);
  }
});

for (const flag of ['0', 'true', '1']) test(`legacy researchPhotos=${flag} never restores person entries or requests photographs`, async ({ page }) => {
  const requests = [];
  page.on('request', request => {
    if (/\/(?:tmp\/home-inheritor-photos|assets\/home-heritage\/inheritors)\//.test(new URL(request.url()).pathname)) requests.push(request.url());
  });
  await openHeritage(page, `/?researchPhotos=${flag}`);
  await expect(page.locator('#homeInheritors, [data-person-id], .archive-portrait-sources')).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: '首页章节导航' });
  await expect(nav.locator('[data-home-section]')).toHaveCount(4);
  await nav.getByRole('button', { name: '参考资料', exact: true }).click();
  await expect(page.locator('#homeCultureSources').getByRole('link', { name: /照片来源/ })).toHaveCount(0);
  await expect(page.locator('#homeCultureSources')).toContainText('AI辅助');
  expect(requests).toEqual([]);
});
