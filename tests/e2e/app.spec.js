import { test, expect } from '@playwright/test';

test('首页媒体、视频结束转场和五章导航均由当前页面运行', async ({ page }) => {
  const errors = [];
  const failedResources = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) failedResources.push(response.url()); });
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await expect(page.locator('.entry-title-art')).toBeVisible();
  const homeLion = page.locator('.entry-lion-emblem');
  await expect(homeLion).toBeVisible();
  await expect(homeLion).toHaveAttribute('src', /assets\/entry\/nav-lion-head\.png/);
  expect(await homeLion.evaluate((image) => image.tagName === 'IMG' && image.complete && image.naturalWidth > 0)).toBe(true);
  await expect.poll(() => page.locator('#entryLionVideo').evaluate((video) => video.readyState)).toBeGreaterThanOrEqual(2);
  expect(requests.some((url) => /three|GLTFLoader|lion-overall/.test(url))).toBe(false);
  await page.screenshot({ path: test.info().outputPath('homepage.png'), fullPage: true });

  await page.getByRole('button', { name: '探索更多' }).click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'intro');
  await expect.poll(() => page.locator('#introVideo').evaluate((video) => video.readyState)).toBeGreaterThanOrEqual(2);
  await page.locator('#introVideo').evaluate((video) => video.dispatchEvent(new Event('ended')));
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

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.locator('.entry-chapter-nav, .chapter-rail').getByRole('button', { name: /结构/ }).click();
  await expect(page.locator('#structureLayer')).toBeVisible();
  await page.locator('#structureDepth').fill('90');
  await expect(page.locator('#structureDepthValue')).toHaveText('90%');
  await expect(page.locator('.structure-callout.is-revealed')).toHaveCount(4);
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(1);
  for (const [route, label] of [['action', '动作'], ['state', '神态']]) {
    await page.locator('.entry-chapter-nav, .chapter-rail').getByRole('button', { name: new RegExp(label) }).click();
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
    await expect(page.locator('#chapterTitle')).toHaveText(label);
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('#sceneContainer canvas')).toHaveCount(0);
  }
  await page.reload();
  await expect(page.locator('#chapterTitle')).toHaveText('神态');
  await page.goBack();
  await expect(page.locator('#chapterTitle')).toHaveText('动作');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await expect(page.locator('#entryLionVideo')).toBeVisible();
  expect(errors).toEqual([]);
  expect(failedResources).toEqual([]);
});

test('手机视口保持章节导航与结构交互，页面可正常滚动', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.screenshot({ path: test.info().outputPath('home-mobile.png'), fullPage: true });
  await page.locator('.entry-bottom-item').filter({ hasText: '结构' }).click();
  await expect(page.locator('#structureLayer')).toBeVisible();
  await expect(page.locator('#modelStatus')).toContainText('结构框架', { timeout: 45_000 });
  await page.locator('#structureDepth').fill('65');
  await expect(page.locator('#structureDepthValue')).toHaveText('65%');
  await page.locator('#hotspotList [data-id="mouth"]').click();
  await expect(page.locator('#panelTitle')).toHaveText('狮嘴');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('structure-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '打开章节菜单', exact: true }).click();
  await page.getByRole('dialog', { name: '章节目录' }).getByRole('button', { name: /04.*动作/ }).click();
  await expect(page.locator('#chapterTitle')).toHaveText('动作');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await expect(page.locator('#entryLionVideo')).toBeVisible();
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

test('整体与结构模型透明融入朱红页面，展示区没有内框或地面', async ({ page }) => {
  for (const route of ['model', 'structure']) {
    await page.goto(`/#/${route}`);
    await expect(page.locator('#modelStage')).toBeVisible();
    await expect(page.locator('#modelStatus')).toContainText(route === 'model' ? '模型已载入' : '结构框架', { timeout: 45_000 });
    await expect(page.locator('#sceneContainer canvas')).toHaveCount(1);
    await expect(page.locator('.scene-glow, .scene-pattern, .scene-grid')).toHaveCount(0);
    const presentation = await page.evaluate(() => {
      const frame = getComputedStyle(document.querySelector('#sceneFrame'));
      const layer = getComputedStyle(document.querySelector('#structureLayer'));
      const control = getComputedStyle(document.querySelector('.structure-control'));
      return {
        stage: getComputedStyle(document.querySelector('#modelStage')).backgroundImage,
        frameColor: frame.backgroundColor,
        frameImage: frame.backgroundImage,
        frameBorders: [frame.borderTopWidth, frame.borderRightWidth, frame.borderBottomWidth, frame.borderLeftWidth],
        frameShadow: frame.boxShadow,
        layerColor: layer.backgroundColor,
        layerImage: layer.backgroundImage,
        controlColor: control.backgroundColor,
        controlImage: control.backgroundImage,
      };
    });
    expect(presentation.stage).toMatch(/104,\s*23,\s*15/);
    expect(presentation.frameColor).toBe('rgba(0, 0, 0, 0)');
    expect(presentation.frameImage).toBe('none');
    expect(presentation.frameBorders).toEqual(['0px', '0px', '0px', '0px']);
    expect(presentation.frameShadow).toBe('none');
    expect(presentation.layerColor).toBe('rgba(0, 0, 0, 0)');
    expect(presentation.layerImage).toBe('none');
    expect(presentation.controlColor).toBe('rgba(0, 0, 0, 0)');
    expect(presentation.controlImage).toBe('none');

    // Read inside rAF before the browser clears a non-preserved WebGL buffer.
    // A nonempty model is required so a cleared, all-zero buffer cannot pass.
    const pixels = await page.locator('#sceneContainer canvas').evaluate((canvas) => new Promise((resolve) => {
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      const attributes = gl?.getContextAttributes();
      if (!gl || !attributes) return resolve({ alpha: false, modelPixels: 0 });
      let attempts = 0;
      const sample = () => {
        const width = gl.drawingBufferWidth;
        const height = gl.drawingBufferHeight;
        const buffer = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
        let modelPixels = 0;
        let edgePixels = 0;
        const margin = Math.max(2, Math.floor(Math.min(width, height) * 0.02));
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (buffer[(y * width + x) * 4 + 3] === 0) continue;
            modelPixels += 1;
            const corner = (x < margin || x >= width - margin) && y >= height - margin;
            if (y < margin || corner) edgePixels += 1;
          }
        }
        if (modelPixels === 0 && ++attempts < 10) return requestAnimationFrame(sample);
        resolve({ alpha: attributes.alpha, modelPixels, edgePixels });
      };
      requestAnimationFrame(sample);
    }));
    expect(pixels.alpha).toBe(true);
    expect(pixels.modelPixels).toBeGreaterThan(100);
    expect(pixels.edgePixels).toBe(0);
  }
});

