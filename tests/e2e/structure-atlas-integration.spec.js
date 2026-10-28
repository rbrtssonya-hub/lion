import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { assetPaths } from '../../src/config/assetPaths.js';
import { settingsPanel, selectSettingsPage } from './settings-navigation.helpers.js';

test.setTimeout(150_000);
test.use({ trace: 'off' });

const parts = [
  ['brows', '眉目'], ['crown', '额冠'], ['beard', '鬃须'],
  ['body', '织锦'], ['trim', '云边'], ['mouth', '口齿'],
];
const atlas = page => page.locator('#model-reading-panel-form .lion-experience');
const model = page => atlas(page).locator('canvas');
const control = (page, id) => atlas(page).locator(`.chapter-control[data-part="${id}"]`);

async function capture(page, name) {
  if (!process.env.STRUCTURE_ATLAS_REVIEW_DIR) return;
  mkdirSync(process.env.STRUCTURE_ATLAS_REVIEW_DIR, { recursive: true });
  await page.screenshot({ path: resolve(process.env.STRUCTURE_ATLAS_REVIEW_DIR, `${name}.png`) });
}

async function openAtlas(page, size = { width: 1920, height: 1080 }, { reduced = true, settings = {} } = {}) {
  const errors = [], failedAssets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && new URL(response.url()).pathname.includes('/assets/')) {
      failedAssets.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  await page.setViewportSize(size);
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.addInitScript(settings => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({
      carouselAutoplay: false, bookAutoplay: false, ...settings,
    }));
    // Observe the actual renderer, including stopped drawing in hidden tabs.
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const gl = Reflect.apply(original, this, args);
      if (!gl || !/^webgl/.test(args[0]) || gl.__atlasObserved) return gl;
      gl.__atlasObserved = true;
      const canvas = this;
      for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
        const draw = gl[name];
        if (!draw) continue;
        gl[name] = function (...values) {
          canvas.__atlasDraws = (canvas.__atlasDraws || 0) + 1;
          return Reflect.apply(draw, this, values);
        };
      }
      return gl;
    };
  }, settings);
  await page.goto('/#/model');
  await expect(atlas(page)).toHaveAttribute('data-ready', 'true', { timeout: 80_000 });
  await expect(atlas(page)).toHaveAttribute('data-phase', 'overview');
  await expect(atlas(page).locator('.model-layer')).toHaveCSS('opacity', '1');
  await expect(model(page)).toHaveAttribute('data-full-hair-drawn-groups', '33');
  await expect(model(page)).toHaveAttribute('data-source-model', new RegExp(`${assetPaths.model.split('/').at(-1).replaceAll('.', '\\.')}$`));
  return { errors, failedAssets };
}

async function study(page, id) {
  await control(page, id).click();
  await expect(atlas(page)).toHaveAttribute('data-selected', id);
  await expect(atlas(page)).toHaveAttribute('data-phase', 'study', { timeout: 35_000 });
  await expect(control(page, id)).toHaveAttribute('aria-pressed', 'true');
  await expect(atlas(page).locator('.lion-breakdown-image-button')).toBeVisible();
}

