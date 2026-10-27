import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Run against the development server to inspect the real renderer and camera.
const url = process.env.ATLAS_URL || 'http://127.0.0.1:5175';
const output = process.env.ATLAS_EVIDENCE || 'artifacts/viewport';
const cameras = JSON.parse(await readFile('public/data/handoff-cameras.json', 'utf8'));
await mkdir(`${output}/screenshots`, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
const errors = [], failedResponses = [];
const result = { url, errors, failedResponses };
let releaseImage;
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) failedResponses.push({ url: response.url(), status: response.status() }); });
const phase = name => page.waitForFunction(name => document.querySelector('.lion-experience')?.dataset.phase === name, name, { timeout: 45000 });
const near = (actual, expected, label, tolerance = .01) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < tolerance, `${label}: ${actual} != ${expected}`);

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.lion-experience')?.dataset.ready === 'true', null, { timeout: 180000 });
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.chapter-control').count(), 6);
  assert.equal(await page.locator('.model-guide').count(), 0, 'overview retains only the six bottom controls');

  // Delay the real chapter image so the real body endpoint can be inspected at full opacity.
  const held = new Promise(resolve => { releaseImage = resolve; });
  await page.route('**/images/chapters/body.png', async route => { await held; await route.continue(); });
  await page.locator('.chapter-control[data-part="body"]').click();
  await phase('travel');
  await page.waitForTimeout(3000);
  result.endpoint = await page.evaluate(() => {
    const w = window.__LION_ATLAS__, canvas = w.renderer.domElement, camera = w.camera;
    const frame = document.querySelector('.visual-frame').getBoundingClientRect();
    const box = canvas.getBoundingClientRect();
    const reference = camera.clone();
    reference.clearViewOffset(); reference.aspect = 1.5; reference.updateProjectionMatrix();
    const projection = w.registry.all().map(part => {
      const actual = part.center.clone().project(camera), old = part.center.clone().project(reference);
      return { id: part.id, actual: [(actual.x + 1) * innerWidth / 2, (1 - actual.y) * innerHeight / 2],
        original: [frame.x + (old.x + 1) * frame.width / 2, frame.y + (1 - old.y) * frame.height / 2] };
    });
    w.renderer.render(w.scene, camera);
    const gl = w.renderer.getContext(), rgba = new Uint8Array(4), samples = [];
    const ratio = w.renderer.getPixelRatio();
    for (let y = 70; y < innerHeight - 135; y += 24) for (let x = 12; x < innerWidth - 12; x += 16) {
      if (x >= frame.x - 8 && x <= frame.right + 8) continue;
      w.raycaster.setFromCamera({ x: x / innerWidth * 2 - 1, y: 1 - y / innerHeight * 2 }, camera);
      const hit = w.raycaster.intersectObjects(w.meshes, false).find(item => item.object.visible);
      if (!hit) continue;
      gl.readPixels(Math.floor(x * ratio), Math.floor((innerHeight - y) * ratio), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      if (rgba[3] > 100) samples.push({ x, y, rgba: [...rgba], source: hit.object.userData.sourceName || hit.object.name });
    }
    return { phase: document.querySelector('.lion-experience').dataset.phase, pose: w.getCameraPose(), projection, samples,
      frame: { x: frame.x, y: frame.y, width: frame.width, height: frame.height, right: frame.right },
      canvas: { x: box.x, y: box.y, width: box.width, height: box.height },
      artworkOpacity: Number(getComputedStyle(document.querySelector('.artwork-layer')).opacity) };
  });
  const endpoint = result.endpoint, registered = cameras.parts.find(part => part.id === 'body');
  assert.equal(endpoint.phase, 'travel');
  assert.equal(endpoint.artworkOpacity, 0);
  near(endpoint.canvas.x, 0, 'canvas x'); near(endpoint.canvas.y, 0, 'canvas y');
  near(endpoint.canvas.width, 1920, 'canvas width'); near(endpoint.canvas.height, 1080, 'canvas height');
  endpoint.pose.position.forEach((value, i) => near(value, registered.position[i], 'body camera position', .00001));
  endpoint.pose.target.forEach((value, i) => near(value, registered.target[i], 'body camera target', .00001));
  near(endpoint.pose.aspect, 1.5, 'original camera aspect', .00001);
  for (const p of endpoint.projection) { near(p.actual[0], p.original[0], `${p.id} original x`); near(p.actual[1], p.original[1], `${p.id} original y`); }
  assert.ok(endpoint.samples.filter(p => p.x < endpoint.frame.x).length > 5, 'actual model paints beyond the former left edge');
  assert.ok(endpoint.samples.filter(p => p.x > endpoint.frame.right).length > 5, 'actual model paints beyond the former right edge');
  await page.screenshot({ path: `${output}/screenshots/body-endpoint.png` });

  // Pause the actual GSAP timeline at a midpoint so the screenshots record the real
  // handoff and return frames without racing a short animation in slow software GL.
  await page.evaluate(async () => {
    const resource = performance.getEntriesByType('resource').find(entry => /\/deps\/gsap\.js(?:\?|$)/.test(entry.name));
    if (!resource) throw new Error('Vite GSAP module was not loaded');
    window.__viewportTestGsap = (await import(resource.name)).gsap;
  });
  await page.evaluate(() => { window.__viewportTestGsap.globalTimeline.timeScale(.25); });
  const captureFrame = async (stage, target, file) => {
    await page.waitForFunction(({ stage, target }) => {
      const root = document.querySelector('.lion-experience'), model = document.querySelector('.model-layer'), image = document.querySelector('.artwork-layer');
      const m = Number(getComputedStyle(model).opacity), a = Number(getComputedStyle(image).opacity);
      if (root.dataset.phase !== stage || Math.abs(a - target) > .06 || m < .05 || m > .95) return false;
      window.__viewportTestGsap.globalTimeline.pause();
      return true;
    }, { stage, target }, { timeout: 45000 });
    const state = await page.evaluate(() => ({ phase: document.querySelector('.lion-experience').dataset.phase,
      model: Number(getComputedStyle(document.querySelector('.model-layer')).opacity),
      artwork: Number(getComputedStyle(document.querySelector('.artwork-layer')).opacity), active: window.__LION_ATLAS__.active }));
    assert.equal(state.phase, stage); assert.equal(state.active, true);
    assert.ok(state.model > .05 && state.model < .95 && state.artwork > .05 && state.artwork < .95, `${stage} both layers are partially visible`);
    near(state.artwork, target, `${stage} image fade stage`, .07);
    near(state.model + state.artwork, 1, `${stage} model and picture fade together`, .025);
    await page.screenshot({ path: `${output}/screenshots/${file}.png` });
    await page.evaluate(() => { window.__viewportTestGsap.globalTimeline.resume(); });
    return state;
  };
  releaseImage();
  result.handoff = [];
  for (const target of [.2, .5, .8]) result.handoff.push(await captureFrame('handoff', target, `body-handoff-${target}`));
  await phase('study');
  await page.getByRole('button', { name: '返回整体', exact: true }).click();
  result.returning = [];
  for (const target of [.8, .5, .2]) result.returning.push(await captureFrame('returning', target, `body-return-${target}`));
  await phase('overview');
  assert.deepEqual(errors, []); assert.deepEqual(failedResponses, []);
  result.passed = true;
  await writeFile(`${output}/viewport-results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ passed: true, bodyPixelsLeft: endpoint.samples.filter(p => p.x < endpoint.frame.x).length,
    bodyPixelsRight: endpoint.samples.filter(p => p.x > endpoint.frame.right).length, handoff: result.handoff, returning: result.returning, errors, failedResponses }, null, 2));
} catch (error) {
  result.passed = false; result.failure = error.stack;
  await page.screenshot({ path: `${output}/screenshots/failure.png` }).catch(() => {});
  await writeFile(`${output}/viewport-results.json`, JSON.stringify(result, null, 2));
  throw error;
} finally { releaseImage?.(); await browser.close(); }
