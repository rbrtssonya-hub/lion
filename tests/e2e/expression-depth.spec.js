import { expect, test } from '@playwright/test';
import { assetPaths } from '../../src/config/assetPaths.js';

const states = [
  ['joy', '喜', 'expressionJoy'], ['anger', '怒', 'expressionAnger'],
  ['sorrow', '哀', 'expressionSorrow'], ['delight', '乐', 'expressionDelight'],
  ['motion', '动', 'expressionMotion'], ['stillness', '静', 'expressionStillness'],
  ['surprise', '惊', 'expressionSurprise'], ['doubt', '疑', 'expressionDoubt'],
];
const stage = page => page.getByRole('region', { name: '醒狮八态纵深图鉴', exact: true });
const directory = page => page.getByRole('navigation', { name: '八态目录', exact: true });
const canvas = page => stage(page).locator('.scene-canvas canvas');
const dialog = page => stage(page).getByRole('dialog');
const routeButton = (page, route) => page.locator(`.site-header [data-route="${route}"]`);
const snapshot = page => page.evaluate(() => window.__LION_DEPTH_SCENE__ ?? null);

test.use({ viewport: { width: 1920, height: 1080 } });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, pushPage: false }));
    // Keep references to the real detached Audio elements so unmount cleanup
    // can be checked without adding a product inspection API or mocking sound.
    window.__depthTestAudio = [];
    window.Audio = new Proxy(window.Audio, {
      construct(target, args) {
        const audio = Reflect.construct(target, args);
        window.__depthTestAudio.push(audio);
        return audio;
      },
    });
  });
});

async function openDepth(page) {
  await page.goto('/?inspect=1#/state');
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 65_000 });
  await expect(stage(page)).toBeVisible();
  await expect(stage(page)).toHaveClass(/has-webgl/);
  await expect(canvas(page)).toBeVisible();
  await expect.poll(async () => (await snapshot(page))?.primaryCount).toBe(8);
}

async function selectState(page, index) {
  await directory(page).getByRole('link', { name: states[index][1], exact: true }).click();
  await expect.poll(async () => Math.abs(((await snapshot(page))?.chapter ?? -100) - (index + 2)), { timeout: 15_000 }).toBeLessThan(.025);
  await expect(directory(page).getByRole('link', { name: states[index][1], exact: true })).toHaveAttribute('aria-current', 'location');
  await expect.poll(async () => (await snapshot(page))?.faces[index]?.ready, { timeout: 20_000 }).toBe(true);
  await expect(page).toHaveURL(/\?inspect=1#\/state$/);
  await expect(dialog(page)).toHaveCount(0);
}

async function clickArtwork(page, index) {
  const bounds = (await snapshot(page)).cards[index].artworkPlaneBounds;
  const box = await canvas(page).boundingBox();
  expect(box).not.toBeNull();
  const point = { x: bounds.centerX, y: bounds.centerY };
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, point)).toBe('CANVAS');
  await page.mouse.click(point.x, point.y);
}

async function expectNoFaceDrivers(page) {
  await expect(page.locator('[data-face-drivers]')).toHaveCount(0);
  expect(await page.evaluate(() => document.getAnimations().filter(animation =>
    animation.effect?.target instanceof Element && animation.effect.target.closest('[data-face-drivers]')).length)).toBe(0);
}

test('V7八态目录只移动镜头，保持原站距、40px路线标记和唯一主站顶栏', async ({ page }) => {
  test.setTimeout(120_000);
  await openDepth(page);
  await expect(page.locator('.site-header')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: '作品章节导航', exact: true })).toHaveCount(1);
  await expect(directory(page).getByRole('link')).toHaveCount(8);
  expect(await directory(page).getByRole('link').evaluateAll(links => links.every(link => link.getAttribute('href') === '#/state'))).toBe(true);
  for (let index = 0; index < states.length; index++) {
    await selectState(page, index);
    const current = await snapshot(page);
    expect(current.faces.every(face => face.playCount === 0 && !face.playing)).toBe(true);
    expect(current.cards[index].stateId).toBe(states[index][0]);
    expect(current.cards[index].distance).toBeCloseTo(13.5, 1);
    expect(current.cards[index].visible).toBe(true);
    expect(current.artworkCount).toBe(8);
    expect(current.backplateCount).toBe(0);
    for (let next = 1; next < current.cards.length; next++) {
      expect(current.cards[next - 1].worldZ - current.cards[next].worldZ).toBeCloseTo(36, 6);
    }
    await expect.poll(async () => (await snapshot(page))?.orb?.visible).toBe(true);
    const orb = (await snapshot(page)).orb;
    expect(orb.radiusPx * 2).toBeCloseTo(40, 3);
    expect(orb.distance).toBeCloseTo(20, 3);
    expect(orb.curveError).toBeLessThan(.001);
    expect(orb.texture).toContain(assetPaths.depthRouteMarker);
    await expectNoFaceDrivers(page);
  }
});

