import { test, expect } from '@playwright/test';
import { assetPaths } from '../../src/config/assetPaths.js';
import { readFileSync } from 'node:fs';

const structureParts = JSON.parse(readFileSync(new URL('../../src/data/lion-structure.json', import.meta.url), 'utf8')).hotspots;
const modelRequestPattern = `**/${assetPaths.model}`;

const routeButton = (page, route) => page.locator(`.site-header .site-navigation .site-nav-item[data-route="${route}"]`);

async function expectDecodedBackground(page, locator, assetPath, property = 'background-image') {
  const decoded = await locator.evaluate(async (element, property) => {
    const background = getComputedStyle(element).getPropertyValue(property).trim();
    const url = background.match(/^url\("([^"]+)"\)$/)?.[1];
    if (!url) throw new Error(`Expected one background image in ${property}: ${background}`);
    const image = new Image();
    image.src = url;
    await image.decode();
    return { url: image.currentSrc || image.src, width: image.naturalWidth, height: image.naturalHeight };
  }, property);
  expect(decoded.url).toBe(new URL(assetPath, page.url()).href);
  expect({ width: decoded.width, height: decoded.height }).toEqual({ width: 2048, height: 1152 });
  return decoded.url;
}

async function expectPushedChapterBackdrop(page, assetPath) {
  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
  const shell = page.locator('.site-shell');
  const sidebar = page.locator('#developerSettingsPanel');
  await expect(sidebar).toBeVisible();
  await expect(shell).toHaveAttribute('data-settings-layout', 'push');
  const shellBackground = await expectDecodedBackground(page, shell, assetPath);
  // The sidebar's translucent material looks through to the full-page shell;
  // its inherited backdrop URL must resolve to that same decoded chapter PNG.
  const sidebarBackdrop = await expectDecodedBackground(page, sidebar, assetPath, '--settings-backdrop-image');
  expect(sidebarBackdrop).toBe(shellBackground);
  await sidebar.getByRole('button', { name: '关闭开发者参数', exact: true }).click();
}

async function sampleModelPixels(page) {
  const canvas = page.locator('#sceneContainer canvas');
  const bounds = await canvas.boundingBox();
  const alpha = await canvas.evaluate(element => {
    const gl = element.getContext('webgl2') ?? element.getContext('webgl');
    return gl?.getContextAttributes()?.alpha === true;
  });
  // Sample the composited WebGL image. A settled demand-rendered scene has no
  // fresh drawing buffer to readPixels from after the browser presents it.
  // Screenshot-only visibility styles isolate the actual transparent canvas
  // without restarting animation or changing the selected part/camera.
  const png = await canvas.screenshot({
    omitBackground: true,
    style: 'html,body{background:transparent!important}body *{visibility:hidden!important}#sceneContainer,#sceneContainer canvas{visibility:visible!important}',
  });
  return page.evaluate(async ({ imageData, bounds, alpha }) => {
    const image = new Image();
    image.src = imageData;
    await image.decode();
    const sample = document.createElement('canvas');
    sample.width = image.naturalWidth;
    sample.height = image.naturalHeight;
    const context = sample.getContext('2d');
    context.drawImage(image, 0, 0);
    const { width, height } = sample;
    const buffer = context.getImageData(0, 0, width, height).data;
    let modelPixels = 0;
    let cornerPixels = 0;
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    const margin = Math.max(2, Math.floor(Math.min(width, height) * 0.02));
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (buffer[(y * width + x) * 4 + 3] === 0) continue;
        modelPixels += 1;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        const corner = (x < margin || x >= width - margin) && (y < margin || y >= height - margin);
        if (corner) cornerPixels += 1;
      }
    }
    return {
      alpha,
      modelPixels,
      cornerPixels,
      modelCenterX: maxX >= minX ? bounds.x + (minX + maxX + 1) * bounds.width / (width * 2) : null,
      modelWidth: maxX >= minX ? (maxX - minX + 1) * bounds.width / width : 0,
      modelHeight: maxY >= minY ? (maxY - minY + 1) * bounds.height / height : 0,
    };
  }, { imageData: 'data:image/png;base64,' + png.toString('base64'), bounds, alpha });
}

