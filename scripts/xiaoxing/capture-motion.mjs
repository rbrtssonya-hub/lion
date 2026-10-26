import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const review = path.join(root, 'source/reviews/xiaoxing/2026-10-26/motion');
const temporary = path.join(root, 'tmp/xiaoxing-motion');
await fs.mkdir(temporary, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => { if (window === window.top) sessionStorage.setItem('nanfeng-lion:intro-seen:v1', '1'); });
const baseURL = process.env.XIAOXING_REVIEW_URL || 'http://127.0.0.1:42826';
const pages = [];
for (const chapter of ['entry', 'model', 'action', 'state']) {
  await page.goto(`${baseURL}/#/${chapter}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.xiaoxing-avatar[data-layered="true"]').waitFor({ state: 'visible' });
  await page.waitForFunction(value => document.body.dataset.state === value, chapter);
  if (chapter === 'model') await page.locator('.model-header-meta.is-ready').waitFor({ state: 'visible', timeout: 60_000 });
  if (chapter === 'action') {
    await page.locator('.theater-loading').waitFor({ state: 'hidden', timeout: 60_000 });
    if (await page.locator('.theater-scene-error').count()) throw new Error('Action scene failed to finish loading for review.');
  }
  await page.waitForTimeout(700);
  const target = path.join(chapter === 'state' ? review : temporary, `${chapter}-1366.png`);
  await page.screenshot({ path: target });
  pages.push({ chapter, target: path.relative(root, target).replaceAll('\\', '/'), layers: await page.locator('.xiaoxing-layer').count() });
}
await context.close();
const videoContext = await browser.newContext({ viewport: { width: 1000, height: 680 }, recordVideo: { dir: temporary, size: { width: 1000, height: 680 } } });
const preview = await videoContext.newPage();
preview.on('pageerror', error => errors.push(error.message));
await preview.goto(pathToFileURL(path.join(review, 'preview.html')).href);
await preview.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
const video = preview.video();
for (const [label, duration] of [['待机', 2800], ['眨眼', 1000], ['倾听', 2000], ['思考', 2000], ['回答', 3300]]) {
  await preview.getByRole('button', { name: label, exact: true }).click();
  await preview.waitForTimeout(duration);
}
await videoContext.close();
const videoPath = await video.path();
const version = browser.version();
await browser.close();
const gif = path.join(review, 'character-states.gif');
const encoded = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-y', '-ss', '0.5', '-i', videoPath, '-vf', 'fps=12,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3', '-loop', '0', gif], { encoding: 'utf8', windowsHide: true });
if (encoded.status !== 0) throw new Error(encoded.error?.message || encoded.stderr);
if (errors.length) throw new Error(`Browser page errors: ${errors.join('; ')}`);
await fs.writeFile(path.join(review, 'capture.json'), JSON.stringify({ browser: version, pages, pageErrors: errors, review: 'Local state selector renders the same nine PNG layers and current source CSS; thinking in this review is selected manually, not a live DeepSeek response.', gif: path.relative(root, gif).replaceAll('\\', '/') }, null, 2) + '\n');
console.log(JSON.stringify({ browser: version, pages: pages.length, pageErrors: errors.length, gif, bytes: (await fs.stat(gif)).size }));
