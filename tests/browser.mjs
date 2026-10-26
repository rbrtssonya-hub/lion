import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const baseURL = process.env.ATLAS_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1536, height: 960 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await mkdir('artifacts', { recursive: true });
try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__LION_ATLAS__?.registry, { timeout: 180000 });
  await page.locator('.loading-state').waitFor({ state: 'detached', timeout: 180000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'artifacts/desktop-overview.png' });
  const model = await page.evaluate(() => {
    const w = window.__LION_ATLAS__;
    return { meshes: w.meshes.length, parts: w.registry.all().map(p => ({ id: p.id, meshes: p.meshes.length })), stats: w.renderer.info.render, materials: w.renderer.info.memory, sourceScale: w.sourceScale };
  });
  assert.equal(model.parts.length, 6, 'six real part mappings');
  assert.ok(model.meshes >= 53, 'source meshes loaded');
  assert.ok(model.stats.triangles > 500000, 'actual geometry was rendered');
  const canvasBox = await page.locator('.canvas-host canvas').boundingBox();
  const beforeCamera = await page.evaluate(() => window.__LION_ATLAS__.camera.position.toArray());
  await page.mouse.move(canvasBox.x + canvasBox.width * .6, canvasBox.y + canvasBox.height * .6);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * .6 + 80, canvasBox.y + canvasBox.height * .6 - 25, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const afterCamera = await page.evaluate(() => window.__LION_ATLAS__.camera.position.toArray());
  assert.notDeepEqual(beforeCamera, afterCamera, 'dragging rotates the camera');
  await page.getByRole('button', { name: '重置视角', exact: true }).click();
  await page.waitForTimeout(1000);
  const click = await page.evaluate(() => {
    const w = window.__LION_ATLAS__, canvas = w.renderer.domElement, rect = canvas.getBoundingClientRect();
    for (let y = .25; y < .8; y += .07) for (let x = .25; x < .8; x += .07) {
      const point = { clientX: rect.left + rect.width * x, clientY: rect.top + rect.height * y };
      if (document.elementFromPoint(point.clientX, point.clientY) !== canvas) continue;
      const part = w.pick(point);
      if (part) return { x: point.clientX, y: point.clientY, id: part.id };
    }
  });
  assert.ok(click, 'a mapped real 3D surface can be raycast');
  await page.mouse.click(click.x, click.y);
  await page.locator('.research-pane').waitFor();
  assert.equal(await page.evaluate(() => window.__LION_ATLAS__.selected), click.id, 'actual model click enters the matching study');
  for (const id of ['brows', 'crown', 'beard', 'body', 'trim', 'mouth']) {
    const index = ['brows', 'crown', 'beard', 'body', 'trim', 'mouth'].indexOf(id);
    await page.locator('.chapter-item').nth(index).click();
    await page.locator('.research-pane').waitFor();
    await page.waitForTimeout(1100);
    await page.screenshot({ path: `artifacts/desktop-${id}.png` });
    assert.equal(await page.locator('.research-pane .rv-svg').count(), 2, `${id} has two distinct diagrams`);
    const before = await page.locator('.research-visuals').innerHTML();
    const input = page.locator('.rv-parameter input');
    await input.fill('0.8');
    await input.dispatchEvent('input');
    assert.equal(await input.inputValue(), '0.8', `${id} parameter is interactive`);
    assert.notEqual(await page.locator('.research-visuals').innerHTML(), before, `${id} parameter changes its diagram`);
    const unchanged = await page.evaluate(() => window.__LION_ATLAS__.meshes.every(mesh => mesh.position.equals(mesh.userData.atlasOriginal.position)));
    assert.ok(unchanged, 'all source object transforms remain intact');
    await page.screenshot({ path: `artifacts/desktop-${id}-parameter.png` });
  }
  await page.getByRole('button', { name: '放大口齿意象图版' }).click();
  assert.ok(await page.locator('.image-lightbox').isVisible(), 'generated image opens full size');
  await page.getByRole('button', { name: '关闭图版' }).click();
  await page.getByRole('button', { name: '几何线描', exact: true }).click();
  await page.getByRole('button', { name: '原貌观察', exact: true }).click();
  await page.getByRole('button', { name: '返回全貌', exact: true }).click();
  await page.waitForTimeout(1100);
  // A projected label opens the same study as a click on the 3D surface.
  const label = page.locator('.spatial-label:visible').first();
  assert.ok(await label.count(), 'spatial labels are visible');
  await label.click();
  await page.locator('.research-pane').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.research-pane').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: /关于研究/ }).click();
  assert.ok(await page.locator('dialog[open]').count(), 'source dialog opens');
  await page.getByRole('button', { name: '关闭研究说明' }).click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(1100);
  await page.screenshot({ path: 'artifacts/desktop-1280.png', fullPage: true });
  await page.locator('.chapter-item').nth(3).click();
  await page.waitForTimeout(1100);
  await page.screenshot({ path: 'artifacts/desktop-1280-body.png', fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.ok(!overflow, 'desktop has no horizontal overflow');
  assert.deepEqual(errors, [], 'no browser errors');
  const result = { date: new Date().toISOString(), baseURL, model, errors, passed: ['six studies', 'parameter changes affect figures', 'source transforms unchanged', 'drag rotation', 'real 3D surface selection', 'view modes', 'spatial label selection', 'return overview', 'source dialog', 'generated image enlargement', '1536px and 1280px desktop layouts'] };
  await writeFile('artifacts/browser-results.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