test('八态均由真实Canvas点击触发原三秒五官，再打开仅本态解读', async ({ page }) => {
  test.setTimeout(180_000);
  await openDepth(page);
  for (let index = 0; index < states.length; index++) {
    await selectState(page, index);
    expect((await snapshot(page)).faces[index].playCount).toBe(0);
    await clickArtwork(page, index);
    await expect.poll(async () => (await snapshot(page))?.faces[index]?.playing).toBe(true);
    await expect.poll(async () => (await snapshot(page))?.faces[index]?.parts.some(part =>
      part.rendered && part.matrix.some((value, i) => Math.abs(value - [1, 0, 0, 1, 0, 0][i]) > .001))).toBe(true);
    const playing = (await snapshot(page)).faces[index];
    expect(playing.playCount).toBe(1);
    expect(playing.rigVisible).toBe(true);
    expect(playing.photoVisible).toBe(false);
    await expect(dialog(page)).toHaveCount(0);
    await expect.poll(async () => (await snapshot(page))?.faces[index]?.elapsed, { timeout: 5_000, intervals: [50, 100] }).toBeGreaterThanOrEqual(2000);
    await expect(dialog(page)).toHaveCount(0);
    await expect(dialog(page)).toBeVisible({ timeout: 5_000 });
    await expect.poll(async () => (await snapshot(page))?.faces[index]?.elapsed, { timeout: 1000, intervals: [50, 100] }).toBe(3000);
    await expect(dialog(page).getByRole('heading', { level: 2 })).toHaveText(new RegExp(`^${states[index][1]} · `));
    await expect(dialog(page).locator('.gallery-image img')).toHaveAttribute('src', new RegExp(assetPaths[states[index][2]].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await expect(dialog(page).locator('.gallery-note')).toContainText('AI辅助视觉');
    await expect(page).toHaveURL(/\?inspect=1#\/state$/);
    await expectNoFaceDrivers(page);
    await dialog(page).getByRole('button', { name: '关闭神态解读', exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect.poll(async () => (await snapshot(page))?.faces[index]?.playing).toBe(false);
  }
});

async function redPixels(page) {
  const bounds = (await snapshot(page)).cards[0].artworkPlaneBounds;
  const box = await canvas(page).boundingBox();
  expect(box).not.toBeNull();
  const x = Math.max(box.x, bounds.left), y = Math.max(box.y, bounds.top);
  const clip = { x, y, width: Math.min(box.x + box.width, bounds.right) - x, height: Math.min(box.y + box.height, bounds.bottom) - y };
  // Read compositor screenshots: WebGL does not need preserveDrawingBuffer.
  // Keep WAAPI running, since disabling animations would skip the real motion.
  const png = await page.screenshot({ clip, animations: 'allow' });
  const red = await page.evaluate(async url => {
    const image = new Image(); image.src = url; await image.decode();
    const sample = document.createElement('canvas');
    sample.width = image.width; sample.height = image.height;
    const context = sample.getContext('2d'); context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, sample.width, sample.height).data;
    let count = 0;
    for (let y = 0; y < sample.height; y++) {
      for (let x = 0; x < sample.width; x++) {
        const i = (y * sample.width + x) * 4;
        if (data[i] > 110 && data[i] > data[i + 1] * 1.35 && data[i] > data[i + 2] * 1.2) count++;
      }
    }
    return count;
  }, `data:image/png;base64,${png.toString('base64')}`);
  return { red, png };
}

test('五官播放期间实际合成帧保持完整红色狮头，没有整幅消失闪烁', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await openDepth(page);
  await selectState(page, 0);
  const baseline = await redPixels(page);
  expect(baseline.red).toBeGreaterThan(500);
  await testInfo.attach('lion-before-motion', { body: baseline.png, contentType: 'image/png' });
  await clickArtwork(page, 0);
  await expect.poll(async () => (await snapshot(page))?.faces[0]?.playing).toBe(true);
  const started = Date.now();
  const samples = [];
  for (const target of [0, 350, 700, 1050]) {
    const remaining = target - (Date.now() - started);
    if (remaining > 0) await page.waitForTimeout(remaining);
    const face = (await snapshot(page)).faces[0];
    expect(face.playing).toBe(true);
    expect(face.rigVisible).toBe(true);
    expect(face.photoVisible).toBe(false);
    expect(face.parts.every(part => part.rendered)).toBe(true);
    const frame = await redPixels(page);
    samples.push({ elapsed: face.elapsed, red: frame.red, ratio: frame.red / baseline.red });
    await testInfo.attach(`lion-motion-${target}ms`, { body: frame.png, contentType: 'image/png' });
    expect(frame.red, `Visible red artwork at ${face.elapsed}ms`).toBeGreaterThan(baseline.red * .45);
  }
  await testInfo.attach('rendered-red-pixel-samples', { body: JSON.stringify({ baseline: baseline.red, samples }, null, 2), contentType: 'application/json' });
  await expect(dialog(page)).toBeVisible({ timeout: 5_000 });
});

test('原顶栏可在播放期间离开，返回无旧解读、音轨、WAAPI驱动，返回舞章入口有效', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openDepth(page);
  await selectState(page, 0);
  await page.locator('#depth-joy').getByRole('button', { name: '启用自动讲解', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__depthTestAudio.some(audio =>
    audio.src.includes('/expression-depth/audio/joy.wav') && !audio.paused)), { timeout: 15_000 }).toBe(true);
  await page.evaluate(() => { window.__depthTestNarrators = window.__depthTestAudio.filter(audio => audio.src.includes('/expression-depth/audio/')); });
  await clickArtwork(page, 0);
  await expect.poll(async () => (await snapshot(page))?.faces[0]?.playing).toBe(true);
  await routeButton(page, 'action').click();
  await expect(page).toHaveURL(/#\/action$/);
  await expect(stage(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__LION_DEPTH_SCENE__ ?? null)).toBeNull();
  await expectNoFaceDrivers(page);
  expect(await page.evaluate(() => window.__depthTestNarrators.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__depthTestNarrators.every(audio => audio.paused && !audio.getAttribute('src')))).toBe(true);
  await page.getByRole('link', { name: '走近醒狮八态', exact: true }).click();
  await expect(stage(page)).toHaveClass(/has-webgl/);
  await expect.poll(async () => (await snapshot(page))?.primaryCount).toBe(8);
  await page.waitForTimeout(3300);
  await expect(dialog(page)).toHaveCount(0);
  expect((await snapshot(page)).faces.every(face => !face.playing && face.playCount === 0)).toBe(true);
  await expectNoFaceDrivers(page);
  await expect(page.locator('.site-header')).toHaveCount(1);
  await stage(page).getByRole('button', { name: '返回舞章入口', exact: true }).click();
  await expect(page).toHaveURL(/#\/action$/);
  await expect(stage(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('滚轮正向推进与反向回退沿同一镜头和空间路线，不改变主站hash', async ({ page }) => {
  test.setTimeout(90_000);
  await openDepth(page);
  await selectState(page, 1);
  const clip = await canvas(page).boundingBox();
  await page.mouse.move(clip.x + clip.width * .52, clip.y + clip.height * .82);
  const initial = await snapshot(page);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(90); }
  await expect.poll(async () => (await snapshot(page))?.chapter).toBeGreaterThan(initial.chapter + .15);
  await page.waitForTimeout(350);
  const forward = await snapshot(page);
  expect(forward.camera.z).toBeLessThan(initial.camera.z);
  expect(forward.camera.z).toBeCloseTo(forward.targetCameraZ, 5);
  expect(forward.orb.curveError).toBeLessThan(.001);
  expect(forward.orb.distance).toBeCloseTo(20, 3);
  const reversed = page.waitForFunction(chapter => (window.__LION_DEPTH_SCENE__?.chapter ?? chapter) < chapter - .025, forward.chapter, { timeout: 3000 });
  for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(90); }
  await reversed;
  const backward = await snapshot(page);
  expect(backward.camera.z).toBeGreaterThan(forward.camera.z);
  expect(backward.camera.z).toBeCloseTo(backward.targetCameraZ, 5);
  expect(backward.orb.curveError).toBeLessThan(.001);
  expect(backward.orb.radiusPx * 2).toBeCloseTo(40, 3);
  expect(backward.faces.every(face => face.playCount === 0)).toBe(true);
  await expect(page).toHaveURL(/\?inspect=1#\/state$/);
  await expect(dialog(page)).toHaveCount(0);
});