async function expectDockedArtwork(page) {
  await expect.poll(() => atlas(page).evaluate(root => {
    const image = root.querySelector('.chapter-artwork').getBoundingClientRect();
    const bar = document.querySelector('.model-journey-bar').getBoundingClientRect();
    return Math.abs(image.top - bar.bottom);
  }), { message: '等待图版布局与副导航同步' }).toBeLessThanOrEqual(1);
  const bounds = await atlas(page).evaluate(root => {
    const picture = root.querySelector('.chapter-artwork');
    const image = picture.getBoundingClientRect();
    const bar = document.querySelector('.model-journey-bar').getBoundingClientRect();
    const frame = root.getBoundingClientRect();
    const info = root.querySelector('.lion-breakdown-stage').getBoundingClientRect();
    const infoImage = root.querySelector('.lion-breakdown-image-button img').getBoundingClientRect();
    return {
      top: image.top, left: image.left, right: image.right, bottom: image.bottom,
      barBottom: bar.bottom, frameLeft: frame.left, frameRight: frame.right,
      ratio: image.width / image.height, sourceRatio: picture.naturalWidth / picture.naturalHeight,
      decoded: picture.complete && picture.naturalWidth > 0,
      objectFit: getComputedStyle(picture).objectFit,
      infoLeft: info.left, infoRight: info.right, infoBottom: info.bottom,
      infoTop: info.top, infoImageTop: infoImage.top, infoImageBottom: infoImage.bottom,
      infoImageLeft: infoImage.left, infoImageRight: infoImage.right,
      blockedControls: [...root.querySelectorAll('.chapter-control')].filter(button => {
        const box = button.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return !button.contains(hit);
      }).map(button => button.dataset.part),
      viewportHeight: innerHeight,
    };
  });
  expect(bounds.decoded).toBe(true);
  expect(bounds.objectFit).toBe('contain');
  expect(Math.abs(bounds.top - bounds.barBottom), '主图完整上沿紧贴副导航栏').toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.left - bounds.frameLeft), '研究态主图停在可用内容区左边缘').toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.ratio - bounds.sourceRatio), '完整等比图片不裁切或拉伸').toBeLessThan(.002);
  expect(bounds.right).toBeLessThanOrEqual(bounds.infoLeft + 1);
  expect(bounds.infoRight).toBeLessThanOrEqual(bounds.frameRight + 1);
  expect(bounds.infoBottom).toBeLessThanOrEqual(bounds.viewportHeight + 1);
  expect(bounds.infoImageBottom, '右图完整收进图版区域，不能由固有尺寸撑出窗口').toBeLessThanOrEqual(bounds.infoBottom + 1);
  expect(bounds.infoImageTop).toBeGreaterThanOrEqual(bounds.infoTop - 1);
  expect(bounds.infoImageLeft).toBeGreaterThanOrEqual(bounds.infoLeft - 1);
  expect(bounds.infoImageRight).toBeLessThanOrEqual(bounds.infoRight + 1);
  expect(bounds.blockedControls, '六个入口均可真实点击，避让小醒').toEqual([]);
  expect(bounds.top).toBeGreaterThan(40);
}

async function expectDrawingPaused(canvas) {
  await expect.poll(async () => {
    const before = await canvas.evaluate(node => node.__atlasDraws || 0);
    await new Promise(resolve => setTimeout(resolve, 220));
    return (await canvas.evaluate(node => node.__atlasDraws || 0)) - before;
  }).toBe(0);
}

async function sampledCanvasPixels(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const clip = await model(page).boundingBox();
  const screenshot = await page.screenshot({ clip, animations: 'disabled' });
  return page.evaluate(async url => {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const pixels = [];
    // Sample the complete lion's central region, keeping the navigation and
    // companion outside the comparison. The backdrop remains identical.
    for (let y = Math.floor(canvas.height * .22); y < canvas.height * .77; y += 5) {
      for (let x = Math.floor(canvas.width * .25); x < canvas.width * .72; x += 5) {
        const offset = (y * canvas.width + x) * 4;
        pixels.push(data[offset], data[offset + 1], data[offset + 2]);
      }
    }
    return { width: canvas.width, height: canvas.height, pixels };
  }, `data:image/png;base64,${screenshot.toString('base64')}`);
}

function pixelDifference(before, after) {
  expect([after.width, after.height, after.pixels.length]).toEqual([before.width, before.height, before.pixels.length]);
  let delta = 0, changed = 0;
  for (let index = 0; index < before.pixels.length; index += 3) {
    const difference = [0, 1, 2].reduce((sum, channel) => sum + Math.abs(after.pixels[index + channel] - before.pixels[index + channel]), 0);
    delta += difference;
    if (difference > 24) changed++;
  }
  return { meanAbsolute: delta / before.pixels.length, changedFraction: changed / (before.pixels.length / 3) };
}

