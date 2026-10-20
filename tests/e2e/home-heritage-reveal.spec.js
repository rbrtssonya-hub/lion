import { test, expect } from '@playwright/test';
import { selectSettingsFor } from './settings-navigation.helpers.js';

async function openHeritage(page, reducedMotion = 'no-preference', url = '/') {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion });
  await page.addInitScript(() => {
    if (window !== top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, navigationTypographyVersion: 2 }));
  });
  await page.goto(url);
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 45000 });
  await page.locator('#homeLionTypes').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  return page.locator('#homeLionTypes');
}

async function expectCentered(types) {
  const figure = types.locator('.heritage-figure');
  await expect.poll(() => figure.evaluate(node => {
    const box = node.getBoundingClientRect();
    const parent = node.parentElement.getBoundingClientRect();
    return Math.abs((box.left + box.right - parent.left - parent.right) / 2);
  })).toBeLessThan(2);
}

test('a single centered type image reveals descriptions on the right without observation buttons', async ({ page }) => {
  const types = await openHeritage(page);
  await expect(types.locator('.heritage-heading .lion-archive-ornament img')).toHaveAttribute('src', /archive-ornament-peeking\.png$/);
  await expect(page.locator('#homeInheritors')).toHaveCount(0);
  await expect(page.locator('#homeCultureSources .home-culture-sources-emblem img')).toHaveAttribute('src', /archive-ornament-paw\.png$/);
  const imageButton = types.getByRole('button', { name: '展开佛山狮介绍', exact: true });
  await expect(imageButton).toHaveAttribute('aria-expanded', 'false');
  await expect(types.getByRole('tab')).toHaveCount(3);
  await expect(types.locator('.heritage-copy')).toBeHidden();
  await expect(types.locator('.heritage-hotspot, .heritage-point-list button')).toHaveCount(0);
  await expectCentered(types);
  await types.screenshot({ path: test.info().outputPath('lion-types-collapsed.png') });
  const centered = await imageButton.boundingBox();
  await imageButton.click();
  await expect(imageButton).toHaveAttribute('aria-expanded', 'true');
  const copy = types.locator('.heritage-copy');
  await expect(copy).toBeVisible();
  await expect(copy.getByRole('heading', { name: '佛山狮', exact: true })).toBeVisible();
  await expect(copy.getByRole('list', { name: '观察重点' }).getByRole('listitem')).toHaveCount(3);
  await expect(copy.getByRole('button')).toHaveCount(1);
  await expect(copy.getByRole('link', { name: /查阅资料/ }).first()).toHaveAttribute('href', /^https:\/\//);
  await expect.poll(async () => (await imageButton.boundingBox()).x).toBeLessThan(centered.x - 100);
  await expect.poll(async () => {
    const left = await imageButton.boundingBox();
    const right = await copy.boundingBox();
    return left.x + left.width - right.x;
  }).toBeLessThanOrEqual(1);
  await types.screenshot({ path: test.info().outputPath('lion-types-expanded.png') });
  await expect(types).toContainText(/AI辅助/);
  await expect(types.getByRole('heading', { name: '传统地狮' })).toBeVisible();
  await expect(types.getByRole('heading', { name: '高桩表演' })).toBeVisible();
});

test('Enter and Space reveal; Escape from the description and the close button restore image focus', async ({ page }) => {
  const types = await openHeritage(page);
  const imageButton = types.locator('.heritage-type-image');
  await expect(imageButton).toHaveAttribute('aria-expanded', 'false');
  for (const key of ['Enter', 'Space']) {
    await imageButton.focus();
    await imageButton.press(key);
    await expect(imageButton).toHaveAttribute('aria-expanded', 'true');
    await types.getByRole('link', { name: /查阅资料/ }).first().focus();
    await page.keyboard.press('Escape');
    await expect(types.locator('.heritage-copy')).toBeHidden();
    await expect(imageButton).toBeFocused();
    await expectCentered(types);
  }
  await imageButton.click();
  await types.getByRole('button', { name: '收起介绍', exact: true }).click();
  await expect(imageButton).toHaveAttribute('aria-expanded', 'false');
  await expect(imageButton).toBeFocused();
  await expectCentered(types);
});

test('changing type collapses the panel and keeps tabs, artwork, classifications and source observations synchronized', async ({ page }) => {
  const types = await openHeritage(page, 'reduce');
  const carouselIndex = await page.locator('#homeCulture').getAttribute('data-culture-index');
  const hash = new URL(page.url()).hash;
  for (const [name, id, kind, observation] of [
    ['佛山狮', 'foshan', '传统流派', '腰马与功架'],
    ['鹤山狮', 'heshan', '传统流派', '猫步与鼓点'],
    ['佛鹤狮', 'fut-hok', '融合形制', '制作与舞台'],
  ]) {
    await types.getByRole('tab', { name: new RegExp(name) }).click();
    const button = types.getByRole('button', { name: `展开${name}介绍`, exact: true });
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(types.locator('.heritage-copy')).toBeHidden();
    await expectCentered(types);
    await expect(types.locator('.heritage-figure img')).toHaveAttribute('src', new RegExp(`lion-types/${id}\\.png$`));
    await button.click();
    await expect(types.locator('.heritage-copy .heritage-kind')).toHaveText(kind);
    await expect(types.getByRole('list', { name: '观察重点' })).toContainText(observation);
  }
  const selected = types.getByRole('tab', { selected: true });
  await selected.focus();
  await selected.press('Home');
  await expect(types.getByRole('tab').first()).toBeFocused();
  await expect(types.locator('.heritage-copy')).toBeHidden();
  await types.getByRole('tab').first().press('End');
  await expect(types.getByRole('tab').last()).toBeFocused();
  await expect(types.locator('.heritage-type-image')).toHaveAttribute('aria-expanded', 'false');
  expect(await page.locator('#homeCulture').getAttribute('data-culture-index')).toBe(carouselIndex);
  expect(new URL(page.url()).hash).toBe(hash);
});

test('reduced motion disables reveal animation and desktop copy reflows beside or below the image', async ({ page }) => {
  const types = await openHeritage(page, 'reduce');
  for (const [width, height] of [[1920, 1080], [1366, 768], [1024, 768]]) {
    await page.setViewportSize({ width, height });
    await expectCentered(types);
    await types.locator('.heritage-type-image').click();
    const copy = types.locator('.heritage-copy');
    await expect(copy).toBeVisible();
    const image = await types.locator('.heritage-figure').boundingBox();
    const text = await copy.boundingBox();
    const available = await types.locator('.heritage-inner').evaluate(node => node.clientWidth);
    if (available >= 760) expect(image.x + image.width).toBeLessThanOrEqual(text.x + 1);
    else expect(image.y + image.height).toBeLessThanOrEqual(text.y + 1);
    expect(await types.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    for (const locator of [types.locator('[data-type-id]'), types.locator('.heritage-figure'), copy]) {
      const style = await locator.evaluate(node => ({ animation: getComputedStyle(node).animationName, transition: getComputedStyle(node).transitionDuration }));
      expect(style.animation).toBe('none');
      expect(style.transition.split(',').every(value => parseFloat(value) === 0)).toBe(true);
    }
    await types.getByRole('button', { name: '收起介绍', exact: true }).click();
  }
});

test('the mounted sidebar leaves readable type descriptions at narrow desktop widths and 900px pushed content', async ({ page }) => {
  const types = await openHeritage(page, 'reduce');
  for (const [width, height, pushed] of [[1366, 768, false], [1024, 768, false], [900, 768, false], [1500, 1080, true]]) {
    await page.setViewportSize({ width, height });
    if (pushed) {
      await page.locator('.site-header [data-action="settings"]').click();
      const settings = page.getByRole('region', { name: '开发者参数设置' });
      await selectSettingsFor(page, 'panelWidth');
      const shellWidth = await page.locator('.site-shell').evaluate(node => node.getBoundingClientRect().width);
      const panelWidth = settings.getByRole('spinbutton', { name: '设置面板宽度数值', exact: true });
      await panelWidth.fill(String(shellWidth - 900));
      await panelWidth.press('Tab');
      await expect.poll(() => page.locator('.site-page').evaluate(node => node.getBoundingClientRect().width)).toBe(900);
    }
    for (const name of ['佛山狮', '鹤山狮', '佛鹤狮']) {
      await types.getByRole('tab', { name: new RegExp(name) }).click();
      await expectCentered(types);
      await types.getByRole('button', { name: `展开${name}介绍`, exact: true }).click();
      await expect(page.getByRole('navigation', { name: '首页章节导航' })).toBeVisible();
      const geometry = await types.evaluate(section => {
        const article = section.querySelector('[data-type-id]');
        const image = article.querySelector('.heritage-figure').getBoundingClientRect();
        const copy = article.querySelector('.heritage-copy');
        const copyBox = copy.getBoundingClientRect();
        const summary = copy.querySelector('.heritage-summary');
        const summaryBox = summary.getBoundingClientRect();
        const fontSize = parseFloat(getComputedStyle(summary).fontSize);
        const rail = document.querySelector('.home-archive-nav').getBoundingClientRect();
        const page = document.querySelector('.site-page').getBoundingClientRect();
        return {
          lineCharacters: summaryBox.width / fontSize,
          imageOutsideRail: image.left >= rail.right,
          columnsSeparate: section.querySelector('.heritage-inner').clientWidth >= 760 ? image.right <= copyBox.left + 1 : image.bottom <= copyBox.top + 1,
          withinPage: copyBox.right <= page.right + 1,
          fits: section.scrollWidth <= section.clientWidth + 1 && [...copy.querySelectorAll('h3, h4, p, li, a')].every(node => node.scrollWidth <= node.clientWidth + 1),
        };
      });
      expect(geometry.lineCharacters, `${width}/${pushed}:${name} readable line length`).toBeGreaterThanOrEqual(16);
      expect(geometry).toMatchObject({ imageOutsideRail: true, columnsSeparate: true, withinPage: true, fits: true });
      await expect(types.getByRole('list', { name: '观察重点' }).getByRole('listitem')).toHaveCount(3);
      await expect(types.locator('.heritage-figure figcaption')).toContainText('AI辅助');
    }
    await types.locator('[data-type-id]').screenshot({ path: test.info().outputPath(`type-sidebar-${width}${pushed ? '-pushed' : ''}.png`) });
    await types.getByRole('button', { name: '收起介绍', exact: true }).click();
  }
});

test('failed type images still reveal observations and switching type resets to a usable collapsed image', async ({ page }) => {
  await page.route('**/assets/lion-types/**', route => route.abort());
  const types = await openHeritage(page, 'reduce');
  for (const name of ['佛山狮', '鹤山狮']) {
    await types.getByRole('tab', { name: new RegExp(name) }).click();
    await expect(types.locator('.heritage-image-fallback')).toBeVisible();
    const button = types.getByRole('button', { name: `展开${name}介绍`, exact: true });
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.press('Enter');
    await expect(types.getByRole('list', { name: '观察重点' }).getByRole('listitem')).toHaveCount(3);
    await button.press('Escape');
    await expectCentered(types);
  }
});

test('removed person entries stay absent when research photos are requested, and retained type fallback remains interactive', async ({ page }) => {
  const requests = [];
  page.on('request', request => {
    if (/\/(?:tmp\/home-inheritor-photos|assets\/home-heritage\/inheritors)\//.test(new URL(request.url()).pathname)) requests.push(request.url());
  });
  await page.route('**/assets/lion-types/**', route => route.abort());
  const types = await openHeritage(page, 'reduce', '/?researchPhotos=1');
  await expect(page.locator('#homeInheritors, .heritage-person-photo, .heritage-person-plaque')).toHaveCount(0);
  for (const name of ['佛山狮', '鹤山狮', '佛鹤狮']) {
    await types.getByRole('tab', { name: new RegExp(name) }).click();
    await expect(types.locator('.heritage-image-fallback')).toBeVisible();
    const image = types.getByRole('button', { name: `展开${name}介绍`, exact: true });
    await image.press('Enter');
    await expect(types.getByRole('list', { name: '观察重点' }).getByRole('listitem')).toHaveCount(3);
    await image.press('Escape');
    await expect(image).toBeFocused();
  }
  expect(requests).toEqual([]);
});

test('default homepage exposes four archive entries and retained source licences without person references', async ({ page }) => {
  await openHeritage(page, 'reduce');
  const nav = page.getByRole('navigation', { name: '首页章节导航' });
  await expect(nav.getByRole('button')).toHaveText(['岭南醒狮志', '醒狮文化', '醒狮种类', '参考资料']);
  await expect(page.locator('#homeInheritors, [data-person-id], .archive-portrait-sources')).toHaveCount(0);
  const sources = page.locator('#homeCultureSources');
  await sources.scrollIntoViewIfNeeded();
  await expect(sources.locator('.heritage-source-group')).toHaveCount(2);
  await expect(sources.getByRole('heading', { name: '历史与文化', exact: true })).toBeVisible();
  await expect(sources.getByRole('heading', { name: '形制与工艺', exact: true })).toBeVisible();
  await expect(sources.getByRole('heading', { name: '人物资料', exact: true })).toHaveCount(0);
  await expect(sources.getByRole('link', { name: /照片来源/ })).toHaveCount(0);
  await sources.getByText('图像说明与工程许可', { exact: true }).click();
  await expect(sources.getByRole('link', { name: /ThreeUI/ })).toHaveAttribute('href', /threeui-LICENSE/);
  await sources.getByText('摄影署名与许可', { exact: true }).click();
  await expect(sources.locator('.home-culture-photo-license')).toHaveCount(8);
});

test('retained type descriptions share paper controls and texture without shrinking or dimming their text', async ({ page }) => {
  const types = await openHeritage(page, 'reduce');
  await types.locator('.heritage-type-image').click();
  const copy = types.locator('.heritage-type-copy');
  await expect(copy).toHaveClass(/archive-reading-panel/);
  await expect(copy).toHaveAttribute('data-surface', 'cultureBody');
  const fonts = () => copy.locator('.heritage-summary, .heritage-observations p').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).fontSize));
  const initialFonts = await fonts();
  expect(initialFonts).toHaveLength(4);
  for (const size of initialFonts) expect(parseFloat(size)).toBeGreaterThanOrEqual(18);
  const texture = () => copy.evaluate(node => ({ image: getComputedStyle(node, '::after').backgroundImage, opacity: Number(getComputedStyle(node, '::after').opacity) }));
  expect((await texture()).image).toContain('home-archive-ink-2026-10-20.png');
  expect((await texture()).opacity).toBeGreaterThan(0);
  await page.locator('.site-header [data-action="settings"]').click();
  const settings = page.getByRole('region', { name: '开发者参数设置' });
  await selectSettingsFor(page, 'cultureBody');
  for (const [name, value] of [['文化正文底板宽度数值', '80'], ['文化正文底板圆角数值', '22'], ['文化正文底板透明度数值', '100']]) {
    const input = settings.getByRole('spinbutton', { name, exact: true });
    await input.fill(value);
    await input.press('Tab');
  }
  await expect(copy).toHaveCSS('background-color', 'rgba(255, 249, 238, 0)');
  await expect(copy).toHaveCSS('border-radius', '22px');
  await expect(copy).toHaveCSS('--surface-width', '80%');
  await expect(copy).toHaveCSS('opacity', '1');
  await expect(copy).toHaveCSS('backdrop-filter', 'none');
  expect((await texture()).opacity).toBe(0);
  const transparency = settings.getByRole('spinbutton', { name: '文化正文底板透明度数值', exact: true });
  await transparency.fill('0');
  await transparency.press('Tab');
  await expect(copy).toHaveCSS('background-color', 'rgb(255, 249, 238)');
  expect((await texture()).opacity).toBeGreaterThan(0);
  await settings.getByRole('button', { name: '关闭开发者参数', exact: true }).click();
  await expect.poll(fonts).toEqual(initialFonts);
  for (const name of ['佛山狮', '鹤山狮', '佛鹤狮']) {
    await types.getByRole('tab', { name: new RegExp(name) }).click();
    await types.getByRole('button', { name: `展开${name}介绍`, exact: true }).click();
    await expect(copy).toHaveAttribute('data-surface', 'cultureBody');
    await expect(copy).toHaveCSS('border-radius', '22px');
    await expect(copy).toHaveCSS('opacity', '1');
    await expect.poll(fonts).toEqual(initialFonts);
  }
  await types.screenshot({ path: test.info().outputPath('type-paper-controls.png') });
});

for (const flag of ['0', 'true', '1']) test(`legacy researchPhotos=${flag} never restores removed person entries or requests photographs`, async ({ page }) => {
  const requests = [];
  page.on('request', request => {
    if (/\/(?:tmp\/home-inheritor-photos|assets\/home-heritage\/inheritors)\//.test(new URL(request.url()).pathname)) requests.push(request.url());
  });
  await openHeritage(page, 'reduce', `/?researchPhotos=${flag}`);
  await expect(page.locator('#homeInheritors, [data-person-id], .archive-portrait-sources')).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: '首页章节导航' });
  await expect(nav.getByRole('button')).toHaveCount(4);
  await nav.getByRole('button', { name: '参考资料', exact: true }).click();
  const sources = page.locator('#homeCultureSources');
  await sources.getByText('图像说明与工程许可', { exact: true }).click();
  await expect(sources.getByRole('link', { name: /照片来源/ })).toHaveCount(0);
  await expect(sources).toContainText('AI辅助');
  expect(requests).toEqual([]);
});