test('模型页顶部复用首页红金章节导航并高亮当前章节', async ({ page }) => {
  await page.goto('/#/model');
  const header = page.locator('.model-header');
  await expect(header.locator('.entry-nav-shell')).toBeVisible();
  const modelLion = header.locator('.entry-lion-emblem');
  await expect(modelLion).toBeVisible();
  await expect(modelLion).toHaveAttribute('src', /assets\/entry\/nav-lion-head\.png/);
  expect(await modelLion.evaluate((image) => image.tagName === 'IMG' && image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(header.locator('.entry-chapter-nav')).toBeVisible();
  await expect(header.locator('.chapter-rail')).toHaveCount(0);
  await expect(header.locator('.entry-nav-item.is-current')).toHaveText(/整体/);
  await expect(header.getByRole('button', { name: '搜索章节', exact: true })).toBeVisible();
  await expect(header.getByRole('button', { name: '打开章节菜单', exact: true })).toBeVisible();
});

test('模型页数字图鉴联动热点、聚焦和结构入口', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/#/model');
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await expect(page.locator('#culturePanel')).toBeVisible();
  await expect(page.locator('#structurePanel')).toBeVisible();
  await expect(page.locator('.panel-detail-list')).toBeVisible();
  await expect(page.locator('.structure-diagram')).toBeVisible();
  await expect(page.locator('#viewStructure')).toBeVisible();
  await expect(page.locator('#resetView')).toBeVisible();
  const sceneRatio = await page.locator('#sceneFrame').evaluate((element) => {
    const { width, height } = element.getBoundingClientRect();
    return width / height;
  });
  expect(sceneRatio).toBeCloseTo(16 / 9, 1);
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
  await page.locator('#viewStructure').click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'structure');
  await expect(page.locator('#structureLayer')).toBeVisible();
  await expect(page.locator('#structureBoundary')).toContainText('合并网格');
  await page.locator('#restoreStructure').click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'model');
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
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.unroute('**/assets/models/lion-overall.glb');
  await page.locator('.entry-bottom-item').filter({ hasText: '认识广府醒狮' }).click();
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45_000 });
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('视频不可用时可以重试或进入模型，未知链接返回首页', async ({ page }) => {
  await page.route('**/assets/intro/entry-intro.mp4', (route) => route.abort('failed'));
  await page.goto('/#/intro');
  await expect(page.locator('.video-status')).toContainText('视频暂时无法播放');
  await page.getByRole('button', { name: '浏览整体模型', exact: true }).click();
  await expect(page.locator('#modelStage')).toBeVisible();
  await page.goto('/#/unknown-chapter');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
});

test('已删除的评分章节链接均返回首页', async ({ page }) => {
  for (const hash of ['#/score', '#score']) {
    await page.goto(`/${hash}`);
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
    await expect(page.locator('#entryLionVideo')).toBeVisible();
    await expect(page.locator('#chapterTitle')).toHaveCount(0);
    await expect(page.locator('.entry-chapter-nav')).not.toContainText('评分');
    await page.reload();
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  }
});
