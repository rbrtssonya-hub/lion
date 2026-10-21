import { expect, test } from '@playwright/test';
import { openTheater, scene, stage } from './action-theater.helpers.js';

test.setTimeout(180_000);
const screenPanel = page => page.locator('[data-spatial-panel="screen"][data-screen-id="tanqing"]');
const cameraDistance = (before, after) => {
  const a = JSON.parse(before), b = JSON.parse(after);
  return Math.hypot(...a.map((value, axis) => value - b[axis]));
};

async function frames(page, count = 2) {
  await page.evaluate(count => new Promise(resolve => {
    const next = () => --count <= 0 ? resolve() : requestAnimationFrame(next);
    requestAnimationFrame(next);
  }), count);
}

async function pauseTheater(page) {
  const rotation = page.getByRole('button', { name: '醒狮自动旋转', exact: true });
  if (await rotation.getAttribute('aria-pressed') === 'true') await rotation.click();
  const pause = page.getByRole('button', { name: '暂停动作视频', exact: true });
  if (await pause.isVisible()) await pause.click();
  await expect(page.getByRole('button', { name: '播放动作视频', exact: true })).toBeVisible();
  await expect.poll(() => stage(page).locator('video').evaluateAll(videos => videos.every(video => video.paused))).toBe(true);
  await frames(page, 2);
}

async function buttonPoint(page) {
  return screenPanel(page).locator('button').evaluate(button => {
    const bounds = button.getBoundingClientRect();
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  });
}

async function observeInput(page) {
  await page.evaluate(() => {
    const button = document.querySelector('[data-spatial-panel="screen"][data-screen-id="tanqing"] button');
    const canvas = document.querySelector('#theaterSceneContainer canvas');
    window.__spatialHitInput = { events: [], playCalls: [] };
    const record = (where, event) => window.__spatialHitInput.events.push({
      where, type: event.type, trusted: event.isTrusted, pointerId: event.pointerId,
      target: button.contains(event.target) ? 'button' : event.target === canvas ? 'canvas' : 'other',
    });
    // Document capture observes the original trusted target before the product's
    // spatial-layer capture guard can stop it. Target listeners prove delivery.
    document.addEventListener('pointerdown', event => record('document', event), true);
    canvas.addEventListener('pointerdown', event => record('canvas', event), true);
    button.addEventListener('pointerdown', event => record('button', event));
    button.addEventListener('click', event => record('button', event));
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      window.__spatialHitInput.playCalls.push(this.dataset.actionId || 'other');
      return Reflect.apply(nativePlay, this, args);
    };
  });
}

async function dragFromPoint(page, point) {
  const before = await scene(page).getAttribute('data-camera-position');
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 22, point.y + 3, { steps: 4 });
  await expect(scene(page)).toHaveAttribute('data-camera-state', 'dragging');
  await expect.poll(async () => cameraDistance(before, await scene(page).getAttribute('data-camera-position'))).toBeGreaterThan(.01);
  const during = await scene(page).getAttribute('data-camera-position');
  await page.mouse.up();
  await expect(scene(page)).toHaveAttribute('data-camera-state', 'idle');
  await frames(page, 2);
  return { before, during, after: await scene(page).getAttribute('data-camera-position') };
}

async function assertPlaybackUntouched(page) {
  await expect(scene(page)).toHaveAttribute('data-active-screen', 'tanqing');
  await expect(page.getByRole('button', { name: '播放动作视频', exact: true })).toBeVisible();
  expect(await stage(page).locator('video').evaluateAll(videos => videos.every(video => video.paused))).toBe(true);
  expect(await page.evaluate(() => window.__spatialHitInput.playCalls)).toEqual([]);
}