test('首页入场结束后原地循环背景，整体与章节交互由当前页面运行', async ({ page }) => {
  const errors = [];
  const failedResources = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) failedResources.push(response.url()); });
  page.on('request', (request) => requests.push(request.url()));
  await openPrepared(page, '/');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await expect(page.locator('.entry-title-art')).toHaveCount(1);
  const homeLion = page.locator('.site-header .site-brand .entry-lion-emblem');
  await expect(homeLion).toBeVisible();
  await expect(homeLion).toHaveAttribute('src', /assets\/entry\/nav-lion-head\.png/);
  expect(await homeLion.evaluate((image) => image.tagName === 'IMG' && image.complete && image.naturalWidth > 0)).toBe(true);
  await expect.poll(() => page.locator('#introVideo').evaluate((video) => video.readyState)).toBeGreaterThanOrEqual(2);
  expect(await page.locator('#introVideo').evaluate((video) => video.loop)).toBe(false);
  expect(requests.some((url) => new URL(url).pathname.endsWith(assetPaths.model))).toBe(true);
  await page.locator('#introVideo').evaluate((video) => video.dispatchEvent(new Event('ended')));
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await expect(page.locator('#entryLionVideo')).toHaveJSProperty('src', new URL(assetPaths.home, page.url()).href);
  await expect.poll(() => page.locator('#entryLionVideo').evaluate((video) => video.readyState)).toBeGreaterThanOrEqual(2);
  expect(await page.locator('#entryLionVideo').evaluate((video) => video.loop)).toBe(true);
  await expect(page.locator('.entry-title-art')).toBeVisible();
  await expect(page.locator('#introVideo')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('homepage.png'), fullPage: true });

  await routeButton(page, 'model').click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'model');
  await expect(page.locator('#modelStage')).toBeVisible();
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath('model.png'), fullPage: true });

  await expect(page.locator('#toggleRotate')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#toggleRotate').click();
  await expect(page.locator('#toggleRotate')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#toggleRotate').click();
  await expect(page.locator('#toggleRotate')).toHaveAttribute('aria-pressed', 'false');
  for (const { id, name } of structureParts) {
    await page.locator(`#hotspotList [data-id="${id}"]`).click();
    await expect(page.locator('#panelTitle')).toHaveText(name);
    await expect(page.locator('#modelStage')).toHaveAttribute('data-focus-state', id);
    await expect(page.locator(`#hotspotList [data-id="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(1);
  for (const [route, label] of [['action', '动作'], ['state', '神态']]) {
    await routeButton(page, route).click();
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
    await expect(page.locator('#chapterTitle')).toHaveText(label);
    await expect(page.locator('.lion-book-stage iframe')).toHaveCount(1);
    await expect(page.locator('#sceneContainer canvas')).toHaveCount(1);
    await expect(page.locator('#modelStage')).toBeHidden();
  }
  await page.reload();
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator('#chapterTitle')).toHaveText('神态');
  await page.goBack();
  await expect(page.locator('#chapterTitle')).toHaveText('动作');
  await page.locator('.site-brand-capsule').click();
  await expect(page.locator('#entryLionVideo')).toBeVisible();
  expect(errors).toEqual([]);
  expect(failedResources).toEqual([]);
});

test('入场仅首次自动播放，返回与刷新保留循环背景，支持重播和跳过', async ({ page }) => {
  await openPrepared(page, '/');
  await expect(page.locator('#introVideo')).toBeVisible();
  await page.getByRole('button', { name: '跳过入场', exact: true }).click();
  await expect(page.locator('#entryLionVideo')).toBeVisible();
  await page.reload();
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator('#entryLionVideo')).toBeVisible();
  await expect(page.locator('#introVideo')).toHaveCount(0);
  await routeButton(page, 'model').click();
  await expect(page.locator('#modelStage')).toBeVisible();
  await page.locator('.site-brand-capsule').click();
  await expect(page.locator('#entryLionVideo')).toBeVisible();
  await page.getByRole('button', { name: '重播入场', exact: true }).click();
  await expect(page.locator('#introVideo')).toBeVisible();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  expect(await page.locator('#introVideo').evaluate((video) => video.loop)).toBe(false);
  await page.locator('#introVideo').evaluate((video) => video.dispatchEvent(new Event('ended')));
  await expect(page.locator('#entryLionVideo')).toBeVisible();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await page.getByRole('button', { name: '探索更多', exact: true }).click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await expect.poll(() => page.locator('#homeLionBook').evaluate(book => Math.abs(book.getBoundingClientRect().top - document.querySelector('.site-header').getBoundingClientRect().bottom))).toBeLessThan(2);
});

test('手机视口保持章节导航与结构交互，页面可正常滚动', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPrepared(page, '/');
  await page.screenshot({ path: test.info().outputPath('home-mobile.png'), fullPage: true });
  await routeButton(page, 'model').click();
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await page.locator('#hotspotList [data-id="mouth"]').click();
  await expect(page.locator('#panelTitle')).toHaveText('狮嘴');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.querySelector('.site-shell').getBoundingClientRect().width)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('structure-mobile.png'), fullPage: true });
  await expect(page.locator('.site-header .site-navigation .site-nav-item[data-route]:visible')).toHaveCount(3);
  for (const route of ['model', 'action', 'state']) await expect(routeButton(page, route)).toBeInViewport();
  await expect(page.locator('.site-brand-capsule')).toBeInViewport();
  await routeButton(page, 'action').click();
  await expect(page.locator('#chapterTitle')).toHaveText('动作');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.querySelector('.site-shell').getBoundingClientRect().width)).toBe(true);
  await page.locator('.site-brand-capsule').click();
  await expect(page.locator('#introVideo, #entryLionVideo')).toBeVisible();
});

test('模型下载失败保留参考图，重试能够恢复3D场景', async ({ page }) => {
  let fail = true;
  await page.route(modelRequestPattern, async (route) => {
    if (fail) await route.fulfill({ status: 503, body: 'temporarily unavailable' });
    else await route.continue();
  });
  await openPrepared(page, '/#/model');
  await expect(page.locator('#modelStatus')).toContainText('模型载入失败');
  await expect(page.locator('#modelFallback')).toBeVisible();
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: '重新载入', exact: true }).click();
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(1);
});

test('结构模型以透明全页画布融入指定背景，模型展示与右侧说明保持分离', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openPrepared(page, '/#/model');
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(1);
  await expect(page.locator('.scene-glow, .scene-pattern, .scene-grid, #hotspots, #structureLayer, #viewStructure')).toHaveCount(0);
  const presentation = await page.evaluate(() => {
    const frame = getComputedStyle(document.querySelector('#sceneFrame'));
    const stage = document.querySelector('#modelStage').getBoundingClientRect();
    const canvas = document.querySelector('#sceneContainer canvas').getBoundingClientRect();
    return {
      stageBackground: getComputedStyle(document.querySelector('#modelStage')).backgroundImage,
      pageBackground: getComputedStyle(document.querySelector('.site-shell')).backgroundImage,
      frameColor: frame.backgroundColor,
      frameImage: frame.backgroundImage,
      frameBorders: [frame.borderTopWidth, frame.borderRightWidth, frame.borderBottomWidth, frame.borderLeftWidth],
      frameShadow: frame.boxShadow,
      frameOverflow: frame.overflow,
      stageBounds: { x: stage.x, y: stage.y, width: stage.width, height: stage.height },
      canvasBounds: { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height },
    };
  });
  expect(presentation.stageBackground).toBe('none');
  expect(presentation.pageBackground).toContain(assetPaths.modelBackground);
  await expectDecodedBackground(page, page.locator('.site-shell'), assetPaths.modelBackground);
  expect(presentation.frameColor).toBe('rgba(0, 0, 0, 0)');
  expect(presentation.frameImage).toBe('none');
  expect(presentation.frameBorders).toEqual(['0px', '0px', '0px', '0px']);
  expect(presentation.frameShadow).toBe('none');
  expect(presentation.frameOverflow).toBe('visible');
  for (const dimension of ['x', 'y', 'width', 'height']) {
    expect(presentation.canvasBounds[dimension]).toBeCloseTo(presentation.stageBounds[dimension], 0);
  }
  const pixels = await sampleModelPixels(page);
  expect(pixels.alpha).toBe(true);
  expect(pixels.modelPixels).toBeGreaterThan(100);
  expect(pixels.cornerPixels).toBe(0);
  const frame = await page.locator('#sceneFrame').boundingBox();
  const panel = await page.locator('#structurePanel').boundingBox();
  expect(pixels.modelCenterX).toBeLessThan(panel.x);
  expect(Math.abs(pixels.modelCenterX - (frame.x + frame.width / 2))).toBeLessThan(frame.width * .22);
  await expectPushedChapterBackdrop(page, assetPaths.modelBackground);
});

test('结构模型真实滚轮放大改变绘制尺寸，透明画布保留全页绘制范围', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openPrepared(page, '/#/model');
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await expect(page.locator('#toggleRotate')).toHaveAttribute('aria-pressed', 'false');
  const initial = await sampleModelPixels(page);
  expect(initial.modelPixels).toBeGreaterThan(100);
  const frame = await page.locator('.scene-interaction').boundingBox();
  await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
  let zoomed = initial;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    await page.mouse.wheel(0, -200);
    zoomed = await sampleModelPixels(page);
    if (zoomed.modelHeight > initial.modelHeight * 1.15) break;
  }
  expect(zoomed.modelHeight).toBeGreaterThan(initial.modelHeight * 1.15);
  expect(zoomed.modelPixels).toBeGreaterThan(initial.modelPixels * 1.15);
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'model');
  const canvas = await page.locator('#sceneContainer canvas').boundingBox();
  const stage = await page.locator('#modelStage').boundingBox();
  expect(canvas.height).toBeCloseTo(stage.height, 0);
  expect(canvas.width).toBeCloseTo(stage.width, 0);
  await page.screenshot({ path: test.info().outputPath('structure-model-wheel-zoom.png'), fullPage: true });
});

for (const viewport of [{ width: 900, height: 900 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
  test(`结构页在${viewport.width}电脑窗口保持左模型右资料，导航与部件目录可操作`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openPrepared(page, '/#/model');
    await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
    const columns = await page.locator('.model-layout').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(2);
    const scene = await page.locator('.scene-column').boundingBox();
    const panel = await page.locator('#structurePanel').boundingBox();
    const header = await page.locator('.site-header').boundingBox();
    expect(scene.x + scene.width).toBeLessThanOrEqual(panel.x + 2);
    expect(scene.y).toBeGreaterThanOrEqual(header.y + header.height - 2);
    expect(panel.y).toBeGreaterThanOrEqual(header.y + header.height - 2);
    expect(scene.width).toBeGreaterThan(300);
    expect(panel.width).toBeGreaterThan(260);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.locator('#hotspotList [data-id="mouth"]').click();
    await expect(page.locator('#modelStage')).toHaveAttribute('data-focus-state', 'mouth');
    await expect(page.locator('#panelTitle')).toHaveText('狮嘴');
    await page.locator('#resetView').click();
    await expect(page.locator('#modelStage')).toHaveAttribute('data-focus-state', 'overall');
    await routeButton(page, 'state').click();
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'state');
  });
}

test('动作章节接入四面巨幕与用户视频并保留全局导航及设置背景', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openPrepared(page, '/#/action');
  await expect(page.locator('#chapterStage')).toHaveAttribute('data-chapter', 'action');
  await expectDecodedBackground(page, page.locator('.site-shell'), assetPaths.actionBackground);
  const canvas = page.locator('#chapterStage canvas');
  await expect(canvas).toHaveAttribute('data-scene-ready', 'true', { timeout: 45_000 });
  await expect(page.locator('#chapterStage video')).toHaveCount(4);
  await expect(page.locator('#chapterStage button[data-action-id]')).toHaveCount(4);
  await expect(page.locator('#chapterStage .action-timeline, #chapterStage .action-clip')).toHaveCount(0);
  await expect(page.locator('#chapterEvidence')).toContainText('用户提供');
  await expect(page.locator('#chapterTitle')).toHaveText('动作');
  await expect(page.locator('.site-header [data-route="action"]')).toHaveAttribute('aria-current', 'page');
  await expectPushedChapterBackdrop(page, assetPaths.actionBackground);
});

test('神态章节展示八态图鉴且保留样本待校核说明', async ({ page }) => {
  await openPrepared(page, '/#/state');
  await expect(page.locator('#chapterStage')).toHaveAttribute('data-chapter', 'state');
  expect(await page.locator('#chapterStage').evaluate((element) => getComputedStyle(element).backgroundImage)).toBe('none');
  await expectDecodedBackground(page, page.locator('.site-shell'), assetPaths.stateBackground);
  await expect(page.getByRole('navigation', { name: '醒狮八态' }).getByRole('button')).toHaveCount(8);
  await expect(page.locator('#expressionObservation')).toBeVisible();
  await expect(page.locator('#chapterEvidence')).toContainText('等待真实图片/视频样本校核');
  await expect(page.locator('[data-quantified-result]')).toHaveCount(0);
  await expect(page.locator('#chapterTitle')).toHaveText('神态');
  await expectPushedChapterBackdrop(page, assetPaths.stateBackground);
});

test('模型页复用全局品牌与章节导航并高亮当前章节', async ({ page }) => {
  await openPrepared(page, '/#/model');
  const header = page.locator('.site-header');
  await expect(header).toHaveCount(1);
  await expect(header).toBeVisible();
  const modelLion = header.locator('.site-brand .entry-lion-emblem');
  await expect(modelLion).toBeVisible();
  await expect(modelLion).toHaveAttribute('src', /assets\/entry\/nav-lion-head\.png/);
  expect(await modelLion.evaluate((image) => image.tagName === 'IMG' && image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(header.locator('.site-navigation img')).toHaveCount(0);
  await expect(header.locator('.site-navigation')).toBeVisible();
  await expect(header.locator('.site-nav-item[data-route]:visible')).toHaveCount(4);
  await expect(header.locator('.site-brand-capsule')).toHaveAccessibleName('南风有狮，返回首页');
  await expect(page.locator('.model-header .site-navigation, .model-header .site-brand')).toHaveCount(0);
  await expect(header.locator('.site-nav-item.is-current')).toHaveAttribute('data-route', 'model');
  await expect(routeButton(page, 'model')).toHaveAttribute('aria-current', 'page');
  await expect(routeButton(page, 'model')).toHaveAccessibleName('结构');
  const title = routeButton(page, 'model').locator('.site-nav-heading strong');
  await expect(title).toBeVisible();
  await expect(title).toHaveText('结构');
  expect(await title.evaluate(element => getComputedStyle(element).fontFamily)).toContain('Nanfeng Navigation Brush');
  await expect(routeButton(page, 'model').locator('.site-nav-description')).toBeHidden();
  await expect(header.locator('.site-nav-short-label')).toHaveCount(0);
  await expect(header.locator('.site-brand-copy')).toBeHidden();
  const settings = header.getByRole('button', { name: '打开开发者参数设置', exact: true });
  await expect(settings).toBeVisible();
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  await expect(settings).toHaveAttribute('aria-controls', 'developerSettingsPanel');
});

test('结构页右侧部件目录驱动局部聚焦，离页暂停并复用预热场景', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openPrepared(page, '/#/model');
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await expect(page.locator('#structurePanel')).toBeVisible();
  await expect(page.locator('#culturePanel, .structure-diagram, #hotspots, #viewStructure, #structureLayer')).toHaveCount(0);
  await expect(page.locator('#resetView')).toBeVisible();
  const canvas = await page.locator('#sceneContainer canvas').elementHandle();
  await page.locator('#hotspotList [data-id="eyes"]').click();
  await expect(page.locator('#modelStage')).toHaveAttribute('data-selected-id', 'eyes');
  await expect(page.locator('#modelStage')).toHaveAttribute('data-focus-state', 'eyes');
  await expect(page.locator('#panelTitle')).toHaveText('鼓眼与狮眉');
  await expect(page.locator('#hotspotList [data-id="eyes"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#toggleRotate')).toHaveAttribute('aria-pressed', 'false');
  expect(await canvas.evaluate(element => element === document.querySelector('#sceneContainer canvas'))).toBe(true);
  await page.locator('#resetView').click();
  await expect(page.locator('#modelStage')).toHaveAttribute('data-focus-state', 'overall');
  await expect(page.locator('#modelStage')).toHaveAttribute('data-selected-id', structureParts[0].id);
  await page.locator('.site-brand-capsule').click();
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(1);
  await expect(page.locator('#modelStage')).toBeHidden();
  expect(await canvas.evaluate(element => element.isConnected)).toBe(true);
  expect(await canvas.evaluate(element => {
    const gl = element.getContext('webgl2') ?? element.getContext('webgl');
    return gl?.isContextLost();
  })).toBe(false);
  await routeButton(page, 'model').click();
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(1);
  expect(await canvas.evaluate(element => element === document.querySelector('#sceneContainer canvas'))).toBe(true);
  await canvas.dispose();
});

test('点击醒狮真实表面同步右侧部件，镜头在左侧放大聚焦实际目标', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openPrepared(page, '/#/model');
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  const canvas = page.locator('#sceneContainer canvas');
  for (const id of ['eyes', 'mouth', 'mirror']) {
    await page.locator('#resetView').click();
    await expect(canvas).toHaveAttribute('data-focused-part', 'overall');
    await expect(canvas).toHaveAttribute('data-focus-state', 'idle');
    const initialDistance = Number(await canvas.getAttribute('data-camera-distance'));
    expect(initialDistance).toBeGreaterThan(0);
    await expect.poll(async () => {
      const projections = JSON.parse(await canvas.getAttribute('data-part-projections') || '{}');
      return projections[id]?.visible === true;
    }).toBe(true);
    const projection = JSON.parse(await canvas.getAttribute('data-part-projections'))[id];
    // These client coordinates come from the actual rendered 3D surface,
    // so a fixed HTML hotspot cannot satisfy this interaction.
    await page.mouse.click(projection.x, projection.y);
    await expect(page.locator('#modelStage')).toHaveAttribute('data-selected-id', id);
    await expect(page.locator('#modelStage')).toHaveAttribute('data-focus-state', id);
    await expect(page.locator(`#hotspotList [data-id="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#panelTitle')).toHaveText(structureParts.find(part => part.id === id).name);
    await expect(canvas).toHaveAttribute('data-focused-part', id);
    await expect(canvas).toHaveAttribute('data-focus-state', 'idle');
    await expect(page.locator('#toggleRotate')).toHaveAttribute('aria-pressed', 'false');
    expect(Number(await canvas.getAttribute('data-camera-distance'))).toBeLessThan(initialDistance * .9);
    const frame = await page.locator('.scene-interaction').boundingBox();
    const target = JSON.parse(await canvas.getAttribute('data-target-screen'));
    expect(Number.isFinite(target.x) && Number.isFinite(target.y)).toBe(true);
    expect(Math.abs(target.x - (frame.x + frame.width / 2))).toBeLessThan(5);
    expect(Math.abs(target.y - (frame.y + frame.height / 2))).toBeLessThan(5);
    const panel = await page.locator('#structurePanel').boundingBox();
    expect(target.x).toBeLessThan(panel.x);
    const pixels = await sampleModelPixels(page);
    expect(pixels.modelPixels).toBeGreaterThan(100);
  }
  await page.screenshot({ path: test.info().outputPath('structure-surface-focus.png'), fullPage: true });
});

test('聚焦后缩窄电脑窗口再复原，完整醒狮按当前左侧展示区重新取景', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openPrepared(page, '/#/model');
  const canvas = page.locator('#sceneContainer canvas');
  await expect(page.locator('#modelStatus')).toContainText('模型已载入');
  await page.locator('#hotspotList [data-id="eyes"]').click();
  await expect(canvas).toHaveAttribute('data-focused-part', 'eyes');
  await expect(canvas).toHaveAttribute('data-focus-state', 'idle');
  await page.locator('#resetView').click();
  // Resize while the reset is still interpolating, as opening the settings
  // panel can also change the left viewport during this animation.
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(canvas).toHaveAttribute('data-focused-part', 'overall');
  await expect(canvas).toHaveAttribute('data-focus-state', 'idle');
  const frame = await page.locator('.scene-interaction').boundingBox();
  const pixels = await sampleModelPixels(page);
  expect(pixels.modelPixels).toBeGreaterThan(100);
  expect(pixels.modelWidth).toBeLessThan(frame.width);
  expect(pixels.modelHeight).toBeLessThan(frame.height);
  const target = JSON.parse(await canvas.getAttribute('data-target-screen'));
  expect(Math.abs(target.x - (frame.x + frame.width / 2))).toBeLessThan(5);
});

test('拖动模型旋转与点击空白不误选部件', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openPrepared(page, '/#/model');
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  const canvas = page.locator('#sceneContainer canvas');
  await expect(canvas).toHaveAttribute('data-focus-state', 'idle');
  const projections = JSON.parse(await canvas.getAttribute('data-part-projections'));
  const start = projections.eyes;
  expect(start.visible).toBe(true);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 90, start.y + 30, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('#modelStage')).toHaveAttribute('data-focus-state', 'overall');
  await expect(page.locator('#modelStage')).toHaveAttribute('data-selected-id', structureParts[0].id);
  await page.locator('#resetView').click();
  await expect(canvas).toHaveAttribute('data-focus-state', 'idle');
  const frame = await page.locator('.scene-interaction').boundingBox();
  await page.mouse.click(frame.x + 5, frame.y + 5);
  await expect(page.locator('#modelStage')).toHaveAttribute('data-focus-state', 'overall');
  await expect(page.locator('#modelStage')).toHaveAttribute('data-selected-id', structureParts[0].id);
});

