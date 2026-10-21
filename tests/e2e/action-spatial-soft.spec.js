import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { actions, scene, stage, openTheater, actionButton } from './action-theater.helpers.js';
import { selectSettingsPage, settingsPanel } from './settings-navigation.helpers.js';
import { actionSpatialDefaults } from '../../src/config/actionSpatialSettings.js';

test.setTimeout(180_000);
const storageKey = 'nanfeng-lion:developer-settings:v1';
const plaque = (page, kind = 'title', id = 'tanqing') => page.locator(`[data-spatial-panel="${kind}"][data-screen-id="${id}"]`);
const labels = {
  actionUiFadeInMs: '悬浮面板渐显时间', actionUiFadeOutMs: '悬浮面板渐隐时间',
  actionUiEdgeZone: '视口边缘渐隐区域', actionUiInteractionOpacity: '悬浮面板交互透明度阈值',
  actionUiHysteresis: '巨幕切换角度迟滞', actionUiOpacity: '悬浮面板不透明度', actionUiScale: '悬浮面板尺寸',
};

async function frames(page, count = 2) {
  await page.evaluate(count => new Promise(resolve => {
    const next = () => --count <= 0 ? resolve() : requestAnimationFrame(next);
    requestAnimationFrame(next);
  }), count);
}

async function ready(page) {
  await expect(scene(page)).toHaveAttribute('data-spatial-renderer', 'webgl-depth', { timeout: 45_000 });
  await expect(plaque(page)).toHaveAttribute('data-opacity', /\d/);
}

async function startSamples(page) {
  await page.evaluate(() => {
    const canvas = document.querySelector('#theaterSceneContainer canvas');
    const nodes = [...document.querySelectorAll('[data-spatial-panel]')];
    const samples = [];
    window.__softSamples = samples;
    window.__softSampling = true;
    const sample = time => {
      if (!window.__softSampling) return;
      samples.push({ time, frame: Number(canvas.dataset.frameId), spatialFrame: Number(canvas.dataset.spatialFrameId),
        active: canvas.dataset.activeScreen,
        selected: document.querySelector('.theater-action-nav [aria-pressed="true"]')?.dataset.actionId,
        heading: document.querySelector('#theaterActionName')?.textContent,
        panels: nodes.map(node => ({ kind: node.dataset.spatialPanel, id: node.dataset.screenId,
          alpha: Number(node.dataset.opacity), target: Number(node.dataset.targetOpacity), edge: Number(node.dataset.edgeOpacity),
          bounds: JSON.parse(node.dataset.projectedBounds || 'null'), interactive: node.dataset.interactive === 'true',
          inert: node.inert, pointerEvents: getComputedStyle(node).pointerEvents,
          world: node.dataset.worldPosition, matrix: node.style.transform, frame: Number(node.dataset.spatialFrame),
        })) });
      window.__softSampleRaf = requestAnimationFrame(sample);
    };
    window.__softSampleRaf = requestAnimationFrame(sample);
  });
}

async function stopSamples(page, testInfo, name) {
  const samples = await page.evaluate(() => {
    window.__softSampling = false;
    cancelAnimationFrame(window.__softSampleRaf);
    return window.__softSamples;
  });
  await jsonEvidence(testInfo, name, samples);
  return samples;
}

async function jsonEvidence(testInfo, name, value) {
  await mkdir(testInfo.outputDir, { recursive: true });
  const path = testInfo.outputPath(`${name}.json`);
  await writeFile(path, JSON.stringify(value, null, 2));
  await testInfo.attach(name, { path, contentType: 'application/json' });
}

async function beginDrag(page, positive = true) {
  const bounds = await scene(page).boundingBox();
  const x = bounds.x + bounds.width * (positive ? .88 : .12);
  const y = await scene(page).evaluate((canvas, { x, bounds }) => {
    for (const fraction of [.4, .48, .33, .58, .25, .65]) {
      const y = bounds.y + bounds.height * fraction;
      if (document.elementFromPoint(x, y) === canvas) return y;
    }
    throw new Error('No uncovered real camera input point');
  }, { x, bounds });
  await page.mouse.move(x, y); await page.mouse.down();
  return { x, y, pixelsPerDegree: bounds.height / .42 / 360 };
}

