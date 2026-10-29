import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { selectSettingsPage, settingsPanel } from './settings-navigation.helpers.js';

const reviewDirectory = path.resolve('source/reviews/expression-depth/2026-10-28');
const stage = page => page.getByRole('region', { name: '醒狮八态纵深图鉴', exact: true });
const snapshot = page => page.evaluate(() => window.__LION_DEPTH_SCENE__);
const viewports = [[1440, 900], [1920, 1080], [1366, 768], [1280, 720], [715, 616]];

if (process.env.EXPRESSION_DEPTH_LAYOUT_BASE_URL) test.use({ baseURL: process.env.EXPRESSION_DEPTH_LAYOUT_BASE_URL });
test.setTimeout(100_000);

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, bookAutoplay: false, pushPage: true }));
  });
  await mkdir(reviewDirectory, { recursive: true });
});

async function openDepth(page) {
  await page.goto('/?inspect=1#/state');
  await expect(stage(page)).toHaveClass(/has-webgl/, { timeout: 65_000 });
  await expect.poll(async () => (await snapshot(page))?.primaryCount).toBe(8);
  await page.evaluate(() => document.fonts.ready);
}

async function selectState(page, label, index) {
  await stage(page).getByRole('navigation', { name: '八态目录', exact: true }).getByRole('link', { name: label, exact: true }).click();
  await expect.poll(async () => Math.abs(((await snapshot(page))?.chapter ?? -100) - (index + 2))).toBeLessThan(.005);
  await expect.poll(async () => (await snapshot(page))?.faces[index]?.ready).toBe(true);
  await page.mouse.move(10, 10);
}

function contained(box, parent, description, tolerance = 1) {
  expect(box, `${description} exists`).not.toBeNull();
  expect(box.x, `${description} left`).toBeGreaterThanOrEqual(parent.x - tolerance);
  expect(box.y, `${description} top`).toBeGreaterThanOrEqual(parent.y - tolerance);
  expect(box.x + box.width, `${description} right`).toBeLessThanOrEqual(parent.x + parent.width + tolerance);
  expect(box.y + box.height, `${description} bottom`).toBeLessThanOrEqual(parent.y + parent.height + tolerance);
}

async function hostBounds(page) {
  const root = await stage(page).boundingBox();
  const header = await page.locator('.site-header').boundingBox();
  const viewport = page.viewportSize();
  expect(root.y).toBeCloseTo(header.y + header.height, 0);
  expect(root.y + root.height).toBeCloseTo(viewport.height, 0);
  expect(root.width).toBeLessThanOrEqual(viewport.width);
  expect(await page.locator('.site-header').count()).toBe(1);
  contained(await stage(page).locator('.scene-canvas canvas').boundingBox(), root, 'Canvas');
  const rail = stage(page).getByRole('navigation', { name: '八态目录', exact: true });
  contained(await rail.boundingBox(), root, 'state rail');
  await expect(rail.getByRole('link')).toHaveCount(8);
  for (const link of await rail.getByRole('link').all()) contained(await link.boundingBox(), root, `rail ${await link.getAttribute('aria-label')}`);
  return root;
}

async function screen(page, name) {
  await page.screenshot({ path: path.join(reviewDirectory, `layout-${name}.png`), animations: 'allow' });
}

async function visibleBrushPixels(page) {
  // Inspect compositor pixels. A fetched atlas and nonzero DOM bounds alone
  // would miss a URL that fails when used by the CSS mask at production BASE.
  const glyph = stage(page).locator('.hero-title .glyph-wake');
  const screenshot = await glyph.screenshot({ animations: 'allow' });
  return page.evaluate(async url => {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let red = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) if (pixels[offset] > 90 && pixels[offset] > pixels[offset + 1] * 1.5 && pixels[offset] > pixels[offset + 2] * 1.3) red++;
    return red;
  }, `data:image/png;base64,${screenshot.toString('base64')}`);
}

async function stateBounds(page, id, index) {
  const root = await hostBounds(page);
  const chapter = stage(page).locator(`[data-depth-id="${id}"]`);
  for (const selector of ['.project-topline', '.state-title-row', '.project-subtitle', '.project-description', '.project-open', '.narration-controls', '.project-bottomline']) {
    contained(await chapter.locator(selector).boundingBox(), root, `${id} ${selector}`);
  }
  const card = (await snapshot(page)).cards[index];
  expect(card.visible).toBe(true);
  expect(card.imageFailed).toBe(false);
  const artwork = card.artworkPlaneBounds;
  contained({ x: artwork.left, y: artwork.top, width: artwork.right - artwork.left, height: artwork.bottom - artwork.top }, root, `${id} lion artwork`);
  return { root, artwork, descriptionSize: await chapter.locator('.project-description').evaluate(element => getComputedStyle(element).fontSize) };
}