test('模型页数字图鉴在手机宽度保持单列且不横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPrepared(page, '/#/model');
  await expect(page.locator('#modelStage')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.querySelector('.site-shell').getBoundingClientRect().width)).toBe(true);
  expect(await page.locator('.model-layout').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1);
});

test('模型预热失败后切换页面可重试，恢复时只有一个canvas', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(modelRequestPattern, (route) => route.abort('aborted'));
  await openPrepared(page, '/#/model');
  await expect(page.locator('#modelStage')).toBeVisible();
  await page.locator('.site-brand-capsule').click();
  await page.unroute(modelRequestPattern);
  await routeButton(page, 'model').click();
  await page.getByRole('button', { name: '重新载入', exact: true }).click();
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('首页入场视频失败可重试与跳过，未知链接返回首页', async ({ page }) => {
  let fail = true;
  await page.route('**/assets/intro/entry-intro.mp4', (route) => fail ? route.abort('failed') : route.continue());
  await openPrepared(page, '/');
  await expect(page.locator('.video-status')).toContainText('视频暂时无法播放');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  fail = false;
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect.poll(() => page.locator('#introVideo').evaluate((video) => video.readyState)).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: '跳过入场', exact: true }).click();
  await expect(page.locator('#entryLionVideo')).toBeVisible();
  await routeButton(page, 'model').click();
  await expect(page.locator('#modelStage')).toBeVisible();
  await openPrepared(page, '/#/unknown-chapter');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
});