async function moveDegrees(page, drag, degrees, steps = 1, pause = 0) {
  drag.x -= degrees * drag.pixelsPerDegree;
  await page.mouse.move(drag.x, drag.y, { steps });
  if (pause) await page.waitForTimeout(pause); // Paces a real slow mouse gesture, not product logic.
  else await frames(page, 1);
}

function assertSynchronized(samples) {
  expect(samples.length).toBeGreaterThan(10);
  const failures = [];
  for (const sample of samples) {
    if (sample.spatialFrame !== sample.frame || sample.selected !== sample.active
      || sample.heading !== actions.find(action => action.id === sample.active)?.name) failures.push({ frame: sample.frame, state: sample.active, selected: sample.selected, heading: sample.heading, spatialFrame: sample.spatialFrame });
    for (const panel of sample.panels) {
      if (panel.frame !== sample.frame || !Number.isFinite(panel.alpha) || panel.alpha < 0 || panel.alpha > 1
        || !/^matrix3d\(/.test(panel.matrix)) failures.push({ frame: sample.frame, panel });
    }
  }
  expect(failures.slice(0, 20), 'all sampled camera/UI frames, discrete state and panel matrices agree').toEqual([]);
}

test('真实慢转与转回按投影边缘连续渐隐渐显，世界坐标和首帧选中保持同步', async ({ page }, testInfo) => {
  await openTheater(page); await ready(page);
  const initialAnchor = await plaque(page).getAttribute('data-world-position');
  const header = await page.locator('.site-header').boundingBox();
  const controls = await page.locator('#theaterControls').boundingBox();
  await startSamples(page);
  const drag = await beginDrag(page);
  for (let angle = 0; angle < 180; angle += 2) await moveDegrees(page, drag, 2, 1, 45);
  await frames(page, 4);
  for (let angle = 0; angle < 180; angle += 2) await moveDegrees(page, drag, -2, 1, 45);
  await page.mouse.up(); await frames(page, 4);
  const samples = await stopSamples(page, testInfo, 'slow-mouse-edge-exit-and-reentry');
  assertSynchronized(samples);
  const title = samples.map(sample => ({ time: sample.time, ...sample.panels.find(panel => panel.kind === 'title') }));
  expect(title.every(panel => panel.world === initialAnchor)).toBe(true);
  const partlyVisible = title.filter(panel => panel.bounds && panel.bounds.right > 0 && panel.bounds.left < 1
    && panel.bounds.bottom > 0 && panel.bounds.top < 1);
  expect(partlyVisible.some(panel => panel.edge > 0 && panel.edge < .95 && panel.alpha > .01 && panel.alpha < .95)).toBe(true);
  // Entering/exiting must be a real edge crossing, rather than a front/back switch at screen centre.
  expect(title.some(panel => panel.bounds && (panel.bounds.left >= .98 || panel.bounds.right <= .02))).toBe(true);
  const alphaLevels = new Set(partlyVisible.filter(panel => panel.alpha > .02 && panel.alpha < .98).map(panel => Math.round(panel.alpha * 20)));
  expect(alphaLevels.size).toBeGreaterThanOrEqual(5);
  const rising = title.slice(1).filter((panel, index) => panel.alpha > title[index].alpha + .002);
  const falling = title.slice(1).filter((panel, index) => panel.alpha < title[index].alpha - .002);
  expect(rising.length).toBeGreaterThan(5); expect(falling.length).toBeGreaterThan(5);
  await expect(scene(page)).toHaveAttribute('data-active-screen', 'tanqing');
  expect(await page.locator('.site-header').boundingBox()).toEqual(header);
  expect(await page.locator('#theaterControls').boundingBox()).toEqual(controls);
});

test('快速反向沿当前透明度续接，低透明度不命中且90度转幕即时更新独立于渐变', async ({ page }, testInfo) => {
  await openTheater(page, { settings: { actionUiFadeInMs: 800, actionUiFadeOutMs: 800, actionUiEdgeZone: 25, actionUiInteractionOpacity: 70 } });
  await ready(page);
  await startSamples(page);
  const drag = await beginDrag(page);
  let found = false;
  for (let angle = 0; angle < 180; angle += 3) {
    await moveDegrees(page, drag, 3, 1, 20);
    const state = await plaque(page).evaluate(node => ({ alpha: Number(node.dataset.opacity), target: Number(node.dataset.targetOpacity) }));
    if (state.alpha > .08 && state.alpha < .8 && state.target < state.alpha - .08) { found = true; break; }
  }
  expect(found, 'find an actual fade-out in flight before reversal').toBe(true);
  const before = await plaque(page).evaluate(node => ({ alpha: Number(node.dataset.opacity), target: Number(node.dataset.targetOpacity) }));
  await moveDegrees(page, drag, -15, 5);
  const after = await plaque(page).evaluate(node => ({ alpha: Number(node.dataset.opacity), target: Number(node.dataset.targetOpacity) }));
  expect(after.target).toBeGreaterThan(before.target);
  expect(after.alpha).toBeGreaterThan(.01);
  expect(Math.abs(after.alpha - before.alpha)).toBeLessThan(.35);
  await page.mouse.up();
  await actionButton(page, 'tanqing').click(); await expect(scene(page)).toHaveAttribute('data-active-screen', 'tanqing');
  const quick = await beginDrag(page);
  await moveDegrees(page, quick, 90, 18); await page.mouse.up();
  await frames(page, 3);
  const active = await scene(page).getAttribute('data-active-screen');
  expect(active).not.toBe('tanqing');
  await expect(page.locator('#theaterActionName')).toHaveText(actions.find(action => action.id === active).name);
  const samples = await stopSamples(page, testInfo, 'reverse-current-alpha-and-fast-90');
  assertSynchronized(samples);
  const weak = samples.flatMap(sample => sample.panels).filter(panel => panel.alpha < .699);
  expect(weak.length).toBeGreaterThan(5);
  expect(weak.filter(panel => panel.interactive || !panel.inert || panel.pointerEvents !== 'none').slice(0, 20)).toEqual([]);
  const changedIndex = samples.findIndex((sample, index) => index > 0 && sample.active !== samples[index - 1].active);
  expect(changedIndex).toBeGreaterThan(0);
  const transition = samples.slice(changedIndex, changedIndex + 50).flatMap(sample => sample.panels.filter(panel => panel.kind === 'caption'));
  expect(transition.some(panel => panel.alpha > .01 && panel.alpha < .95)).toBe(true);
  const switches = samples.map((sample, index) => ({ sample, index })).filter(({ sample, index }) => index > 0 && sample.active !== samples[index - 1].active);
  const fadingOld = switches.filter(({ index }) => samples[index - 1].panels.find(panel => panel.kind === 'caption' && panel.id === samples[index - 1].active)?.alpha > .08);
  expect(fadingOld.length, 'at least one actual old caption is still visible when selection changes').toBeGreaterThan(0);
  for (const { sample, index } of fadingOld) {
    const previousId = samples[index - 1].active;
    expect(sample.panels.find(panel => panel.kind === 'caption' && panel.id === previousId).alpha).toBeGreaterThan(.005);
    expect(sample.panels.find(panel => panel.kind === 'caption' && panel.id === sample.active).alpha).toBeLessThan(.98);
  }
});

test('七个空间参数真实修改/保存/独立复原，修改渐变只更新既有画布', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(({ storageKey }) => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'); sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    if (!sessionStorage.getItem('lion:soft-ui:seeded')) {
      localStorage.setItem(storageKey, JSON.stringify({ pushPage: false, carouselAutoplay: false, hdriIntensity: 1.5, headerTransparency: 37 }));
      sessionStorage.setItem('lion:soft-ui:seeded', '1');
    }
  }, { storageKey });
  const open = async () => {
    await page.goto('/#/action');
    await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 65_000 }); await ready(page);
    await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
    await selectSettingsPage(page, '章节', '动作');
  };
  await open();
  const retained = await scene(page).elementHandle();
  const initialWidth = (await plaque(page, 'screen').boundingBox()).width;
  const changed = { actionUiFadeInMs: 730, actionUiFadeOutMs: 610, actionUiEdgeZone: 20, actionUiInteractionOpacity: 65, actionUiHysteresis: 9.5, actionUiOpacity: 75, actionUiScale: 110 };
  for (const [name, value] of Object.entries(changed)) {
    const input = settingsPanel(page).getByRole('spinbutton', { name: `${labels[name]}数值`, exact: true });
    await input.fill(String(value)); await input.press('Tab'); await expect(input).toHaveValue(String(value));
  }
  const expected = { fadeInMs: 730, fadeOutMs: 610, edgeZone: .2, interactionOpacity: .65, hysteresisDegrees: 9.5, opacity: .75, scale: 1.1 };
  await expect.poll(() => scene(page).evaluate(node => JSON.parse(node.dataset.spatialSettings || 'null'))).toMatchObject(expected);
  expect(await retained.evaluate(node => node.isConnected && node === document.querySelector('#theaterSceneContainer canvas'))).toBe(true);
  expect((await plaque(page, 'screen').boundingBox()).width / initialWidth).toBeCloseTo(1.1, 1);
  await expect.poll(() => page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), storageKey)).toMatchObject(changed);
  await page.reload(); await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 65_000 }); await ready(page);
  await expect.poll(() => scene(page).evaluate(node => JSON.parse(node.dataset.spatialSettings || 'null'))).toMatchObject(expected);
  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click(); await selectSettingsPage(page, '章节', '动作');
  for (const [name, value] of Object.entries(changed)) await expect(settingsPanel(page).getByRole('spinbutton', { name: `${labels[name]}数值`, exact: true })).toHaveValue(String(value));
  await page.getByRole('button', { name: '恢复悬浮UI默认参数', exact: true }).click();
  await expect.poll(() => page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), storageKey)).toMatchObject({ ...actionSpatialDefaults, hdriIntensity: 1.5, headerTransparency: 37 });
  await expect.poll(() => scene(page).evaluate(node => JSON.parse(node.dataset.spatialSettings || 'null'))).toMatchObject({ fadeInMs: 380, fadeOutMs: 320, edgeZone: .12, interactionOpacity: .35, hysteresisDegrees: 7, opacity: 1, scale: 1 });
  await jsonEvidence(testInfo, 'public-spatial-settings', { changed, normalized: expected, restored: await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), storageKey) });
});

