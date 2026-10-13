import { test, expect } from '@playwright/test';
import { assetPaths } from '../../src/config/assetPaths.js';

const routeButton = (page, route) => page.locator(`.site-header .site-navigation .site-nav-item[data-route="${route}"]`);

async function sampleModelPixels(page) {
  return page.locator('#sceneContainer canvas').evaluate((canvas) => new Promise((resolve) => {
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const attributes = gl?.getContextAttributes();
    if (!gl || !attributes) return resolve({ alpha: false, modelPixels: 0 });
    let attempts = 0;
    const sample = () => {
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const bounds = canvas.getBoundingClientRect();
      const frame = document.querySelector('#sceneFrame').getBoundingClientRect();
      const legacyHeight = frame.width * 9 / 16;
      const legacyTop = frame.top + (frame.height - legacyHeight) / 2;
      const legacyBottom = legacyTop + legacyHeight;
      const buffer = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
      let modelPixels = 0;
      let cornerPixels = 0;
      let abovePixels = 0;
      let belowPixels = 0;
      let aboveFramePixels = 0;
      let belowFramePixels = 0;
      let minY = height;
      let maxY = -1;
      const margin = Math.max(2, Math.floor(Math.min(width, height) * 0.02));
      for (let y = 0; y < height; y += 1) {
        const cssY = bounds.bottom - (y + 0.5) * bounds.height / height;
        for (let x = 0; x < width; x += 1) {
          if (buffer[(y * width + x) * 4 + 3] === 0) continue;
          modelPixels += 1;
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          const corner = (x < margin || x >= width - margin) && (y < margin || y >= height - margin);
          if (corner) cornerPixels += 1;
          const cssX = bounds.left + (x + 0.5) * bounds.width / width;
          if (cssX < frame.left || cssX > frame.right) continue;
          if (cssY < legacyTop - 4) abovePixels += 1;
          if (cssY > legacyBottom + 4) belowPixels += 1;
          if (cssY < frame.top - 4) aboveFramePixels += 1;
          if (cssY > frame.bottom + 4) belowFramePixels += 1;
        }
      }
      if (modelPixels === 0 && ++attempts < 10) return requestAnimationFrame(sample);
      resolve({
        alpha: attributes.alpha,
        modelPixels,
        cornerPixels,
        abovePixels,
        belowPixels,
        aboveFramePixels,
        belowFramePixels,
        modelHeight: maxY >= minY ? (maxY - minY + 1) * bounds.height / height : 0,
        legacyHeight,
      });
    };
    // A nonempty model is required so a cleared WebGL buffer cannot pass.
    // Read during rAF before compositing clears a non-preserved drawing buffer.
    requestAnimationFrame(sample);
  }));
}

