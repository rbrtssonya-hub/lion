import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { assetPaths } from '../../src/config/assetPaths.js';
import { selectSettingsFor, settingsPanel } from './settings-navigation.helpers.js';

const parts = JSON.parse(readFileSync(new URL('../../src/data/lion-structure.json', import.meta.url), 'utf8')).hotspots;
const artwork = [
  ['神', 'shen.png', '一笔绘神采，百色塑狮魂。'],
  ['威', 'wei.png', '双目藏神气，扬眉见雄风。'],
  ['冠', 'guan.png', '额间凝瑞彩，角上见精神。'],
  ['启', 'qi.png', '一张一合间，百态皆生动。'],
  ['灵', 'ling.png', '须随风而动，饰随势而生。'],
  ['势', 'shi.png', '彩被翻如浪，狮尾动生风。'],
];

async function preparePage(page, viewport, savedSettings = {}) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(settings => {
    if (window !== top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, navigationTypographyVersion: 2, ...settings }));
  }, savedSettings);
}

async function openModel(page, viewport = { width: 1920, height: 1080 }, savedSettings = {}) {
  await preparePage(page, viewport, savedSettings);
  await page.goto('/#/model');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-focus-state', 'idle');
}

async function expectSelection(page, index, focus = true) {
  const part = parts[index];
  await expect(page.locator('#modelStage')).toHaveAttribute('data-selected-id', part.id);
  await expect(page.locator('#panelTitle')).toHaveText(part.name);
  await expect(page.locator('#structureCalligraphy')).toHaveAttribute('src', new RegExp(`/${artwork[index][1]}$`));
  await expect(page.locator('#structureCalligraphy')).toHaveAttribute('alt', new RegExp(artwork[index][0]));
  await expect(page.locator('#structurePanel')).toContainText(artwork[index][2]);
  if (focus) {
    await expect(page.locator(`#modelHotspots [data-id="${part.id}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#modelStage')).toHaveAttribute('data-focus-state', part.id);
    await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-focused-part', part.id);
    await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-focus-state', 'idle');
  }
}

async function expectLabelsClearHeading(page) {
  const intersections = await page.locator('#sceneFrame').evaluate(frame => {
    const heading = frame.querySelector('.model-scene-heading').getBoundingClientRect();
    return [...frame.querySelectorAll('.model-hotspot[data-visible="true"]')].filter(node => {
      const label = node.getBoundingClientRect();
      return label.left < heading.right && label.right > heading.left && label.top < heading.bottom && label.bottom > heading.top;
    }).map(node => node.dataset.id);
  });
  expect(intersections, 'projected labels leave the scene title legible').toEqual([]);
}

async function expectGlobalNavigationInViewport(page) {
  const header = await page.locator('.site-header').boundingBox();
  const viewport = page.viewportSize();
  expect(header.x).toBeGreaterThanOrEqual(-1);
  expect(header.y).toBeGreaterThanOrEqual(-1);
  expect(header.x + header.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(header.y + header.height).toBeLessThanOrEqual(viewport.height + 1);
  const nav = await page.locator('.site-header .site-navigation').boundingBox();
  expect(nav.y).toBeGreaterThanOrEqual(header.y - 1);
  expect(nav.y + nav.height).toBeLessThanOrEqual(header.y + header.height + 1);
  for (const button of await page.locator('.site-header .site-nav-item[data-route]').all()) {
    await expect(button).toBeInViewport();
    const bounds = await button.boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(header.y - 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(header.y + header.height + 1);
    for (const child of await button.locator('.site-nav-icon, .site-nav-copy').all()) {
      const content = await child.boundingBox();
      expect(content.y, 'navigation artwork and text stay inside the header').toBeGreaterThanOrEqual(header.y - 1);
      expect(content.y + content.height, 'navigation artwork and text stay inside the header').toBeLessThanOrEqual(header.y + header.height + 1);
    }
  }
}

async function imagePixels(image) {
  return image.evaluate(async node => {
    await node.decode();
    const sample = document.createElement('canvas');
    sample.width = node.naturalWidth;
    sample.height = node.naturalHeight;
    const context = sample.getContext('2d');
    context.drawImage(node, 0, 0);
    const data = context.getImageData(0, 0, sample.width, sample.height).data;
    let transparent = 0, visible = 0, cinnabar = 0, borderInk = 0;
    for (let y = 0; y < sample.height; y += 1) {
      for (let x = 0; x < sample.width; x += 1) {
        const offset = (y * sample.width + x) * 4;
        const alpha = data[offset + 3];
        if (alpha === 0) transparent += 1;
        if (alpha > 32) {
          visible += 1;
          if (data[offset] > data[offset + 1] * 1.3 && data[offset] > data[offset + 2] * 1.3) cinnabar += 1;
          if (x === 0 || y === 0 || x === sample.width - 1 || y === sample.height - 1) borderInk += 1;
        }
      }
    }
    return { src: node.currentSrc, width: sample.width, height: sample.height, transparent, visible, cinnabar, borderInk, total: sample.width * sample.height };
  });
}

test('首页预热保留原体验，首次进入结构时才请求书法图片', async ({ page }) => {
  const calligraphyRequests = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.includes('/assets/structure/calligraphy/')) calligraphyRequests.push(path);
  });
  await preparePage(page, { width: 1920, height: 1080 });
  await page.goto('/');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator('#entryLionVideo')).toBeVisible();
  await expect(page.locator('#modelStatus')).toContainText('模型已载入');
  expect(calligraphyRequests).toEqual([]);
  await page.locator('.site-header [data-route="model"]').click();
  await expectSelection(page, 0, false);
  await expect.poll(() => page.locator('#structureCalligraphy').evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
  expect(calligraphyRequests).toHaveLength(1);
  expect(calligraphyRequests[0]).toMatch(/\/shen\.png$/);
  await page.locator('.site-brand-capsule').click();
  await expect(page.locator('#entryLionVideo')).toBeVisible();
  await page.locator('.site-header [data-route="model"]').click();
  await expectSelection(page, 0, false);
  expect(calligraphyRequests).toHaveLength(1);
});

test('图鉴六部件均使用独立朱砂PNG、真实透明像素和正确内容映射', async ({ page }) => {
  await openModel(page);
  await expectSelection(page, 0, false);
  await page.locator('#structureCalligraphy').evaluate(node => node.decode());
  await page.screenshot({ path: test.info().outputPath('structure-atlas-initial-1920.png'), fullPage: true });
  await expect(page.locator('#hotspotList, .hotspot-list, .model-detail-tabs')).toHaveCount(0);
  await expect(page.locator('#structurePanel')).toContainText('岭南醒狮志 · 形制探微');
  const observations = [];
  for (let index = 0; index < parts.length; index += 1) {
    await expectSelection(page, index, index > 0);
    const pixels = await imagePixels(page.locator('#structureCalligraphy'));
    expect(pixels.width).toBeGreaterThanOrEqual(512);
    expect(pixels.height).toBeGreaterThanOrEqual(512);
    expect(pixels.transparent / pixels.total).toBeGreaterThan(.35);
    expect(pixels.visible / pixels.total).toBeGreaterThan(.025);
    expect(pixels.cinnabar / pixels.visible).toBeGreaterThan(.85);
    expect(pixels.borderInk).toBe(0);
    observations.push({ id: parts[index].id, character: artwork[index][0], ...pixels });
    await page.locator('#structurePanel').screenshot({ path: test.info().outputPath(`structure-panel-${artwork[index][1]}`) });
    await page.locator('#nextStructurePart').click();
  }
  await expectSelection(page, 0);
  expect(new Set(observations.map(item => item.src)).size).toBe(6);
  await test.info().attach('six-calligraphy-pixel-audit', { body: JSON.stringify(observations, null, 2), contentType: 'application/json' });
});

test('点击真实模型表面同时切换图鉴、结构高亮和聚焦，保留实际镜头放大', async ({ page }) => {
  await openModel(page);
  const canvas = page.locator('#sceneContainer canvas');
  for (const id of ['eyes', 'mouth', 'mirror']) {
    await page.locator('#resetView').click();
    await expect(canvas).toHaveAttribute('data-focused-part', 'overall');
    await expect(canvas).toHaveAttribute('data-focus-state', 'idle');
    const distance = Number(await canvas.getAttribute('data-camera-distance'));
    const projection = JSON.parse(await canvas.getAttribute('data-part-projections'))[id];
    expect(projection.visible).toBe(true);
    // Only actual raycast selection can satisfy these projected surface clicks.
    await page.mouse.click(projection.x, projection.y);
    await expectSelection(page, parts.findIndex(part => part.id === id));
    expect(Number(await canvas.getAttribute('data-camera-distance'))).toBeLessThan(distance * .9);
    await expect(page.locator('#modelHotspots .is-active .model-anchor-line')).toHaveAttribute('data-part', id);
  }
});

test('前后导航双向循环并复用模型，选择停止自动旋转且复原恢复整体', async ({ page }) => {
  await openModel(page);
  const canvas = await page.locator('#sceneContainer canvas').elementHandle();
  await page.locator('#previousStructurePart').click();
  await expectSelection(page, 5);
  for (let index = 4; index >= 0; index -= 1) {
    await page.locator('#previousStructurePart').click();
    await expectSelection(page, index);
  }
  await page.locator('#toggleRotate').click();
  await expect(page.locator('#toggleRotate')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#nextStructurePart').click();
  await expectSelection(page, 1);
  await expect(page.locator('#toggleRotate')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#resetView').click();
  await expectSelection(page, 0, false);
  await expect(page.locator('#modelStage')).toHaveAttribute('data-focus-state', 'overall');
  await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-focused-part', 'overall');
  expect(await canvas.evaluate(node => node === document.querySelector('#sceneContainer canvas'))).toBe(true);
  await expect(page.locator('#structurePanel #toggleRotate, #structurePanel #resetView')).toHaveCount(0);
  await canvas.dispose();
});

test('三段文化解说可展开阅读六部件的全部原结构、工艺和文化资料', async ({ page }) => {
  await openModel(page);
  const panel = page.locator('#structurePanel');
  for (let index = 0; index < parts.length; index += 1) {
    await expectSelection(page, index, index > 0);
    for (const heading of ['形制之美', '匠心之艺', '狮韵之意']) {
      await expect(panel.getByRole('heading', { name: heading, exact: true })).toHaveCount(1);
    }
    const details = panel.locator('.structure-more-reading');
    expect(await details.count()).toBeGreaterThan(0);
    for (const detail of await details.all()) {
      if (!(await detail.getAttribute('open') === '')) await detail.locator('summary').click();
      await expect(detail).toHaveAttribute('open', '');
    }
    const part = parts[index];
    const rendered = await panel.innerText();
    for (const text of [part.material, part.function, part.description, part.sourceTag,
      ...part.structure.parts, part.structure.material, part.structure.craft, part.structure.connection,
      ...Object.values(part.culture)]) {
      expect(rendered, `${part.id}: retain original readable text`).toContain(text);
    }
    await page.locator('#structureBoundary summary').click();
    await expect(page.locator('#structureBoundary p')).toBeVisible();
    await expect(page.locator('#structureBoundary p')).toContainText(/六幅朱砂书法由\s*AI\s*辅助生成/);
    if (index === 0) {
      await page.locator('#structureBoundary p').scrollIntoViewIfNeeded();
      await panel.screenshot({ path: test.info().outputPath('structure-atlas-full-reading-end.png') });
    }
    await page.locator('#nextStructurePart').click();
  }
});

for (const viewport of [{ width: 900, height: 900 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
  test(`${viewport.width}电脑窗口宣纸图鉴可读、艺术字无裁切且末尾阅读可达`, async ({ page }) => {
    await openModel(page, viewport);
    const panel = page.locator('#structurePanel');
    const box = await panel.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(370);
    expect(box.width).toBeLessThanOrEqual(422);
    const style = await panel.evaluate(node => {
      const css = getComputedStyle(node);
      return { background: css.backgroundColor, rgb: css.getPropertyValue('--modelOverlay-surface-rgb').trim(), blur: css.backdropFilter };
    });
    expect(style.rgb).toBe('247 244 237');
    const image = page.locator('#structureCalligraphy');
    await image.scrollIntoViewIfNeeded();
    await expect(image).toBeInViewport();
    expect(await image.evaluate(node => getComputedStyle(node).objectFit)).toBe('contain');
    const artBox = await image.boundingBox();
    expect(artBox.width).toBeGreaterThanOrEqual(150);
    expect(artBox.x).toBeGreaterThanOrEqual(box.x);
    expect(artBox.x + artBox.width).toBeLessThanOrEqual(box.x + box.width);
    await page.locator('#structureBoundary summary').click();
    await page.locator('#structureBoundary p').scrollIntoViewIfNeeded();
    await expect(page.locator('#structureBoundary p')).toBeInViewport();
    const scroll = await page.locator('#modelDetailContent').evaluate(node => ({ top: node.scrollTop, overflow: getComputedStyle(node).overflowY }));
    expect(scroll.overflow).toBe('auto');
    expect(scroll.top).toBeGreaterThan(0);
    await expect(panel.locator('#nextStructurePart')).toBeInViewport();
    await page.locator('#nextStructurePart').click();
    await expectSelection(page, 1);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    expect(await panel.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: test.info().outputPath(`structure-atlas-${viewport.width}.png`), fullPage: true });
  });
}

test('电脑缩放后的683px余宽将图鉴置于模型下方，正文滚动与翻页仍可用', async ({ page, browser }) => {
  await openModel(page, { width: 683, height: 512 });
  const scene = await page.locator('.scene-column').boundingBox();
  const panel = await page.locator('#structurePanel').boundingBox();
  expect(scene.y + scene.height).toBeLessThanOrEqual(panel.y + 2);
  expect(scene.height).toBeGreaterThanOrEqual(360);
  expect(panel.width).toBeGreaterThanOrEqual(370);
  expect(panel.width).toBeLessThanOrEqual(422);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expectLabelsClearHeading(page);
  await expectGlobalNavigationInViewport(page);
  await page.screenshot({ path: test.info().outputPath('structure-atlas-683-model-viewport.png') });
  await page.locator('#structureCalligraphy').scrollIntoViewIfNeeded();
  await expect(page.locator('#structureCalligraphy')).toBeInViewport();
  await page.locator('#structureBoundary summary').click();
  await page.locator('#structureBoundary p').scrollIntoViewIfNeeded();
  await expect(page.locator('#structureBoundary p')).toBeInViewport();
  expect(await page.locator('#modelDetailContent').evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await page.locator('#nextStructurePart').click();
  await expectSelection(page, 1);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await expectLabelsClearHeading(page);
  await page.locator('#structureCalligraphy').scrollIntoViewIfNeeded();
  await expectGlobalNavigationInViewport(page);
  await page.screenshot({ path: test.info().outputPath('structure-atlas-683-reading-viewport.png') });
  const graphics = await page.locator('#sceneContainer canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const extension = gl?.getExtension('WEBGL_debug_renderer_info');
    return extension ? { renderer: gl.getParameter(extension.UNMASKED_RENDERER_WEBGL), vendor: gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) } : null;
  });
  await test.info().attach('environment', { body: JSON.stringify({ browser: browser.version(), graphics }), contentType: 'application/json' });
});

test('合法40%资料底板宽度在900与1920电脑窗仍完整呈现题签图片及可点击翻页', async ({ page }) => {
  await openModel(page);
  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
  await selectSettingsFor(page, 'modelOverlay');
  const width = settingsPanel(page).getByRole('spinbutton', { name: '结构资料底板宽度数值', exact: true });
  await width.fill('40');
  await width.press('Tab');
  await page.getByRole('button', { name: '关闭开发者参数', exact: true }).click();
  for (const viewport of [{ width: 900, height: 900 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    const panel = page.locator('#structurePanel');
    await page.locator('#resetView').click();
    await expectSelection(page, 0, false);
    await expect(page.locator('#sceneContainer canvas')).toHaveAttribute('data-focus-state', 'idle');
    const box = await panel.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(150);
    expect(box.width).toBeLessThanOrEqual(170);
    await page.locator('#structureCalligraphy').scrollIntoViewIfNeeded();
    const art = await page.locator('#structureCalligraphy').boundingBox();
    expect(art.width).toBeGreaterThanOrEqual(box.width * .55);
    expect(art.x).toBeGreaterThanOrEqual(box.x);
    expect(art.x + art.width).toBeLessThanOrEqual(box.x + box.width + 1);
    for (const [selector, minimum] of [['.structure-poetic-subtitle', 14], ['.structure-introduction p', 15], ['.structure-culture-section > p', 13]]) {
      const fontSizes = await panel.locator(selector).evaluateAll(nodes => nodes.map(node => parseFloat(getComputedStyle(node).fontSize)));
      expect(fontSizes.every(size => size >= minimum), `${viewport.width}: narrow paper preserves readable ${selector}`).toBe(true);
    }
    const directory = panel.getByRole('navigation', { name: '结构部件目录', exact: true });
    await expect(directory.getByRole('button')).toHaveCount(parts.length);
    expect(await directory.getByRole('button').evaluateAll(nodes => nodes.every(node => node.scrollWidth - node.clientWidth <= 1)), 'all six narrow-paper labels remain unclipped').toBe(true);
    for (const selector of ['.structure-atlas-masthead', '.structure-atlas-masthead > div', '.structure-atlas-footer', '.structure-folio-nav', '#previousStructurePart', '#nextStructurePart']) {
      const node = panel.locator(selector);
      const bounds = await node.boundingBox();
      expect(bounds.x, `${viewport.width}: ${selector} left edge`).toBeGreaterThanOrEqual(box.x);
      expect(bounds.x + bounds.width, `${viewport.width}: ${selector} right edge`).toBeLessThanOrEqual(box.x + box.width + 1);
      expect(await node.evaluate(element => element.scrollWidth - element.clientWidth), `${viewport.width}: ${selector} text remains unclipped`).toBeLessThanOrEqual(1);
    }
    await page.locator('#nextStructurePart').click();
    await expectSelection(page, 1);
    await page.locator('#previousStructurePart').click();
    await expectSelection(page, 0);
    await page.locator('#structureBoundary summary').click();
    await page.locator('#structureBoundary p').scrollIntoViewIfNeeded();
    await expect(page.locator('#structureBoundary p')).toBeInViewport();
    expect(await page.locator('#modelDetailContent').evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    await panel.screenshot({ path: test.info().outputPath(`structure-atlas-width40-${viewport.width}.png`) });
    await page.locator('#structureBoundary summary').click();
  }
});

test('已有深红默认偏好升级为宣纸材质，其他自定义尺寸及首页偏好保留', async ({ page }) => {
  await openModel(page, { width: 1920, height: 1080 }, {
    modelOverlayColor: '#68170f', modelOverlayTransparency: 20, modelOverlayBlur: 12,
    modelOverlayRadius: 24, modelOverlayHeight: 620, modelOverlayWidth: 87,
    bookTitleWidth: 57, bookTitleLayoutVersion: 1, archivePanelTransparency: 55,
    readingPaperVersion: 1,
  });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('nanfeng-lion:developer-settings:v1')))).toMatchObject({
    structureAtlasVersion: 1,
    modelOverlayColor: '#f7f4ed', modelOverlayTransparency: 5, modelOverlayBlur: 0,
    modelOverlayRadius: 10, modelOverlayHeight: 0, modelOverlayWidth: 87,
    bookTitleWidth: 57, archivePanelTransparency: 55,
  });
  expect(await page.locator('#structurePanel').evaluate(node => getComputedStyle(node).getPropertyValue('--modelOverlay-surface-rgb').trim())).toBe('247 244 237');
  await expect(page.locator('#structureCalligraphy')).toBeVisible();
  await page.locator('#nextStructurePart').click();
  await expectSelection(page, 1);
});

test('设置推开页面后图鉴和实际热点仍同步，跨章保留首页与动作场景', async ({ page }) => {
  const errors = [], badResources = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) badResources.push(response.url()); });
  await openModel(page);
  const canvas = await page.locator('#sceneContainer canvas').elementHandle();
  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  const scene = await page.locator('.scene-column').boundingBox();
  const panel = await page.locator('#structurePanel').boundingBox();
  const settings = await page.locator('#developerSettingsPanel').boundingBox();
  expect(scene.x + scene.width).toBeLessThanOrEqual(panel.x + 2);
  expect(panel.x + panel.width).toBeLessThanOrEqual(settings.x + 2);
  await page.locator('#modelHotspots [data-id="eyes"]').click();
  await expectSelection(page, 1);
  await page.getByRole('button', { name: '关闭开发者参数', exact: true }).click();
  await page.locator('.site-header [data-route="action"]').click();
  await expect(page.locator('#chapterStage canvas')).toHaveAttribute('data-scene-ready', 'true', { timeout: 45_000 });
  await expect(page.locator('#chapterStage video')).toHaveCount(4);
  await expect(page.locator('#chapterStage button[data-action-id]')).toHaveCount(4);
  await page.locator('.site-brand-capsule').click();
  await expect(page.locator('#entryLionVideo')).toHaveJSProperty('src', new URL(assetPaths.home, page.url()).href);
  await expect(page.locator('.entry-title-art')).toBeVisible();
  await page.locator('.site-header [data-route="model"]').click();
  await expectSelection(page, 1);
  expect(await canvas.evaluate(node => node === document.querySelector('#sceneContainer canvas'))).toBe(true);
  const model = page.locator('#sceneContainer canvas');
  // Close focus can cull hair groups outside the camera frustum. The full
  // source must remain loaded; submitted-draw totals are checked at overview.
  for (const [key, value] of [['groups', '33'], ['strands', '2295421'], ['points', '19957105']]) {
    await expect(model).toHaveAttribute(`data-full-hair-${key}`, value);
  }
  await page.locator('#resetView').click();
  await expect(model).toHaveAttribute('data-focused-part', 'overall');
  await expect(model).toHaveAttribute('data-focus-state', 'idle');
  for (const [key, value] of [['groups', '33'], ['strands', '2295421'], ['points', '19957105']]) {
    await expect(model).toHaveAttribute(`data-full-hair-drawn-${key}`, value);
  }
  expect(errors).toEqual([]);
  expect(badResources).toEqual([]);
  await canvas.dispose();
});
