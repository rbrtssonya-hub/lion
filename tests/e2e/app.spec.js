import { test, expect } from '@playwright/test';

test('首页媒体、视频结束转场和六章导航均由当前页面运行', async ({ page }) => {
  const errors = [];
  const failedResources = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) failedResources.push(response.url()); });
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'entry');
  await expect(page.locator('.entry-title-art')).toBeVisible();
  await expect.poll(() => page.locator('#entryLionVideo').evaluate((video) => video.readyState)).toBeGreaterThanOrEqual(2);
  expect(requests.some((url) => /three|GLTFLoader|lion-overall/.test(url))).toBe(false);
  await page.screenshot({ path: test.info().outputPath('homepage.png'), fullPage: true });

  await page.getByRole('button', { name: '进入醒狮档案', exact: true }).click();
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

  await page.locator('.chapter-rail').getByRole('button', { name: '结构', exact: true }).click();
  await expect(page.locator('#structureLayer')).toBeVisible();
  await page.locator('#structureDepth').fill('90');
  await expect(page.locator('#structureDepthValue')).toHaveText('90%');
  await expect(page.locator('.structure-callout.is-revealed')).toHaveCount(4);
  await expect(page.locator('#sceneContainer canvas')).toHaveCount(1);
  for (const [route, label] of [['action', '动作'], ['state', '神态'], ['score', '评分']]) {
    await page.locator('.chapter-rail').getByRole('button', { name: label, exact: true }).click();
    await expect(page.locator('#react-app')).toHaveAttribute('data-route', route);
    await expect(page.locator('#chapterTitle')).toHaveText(label);
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('#sceneContainer canvas')).toHaveCount(0);
  }
  await page.reload();
  await expect(page.locator('#chapterTitle')).toHaveText('评分');
  await page.goBack();
  await expect(page.locator('#chapterTitle')).toHaveText('神态');
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
  await page.locator('.chapter-rail').getByRole('button', { name: '动作', exact: true }).click();
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