test('观形融合六部位、完整主图、独立信息图与文化浮窗，保留当前模型和图片背景', async ({ page }) => {
  const { errors, failedAssets } = await openAtlas(page);
  await expect(model(page)).toHaveAttribute('data-full-hair-drawn-strands', '2289801');
  await expect(model(page)).toHaveAttribute('data-full-hair-drawn-points', '19929005');
  const background = await page.locator('.site-shell').evaluate(node => node.style.getPropertyValue('--chapter-background-image'));
  expect(background).toContain(assetPaths.modelBackground);
  expect(await atlas(page).evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  await capture(page, 'overview-1920');

  const images = new Set();
  for (const [id, name] of parts) {
    await study(page, id);
    await expectDockedArtwork(page);
    await expectDrawingPaused(model(page));
    await capture(page, `${id}-study-1920`);
    const button = atlas(page).getByRole('button', { name: `打开${name}文化讲解`, exact: true });
    images.add(await button.locator('img').getAttribute('src'));
    await button.click();
    const dialog = page.getByRole('dialog', { name, exact: true });
    await expect(dialog).toBeVisible();
    if (id === 'brows') await capture(page, 'brows-cultural-modal-1920');
    await expect(dialog).toContainText('不代表模型拆件或实测图');
    await expect(dialog.getByRole('heading', { name: '资料来源', exact: true })).toBeVisible();
    expect(await dialog.getByRole('link').count()).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(button).toBeFocused();
    await expect(atlas(page)).toHaveAttribute('data-phase', 'study');
    await expect(atlas(page)).toHaveAttribute('data-selected', id);
  }
  expect(images.size, '每个部位有自己的信息可视化图版').toBe(6);
  await atlas(page).getByRole('button', { name: '返回整体', exact: true }).click();
  await expect(atlas(page)).toHaveAttribute('data-phase', 'overview');
  await expect(atlas(page)).toHaveAttribute('data-selected', '');
  await expect(model(page)).toHaveAttribute('data-full-hair-drawn-groups', '33');
  expect(errors).toEqual([]);
  expect(failedAssets).toEqual([]);
});

for (const size of [{ width: 1366, height: 768 }, { width: 2560, height: 1080 }]) {
  test(`电脑${size.width}×${size.height}与窗口缩放仍完整贴副导航，并保留形制和工艺`, async ({ page }) => {
    const { errors, failedAssets } = await openAtlas(page, size);
    await study(page, 'trim');
    await expect(atlas(page).locator('.chapter-artwork')).toHaveAttribute('src', /\/fullscreen\/ultrawide\/trim\.png$/);
    await expectDockedArtwork(page);
    await capture(page, `trim-study-${size.width}`);
    const canvas = await model(page).elementHandle();
    await page.locator('#model-reading-tab-types').click();
    await expect(atlas(page)).toBeHidden();
    await expect(page.getByRole('tab', { name: /佛鹤狮/ })).toBeVisible();
    await expectDrawingPaused(canvas);
    await page.locator('#model-reading-tab-craft').click();
    await expect(page.locator('#model-craft-title')).toBeVisible();
    await expect(page.locator('.model-craft-game')).toHaveCount(2);
    await page.locator('#model-reading-tab-form').click();
    await expect(atlas(page)).toHaveAttribute('data-phase', 'study');
    await expect(atlas(page)).toHaveAttribute('data-selected', 'trim');
    await page.setViewportSize({ width: 1536, height: 960 });
    await expect(atlas(page).locator('.chapter-artwork')).toHaveAttribute('src', /\/fullscreen\/trim\.png$/);
    await expect.poll(async () => {
      const image = atlas(page).locator('.chapter-artwork');
      return image.evaluate(node => node.complete && node.naturalWidth > 0);
    }).toBe(true);
    await expect(atlas(page).locator('.variant-outgoing')).toHaveCount(0);
    await expect(atlas(page).locator('.artwork-layer > img')).toHaveCount(1);
    await expectDockedArtwork(page);
    await page.setViewportSize({ width: 2560, height: 1080 });
    await expect(atlas(page).locator('.chapter-artwork')).toHaveAttribute('src', /\/fullscreen\/ultrawide\/trim\.png$/);
    await expect(atlas(page).locator('.variant-outgoing')).toHaveCount(0);
    await expectDockedArtwork(page);
    expect(await canvas.evaluate(node => node === document.querySelector('.lion-experience canvas'))).toBe(true);
    await canvas.dispose();
    expect(errors).toEqual([]);
    expect(failedAssets).toEqual([]);
  });
}

test('设置推开时图版完整对齐，HDRI强度与曝光实时改变当前模型的真实画面', async ({ page }, testInfo) => {
  const { errors, failedAssets } = await openAtlas(page, { width: 1920, height: 1080 }, { settings: { pushPage: true, panelWidth: 420 } });
  await study(page, 'body');
  await page.locator('.site-navigation [data-action="settings"]').click();
  await selectSettingsPage(page, '视角');
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  await expect(settingsPanel(page)).toBeVisible();
  await expectDockedArtwork(page);
  await capture(page, 'body-study-settings-push-1920');
  const bounds = await atlas(page).boundingBox();
  const panel = await settingsPanel(page).boundingBox();
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(panel.x + 1);
  await settingsPanel(page).getByRole('button', { name: '取消', exact: true }).click();
  await expect(settingsPanel(page)).toHaveCount(0);
  await expectDockedArtwork(page);
  await atlas(page).getByRole('button', { name: '返回整体', exact: true }).click();
  await expect(atlas(page)).toHaveAttribute('data-phase', 'overview');
  await page.locator('.site-navigation [data-action="settings"]').click();
  await selectSettingsPage(page, 'HDRI');
  await expect(model(page)).toHaveAttribute('data-hdri-state', 'ready');
  await expect(model(page)).toHaveAttribute('data-focus-state', 'idle');
  const original = await model(page).elementHandle();
  const edit = async (label, value) => {
    const input = settingsPanel(page).getByRole('spinbutton', { name: `${label}数值`, exact: true });
    await input.fill(String(value)); await input.press('Tab');
  };
  const initial = await sampledCanvasPixels(page);
  await edit('HDRI强度', .1);
  await expect.poll(() => model(page).evaluate(node => JSON.parse(node.dataset.hdriSettings))).toMatchObject({ hdriIntensity: .1, hdriExposure: 0 });
  const dim = await sampledCanvasPixels(page);
  const intensity = pixelDifference(initial, dim);
  expect(intensity.meanAbsolute).toBeGreaterThan(1);
  expect(intensity.changedFraction).toBeGreaterThan(.02);
  await edit('HDRI曝光补偿', 1.5);
  await expect.poll(() => model(page).evaluate(node => JSON.parse(node.dataset.hdriSettings))).toMatchObject({ hdriIntensity: .1, hdriExposure: 1.5 });
  const exposed = await sampledCanvasPixels(page);
  const exposure = pixelDifference(dim, exposed);
  expect(exposure.meanAbsolute).toBeGreaterThan(1);
  expect(exposure.changedFraction).toBeGreaterThan(.02);
  expect(await original.evaluate(node => node === document.querySelector('.lion-experience canvas'))).toBe(true);
  await expect(model(page)).toHaveAttribute('data-full-hair-drawn-groups', '33');
  await testInfo.attach('atlas-hdri-pixel-metrics', { body: JSON.stringify({ intensity, exposure }, null, 2), contentType: 'application/json' });
  await settingsPanel(page).getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('alertdialog', { name: '放弃未保存的设置？' }).getByRole('button', { name: '放弃更改', exact: true }).click();
  await expect(settingsPanel(page)).toHaveCount(0);
  await expect.poll(() => model(page).evaluate(node => JSON.parse(node.dataset.hdriSettings))).toMatchObject({ hdriIntensity: 1, hdriExposure: 0 });
  await original.dispose();
  expect(errors).toEqual([]);
  expect(failedAssets).toEqual([]);
});

test('真实运镜可中断返回，隐藏章节不接收部位快捷键或继续绘制', async ({ page }) => {
  const { errors, failedAssets } = await openAtlas(page, { width: 1920, height: 1080 }, { reduced: false });
  await control(page, 'brows').click();
  await expect(atlas(page)).toHaveAttribute('data-phase', 'travel');
  await control(page, 'mouth').click();
  await expect(atlas(page)).toHaveAttribute('data-selected', 'mouth');
  await atlas(page).getByRole('button', { name: '返回整体', exact: true }).click();
  await expect(atlas(page)).toHaveAttribute('data-phase', 'overview', { timeout: 30_000 });
  await expect(atlas(page)).toHaveAttribute('data-selected', '');
  await expect(model(page)).toHaveAttribute('data-focus-state', 'idle');
  await atlas(page).evaluate(root => {
    root.__atlasPhases = [];
    new MutationObserver(records => {
      if (!records.some(record => record.attributeName === 'data-phase')) return;
      const phase = root.dataset.phase;
      const image = root.querySelector('.chapter-artwork')?.getBoundingClientRect();
      const frame = root.getBoundingClientRect();
      const model = root.querySelector('canvas').getBoundingClientRect();
      root.__atlasPhases.push({ phase, image: image && { width: image.width, height: image.height },
        frame: { width: frame.width, height: frame.height }, model: { width: model.width, height: model.height } });
    }).observe(root, { attributes: true, attributeFilter: ['data-phase'] });
  });
  await study(page, 'brows');
  const phases = await atlas(page).evaluate(root => root.__atlasPhases);
  const order = ['travel', 'handoff', 'arranging', 'study'].map(phase => phases.findIndex(item => item.phase === phase));
  expect(order.every((value, index) => value >= 0 && (!index || value > order[index - 1])), '真实运镜完成后才转图，转图完成后才缩到左上').toBe(true);
  const handoff = phases.find(item => item.phase === 'handoff');
  expect(Math.abs(handoff.model.width - handoff.frame.width), '转图时模型视口仍覆盖全部可用宽度').toBeLessThanOrEqual(1);
  expect(Math.abs(handoff.model.height - handoff.frame.height), '转图时模型视口仍覆盖全部可用高度').toBeLessThanOrEqual(1);
  const canvas = await model(page).elementHandle();
  await page.locator('.site-navigation [data-route="spread"]').click();
  await expect(page.locator('#react-app')).toHaveAttribute('data-route', 'spread');
  await expect(atlas(page)).toBeHidden();
  await expectDrawingPaused(canvas);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await expect(atlas(page)).toHaveAttribute('data-selected', 'brows');
  await page.locator('.site-navigation [data-route="model"]').click();
  await expect(atlas(page)).toBeVisible();
  await expect(atlas(page)).toHaveAttribute('data-phase', 'study');
  await expect(atlas(page)).toHaveAttribute('data-selected', 'brows');
  expect(await canvas.evaluate(node => node === document.querySelector('.lion-experience canvas'))).toBe(true);
  await page.setViewportSize({ width: 2560, height: 1080 });
  await expect(atlas(page).locator('.chapter-artwork')).toHaveAttribute('src', /\/fullscreen\/ultrawide\/brows\.png$/);
  await expect(atlas(page).locator('.variant-outgoing')).toHaveCount(0, { timeout: 2000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1536, height: 960 });
  await expect(atlas(page).locator('.chapter-artwork')).toHaveAttribute('src', /\/fullscreen\/brows\.png$/);
  await expect(atlas(page).locator('.variant-outgoing')).toHaveCount(0);
  await expectDockedArtwork(page);
  await canvas.dispose();
  expect(errors).toEqual([]);
  expect(failedAssets).toEqual([]);
});

test('真实WebGL上下文丢失退出研究态并可重新载入完整模型', async ({ page }) => {
  const { errors, failedAssets } = await openAtlas(page);
  await study(page, 'brows');
  const previous = await model(page).elementHandle();
  const supported = await previous.evaluate(canvas => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const extension = gl?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    extension.loseContext();
    return true;
  });
  expect(supported, '测试浏览器提供真实WebGL上下文丢失扩展').toBe(true);
  await expect(atlas(page)).toHaveAttribute('data-ready', 'false');
  await expect(atlas(page)).toHaveAttribute('data-phase', 'overview');
  await expect(atlas(page)).toHaveAttribute('data-selected', '');
  await expect(atlas(page).locator('.initial-loader')).toContainText('3D 显示已中断');
  await expect(model(page)).toHaveCount(0);
  await atlas(page).getByRole('button', { name: '重新载入', exact: true }).click();
  await expect(atlas(page)).toHaveAttribute('data-ready', 'true', { timeout: 80_000 });
  await expect(model(page)).toHaveAttribute('data-full-hair-drawn-groups', '33');
  await expect(model(page)).toHaveAttribute('data-full-hair-drawn-strands', '2289801');
  expect(await previous.evaluate(node => node.isConnected)).toBe(false);
  await study(page, 'mouth');
  await expectDockedArtwork(page);
  await previous.dispose();
  expect(errors).toEqual([]);
  expect(failedAssets).toEqual([]);
});
