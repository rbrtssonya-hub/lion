import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { inheritorPhotos as photos } from '../../src/data/inheritor-photos.js';
const people = [
  ['feng-kunjie', '冯昆杰'], ['zhao-jihong', '赵继红'], ['huang-qintian', '黄钦添'],
  ['zhao-weibin', '赵伟斌'], ['li-wei', '黎伟'], ['li-wanzhen', '黎婉珍'],
];

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
  await expect(page.locator('#homeInheritors .heritage-heading .lion-archive-ornament img')).toHaveAttribute('src', /archive-ornament-paw\.png$/);
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

test('reduced motion disables reveal animation and desktop widths keep expanded copy beside the image', async ({ page }) => {
  const types = await openHeritage(page, 'reduce');
  for (const [width, height] of [[1920, 1080], [1366, 768], [1024, 768]]) {
    await page.setViewportSize({ width, height });
    await expectCentered(types);
    await types.locator('.heritage-type-image').click();
    const copy = types.locator('.heritage-copy');
    await expect(copy).toBeVisible();
    const image = await types.locator('.heritage-figure').boundingBox();
    const text = await copy.boundingBox();
    expect(image.x + image.width).toBeLessThanOrEqual(text.x + 1);
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
      await settings.getByRole('tab', { name: '布局', exact: true }).click();
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
          columnsSeparate: image.right <= copyBox.left + 1,
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

test('six person choices retain recognition and filters, with a name plaque when a photograph is absent or fails', async ({ page }) => {
  for (const photo of Object.values(photos)) if (photo.src) {
    const pathname = new URL(photo.src, 'http://local/').pathname;
    await page.route(`**${pathname}`, route => route.abort());
  }
  await openHeritage(page, 'reduce', '/?researchPhotos=1');
  const section = page.locator('#homeInheritors');
  for (const [id, name] of people) {
    await section.getByRole('button', { name: `查看${name}档案`, exact: true }).click();
    await expect(section.locator('[data-person-id]')).toHaveAttribute('data-person-id', id);
    await expect(section.locator('.heritage-person-detail h3')).toHaveText(name);
    await expect(section.getByLabel(`${name}姓名档案牌`).locator('strong')).toHaveText(name);
    await expect(section.getByText('姓名档案牌 · 非人物肖像', { exact: true })).toBeVisible();
    if (['huang-qintian', 'zhao-weibin', 'li-wei', 'li-wanzhen'].includes(id)) await expect(section.locator('.heritage-person-level')).toContainText('国家级');
  }
  await section.getByRole('button', { name: '舞狮表演', exact: true }).click();
  await expect(section.locator('.heritage-person-choice')).toHaveCount(4);
  await expect(section.locator('[data-person-id]')).toHaveAttribute('data-person-id', 'feng-kunjie');
  await section.getByRole('button', { name: '狮头扎作', exact: true }).click();
  await expect(section.locator('.heritage-person-choice')).toHaveCount(2);
  await expect(section.locator('[data-person-id]')).toHaveAttribute('data-person-id', 'li-wei');
});

test('default pages show six name plaques and photo sources without requesting research photographs', async ({ page }) => {
  const requests = [];
  page.on('request', request => {
    if (/\/(?:tmp\/home-inheritor-photos|assets\/home-heritage\/inheritors)\//.test(new URL(request.url()).pathname)) requests.push(request.url());
  });
  await openHeritage(page, 'reduce');
  const section = page.locator('#homeInheritors');
  for (const [id, name] of people) {
    const photo = photos[id];
    await section.getByRole('button', { name: `查看${name}档案`, exact: true }).click();
    await expect(section.locator('.heritage-person-photo')).toHaveCount(0);
    const figure = section.getByLabel(`${name}姓名档案牌`);
    await expect(figure.locator('strong')).toHaveText(name);
    await expect(figure.locator('figcaption')).toContainText('姓名档案牌 · 非人物肖像');
    await expect(figure.locator('figcaption')).not.toContainText(photo.credit);
    await expect(figure.locator('figcaption')).not.toContainText(photo.rights);
    await expect(figure.getByRole('link', { name: /照片来源/ })).toHaveAttribute('href', photo.sourceUrl);
  }
  expect(requests).toEqual([]);
});

test('fallback name plaques share paper controls and texture without shrinking or dimming their text', async ({ page }) => {
  await openHeritage(page, 'reduce');
  const section = page.locator('#homeInheritors');
  const plaque = section.getByLabel('冯昆杰姓名档案牌');
  await expect(plaque).toHaveClass(/archive-reading-panel/);
  await expect(plaque).toHaveAttribute('data-surface', 'cultureBody');
  await expect(plaque.locator('.heritage-plaque-paper')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const fonts = () => section.evaluate(node => ['.heritage-plaque-paper strong', '.heritage-plaque-paper > span', '.heritage-person-detail .heritage-summary'].map(selector => getComputedStyle(node.querySelector(selector)).fontSize));
  const initialFonts = await fonts();
  expect(parseFloat(initialFonts[2])).toBeGreaterThanOrEqual(18);
  const texture = () => plaque.evaluate(node => ({ image: getComputedStyle(node, '::after').backgroundImage, opacity: Number(getComputedStyle(node, '::after').opacity) }));
  expect((await texture()).image).toContain('home-archive-ink-2026-10-20.png');
  expect((await texture()).opacity).toBeGreaterThan(0);
  await page.locator('.site-header [data-action="settings"]').click();
  const settings = page.getByRole('region', { name: '开发者参数设置' });
  await settings.getByRole('tab', { name: '外观', exact: true }).click();
  for (const [name, value] of [['文化正文底板宽度数值', '80'], ['文化正文底板圆角数值', '22'], ['文化正文底板透明度数值', '100']]) {
    const input = settings.getByRole('spinbutton', { name, exact: true });
    await input.fill(value);
    await input.press('Tab');
  }
  await expect(plaque).toHaveCSS('background-color', 'rgba(255, 249, 238, 0)');
  await expect(plaque).toHaveCSS('border-radius', '22px');
  await expect(plaque).toHaveCSS('opacity', '1');
  await expect(plaque).toHaveCSS('backdrop-filter', 'none');
  expect((await texture()).opacity).toBe(0);
  // The settings panel's push changes the containing column; compare its own ratio.
  const columns = await plaque.evaluate(node => getComputedStyle(node.parentElement).gridTemplateColumns.split(' ').map(parseFloat));
  expect(await plaque.evaluate(node => node.getBoundingClientRect().width)).toBeCloseTo(columns[0] * .8, 0);
  const transparency = settings.getByRole('spinbutton', { name: '文化正文底板透明度数值', exact: true });
  await transparency.fill('0');
  await transparency.press('Tab');
  await expect(plaque).toHaveCSS('background-color', 'rgb(255, 249, 238)');
  expect((await texture()).opacity).toBeGreaterThan(0);
  await page.locator('.site-header [data-action="settings"]').click();
  await expect.poll(fonts).toEqual(initialFonts);
  for (const [, name] of people) {
    await section.getByRole('button', { name: `查看${name}档案`, exact: true }).click();
    const current = section.getByLabel(`${name}姓名档案牌`);
    await expect(current).toHaveClass(/archive-reading-panel/);
    await expect(current).toHaveAttribute('data-surface', 'cultureBody');
    await expect(current.locator('.heritage-plaque-paper')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  }
  await section.screenshot({ path: test.info().outputPath('inheritors-paper-controls-plaque.png') });
});

for (const flag of ['0', 'true']) test(`researchPhotos=${flag} keeps the local photo preview disabled`, async ({ page }) => {
  const requests = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/tmp/home-inheritor-photos/')) requests.push(request.url());
  });
  await openHeritage(page, 'reduce', `/?researchPhotos=${flag}`);
  const section = page.locator('#homeInheritors');
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByLabel('冯昆杰姓名档案牌')).toBeVisible();
  await expect(section.locator('figure img')).toHaveCount(0);
  expect(requests).toEqual([]);
});

test('researchPhotos=1 loads local originals only in development; production keeps plaques and makes no photo requests', async ({ page }) => {
  const requests = [];
  page.on('request', request => {
    if (/\/(?:tmp\/home-inheritor-photos|assets\/home-heritage\/inheritors)\//.test(new URL(request.url()).pathname)) requests.push(request.url());
  });
  await openHeritage(page, 'reduce', '/?researchPhotos=1');
  const development = await page.locator('script[src$="/@vite/client"]').count() > 0;
  const section = page.locator('#homeInheritors');
  for (const [id, name] of people) {
    const photo = photos[id];
    await section.getByRole('button', { name: `查看${name}档案`, exact: true }).click();
    if (!development) {
      const figure = section.getByLabel(`${name}姓名档案牌`);
      await expect(figure).toBeVisible();
      await expect(figure.locator('figcaption')).toContainText('姓名档案牌 · 非人物肖像');
      await expect(figure.locator('figcaption')).not.toContainText(photo.credit);
      await expect(figure.locator('figcaption')).not.toContainText(photo.rights);
      await expect(section.locator('figure img')).toHaveCount(0);
      await expect(section.getByRole('link', { name: /照片来源/ })).toHaveAttribute('href', photo.sourceUrl);
      continue;
    }
    const figure = section.locator('.heritage-person-photo');
    await expect(figure).not.toHaveClass(/archive-reading-panel/);
    await expect(figure).not.toHaveAttribute('data-surface', 'cultureBody');
    const image = figure.getByRole('img');
    const extension = id === 'feng-kunjie' ? 'jpeg' : 'jpg';
    await expect(image).toBeVisible();
    expect(new URL(await image.getAttribute('src'), page.url()).pathname).toBe(`/tmp/home-inheritor-photos/${id}.${extension}`);
    await expect(image).toHaveAttribute('alt', photo.alt);
    await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
    await expect(figure.locator('figcaption')).toContainText(photo.credit);
    await expect(figure.locator('figcaption')).toContainText(photo.rights);
    await expect(figure.getByRole('link', { name: /照片来源/ })).toHaveAttribute('href', photo.sourceUrl);
    await figure.screenshot({ path: fileURLToPath(new URL(`../../tmp/home-inheritor-photos-qa/${id}.png`, import.meta.url)) });
  }
  if (development) expect(requests).toHaveLength(6);
  else expect(requests).toEqual([]);
  await section.screenshot({ path: development
    ? fileURLToPath(new URL('../../tmp/home-inheritor-photos-qa/inheritors-local-preview.png', import.meta.url))
    : test.info().outputPath('inheritors-production-plaque.png') });
});
