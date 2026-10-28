import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const known = JSON.parse(await readFile('public/data/handoff-cameras.json', 'utf8'));
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1020 }, deviceScaleFactor: 1 });
const records = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5196/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.lion-experience')?.dataset.ready === 'true', null, { timeout: 180000 });
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: '.lion-experience > :not(.visual-frame) { visibility: hidden !important; } .artwork-layer { visibility: hidden !important; } .model-layer { opacity: 1 !important; visibility: visible !important; }' });
  for (const id of ['brows', 'crown', 'beard', 'body', 'trim', 'mouth']) {
    const data = await page.evaluate(async id => {
      const world = window.__LION_ATLAS__;
      const result = await world.flyToPart(id, { duration: 0 });
      world.renderer.render(world.scene, world.camera);
      const canvas = world.renderer.domElement.getBoundingClientRect();
      return { result, pose: world.getCameraPose(), canvas: { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height }, view: world.camera.view };
    }, id);
    assert.equal(data.result.completed, true);
    const expected = known.parts.find(part => part.id === id);
    for (const field of ['position', 'target']) data.pose[field].forEach((value, index) => assert.ok(Math.abs(value - expected[field][index]) < 0.00001, `${id} ${field} ${index}`));
    assert.equal(data.pose.fov, expected.fov);
    assert.equal(data.pose.aspect, expected.aspect);
    assert.deepEqual(data.canvas, { x: 0, y: 0, width: 1920, height: 1020 });
    await page.screenshot({ path: `artifacts/fullscreen/reference-wide/${id}.png` });
    records.push({ id, ...data });
  }
  assert.deepEqual(errors, []);
  await writeFile('artifacts/fullscreen/reference-wide/capture.json', JSON.stringify({ viewport: { width: 1920, height: 1020 }, records, errors }, null, 2));
  console.log(`Captured ${records.map(r => r.id).join(', ')}; all registered poses verified.`);
} finally { await browser.close(); }
