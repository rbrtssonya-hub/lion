import { test, expect } from '@playwright/test';
import { openTheater, scene, jsonAttribute } from './action-theater.helpers.js';
import { selectSettingsFor } from './settings-navigation.helpers.js';

const header = page => page.locator('.site-header');
const theater = page => page.locator('#actionTheater');
const stageWidth = async page => (await jsonAttribute(scene(page), 'data-composition')).stage.widthRatio;
const frameCount = async page => Number(await scene(page).getAttribute('data-rendered-frames'));

async function expectRoomUnderNavigation(page, retained) {
  await expect.poll(() => page.evaluate(() => {
    const nav = document.querySelector('.site-header').getBoundingClientRect();
    const canvas = document.querySelector('#theaterSceneContainer canvas').getBoundingClientRect();
    const title = document.querySelector('.theater-topline').getBoundingClientRect();
    const tools = document.querySelector('.theater-view-tools').getBoundingClientRect();
    const page = document.querySelector('.site-page').getBoundingClientRect();
    return Math.abs(canvas.top) < 1 && Math.abs(canvas.bottom - innerHeight) < 1
      && canvas.left <= nav.left + 1 && canvas.right >= nav.right - 1
      && Math.abs(canvas.right - page.right) < 1
      && title.top >= nav.bottom + 12 && tools.top >= nav.bottom + 12
      && document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
  })).toBe(true);
  expect(await retained.evaluate(canvas => canvas.isConnected
    && canvas === document.querySelector('#theaterSceneContainer canvas'))).toBe(true);
}

// Read actual page screenshots. A locator screenshot of a WebGL canvas is also
// composited and cannot independently prove which layer supplied the backdrop.
async function screenshotDifference(page, before, after) {
  return page.evaluate(async sources => {
    const pixels = [];
    for (const source of sources) {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      pixels.push(context.getImageData(0, 0, canvas.width, canvas.height));
    }
    const [visible, hidden] = pixels;
    if (visible.width !== hidden.width || visible.height !== hidden.height) throw new Error('Backdrop capture dimensions changed');
    let changed = 0, sum = 0, count = 0;
    for (let index = 0; index < visible.data.length; index += 4) {
      const delta = [0, 1, 2].map(channel => Math.abs(visible.data[index + channel] - hidden.data[index + channel]));
      if (Math.max(...delta) > 8) changed += 1;
      sum += (delta[0] + delta[1] + delta[2]) / 3;
      count += 1;
    }
    return { pixels: count, changedRatio: changed / count, meanAbsoluteDifference: sum / count };
  }, [before, after].map(bytes => `data:image/png;base64,${bytes.toString('base64')}`));
}