test('低alpha空间按钮的真实投影位置直接命中canvas并接管拖动，不选幕或恢复播放', async ({ page }, testInfo) => {
  await openTheater(page, { settings: { actionUiOpacity: 40, actionUiInteractionOpacity: 80 } });
  await expect(screenPanel(page)).toHaveAttribute('data-geometry-visible', 'true');
  await expect.poll(() => screenPanel(page).evaluate(node => Number(node.dataset.opacity))).toBeGreaterThan(.1);
  await expect(screenPanel(page)).toHaveAttribute('data-interactive', 'false');
  await pauseTheater(page);
  const point = await buttonPoint(page);
  const hit = await page.evaluate(({ x, y }) => {
    const panel = document.querySelector('[data-spatial-panel="screen"][data-screen-id="tanqing"]');
    const canvas = document.querySelector('#theaterSceneContainer canvas');
    return { canvas: document.elementFromPoint(x, y) === canvas, inert: panel.inert, alpha: Number(panel.dataset.opacity),
      buttonPointerEvents: getComputedStyle(panel.querySelector('button')).pointerEvents };
  }, point);
  expect(hit).toMatchObject({ canvas: true, inert: true, buttonPointerEvents: 'none' });
  expect(hit.alpha).toBeLessThan(.8);
  await observeInput(page);
  const camera = await dragFromPoint(page, point);
  const input = await page.evaluate(() => window.__spatialHitInput);
  expect(input.events.filter(event => event.where === 'canvas' && event.type === 'pointerdown' && event.trusted)).toHaveLength(1);
  expect(input.events.filter(event => event.where === 'button')).toEqual([]);
  await assertPlaybackUntouched(page);
  await testInfo.attach('low-alpha-real-pointer-pass-through', {
    body: JSON.stringify({ point, hit, camera, input }, null, 2), contentType: 'application/json',
  });
});