test('真实设置改变逐帧透明度的渐显/渐隐用时，画布和相机保持不变', async ({ page }, testInfo) => {
  await openTheater(page, { settings: { actionUiEdgeZone: 5 } }); await ready(page);
  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
  await selectSettingsPage(page, '章节', '动作');
  const retained = await scene(page).elementHandle();
  const camera = await scene(page).getAttribute('data-camera-position');
  const input = name => settingsPanel(page).getByRole('spinbutton', { name: `${labels[name]}数值`, exact: true });
  const set = async (name, value) => { await input(name).fill(String(value)); await input(name).press('Tab'); };
  const selected = plaque(page, 'caption');
  const level = () => selected.evaluate(node => ({ alpha: Number(node.dataset.opacity), target: Number(node.dataset.targetOpacity) }));
  const settle = () => expect.poll(async () => { const state = await level(); return Math.abs(state.alpha - state.target); }, { timeout: 6000 }).toBeLessThan(.005);
  const durationTo90 = (samples, from, to) => {
    const curve = samples.map(sample => ({ time: sample.time, ...sample.panels.find(panel => panel.kind === 'caption' && panel.id === 'tanqing') }));
    const started = curve.findIndex(point => Math.abs(point.target - to) < .01);
    expect(started).toBeGreaterThanOrEqual(0);
    const direction = Math.sign(to - from), span = Math.abs(to - from);
    expect(span).toBeGreaterThan(.1);
    const reached = curve.slice(started).find(point => (point.alpha - from) * direction >= span * .9);
    expect(reached, 'actual material alpha reaches 90% of the requested change').toBeTruthy();
    return reached.time - curve[started].time;
  };
  const measured = [];
  for (const duration of [150, 800]) {
    await set('actionUiFadeInMs', duration); await set('actionUiFadeOutMs', duration);
    await set('actionUiOpacity', 40); await settle();
    const low = (await level()).alpha;
    await startSamples(page); await set('actionUiOpacity', 100); await settle();
    const high = (await level()).target;
    const fadeIn = await stopSamples(page, testInfo, `actual-fade-in-${duration}ms`);
    await startSamples(page); await set('actionUiOpacity', 40); await settle();
    const lowTarget = (await level()).target;
    const fadeOut = await stopSamples(page, testInfo, `actual-fade-out-${duration}ms`);
    measured.push({ duration, fadeIn: durationTo90(fadeIn, low, high), fadeOut: durationTo90(fadeOut, high, lowTarget) });
  }
  for (const name of ['fadeIn', 'fadeOut']) {
    expect(measured[1][name]).toBeGreaterThan(measured[0][name] * 1.8);
    expect(measured[1][name] - measured[0][name]).toBeGreaterThan(200);
  }
  expect(await retained.evaluate(node => node.isConnected && node === document.querySelector('#theaterSceneContainer canvas'))).toBe(true);
  expect(await scene(page).getAttribute('data-camera-position')).toBe(camera);
  await jsonEvidence(testInfo, 'measured-fade-duration-response', measured);
});

