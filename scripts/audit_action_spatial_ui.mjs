// Real desktop screenshots and rendered-frame timing; never invokes scene APIs.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.ACTION_AUDIT_URL || 'http://127.0.0.1:4173';
const output = path.resolve(process.env.ACTION_AUDIT_OUTPUT || 'source/reviews/action-theater/2026-10-21-floating-ui');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    if (window !== window.top) return;
    sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1');
    sessionStorage.setItem('nanfeng-lion:book-intro-seen:v1', '1');
    localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, pushPage: true, panelWidth: 760 }));
  });
  await page.goto(`${baseURL}/#/action`);
  await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 90_000 });
  const canvas = page.locator('#theaterSceneContainer canvas');
  await expect(canvas).toHaveAttribute('data-active-screen', 'tanqing', { timeout: 60_000 });
  const frames = count => page.evaluate(count => new Promise(resolve => {
    const next = () => --count <= 0 ? resolve() : requestAnimationFrame(next);
    requestAnimationFrame(next);
  }), count);
  await frames(100);
  const captures = [];
  const capture = async name => {
    await frames(3);
    const file = path.join(output, `${name}.png`);
    await page.screenshot({ path: file });
    captures.push({ name, file: path.relative(process.cwd(), file).replaceAll('\\', '/'), viewport: page.viewportSize(),
      state: await canvas.evaluate(node => ({ active: node.dataset.activeScreen, camera: JSON.parse(node.dataset.cameraPosition),
        frame: node.dataset.frameId, spatialFrame: node.dataset.spatialFrameId, composition: JSON.parse(node.dataset.composition) })) });
  };
  await capture('desktop-1920');
  const startSampling = () => page.evaluate(() => {
    window.__auditFrames = [];
    const canvas = document.querySelector('#theaterSceneContainer canvas');
    const sample = time => {
      window.__auditFrames.push({ time, frame: Number(canvas.dataset.frameId), spatialFrame: Number(canvas.dataset.spatialFrameId), active: canvas.dataset.activeScreen });
      window.__auditRaf = requestAnimationFrame(sample);
    };
    window.__auditRaf = requestAnimationFrame(sample);
  });
  await startSampling();
  await frames(120);
  const box = await canvas.boundingBox();
  const drags = [];
  const drag = async degrees => {
    const x = box.x + box.width * .86, y = box.y + box.height * .40;
    expect(await canvas.evaluate((node, { x, y }) => document.elementFromPoint(x, y) === node, { x, y })).toBe(true);
    const before = Number(await canvas.getAttribute('data-camera-azimuth'));
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - degrees / 360 * box.height / .42, y, { steps: 24 });
    await page.mouse.up();
    await frames(2);
    const after = Number(await canvas.getAttribute('data-camera-azimuth'));
    const actualDegrees = Math.abs(Math.atan2(Math.sin(after - before), Math.cos(after - before))) * 180 / Math.PI;
    expect(Math.abs(actualDegrees - degrees)).toBeLessThan(2);
    drags.push({ requestedDegrees: degrees, actualDegrees, before, after });
  };
  await drag(90);
  await capture('drag-left-90');
  await drag(180);
  await capture('drag-next-180');
  const timing = await page.evaluate(() => { cancelAnimationFrame(window.__auditRaf); return window.__auditFrames; });
  const intervals = timing.slice(1).map((sample, index) => sample.time - timing[index].time).sort((a, b) => a - b);
  const frameTiming = {
    samples: timing.length,
    fps: 1000 * (timing.length - 1) / (timing.at(-1).time - timing[0].time),
    renderedFps: 1000 * (timing.at(-1).frame - timing[0].frame) / (timing.at(-1).time - timing[0].time),
    repeatedFrameSamples: timing.slice(1).filter((sample, index) => sample.frame === timing[index].frame).length,
    intervalMedianMs: intervals[Math.floor(intervals.length * .5)],
    intervalP95Ms: intervals[Math.floor(intervals.length * .95)],
    mismatchedFramePairs: timing.filter(sample => sample.frame !== sample.spatialFrame).length,
    note: 'Browser RAF wall-clock intervals include real input and screenshots; this is a local hardware observation, not a GPU timing or cross-device guarantee.',
  };
  await page.locator('button[data-action-id="tanqing"]').click();
  await expect(canvas).toHaveAttribute('data-active-screen', 'tanqing');
  for (const [width, height] of [[1366, 768], [900, 900]]) {
    await page.setViewportSize({ width, height });
    await capture(`desktop-${width}`);
  }
  await page.setViewportSize({ width: 1675, height: 1000 });
  await page.getByRole('button', { name: '打开开发者参数设置', exact: true }).click();
  await expect(page.locator('.site-shell')).toHaveAttribute('data-settings-layout', 'push');
  // The shared shell intentionally switches to overlay below 900px of page.
  await expect.poll(() => canvas.evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(900);
  for (const name of ['醒狮自动旋转', '平面观看']) {
    const button = page.getByRole('button', { name, exact: true });
    const bounds = await button.boundingBox();
    const viewport = page.viewportSize();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(await button.evaluate(node => { const b = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)); })).toBe(true);
  }
  await capture('settings-push-900');
  await page.getByRole('button', { name: '关闭开发者参数', exact: true }).click();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole('button', { name: '平面观看', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-render-state', 'inactive');
  await capture('flat-video');
  expect(errors).toEqual([]);
  const graphics = await canvas.evaluate(node => {
    const gl = node.getContext('webgl2') || node.getContext('webgl');
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return { renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), vendor: gl.getParameter(gl.VENDOR) };
  });
  const idle = timing.slice(0, 120);
  const idleFrameTiming = {
    samples: idle.length,
    renderedFps: 1000 * (idle.at(-1).frame - idle[0].frame) / (idle.at(-1).time - idle[0].time),
    note: 'First 120 sampled frames before mouse input and screenshots.',
  };
  const report = { testedOn: '2026-10-21', baseURL, browser: browser.version(), graphics, frameTiming, idleFrameTiming, drags, errors, captures };
  await writeFile(path.join(output, 'audit.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ screenshots: captures.length, ...frameTiming, errors }));
} finally { await browser.close(); }