test('已有醒狮实体遮住空间按钮时原生pointerdown由guard截住，canvas仍能拖动且不选幕或播放', async ({ page }, testInfo) => {
  // Only this source response gains test handles. Keep the application's RAF,
  // spatial guards, OrbitControls and already-cached lion meshes unchanged.
  let instrumented = false;
  await page.route('**/src/services/actionTheaterScene.js*', async route => {
    const response = await route.fetch();
    let source = await response.text();
    const api = '  const api = {';
    expect(source).toContain(api); expect(source).toContain('  Box3,');
    source = source.replace('  Box3,', '  Box3,\n  Raycaster,');
    source = source.replace(api, `
  window.__spatialHitProbe = {
    scene, camera, Raycaster, Vector2, Vector3,
    get lionRoot() { return lionRoot; }, get renderer() { return renderer; },
  };
${api}`);
    instrumented = true;
    await route.fulfill({ response, body: source });
  });
  await openTheater(page);
  expect(instrumented, 'geometry hit regression runs against the source dev server').toBe(true);
  await expect(screenPanel(page)).toHaveAttribute('data-interactive', 'true');
  await pauseTheater(page);
  const point = await buttonPoint(page);
  expect(await screenPanel(page).locator('button').evaluate((button, { x, y }) => button.contains(document.elementFromPoint(x, y)), point)).toBe(true);
  await observeInput(page);

  // Establish that this exact projected point delivers a native click before
  // the existing lion is moved into its ray, so a broken hit area cannot pass.
  await page.mouse.click(point.x, point.y);
  await expect.poll(() => page.evaluate(() => window.__spatialHitInput.events.filter(event => event.where === 'button' && event.type === 'click' && event.trusted).length)).toBe(1);
  await expect(scene(page)).toHaveAttribute('data-camera-state', 'idle');
  // Restore the paused baseline after the positive click before recording
  // the following blocked gesture, even when the current clip stays paused.
  await pauseTheater(page);
  await page.evaluate(() => { window.__spatialHitInput.events.length = 0; window.__spatialHitInput.playCalls.length = 0; });

  const arrangement = await page.evaluate(({ x, y }) => {
    const { scene, camera, lionRoot, renderer, Raycaster, Vector2, Vector3 } = window.__spatialHitProbe;
    scene.updateMatrixWorld(true);
    const plane = scene.getObjectByName('Theater_Spatial_screen_tanqing');
    const bounds = renderer.domElement.getBoundingClientRect();
    const raycaster = new Raycaster();
    raycaster.setFromCamera(new Vector2((x - bounds.left) / bounds.width * 2 - 1, 1 - (y - bounds.top) / bounds.height * 2), camera);
    const planeHit = raycaster.intersectObject(plane, false)[0];
    if (!planeHit || !lionRoot) throw new Error('Missing actual screen plane or full lion');
    const meshes = [];
    lionRoot.traverseVisible(object => {
      if (!object.isMesh || object.userData.fullHair) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.some(material => material?.visible && material.depthWrite && (!material.transparent || material.opacity >= .98))) meshes.push(object);
    });
    // Choose a nondegenerate, camera-facing triangle from an existing opaque
    // mesh. Its centroid will lie exactly on the button ray after translation.
    // No new occluder, geometry or material is inserted into the scene/cache.
    const towardCamera = raycaster.ray.direction.clone().negate();
    const a = new Vector3(), b = new Vector3(), c = new Vector3(), edge = new Vector3(), normal = new Vector3();
    let chosen;
    for (const mesh of meshes) {
      const positions = mesh.geometry.attributes.position, indices = mesh.geometry.index;
      if (!positions) continue;
      const triangles = Math.floor((indices?.count ?? positions.count) / 3);
      for (let triangle = 0; triangle < triangles; triangle += Math.max(1, Math.floor(triangles / 96))) {
        const vertex = offset => indices ? indices.getX(triangle * 3 + offset) : triangle * 3 + offset;
        a.fromBufferAttribute(positions, vertex(0)).applyMatrix4(mesh.matrixWorld);
        b.fromBufferAttribute(positions, vertex(1)).applyMatrix4(mesh.matrixWorld);
        c.fromBufferAttribute(positions, vertex(2)).applyMatrix4(mesh.matrixWorld);
        normal.subVectors(b, a).cross(edge.subVectors(c, a));
        const area = normal.length();
        if (area < 1e-8 || normal.dot(towardCamera) / area < .25 || (chosen && area <= chosen.area)) continue;
        chosen = { mesh, area, center: a.clone().add(b).add(c).multiplyScalar(1 / 3) };
      }
    }
    if (!chosen) throw new Error('No existing opaque lion triangle faces the button ray');
    const before = lionRoot.position.toArray();
    const destination = raycaster.ray.at(planeHit.distance * .5, new Vector3());
    const rootWorld = lionRoot.getWorldPosition(new Vector3()).add(destination.clone().sub(chosen.center));
    lionRoot.position.copy(lionRoot.parent.worldToLocal(rootWorld));
    scene.updateMatrixWorld(true);
    const nearest = raycaster.intersectObjects(meshes, false).find(hit => hit.distance < planeHit.distance - .01);
    if (!nearest) throw new Error('Existing lion geometry did not actually intersect before the UI plane');
    return { point: { x, y }, existingMeshes: meshes.length, triangleMesh: chosen.mesh.name,
      blockingMesh: nearest.object.name, planeDistance: planeHit.distance, occluderDistance: nearest.distance,
      before, after: lionRoot.position.toArray(), frame: Number(renderer.domElement.dataset.frameId) };
  }, point);
  expect(arrangement.existingMeshes).toBeGreaterThan(0);
  expect(arrangement.occluderDistance).toBeLessThan(arrangement.planeDistance - .01);
  await expect.poll(() => scene(page).evaluate(node => Number(node.dataset.frameId))).toBeGreaterThan(arrangement.frame);
  await expect(screenPanel(page)).toHaveAttribute('data-interactive', 'true');
  const camera = await dragFromPoint(page, point);
  await expect(screenPanel(page)).toHaveAttribute('data-occluded', 'true');
  const input = await page.evaluate(() => window.__spatialHitInput);
  expect(input.events.filter(event => event.where === 'document' && event.type === 'pointerdown' && event.trusted && event.target === 'button')).toHaveLength(1);
  expect(input.events.filter(event => event.where === 'button')).toEqual([]);
  expect(input.events.filter(event => event.where === 'canvas' && event.type === 'pointerdown' && !event.trusted)).toHaveLength(1);
  await assertPlaybackUntouched(page);
  await testInfo.attach('opaque-lion-native-pointer-guard-and-camera-handoff', {
    body: JSON.stringify({ arrangement, camera, input }, null, 2), contentType: 'application/json',
  });
});
