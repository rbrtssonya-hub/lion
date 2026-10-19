/**
 * Reproduce the structure viewport benchmark against the running Vite server.
 * node scripts/benchmark_lion_scene.mjs --dpr=1 --output=tmp/structure-after-dpr1
 * node scripts/benchmark_lion_scene.mjs --baseline-ref=1f8f206 --dpr=1 --output=tmp/structure-before-dpr1
 *
 * Source/GLB snapshots and timing hooks are served only through Playwright routes.
 * Application source, the mounted scene API, and original model files are not edited.
 */
import { chromium, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { assetPaths } from '../src/config/assetPaths.js';

const options = new Map(process.argv.slice(2).map(argument => {
  const match = argument.match(/^--([^=]+)=(.+)$/);
  if (!match) throw new Error(`Expected --name=value, received ${argument}`);
  return [match[1], match[2]];
}));
for (const key of options.keys()) {
  if (!['baseline-ref', 'dpr', 'output', 'url', 'duration'].includes(key)) throw new Error(`Unknown option: ${key}`);
}
const reference = options.get('baseline-ref');
const dpr = Number(options.get('dpr') || 1);
const duration = Number(options.get('duration') || 6000);
if (!Number.isFinite(dpr) || dpr < 1 || dpr > 3) throw new Error('DPR must be between 1 and 3');
if (!Number.isFinite(duration) || duration < 1000 || duration > 60000) throw new Error('Duration must be 1000–60000 ms');
const origin = new URL(options.get('url') || 'http://127.0.0.1:5173').origin;
const output = resolve(options.get('output') || `tmp/structure-performance-${reference || 'current'}-dpr${dpr}`);
await mkdir(dirname(output), { recursive: true });
const scenePath = 'src/services/lionScene.js';
const modelPath = `source/public/${assetPaths.model}`;
const referenceCommit = reference ? execFileSync('git', ['rev-parse', '--verify', '--end-of-options', `${reference}^{commit}`], { encoding: 'utf8' }).trim() : null;
const gitRead = path => execFileSync('git', ['show', `${referenceCommit}:${path}`], { maxBuffer: 128 * 1024 * 1024 });
const rawScene = reference ? gitRead(scenePath) : await readFile(scenePath);
const model = reference ? gitRead(modelPath) : await readFile(modelPath);
const sceneSha256 = createHash('sha256').update(rawScene).digest('hex');
const snapshotPath = `tmp/lion-scene-benchmark/snapshot-${sceneSha256.slice(0, 16)}.js`;
await mkdir(dirname(snapshotPath), { recursive: true });
await writeFile(snapshotPath, rawScene);
// Vite resolves bare Three.js imports in this frozen copy, including historical code.
const sourceResponse = await fetch(`${origin}/${snapshotPath}`);
if (!sourceResponse.ok) throw new Error(`Vite source request failed: HTTP ${sourceResponse.status}`);
let source = `window.__lionPerf = { render: [], pick: [], diagnostics: [] };\n${await sourceResponse.text()}`;
function instrument(needle, replacement) {
  if (!source.includes(needle)) throw new Error(`Timing hook no longer matches: ${needle}`);
  source = source.replace(needle, replacement);
}
instrument('const pick = (clientX, clientY) => {', 'const pick = (clientX, clientY) => { const __pickStart = performance.now();');
instrument('return hit ? { id: classifyHit(hit), point: hit.point.toArray() } : null;', 'const __result = hit ? { id: classifyHit(hit), point: hit.point.toArray() } : null; window.__lionPerf.pick.push(performance.now() - __pickStart); return __result;');
instrument('const updateDiagnostics = () => {', 'const updateDiagnostics = () => { const __diagStart = performance.now();');
instrument('canvas.dataset.partProjections = JSON.stringify(projections);', 'canvas.dataset.partProjections = JSON.stringify(projections); window.__lionPerf.diagnostics.push(performance.now() - __diagStart);');
instrument('renderer.render(scene, camera);', 'const __renderStart = performance.now(); renderer.render(scene, camera); window.__lionPerf.render.push(performance.now() - __renderStart);');
function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { count: values.length, total: values.reduce((sum, value) => sum + value, 0),
    median: sorted[Math.floor(sorted.length * .5)] || 0,
    p95: sorted[Math.floor(sorted.length * .95)] || 0, max: sorted.at(-1) || 0 };
}
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: dpr });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/src/services/lionScene.js*', route => route.fulfill({ body: source, contentType: 'text/javascript' }));
  await page.route(`**/${assetPaths.model}`, route => route.fulfill({ body: model, contentType: 'model/gltf-binary' }));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await page.goto(`${origin}/#/model`);
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60000 });
  await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 45000 });
  await page.waitForTimeout(1200);
  const gpu = await page.locator('#sceneContainer canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return { renderer: extension && gl.getParameter(extension.UNMASKED_RENDERER_WEBGL),
      vendor: extension && gl.getParameter(extension.UNMASKED_VENDOR_WEBGL),
      canvas: [canvas.width, canvas.height], dpr: devicePixelRatio, userAgent: navigator.userAgent };
  });
  const frame = await page.locator('.scene-interaction').boundingBox();
  const start = { x: frame.x + frame.width * .5, y: frame.y + frame.height * .5 };
  async function phase(name, drag) {
    await page.evaluate(() => { for (const key of Object.keys(window.__lionPerf)) window.__lionPerf[key] = []; });
    if (drag) { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
    await cdp.send('Profiler.start');
    const samples = await page.evaluate(async ({ duration, drag, start }) => {
      const times = [];
      let previous;
      let first;
      await new Promise(resolve => {
        const sample = now => {
          if (first === undefined) first = now;
          if (previous !== undefined) times.push(now - previous);
          previous = now;
          if (drag) {
            const seconds = (now - first) / 1000;
            // A real pointerdown establishes OrbitControls' capture. Sustained
            // pointermove events then orbit in the same path on each display rAF.
            document.querySelector('.scene-interaction').dispatchEvent(new PointerEvent('pointermove', {
              bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 1,
              clientX: start.x + Math.sin(seconds * 2.8) * 170,
              clientY: start.y + Math.cos(seconds * 2.2) * 65,
            }));
          }
          if (now - first >= duration) resolve();
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      return { elapsed: previous - first, frames: times, metrics: window.__lionPerf };
    }, { duration, drag, start });
    const { profile } = await cdp.send('Profiler.stop');
    if (drag) await page.mouse.up();
    await writeFile(`${output}-${name}-cpu.json`, JSON.stringify(profile));
    const nodes = new Map(profile.nodes.map(node => [node.id, node]));
    const counts = new Map();
    for (const id of profile.samples ?? []) {
      const node = nodes.get(id);
      const key = `${node.callFrame.functionName || '(anon)'} @ ${node.callFrame.url.split('/').at(-1)}:${node.callFrame.lineNumber + 1}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return { name, elapsed: samples.elapsed, fps: samples.frames.length / (samples.elapsed / 1000), raf: summarize(samples.frames),
      over33: samples.frames.filter(time => time > 33.4).length, over50: samples.frames.filter(time => time > 50).length,
      metrics: Object.fromEntries(Object.entries(samples.metrics).map(([key, values]) => [key, summarize(values)])),
      cpuTop: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25) };
  }
  const phases = [await phase('idle', false), await phase('drag', true)];
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${output}-viewport.png` });
  const result = { timestamp: new Date().toISOString(), reference: reference || 'working-tree', referenceCommit,
    checkout: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sceneSha256, modelSha256: createHash('sha256').update(model).digest('hex'),
    modelBytes: model.length, gpu, viewport: { width: 1920, height: 1080 }, duration, errors, phases };
  await writeFile(`${output}.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