test('旧入场与结构链接兼容到首页与整体，不再保留独立页面', async ({ page }) => {
  for (const [hash, route] of [['#/intro', 'entry'], ['#intro', 'entry'], ['#/structure', 'model'], ['#structure', 'model']]) {
    await openPrepared(page, `/${hash}`);
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
    await expect(page).toHaveURL(new RegExp(`#/${route}$`));
    if (route === 'entry') {
      await expect(page.locator('.entry-title-art')).toHaveCount(1);
      await expect(page.locator('#introVideo, #entryLionVideo')).toBeVisible();
    } else {
      await expect(page.locator('#modelStage')).toBeVisible();
      await expect(page.locator('#structurePanel')).toBeVisible();
      await expect(page.locator('#modelStage')).toHaveAttribute('data-focus-state', 'overall');
    }
    await page.reload();
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
  }
});

test('已删除的评分章节链接均返回首页', async ({ page }) => {
  for (const hash of ['#/score', '#score']) {
    await openPrepared(page, `/${hash}`);
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
    await expect(page.locator('#introVideo, #entryLionVideo')).toBeVisible();
    await expect(page.locator('#chapterTitle')).toHaveCount(0);
    await expect(page.locator('.site-header .site-navigation')).not.toContainText('评分');
    await expect(routeButton(page, 'score')).toHaveCount(0);
    await page.reload();
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  }
});

async function openPrepared(page, url) {
  await page.goto(url);
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
}
