import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const baseURL = process.env.ATLAS_URL || 'http://127.0.0.1:5175';
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir('artifacts/handoff/references', { recursive: true });
try {
  await page.goto(baseURL);
  await page.waitForFunction(() => window.__LION_ATLAS__?.registry, { timeout: 180000 });
  await page.addStyleTag({ content: `
    body{background:#eeeae1!important}body *{visibility:hidden!important}
    .atlas:before,.canvas-host:before,.lion-experience:after{display:none!important}
    .visual-frame{position:fixed!important;left:0!important;top:0!important;width:1200px!important;height:800px!important;transform:none!important}
    .model-layer{visibility:visible!important;opacity:1!important}
    .canvas-host,.canvas-host canvas{visibility:visible!important}
    .canvas-host{position:fixed!important;left:0!important;top:0!important;right:auto!important;bottom:auto!important;width:1200px!important;height:800px!important;transform:none!important;background:#eeeae1!important;z-index:9999!important}
  ` });
  await page.evaluate(() => {
    const world = window.__LION_ATLAS__;
    world.options.labels = false;
    world.setInteractive(false);
    world.resize(false);
    world.fitOverall(false);
  });
  const overview = await page.evaluate(() => window.__LION_ATLAS__.getCameraPose());
  const parts = [];
  // Alternate the two image owners so each can start as early as possible.
  for (const id of ['brows', 'body', 'crown', 'trim', 'beard', 'mouth']) {
    const part = await page.evaluate(async id => {
      const world = window.__LION_ATLAS__;
      await world.flyToPart(id, { duration: 0 });
      world.setInteractive(false);
      return { ...world.getPartPose(id), actualPose: world.getCameraPose(), sourceScale: world.sourceScale };
    }, id);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `artifacts/handoff/references/${id}.png`, clip: { x: 0, y: 0, width: 1200, height: 800 } });
    parts.push(part);
    console.log(`REFERENCE READY: artifacts/handoff/references/${id}.png`);
  }
  const invariants = await page.evaluate(async () => {
    const world = window.__LION_ATLAS__;
    const first = world.flyToPart('brows', { duration: 1 });
    const second = world.flyToPart('mouth', { duration: .01 });
    const cancellation = await Promise.all([first, second]);
    const posesUnchanged = world.meshes.every(mesh => mesh.position.equals(mesh.userData.atlasOriginal.position));
    world.setActive(false);
    const frame = world.renderer.info.render.frame;
    await new Promise(resolve => setTimeout(resolve, 100));
    const inactive = frame === world.renderer.info.render.frame;
    world.setActive(true);
    const returned = await world.restoreOverview({ duration: .01 });
    return { cancellation, posesUnchanged, inactive, returned, restoredPose: world.getCameraPose() };
  });
  const result = { version: 2, aperture: { width: 1200, height: 800, aspect: 1.5, fov: 34 }, background: '#eeeae1', coordinateSystem: 'normalized Three.js world; unmodified source mesh transforms', overview, parts, invariants, errors };
  await writeFile('public/data/handoff-cameras.json', JSON.stringify(result, null, 2));
  await writeFile('artifacts/handoff/capture-results.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ errors, invariants }, null, 2));
} finally { await browser.close(); }