for (const [width, height] of viewports) {
  test(`电脑纵深排版 ${width}x${height}：卷首字图、喜怒双栏、回望及当前解读完整`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await openDepth(page);
    const root = await hostBounds(page);
    if (width === 715) {
      expect(root.width).toBeCloseTo(700, 0);
      expect(root.height).toBeCloseTo(500, 0);
    }
    contained(await stage(page).locator('.hero-title').boundingBox(), root, 'hero title');
    contained(await stage(page).locator('.hero-bottom').boundingBox(), root, 'hero lower copy');
    expect(await visibleBrushPixels(page)).toBeGreaterThan(200);
    await screen(page, `home-${width}x${height}`);

    await selectState(page, '喜', 0);
    const joy = await stateBounds(page, 'joy', 0);
    await screen(page, `joy-${width}x${height}`);
    await selectState(page, '怒', 1);
    const anger = await stateBounds(page, 'anger', 1);
    if (width === 1366 || width === 715) await screen(page, `anger-${width}x${height}`);

    await stage(page).focus();
    await page.keyboard.press('End');
    await expect.poll(async () => (await snapshot(page))?.chapter).toBeCloseTo(10, 2);
    const contact = stage(page).locator('[data-depth-id="contact"]');
    for (const selector of ['.contact-eyebrow', 'h2', '.contact-email', '.email-row', '.contact-details', '.site-footer']) {
      contained(await contact.locator(selector).boundingBox(), root, `contact ${selector}`);
    }
    if (width === 1280 || width === 715) await screen(page, `contact-${width}x${height}`);

    await selectState(page, '喜', 0);
    const artwork = (await snapshot(page)).cards[0].artworkPlaneBounds;
    await page.mouse.click(artwork.centerX, artwork.centerY);
    const dialog = stage(page).getByRole('dialog', { name: '喜 · 灵动欢喜', exact: true });
    await expect(dialog).toBeVisible({ timeout: 8_000 });
    contained(await stage(page).locator('.depth-gallery-backdrop').boundingBox(), root, 'module reader backdrop');
    contained(await dialog.boundingBox(), root, 'reader');
    await expect(dialog.locator('.gallery-image img')).toHaveCount(1);
    expect(await dialog.locator('.gallery-image img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    expect(await dialog.locator('.lion-reading-copy').evaluate(element => ['auto', 'scroll'].includes(getComputedStyle(element).overflowY))).toBe(true);
    if (width === 1440 || width === 715) await screen(page, `dialog-${width}x${height}`);
    await dialog.getByRole('button', { name: '关闭神态解读', exact: true }).click();
    expect(errors).toEqual([]);
    await writeFile(path.join(reviewDirectory, `layout-${width}x${height}.json`), JSON.stringify({ viewport: { width, height }, root, joy, anger, visibleAtlas: true, errors }, null, 2));
  });
}

test('设置推开后保留完整八态；简介与详情16→32字号实际增大', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDepth(page);
  await selectState(page, '喜', 0);
  const original = await hostBounds(page);
  await page.locator('.site-navigation [data-action="settings"]').click();
  await selectSettingsPage(page, '章节', '神态');
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await expect.poll(async () => (await stage(page).boundingBox()).width).toBeLessThan(original.width - 200);
  const pushed = await stateBounds(page, 'joy', 0);
  await screen(page, 'settings-push-1440x900');
  const overview = page.locator('#depth-joy .project-description');
  const computed = locator => locator.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  const change = async (label, value) => {
    const input = settingsPanel(page).getByRole('spinbutton', { name: `${label}数值`, exact: true });
    await input.fill(String(value)); await input.press('Tab'); await expect(input).toHaveValue(String(value));
  };
  await change('神态简介字号', 16);
  const overview16 = await computed(overview);
  await change('神态简介字号', 32);
  const overview32 = await computed(overview);
  await settingsPanel(page).getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(settingsPanel(page)).toHaveCount(0);
  await page.locator('#depth-joy .project-open').click();
  const reader = stage(page).getByRole('dialog', { name: '喜 · 灵动欢喜', exact: true });
  await expect(reader).toBeVisible({ timeout: 8_000 });
  const details = reader.locator('.lion-reading-copy dd').first();
  await page.locator('.site-navigation [data-action="settings"]').click();
  await selectSettingsPage(page, '章节', '神态');
  await change('神态解读字号', 16);
  const detail16 = await computed(details);
  await change('神态解读字号', 32);
  const detail32 = await computed(details);
  await writeFile(path.join(reviewDirectory, 'layout-font-settings.json'), JSON.stringify({ original, pushed, overview16, overview32, detail16, detail32 }, null, 2));
  expect(overview32, '简介字号设置 must change rendered text').toBeGreaterThan(overview16 * 1.2);
  expect(detail32, '详情字号设置 must change rendered text').toBeGreaterThan(detail16 * 1.2);
});