test('首页入场结束后原地循环背景，整体与章节交互由当前页面运行', async ({ page }) => {
  const errors = [];
  const failedResources = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) failedResources.push(response.url()); });
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await expect(page.locator('.entry-title-art')).toHaveCount(1);
  const homeLion = page.locator('.site-header .site-brand .entry-lion-emblem');
  await expect(homeLion).toBeVisible();
  await expect(homeLion).toHaveAttribute('src', /assets\/entry\/nav-lion-head\.png/);
  expect(await homeLion.evaluate((image) => image.tagName === 'IMG' && image.complete && image.naturalWidth > 0)).toBe(true);
  await expect.poll(() => page.locator('#introVideo').evaluate((video) => video.readyState)).toBeGreaterThanOrEqual(2);
  expect(await page.locator('#introVideo').evaluate((video) => video.loop)).toBe(false);
  expect(requests.some((url) => /three|GLTFLoader|lion-overall/.test(url))).toBe(false);
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

  await page.getByRole('button', { name: '暂停自动旋转', exact: true }).click();
  await expect(page.locator('#toggleRotate')).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '继续自动旋转', exact: true }).click();
  await expect(page.locator('#toggleRotate')).toHaveAttribute('aria-pressed', 'true');
  for (const [id, label] of [['eyes', '鼓眼与狮眉'], ['mirror', '额头铜镜'], ['mouth', '狮嘴'], ['fur_and_bells', '须毛与铜铃'], ['lion_cloth', '狮被与狮尾'], ['outer_shell', '彩绘狮头']]) {
    await page.locator(`#hotspotList [data-id="${id}"]`).click();
    await expect(page.locator('#panelTitle')).toHaveText(label);
    await expect(page.locator(`#hotspots [data-id="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
  }

  await page.locator('#viewStructure').click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'model');
  await expect(page.locator('#structureLayer')).toBeVisible();
  await page.locator('#structureDepth').fill('90');
  await expect(page.locator('#structureDepthValue')).toHaveText('90%');
  await expect(page.locator('.structure-callout.is-revealed')).toHaveCount(4);
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(1);
  for (const [route, label] of [['action', '动作'], ['state', '神态']]) {
    await routeButton(page, route).click();
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
    await expect(page.locator('#chapterTitle')).toHaveText(label);
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('#sceneContainer canvas')).toHaveCount(0);
  }
  await page.reload();
  await expect(page.locator('#chapterTitle')).toHaveText('神态');
  await page.goBack();
  await expect(page.locator('#chapterTitle')).toHaveText('动作');
  await routeButton(page, 'entry').click();
  await expect(page.locator('#entryLionVideo')).toBeVisible();
  expect(errors).toEqual([]);
  expect(failedResources).toEqual([]);
});

test('入场仅首次自动播放，返回与刷新保留循环背景，支持重播和跳过', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#introVideo')).toBeVisible();
  await page.getByRole('button', { name: '跳过入场', exact: true }).click();
  await expect(page.locator('#entryLionVideo')).toBeVisible();
  await page.reload();
  await expect(page.locator('#entryLionVideo')).toBeVisible();
  await expect(page.locator('#introVideo')).toHaveCount(0);
  await routeButton(page, 'model').click();
  await expect(page.locator('#modelStage')).toBeVisible();
  await routeButton(page, 'entry').click();
  await expect(page.locator('#entryLionVideo')).toBeVisible();
  await page.getByRole('button', { name: '重播入场', exact: true }).click();
  await expect(page.locator('#introVideo')).toBeVisible();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  expect(await page.locator('#introVideo').evaluate((video) => video.loop)).toBe(false);
  await page.locator('#introVideo').evaluate((video) => video.dispatchEvent(new Event('ended')));
  await expect(page.locator('#entryLionVideo')).toBeVisible();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await page.getByRole('button', { name: '探索更多', exact: true }).click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'model');
  await expect(page).toHaveURL(/#\/model$/);
  await expect(page.locator('#modelStage')).toBeVisible();
});

test('手机视口保持章节导航与结构交互，页面可正常滚动', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.screenshot({ path: test.info().outputPath('home-mobile.png'), fullPage: true });
  await routeButton(page, 'model').click();
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await page.locator('#viewStructure').click();
  await expect(page.locator('#structureLayer')).toBeVisible();
  await expect(page.locator('#modelStatus')).toContainText('结构示意', { timeout: 45_000 });
  await page.locator('#structureDepth').fill('65');
  await expect(page.locator('#structureDepthValue')).toHaveText('65%');
  await page.locator('#hotspotList [data-id="mouth"]').click();
  await expect(page.locator('#panelTitle')).toHaveText('狮嘴');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('structure-mobile.png'), fullPage: true });
  await expect(page.locator('.site-header .site-navigation .site-nav-item[data-route]')).toHaveCount(4);
  for (const route of ['entry', 'model', 'action', 'state']) await expect(routeButton(page, route)).toBeInViewport();
  await routeButton(page, 'action').click();
  await expect(page.locator('#chapterTitle')).toHaveText('动作');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await routeButton(page, 'entry').click();
  await expect(page.locator('#introVideo, #entryLionVideo')).toBeVisible();
});

test('模型下载失败保留参考图，重试能够恢复3D场景', async ({ page }) => {
  let fail = true;
  await page.route('**/assets/models/lion-overall.glb', async (route) => {
    if (fail) await route.fulfill({ status: 503, body: 'temporarily unavailable' });
    else await route.continue();
  });
  await page.goto('/#/model');
  await expect(page.locator('#modelStatus')).toContainText('模型载入失败');
  await expect(page.locator('#modelFallback')).toBeVisible();
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: '重新载入', exact: true }).click();
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(1);
});

test('整体及同页结构示意透明融入指定背景，展示区没有内框或地面', async ({ page }) => {
  await page.goto('/#/model');
  for (const showGuide of [false, true]) {
    if (showGuide) await page.locator('#viewStructure').click();
    await expect(page.locator('#modelStage')).toBeVisible();
    await expect(page.locator('#modelStatus')).toContainText(showGuide ? '结构示意' : '模型已载入', { timeout: 45_000 });
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'model');
    await expect(page.locator('#sceneContainer canvas')).toHaveCount(1);
    await expect(page.locator('.scene-glow, .scene-pattern, .scene-grid')).toHaveCount(0);
    const presentation = await page.evaluate(() => {
      const frame = getComputedStyle(document.querySelector('#sceneFrame'));
      const layer = getComputedStyle(document.querySelector('#structureLayer'));
      const control = getComputedStyle(document.querySelector('.structure-control'));
      const stageBounds = document.querySelector('#modelStage').getBoundingClientRect();
      const canvasBounds = document.querySelector('#sceneContainer canvas').getBoundingClientRect();
      return {
        stage: getComputedStyle(document.querySelector('#modelStage')).backgroundImage,
        pageBackground: getComputedStyle(document.querySelector('.site-shell')).backgroundImage,
        frameColor: frame.backgroundColor,
        frameImage: frame.backgroundImage,
        frameBorders: [frame.borderTopWidth, frame.borderRightWidth, frame.borderBottomWidth, frame.borderLeftWidth],
        frameShadow: frame.boxShadow,
        frameOverflow: frame.overflow,
        stageBounds: { x: stageBounds.x, y: stageBounds.y, width: stageBounds.width, height: stageBounds.height },
        canvasBounds: { x: canvasBounds.x, y: canvasBounds.y, width: canvasBounds.width, height: canvasBounds.height },
        layerColor: layer.backgroundColor,
        layerImage: layer.backgroundImage,
        controlColor: control.backgroundColor,
        controlImage: control.backgroundImage,
      };
    });
    expect(presentation.stage).toBe('none');
    expect(presentation.pageBackground).toContain(assetPaths.modelBackground);
    expect(presentation.frameColor).toBe('rgba(0, 0, 0, 0)');
    expect(presentation.frameImage).toBe('none');
    expect(presentation.frameBorders).toEqual(['0px', '0px', '0px', '0px']);
    expect(presentation.frameShadow).toBe('none');
    expect(presentation.frameOverflow).toBe('visible');
    for (const dimension of ['x', 'y', 'width', 'height']) {
      expect(presentation.canvasBounds[dimension]).toBeCloseTo(presentation.stageBounds[dimension], 0);
    }
    expect(presentation.layerColor).toBe('rgba(0, 0, 0, 0)');
    expect(presentation.layerImage).toBe('none');
    expect(presentation.controlColor).toBe('rgba(0, 0, 0, 0)');
    expect(presentation.controlImage).toBe('none');

    const pixels = await sampleModelPixels(page);
    expect(pixels.alpha).toBe(true);
    expect(pixels.modelPixels).toBeGreaterThan(100);
    expect(pixels.cornerPixels).toBe(0);
  }
});

test('整体及结构示意滚轮放大后越过旧16:9及交互区上下边缘而不被裁切', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const showGuide of [false, true]) {
    await page.goto('/');
    await page.goto('/#/model');
    await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
    if (showGuide) await page.locator('#viewStructure').click();
    await page.getByRole('button', { name: '暂停自动旋转', exact: true }).click();
    const initial = await sampleModelPixels(page);
    expect(initial.modelPixels).toBeGreaterThan(100);
    const frame = await page.locator('.scene-interaction').boundingBox();
    await page.locator('.scene-interaction').hover({ position: { x: frame.width / 2, y: 100 } });
    let zoomed = initial;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      await page.mouse.wheel(0, -400);
      zoomed = await sampleModelPixels(page);
      if (zoomed.modelHeight > initial.modelHeight * 1.15 && zoomed.aboveFramePixels > 100 && zoomed.belowFramePixels > 100) break;
    }
    expect(zoomed.modelHeight).toBeGreaterThan(initial.modelHeight * 1.15);
    expect(zoomed.modelHeight).toBeGreaterThan(zoomed.legacyHeight);
    expect(zoomed.abovePixels).toBeGreaterThan(100);
    expect(zoomed.belowPixels).toBeGreaterThan(100);
    expect(zoomed.aboveFramePixels).toBeGreaterThan(100);
    expect(zoomed.belowFramePixels).toBeGreaterThan(100);
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'model');
    await page.screenshot({ path: test.info().outputPath(`${showGuide ? 'structure-guide' : 'model'}-zoom-beyond-legacy-frame.png`), fullPage: true });
  }
});

test('动作章节使用透明底层并保留待接入视频和定性时间轴', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const mediaRequests = [];
  page.on('request', (request) => mediaRequests.push(request.url()));
  await page.goto('/#/action');
  await expect(page.locator('#chapterStage')).toHaveAttribute('data-chapter', 'action');
  expect(await page.locator('#chapterStage').evaluate((element) => getComputedStyle(element).backgroundImage)).toBe('none');
  await expect(page.locator('.chapter-layout')).toHaveClass(/chapter-layout--three-column/);
  await expect(page.locator('.chapter-side-panel')).toHaveCount(2);
  await expect(page.locator('.chapter-main-visual')).toHaveCount(1);
  await expect(page.locator('#chapterMediaPlaceholder')).toContainText('动作视频待接入');
  await expect(page.locator('#chapterMediaPlaceholder')).toHaveAttribute('data-media-state', 'pending');
  await expect(page.locator('#chapterMediaViewport')).toBeVisible();
  await expect(page.locator('#chapterMediaControls')).toBeVisible();
  await expect(page.locator('#chapterMediaControls')).toContainText('资料状态 · 待核对');
  expect(mediaRequests.some((url) => url.includes('entry-intro.mp4'))).toBe(false);
  await expect(page.locator('.chapter-timeline')).toHaveClass(/chapter-timeline--horizontal/);
  await expect(page.locator('.chapter-timeline .chapter-timeline-node strong')).toHaveText(['入场', '展开', '收势']);
  const desktopNodes = await page.locator('.chapter-timeline-node').evaluateAll((nodes) => nodes.map((node) => {
    const bounds = node.getBoundingClientRect();
    return { x: bounds.x, width: bounds.width };
  }));
  expect(desktopNodes).toHaveLength(3);
  expect(desktopNodes.every(({ width }) => width > 0)).toBe(true);
  expect(desktopNodes[0].x).toBeLessThan(desktopNodes[1].x);
  expect(desktopNodes[1].x).toBeLessThan(desktopNodes[2].x);
  await expect(page.locator('#chapterSourceTag')).toContainText('公开视频样本分析');
  await expect(page.locator('#chapterTitle')).toHaveText('动作');
});

test('神态章节展示八态图鉴且保留样本待校核说明', async ({ page }) => {
  await page.goto('/#/state');
  await expect(page.locator('#chapterStage')).toHaveAttribute('data-chapter', 'state');
  expect(await page.locator('#chapterStage').evaluate((element) => getComputedStyle(element).backgroundImage)).toBe('none');
  await expect(page.getByRole('navigation', { name: '醒狮八态' }).getByRole('button')).toHaveCount(8);
  await expect(page.locator('#expressionObservation')).toBeVisible();
  await expect(page.locator('#chapterEvidence')).toContainText('等待真实图片/视频样本校核');
  await expect(page.locator('[data-quantified-result]')).toHaveCount(0);
  await expect(page.locator('#chapterTitle')).toHaveText('神态');
});

test('模型页复用全局品牌与章节导航并高亮当前章节', async ({ page }) => {
  await page.goto('/#/model');
  const header = page.locator('.site-header');
  await expect(header).toHaveCount(1);
  await expect(header).toBeVisible();
  const modelLion = header.locator('.site-brand .entry-lion-emblem');
  await expect(modelLion).toBeVisible();
  await expect(modelLion).toHaveAttribute('src', /assets\/entry\/nav-lion-head\.png/);
  expect(await modelLion.evaluate((image) => image.tagName === 'IMG' && image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(header.locator('.site-navigation img')).toHaveCount(0);
  await expect(header.locator('.site-navigation')).toBeVisible();
  await expect(header.locator('.site-nav-item[data-route]')).toHaveCount(4);
  await expect(page.locator('.model-header .site-navigation, .model-header .site-brand')).toHaveCount(0);
  await expect(header.locator('.site-nav-item.is-current')).toHaveAttribute('data-route', 'model');
  await expect(routeButton(page, 'model')).toHaveAttribute('aria-current', 'page');
  await expect(routeButton(page, 'model')).toHaveAccessibleName('结构');
  await expect(routeButton(page, 'model').locator('.site-nav-copy')).toBeHidden();
  const settings = header.getByRole('button', { name: '打开开发者参数设置', exact: true });
  await expect(settings).toBeVisible();
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  await expect(settings).toHaveAttribute('aria-controls', 'developerSettingsPanel');
});

test('模型页数字图鉴联动热点、聚焦和同页结构开关，退出释放场景', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/#/model');
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await expect(page.locator('#culturePanel')).toBeVisible();
  await expect(page.locator('#structurePanel')).toBeVisible();
  await expect(page.locator('.panel-detail-list')).toBeVisible();
  await expect(page.locator('.structure-diagram')).toBeVisible();
  await expect(page.locator('#viewStructure')).toBeVisible();
  await expect(page.locator('#resetView')).toBeVisible();
  const canvas = await page.locator('#sceneContainer canvas').elementHandle();
  const columns = await page.locator('.model-layout').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(3);

  await page.locator('#hotspots [data-id="eyes"]').click();
  await expect(page.locator('#modelStage')).toHaveAttribute('data-selected-id', 'eyes');
  await expect(page.locator('#modelStage')).toHaveAttribute('data-focus-state', 'eyes');
  await expect(page.locator('#cultureTitle')).toHaveText('鼓眼与狮眉');
  await expect(page.locator('#structureTitle')).toHaveText('鼓眼与狮眉');
  await expect(page.locator('#hotspots [data-id="eyes"]')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#resetView').click();
  await expect(page.locator('#modelStage')).toHaveAttribute('data-focus-state', 'overall');
  await expect(page.locator('#modelStage')).toHaveAttribute('data-selected-id', 'outer_shell');

  await page.locator('#hotspots [data-id="mirror"]').click();
  const modelHash = await page.evaluate(() => location.hash);
  await page.locator('#viewStructure').click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'model');
  expect(await page.evaluate(() => location.hash)).toBe(modelHash);
  await expect(page.locator('#viewStructure')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#modelStage')).toHaveAttribute('data-guide-open', 'true');
  await expect(page.locator('#structureLayer')).toBeVisible();
  await expect(page.locator('#structureBoundary')).toContainText('合并网格');
  expect(await canvas.evaluate((element) => element === document.querySelector('#sceneContainer canvas'))).toBe(true);
  await page.locator('#viewStructure').click();
  await expect(page.locator('#viewStructure')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#structureLayer')).not.toBeVisible();
  await expect(page.locator('#modelStage')).toHaveAttribute('data-focus-state', 'mirror');
  await page.locator('#viewStructure').click();
  await page.locator('#restoreStructure').click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'model');
  await expect(page.locator('#viewStructure')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#structureLayer')).not.toBeVisible();
  await expect(page.locator('#modelStage')).toHaveAttribute('data-focus-state', 'overall');
  await expect(page.locator('#modelStage')).toHaveAttribute('data-selected-id', 'outer_shell');
  await expect(page.locator('#structureDepthValue')).toHaveText('18%');
  expect(await canvas.evaluate((element) => element === document.querySelector('#sceneContainer canvas'))).toBe(true);
  await routeButton(page, 'entry').click();
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(0);
  expect(await canvas.evaluate((element) => element.isConnected)).toBe(false);
  await expect.poll(() => canvas.evaluate((element) => {
    const gl = element.getContext('webgl2') ?? element.getContext('webgl');
    return gl?.isContextLost();
  })).toBe(true);
  await routeButton(page, 'model').click();
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(1);
  expect(await canvas.evaluate((element) => element === document.querySelector('#sceneContainer canvas'))).toBe(false);
  await canvas.dispose();
});

test('模型页数字图鉴在手机宽度保持单列且不横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/model');
  await expect(page.locator('#modelStage')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.model-layout').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1);
});

test('快速离开载入中的模型时取消请求，重新进入只有一个canvas', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/assets/models/lion-overall.glb', (route) => route.abort('aborted'));
  await page.goto('/#/model');
  await expect(page.locator('#modelStage')).toBeVisible();
  await routeButton(page, 'entry').click();
  await page.unroute('**/assets/models/lion-overall.glb');
  await routeButton(page, 'model').click();
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('首页入场视频失败可重试与跳过，未知链接返回首页', async ({ page }) => {
  let fail = true;
  await page.route('**/assets/intro/entry-intro.mp4', (route) => fail ? route.abort('failed') : route.continue());
  await page.goto('/');
  await expect(page.locator('.video-status')).toContainText('视频暂时无法播放');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  fail = false;
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect.poll(() => page.locator('#introVideo').evaluate((video) => video.readyState)).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: '跳过入场', exact: true }).click();
  await expect(page.locator('#entryLionVideo')).toBeVisible();
  await routeButton(page, 'model').click();
  await expect(page.locator('#modelStage')).toBeVisible();
  await page.goto('/#/unknown-chapter');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
});

test('旧入场与结构链接兼容到首页与整体，不再保留独立页面', async ({ page }) => {
  for (const [hash, route] of [['#/intro', 'entry'], ['#intro', 'entry'], ['#/structure', 'model'], ['#structure', 'model']]) {
    await page.goto(`/${hash}`);
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
    await expect(page).toHaveURL(new RegExp(`#/${route}$`));
    if (route === 'entry') {
      await expect(page.locator('.entry-title-art')).toHaveCount(1);
      await expect(page.locator('#introVideo, #entryLionVideo')).toBeVisible();
    } else {
      await expect(page.locator('#modelStage')).toBeVisible();
      await expect(page.locator('#viewStructure')).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#structureLayer')).not.toBeVisible();
    }
    await page.reload();
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
  }
});

test('已删除的评分章节链接均返回首页', async ({ page }) => {
  for (const hash of ['#/score', '#score']) {
    await page.goto(`/${hash}`);
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
    await expect(page.locator('#introVideo, #entryLionVideo')).toBeVisible();
    await expect(page.locator('#chapterTitle')).toHaveCount(0);
    await expect(page.locator('.site-header .site-navigation')).not.toContainText('评分');
    await expect(routeButton(page, 'score')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  }
});