test('动作导航透出当前三维场景，顶栏调整、等尺寸全屏与设置推开保留画布和投影', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openTheater(page, { settings: { headerTransparency: 100, headerBlur: 0, panelWidth: 420, pushPage: false } });
  await expect(scene(page)).toHaveAttribute('data-hdri-state', 'ready', { timeout: 45_000 });
  await expect(scene(page)).toHaveAttribute('data-camera-state', 'idle');
  const retained = await scene(page).elementHandle();
  await expectRoomUnderNavigation(page, retained);

  // Compact navigation occupies the right half. Keep this native screenshot
  // inside the empty left part, away from icons and the resize boundary.
  const nav = await header(page).boundingBox();
  const clip = { x: nav.x + 24, y: nav.y + 12, width: Math.floor(Math.min(480, nav.width / 4)), height: Math.floor(nav.height - 24) };
  const live = await page.screenshot({ clip });
  const visibility = await retained.evaluate(canvas => {
    const previous = canvas.style.visibility;
    canvas.style.visibility = 'hidden';
    return previous;
  });
  let hidden;
  try {
    hidden = await page.screenshot({ clip });
  } finally {
    await retained.evaluate((canvas, previous) => { canvas.style.visibility = previous; }, visibility);
  }
  const difference = await screenshotDifference(page, live, hidden);
  expect(difference.changedRatio).toBeGreaterThan(.1);
  expect(difference.meanAbsoluteDifference).toBeGreaterThan(2);
  await testInfo.attach('transparent-navigation-live-scene', { body: live, contentType: 'image/png' });
  await testInfo.attach('transparent-navigation-canvas-hidden', { body: hidden, contentType: 'image/png' });
  await testInfo.attach('backdrop-pixel-difference', { body: Buffer.from(JSON.stringify(difference)), contentType: 'application/json' });

  const initialWidth = await stageWidth(page);
  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
  await selectSettingsFor(page, 'headerHeight');
  const heightControl = page.getByRole('spinbutton', { name: '顶栏高度数值', exact: true });
  const previousFrames = await frameCount(page);
  await heightControl.fill('64');
  await expect.poll(() => header(page).evaluate(element => element.getBoundingClientRect().height)).toBe(64);
  await expectRoomUnderNavigation(page, retained);
  await expect.poll(() => stageWidth(page)).toBeGreaterThan(initialWidth * 1.01);
  const shortHeaderWidth = await stageWidth(page);
  await heightControl.fill('180');
  await expect.poll(() => header(page).evaluate(element => element.getBoundingClientRect().height)).toBe(180);
  await expectRoomUnderNavigation(page, retained);
  await expect.poll(() => stageWidth(page)).toBeLessThan(shortHeaderWidth * .95);
  await expect.poll(() => frameCount(page)).toBeGreaterThan(previousFrames);
  await page.getByRole('button', { name: '保存设置', exact: true }).click();

  // Lock only the fullscreen test box to the normal box. Entering fullscreen
  // must clear the camera's header crop even when ResizeObserver sees no size
  // change (a stable scrollbar gutter otherwise changes width on some hosts).
  const normalBox = await theater(page).boundingBox();
  const normalStageWidth = await stageWidth(page);
  const fixedFullscreenSize = await page.addStyleTag({ content: `#actionTheater:fullscreen { width: ${normalBox.width}px !important; height: ${normalBox.height}px !important; }` });
  try {
    await page.getByRole('button', { name: '全屏观看动作空间', exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('actionTheater');
    await expect.poll(() => theater(page).evaluate(element => {
      const canvas = element.querySelector('canvas').getBoundingClientRect();
      const title = element.querySelector('.theater-topline').getBoundingClientRect();
      return Math.abs(title.top - canvas.top - 22) < 1;
    })).toBe(true);
    const fullscreenBox = await theater(page).boundingBox();
    expect(fullscreenBox.width).toBeCloseTo(normalBox.width, 0);
    expect(fullscreenBox.height).toBeCloseTo(normalBox.height, 0);
    await expect.poll(() => stageWidth(page)).toBeGreaterThan(normalStageWidth * 1.1);
    expect(await retained.evaluate(canvas => canvas === document.querySelector('#theaterSceneContainer canvas'))).toBe(true);
    await page.evaluate(() => document.exitFullscreen());
    await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBe(null);
    await expectRoomUnderNavigation(page, retained);
    await expect.poll(() => stageWidth(page)).toBeCloseTo(normalStageWidth, 3);
  } finally {
    if (await page.evaluate(() => Boolean(document.fullscreenElement))) await page.evaluate(() => document.exitFullscreen());
    await fixedFullscreenSize.evaluate(style => style.remove());
  }

  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
  await selectSettingsFor(page, 'pushPage');
  await page.getByRole('checkbox', { name: '设置面板推开页面', exact: true }).check();
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await expect.poll(() => scene(page).evaluate(canvas => canvas.getBoundingClientRect().width)).toBeLessThan(normalBox.width - 300);
  await expectRoomUnderNavigation(page, retained);
  await page.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect.poll(() => scene(page).evaluate(canvas => canvas.getBoundingClientRect().width)).toBeCloseTo(normalBox.width, 0);
  await expectRoomUnderNavigation(page, retained);
  await expect(theater(page).locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});