test('真实WebGL面板被醒狮深度遮挡：同相机同姿态的GPU像素三态对照', async ({ page }, testInfo) => {
  // Inject handles into this test's dev-server response only. The application
  // does not ship a renderer escape hatch or a second animation loop.
  let instrumented = false;
  await page.route('**/src/services/actionTheaterScene.js*', async route => {
    const response = await route.fetch();
    let source = await response.text();
    const guard = 'if (!canRender()) return;';
    const api = '  const api = {';
    expect(source).toContain(guard); expect(source).toContain(api);
    source = source.replace(guard, 'if (!canRender() || window.__spatialDepthProbe?.manual) return;');
    source = source.replace(api, `
  window.__spatialDepthProbe = {
    scene, camera, get renderer() { return renderer; }, get lionRoot() { return lionRoot; },
    manual: false,
    freeze() {
      this.manual = true;
      document.querySelectorAll('#chapterStage video').forEach(video => video.pause());
      const frozenTextures = new Map();
      this.frozenVideos = [];
      scene.traverse(object => {
        if (object.isReflector) object.onBeforeRender = () => {};
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (!material) continue;
          for (const channel of Object.keys(material)) {
            const texture = material[channel];
            if (!texture?.isVideoTexture) continue;
            if (!frozenTextures.has(texture)) {
              const video = texture.image;
              if (!video?.videoWidth || !video?.videoHeight || video.readyState < 2) throw new Error('Video frame is not ready to freeze');
              const still = document.createElement('canvas');
              still.width = video.videoWidth; still.height = video.videoHeight;
              still.getContext('2d').drawImage(video, 0, 0);
              const frozen = new CanvasTexture(still);
              for (const property of ['mapping', 'wrapS', 'wrapT', 'magFilter', 'minFilter', 'anisotropy', 'colorSpace', 'flipY', 'generateMipmaps', 'premultiplyAlpha', 'unpackAlignment', 'matrixAutoUpdate', 'rotation']) frozen[property] = texture[property];
              frozen.offset.copy(texture.offset); frozen.repeat.copy(texture.repeat);
              frozen.center.copy(texture.center); frozen.matrix.copy(texture.matrix);
              frozen.needsUpdate = true;
              frozenTextures.set(texture, frozen);
              this.frozenVideos.push({ width: still.width, height: still.height, currentTime: video.currentTime });
            }
            material[channel] = frozenTextures.get(texture);
            material.needsUpdate = true;
          }
        }
      });
      return { frozenVideoTextures: frozenTextures.size, videos: this.frozenVideos };
    },
    arrange() {
      const group = scene.getObjectByName('Theater_Spatial_UI');
      const mesh = group?.getObjectByName('Theater_Spatial_title_tanqing');
      if (!mesh || !lionRoot) throw new Error('Missing actual spatial plane or full lion');
      const bounds = new Box3().setFromObject(lionRoot);
      const center = bounds.getCenter(new Vector3());
      const size = bounds.getSize(new Vector3());
      // Use the real title plane and its material. Position it behind the
      // real full lion so this test always includes both occluded and clear UI.
      const away = center.clone().sub(camera.position).normalize();
      mesh.geometry.computeBoundingBox();
      const geometrySize = mesh.geometry.boundingBox.getSize(new Vector3());
      const texture = mesh.material.map.image;
      const height = size.y * .85, width = height * texture.width / texture.height;
      mesh.matrixAutoUpdate = true;
      mesh.position.copy(center).addScaledVector(away, Math.max(size.z, 2));
      mesh.quaternion.identity(); mesh.scale.set(width / geometrySize.x, height / geometrySize.y, 1);
      mesh.lookAt(camera.position); mesh.updateMatrixWorld(true);
      group.traverse(object => { if (object.isMesh) object.visible = object === mesh; });
      mesh.material.opacity = 1;
      this.mesh = mesh;
      const projected = [];
      const min = mesh.geometry.boundingBox.min, max = mesh.geometry.boundingBox.max;
      for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) {
        const corner = new Vector3(x, y, 0).applyMatrix4(mesh.matrixWorld).project(camera);
        projected.push({ x: (corner.x + 1) / 2, y: (1 - corner.y) / 2 });
      }
      return { lionBounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, plane: mesh.position.toArray(),
        material: { depthTest: mesh.material.depthTest, depthWrite: mesh.material.depthWrite, transparent: mesh.material.transparent },
        camera: camera.position.toArray(),
        projectedPlaneBounds: { left: Math.min(...projected.map(point => point.x)), right: Math.max(...projected.map(point => point.x)),
          top: Math.min(...projected.map(point => point.y)), bottom: Math.max(...projected.map(point => point.y)) } };
    },
    render(mode) {
      this.mesh.visible = mode !== 'hidden'; this.mesh.material.depthTest = mode !== 'no-depth';
      renderer.render(scene, camera);
      // Read this exact submitted GPU frame before the browser clears a
      // non-preserved drawing buffer. HTML player timers are outside this PNG.
      return renderer.domElement.toDataURL('image/png');
    },
  };
${api}`);
    instrumented = true;
    await route.fulfill({ response, body: source });
  });
  await openTheater(page); await ready(page);
  expect(instrumented, 'pixel depth regression runs against the source dev server').toBe(true);
  const autoRotate = page.getByRole('button', { name: '醒狮自动旋转', exact: true });
  if (await autoRotate.getAttribute('aria-pressed') === 'true') await autoRotate.click();
  const frozenBackground = await page.evaluate(() => window.__spatialDepthProbe.freeze());
  expect(frozenBackground.frozenVideoTextures).toBeGreaterThan(0);
  await frames(page, 2);
  const setup = await page.evaluate(() => window.__spatialDepthProbe.arrange());
  expect(setup.material).toEqual({ depthTest: true, depthWrite: false, transparent: true });
  // Settle shader/texture/shadow caches after replacing the video materials,
  // then compare three readbacks of the same frozen GPU scene.
  await page.evaluate(() => {
    window.__spatialDepthProbe.render('hidden');
    window.__spatialDepthProbe.render('hidden');
  });
  const images = {};
  for (const mode of ['hidden', 'depth', 'no-depth']) {
    images[mode] = await page.evaluate(mode => window.__spatialDepthProbe.render(mode), mode);
    const png = Buffer.from(images[mode].split(',')[1], 'base64');
    await mkdir(testInfo.outputDir, { recursive: true });
    await writeFile(testInfo.outputPath(`actual-gpu-ui-${mode}.png`), png);
    await testInfo.attach(`actual-gpu-ui-${mode}`, { path: testInfo.outputPath(`actual-gpu-ui-${mode}.png`), contentType: 'image/png' });
  }
  const pixels = await page.evaluate(async ({ images, bounds }) => {
    const read = async source => {
      const image = new Image(); image.src = source; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      return { width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
    };
    const [hidden, depth, overlay] = await Promise.all([read(images.hidden), read(images.depth), read(images['no-depth'])]);
    const roi = { left: Math.max(0, Math.floor(bounds.left * hidden.width) - 2), right: Math.min(hidden.width, Math.ceil(bounds.right * hidden.width) + 2),
      top: Math.max(0, Math.floor(bounds.top * hidden.height) - 2), bottom: Math.min(hidden.height, Math.ceil(bounds.bottom * hidden.height) + 2) };
    let occluded = 0, clear = 0, changed = 0, outsideChanged = 0, outsideChangedOver1 = 0, outsideMaxDelta = 0;
    const delta = (a, b, index) => Math.max(Math.abs(a[index] - b[index]), Math.abs(a[index + 1] - b[index + 1]), Math.abs(a[index + 2] - b[index + 2]));
    for (let index = 0; index < hidden.data.length; index += 4) {
      const withoutDepth = delta(overlay.data, hidden.data, index), withDepth = delta(depth.data, hidden.data, index);
      const pixel = index / 4, x = pixel % hidden.width, y = Math.floor(pixel / hidden.width);
      if (x < roi.left || x >= roi.right || y < roi.top || y >= roi.bottom) {
        const difference = Math.max(withoutDepth, withDepth);
        if (difference > 0) outsideChanged++;
        if (difference > 1) outsideChangedOver1++;
        outsideMaxDelta = Math.max(outsideMaxDelta, difference);
        continue;
      }
      if (withoutDepth > 24) changed += 1;
      if (withoutDepth > 24 && withDepth < 4) occluded += 1;
      if (withDepth > 24 && delta(depth.data, overlay.data, index) < 4) clear += 1;
    }
    return { width: hidden.width, height: hidden.height, roi: { ...roi, pixels: (roi.right - roi.left) * (roi.bottom - roi.top), antiAliasPaddingPx: 2 }, changed, occluded, clear, outsideChanged, outsideChangedOver1, outsideMaxDelta, outsideQuantizationTolerance: 1 };
  }, { images, bounds: setup.projectedPlaneBounds });
  await jsonEvidence(testInfo, 'gpu-depth-pixel-counts', { frozenBackground, setup, pixels });
  expect(pixels.outsideChangedOver1, 'frozen backgrounds outside the real plane have no change beyond one 8-bit quantization level').toBe(0);
  expect(pixels.outsideMaxDelta).toBeLessThanOrEqual(1);
  expect(pixels.changed, 'real title texture produces visible pixels with depth disabled').toBeGreaterThan(1000);
  expect(pixels.occluded, 'opaque full-lion geometry hides actual UI pixels with depth enabled').toBeGreaterThan(100);
  expect(pixels.clear, 'unoccluded real UI pixels remain visible').toBeGreaterThan(100);
});
