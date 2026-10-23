#!/usr/bin/env node
// Verifies the delivered EXE's own Electron window. Playwright and Node are
// acceptance tools on the development computer, not application dependencies.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createReadStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, expect } from '@playwright/test';
import { lionBookPages } from '../../src/data/lion-book.js';
import { lionExpressions } from '../../src/data/lion-expressions.js';
import { theaterActions } from '../../src/features/action/actionClips.js';

const system = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const execute = promisify(execFile);
if (process.argv.length !== 5) {
  console.error('Usage: node scripts/portable/verify-delivery.mjs <exe> <expectedSiteDir> <reviewDir>');
  process.exitCode = 2;
} else await verify(...process.argv.slice(2).map(value => path.resolve(value)));

async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function inventory(root) {
  const files = [];
  async function visit(relative = '') {
    for (const item of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
      const name = relative ? relative + '/' + item.name : item.name;
      assert(!item.isSymbolicLink(), 'Unexpected symbolic link: ' + name);
      if (item.isDirectory()) await visit(name);
      else if (item.isFile()) {
        const file = path.join(root, name);
        files.push({ path: name, bytes: (await fs.stat(file)).size, sha256: await hashFile(file) });
      }
    }
  }
  await visit();
  return files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
function sorted(files) { return [...files].sort((a, b) => a.path.localeCompare(b.path, 'en')); }
function encodedPath(value) { return '/' + value.split('/').map(encodeURIComponent).join('/'); }
function request(url, { method = 'GET', headers = {}, keepBody = false } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers, agent: false }, res => {
      const hash = createHash('sha256'), chunks = [];
      let bytes = 0;
      res.on('data', chunk => { bytes += chunk.length; hash.update(chunk); if (keepBody) chunks.push(chunk); });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, bytes,
        sha256: hash.digest('hex'), ...(keepBody ? { body: Buffer.concat(chunks) } : {}) }));
      res.on('error', reject);
    });
    req.setTimeout(90_000, () => req.destroy(new Error('HTTP request timed out: ' + url)));
    req.on('error', reject); req.end();
  });
}
async function readJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
async function poll(fn, timeout = 60_000, message = 'Condition did not become true') {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try { const value = await fn(); if (value) return value; } catch (error) { last = error; }
    await delay(100);
  }
  throw new Error(message + (last ? ': ' + last.message : ''));
}
async function processInfo(pid) {
  assert(Number.isSafeInteger(pid) && pid > 0);
  const { stdout } = await execute(path.join(system, 'WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoProfile', '-NonInteractive', '-Command', `[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}' | Select-Object ProcessId,ParentProcessId,ExecutablePath | ConvertTo-Json -Compress`],
    { windowsHide: true });
  return stdout.trim() ? JSON.parse(stdout) : null;
}
async function listening(origin) {
  const url = new URL(origin);
  return new Promise(resolve => {
    const socket = net.createConnection({ host: url.hostname, port: Number(url.port) });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
    socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
  });
}

async function verify(executable, expectedSiteDir, reviewDir) {
  const report = { verifier: 'current-delivery-electron', startedAt: new Date().toISOString(), verdict: 'RED',
    inputs: { executable, expectedSiteDir, reviewDir }, checks: [], screenshots: [], pageErrors: [],
    httpFailures: [], requestFailures: [], outsideRequests: [], consoleErrors: [] };
  let child, browser, page, status, ownedMain, exitResult;
  let shutdownRequested = false;
  const runDir = path.join(reviewDir, 'delivery-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8));
  await fs.mkdir(runDir, { recursive: true });
  report.runDir = runDir;
  const save = () => fs.writeFile(path.join(runDir, 'validation.json'), JSON.stringify(report, null, 2));
  const shot = async name => {
    const file = path.join(runDir, name + '.png');
    await page.screenshot({ path: file, timeout: 30_000 });
    const result = { name, path: file, sha256: await hashFile(file) };
    report.screenshots.push(result); return result;
  };
  const step = async (name, fn) => {
    const entry = { name, status: 'running', startedAt: new Date().toISOString() };
    report.checks.push(entry);
    const started = Date.now();
    try { entry.evidence = await fn(); entry.status = 'passed'; console.log('PASS ' + name); return entry.evidence; }
    catch (error) {
      entry.status = 'failed'; entry.error = { message: error.message, stack: error.stack };
      console.error('FAIL ' + name + ': ' + error.message);
      if (page && !page.isClosed()) try { entry.screenshot = await shot('failure-' + name); } catch {}
      throw error;
    } finally { entry.durationMs = Date.now() - started; await save(); }
  };
  try {
    const expected = await step('preflight', async () => {
      assert.equal(process.platform, 'win32');
      assert.equal(path.extname(executable).toLowerCase(), '.exe');
      report.artifact = { bytes: (await fs.stat(executable)).size, sha256: await hashFile(executable) };
      assert(report.artifact.bytes > 0);
      const files = await inventory(expectedSiteDir);
      assert(files.some(file => file.path === 'index.html'));
      assert(files.some(file => file.path === 'assets/loading/entry-transition.html'));
      assert(files.filter(file => /\.mp4$/i.test(file.path)).length >= theaterActions.length + 2);
      const published = new Map(files.map(file => [file.path, file]));
      const sourcePublic = await inventory(path.join(project, 'source/public'));
      for (const file of sourcePublic) {
        const actual = published.get(file.path);
        assert(actual, 'Public runtime asset omitted from delivery: ' + file.path);
        // Publish-only H.264/AAC conversion deliberately changes some MP4 bytes.
        if (!/\.mp4$/i.test(file.path)) assert.deepEqual(actual, file, 'Changed or missing public asset: ' + file.path);
      }
      report.publicAssets = { fileCount: sourcePublic.length, nonVideoBytesMatchSource: true };
      report.expectedFiles = files; return files;
    });
    await step('launch-bundled-executable-with-system-only-path', async () => {
      const statusFile = path.join(runDir, 'private-status.json');
      const env = { ...process.env, PATH: system, Path: system, TEMP: path.join(runDir, 'temp'), TMP: path.join(runDir, 'temp') };
      delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
      await fs.mkdir(env.TEMP);
      child = spawn(executable, ['--inspect-ui', '--offline', '--port=0', '--status-file=' + statusFile,
        '--data-dir=' + path.join(runDir, 'profiles')], { env, cwd: path.dirname(executable), windowsHide: false, stdio: ['ignore', 'pipe', 'pipe'] });
      const output = { stdout: '', stderr: '' };
      child.stdout.on('data', chunk => { output.stdout = (output.stdout + chunk).slice(-30_000); });
      child.stderr.on('data', chunk => { output.stderr = (output.stderr + chunk).slice(-30_000); });
      child.once('exit', (code, signal) => { exitResult = { code, signal }; });
      let spawnError;
      child.once('error', error => { spawnError = error; });
      status = await poll(async () => {
        if (spawnError) return { state: 'error', message: spawnError.message };
        try {
          const data = await readJson(statusFile);
          return ['ready', 'error'].includes(data.state) ? data : false;
        } catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return false; throw error; }
      }, 180_000, 'EXE did not become ready');
      assert.equal(status.state, 'ready', status.message || 'EXE startup failed');
      assert.equal(status.runtime.bundled, true);
      assert.equal(status.runtime.arch, 'x64');
      assert.equal(status.runtime.platform, 'win32');
      assert.equal(status.runtime.sandbox, true);
      assert.equal(status.runtime.contextIsolation, true);
      assert.equal(status.runtime.nodeIntegration, false);
      assert.equal(new URL(status.origin).hostname, '127.0.0.1');
      assert(Number.isInteger(status.debugPort) && status.debugPort > 0);
      ownedMain = await processInfo(status.pid);
      assert(ownedMain, 'Electron main process absent');
      assert.equal(path.resolve(ownedMain.ExecutablePath).toLowerCase(), path.resolve(status.runtime.executablePath).toLowerCase());
      report.runtime = { ...status.runtime, pid: status.pid, origin: status.origin, debugPort: status.debugPort };
      report.launch = { wrapperPid: child.pid, main: ownedMain, childPath: system, output };
      // The status file is private acceptance data and contains a shutdown token.
      return { wrapperPid: child.pid, mainPid: status.pid, origin: status.origin, runtime: status.runtime };
    });
    await step('complete-runtime-site-and-http-byte-verification', async () => {
      const root = path.dirname(status.runtime.executablePath);
      const runtime = await readJson(path.join(root, 'resources/runtime-manifest.json'));
      const siteManifest = await readJson(path.join(root, 'resources/site.manifest.json'));
      assert.equal(runtime.electron, status.runtime.electron);
      assert.equal(runtime.files.length, status.runtime.verifiedRuntimeFiles);
      assert.equal(siteManifest.buildId, status.buildId);
      assert.equal(siteManifest.files.length, status.fileCount);
      assert.deepEqual(sorted(siteManifest.files), sorted(expected));
      assert.deepEqual(await inventory(status.siteRoot), sorted(expected));
      const physical = (await inventory(root)).filter(file => file.path !== 'resources/runtime-manifest.json');
      assert.deepEqual(physical, sorted(runtime.files));
      for (const item of ['ffmpeg.dll', 'icudtl.dat', 'resources.pak', 'v8_context_snapshot.bin', 'vk_swiftshader.dll',
        'vk_swiftshader_icd.json', 'vulkan-1.dll', 'LICENSE.electron.txt', 'LICENSES.chromium.html'])
        assert(runtime.files.some(file => file.path === item), 'Missing bundled runtime: ' + item);
      const published = await request(status.origin + '/_portable/manifest', { keepBody: true });
      assert.equal(published.status, 200);
      assert.deepEqual(JSON.parse(published.body.toString('utf8')), siteManifest);
      const ranges = [];
      for (const file of expected) {
        const url = status.origin + encodedPath(file.path);
        const actual = await request(url);
        assert.equal(actual.status, 200, file.path);
        assert.equal(actual.bytes, file.bytes, file.path);
        assert.equal(actual.sha256, file.sha256, file.path);
        if (/\.mp4$/i.test(file.path)) {
          const end = Math.min(4095, file.bytes - 1);
          const response = await request(url, { headers: { Range: 'bytes=0-' + end }, keepBody: true });
          assert.equal(response.status, 206);
          assert.equal(response.headers['content-range'], `bytes 0-${end}/${file.bytes}`);
          const handle = await fs.open(path.join(expectedSiteDir, file.path));
          try { const bytes = Buffer.alloc(end + 1); await handle.read(bytes, 0, bytes.length, 0); assert.deepEqual(response.body, bytes); }
          finally { await handle.close(); }
          ranges.push({ path: file.path, bytes: response.bytes, contentRange: response.headers['content-range'] });
        }
      }
      return { runtimeFiles: runtime.files.length, siteFiles: expected.length, allSha256Matched: true, videoRanges: ranges };
    });
    await step('attach-real-electron-window-and-observe', async () => {
      browser = await chromium.connectOverCDP('http://127.0.0.1:' + status.debugPort, { timeout: 45_000 });
      const context = browser.contexts()[0];
      page = await poll(() => context.pages().find(candidate => candidate.url().startsWith(status.origin + '/')), 15_000);
      page.setDefaultTimeout(30_000); page.setDefaultNavigationTimeout(90_000);
      await page.bringToFront();
      const session = await browser.newBrowserCDPSession();
      const processes = await session.send('SystemInfo.getProcessInfo');
      assert(processes.processInfo.some(item => item.type === 'browser' && item.id === status.pid));
      const version = await session.send('Browser.getVersion');
      assert(version.product.endsWith('/' + status.runtime.chrome));
      report.browserVersion = version;
      const observedPages = new WeakSet();
      const observePage = candidate => {
        if (observedPages.has(candidate)) return; observedPages.add(candidate);
        candidate.on('pageerror', error => report.pageErrors.push({ message: error.message, stack: error.stack }));
        candidate.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ text: message.text(), location: message.location() }); });
      };
      context.pages().forEach(observePage); context.on('page', observePage);
      context.on('request', req => {
        if (/^https?:/.test(req.url()) && new URL(req.url()).origin !== status.origin && !req.url().includes('/delivery-offline-probe-'))
          report.outsideRequests.push({ url: req.url(), type: req.resourceType() });
      });
      context.on('response', res => { if (res.url().startsWith(status.origin + '/') && res.status() >= 400) report.httpFailures.push({ url: res.url(), status: res.status() }); });
      context.on('requestfailed', req => {
        if (req.url().startsWith(status.origin + '/')) report.requestFailures.push({ url: req.url(), type: req.resourceType(), error: req.failure()?.errorText,
          expectedCancellation: req.failure()?.errorText === 'net::ERR_ABORTED' && (req.resourceType() === 'media' || /\/assets\/(models|environments)\//.test(req.url())) });
      });
      await page.addInitScript(() => {
        if (window !== top) return;
        sessionStorage.clear();
        window.__deliveryEvents = [];
        const log = value => { if (window.__deliveryEvents.length < 5000) window.__deliveryEvents.push({ at: performance.now(), ...value }); };
        let phase;
        new MutationObserver(() => {
          const value = document.querySelector('#entryTransitionFrame') ? 'animation' : document.querySelector('#introVideo') ? 'intro' : document.querySelector('#entryLionVideo') ? 'home' : null;
          if (value && value !== phase) { phase = value; log({ type: 'phase', phase }); }
        }).observe(document, { childList: true, subtree: true });
        addEventListener('message', event => {
          if (event.origin === location.origin && event.source === document.querySelector('#entryTransitionFrame')?.contentWindow && event.data?.type === 'nanfeng-entry-transition-complete') log({ type: 'animation-complete' });
        });
        const previous = new WeakMap();
        for (const type of ['playing', 'timeupdate', 'ended', 'error']) document.addEventListener(type, event => {
          const video = event.target; if (!(video instanceof HTMLVideoElement)) return;
          const last = previous.get(video);
          log({ type, id: video.id, actionId: video.dataset.actionId, time: video.currentTime, duration: video.duration,
            width: video.videoWidth, height: video.videoHeight, frames: video.getVideoPlaybackQuality?.().totalVideoFrames || 0,
            wrapped: Boolean(last > video.duration - 1 && video.currentTime < 1), error: video.error?.message });
          previous.set(video, video.currentTime);
        }, true);
      });
      return { actualElectronPid: status.pid, existingPage: page.url(), connectedToBundledWindow: true };
    });
    await step('natural-animation-intro-and-home-loop-sequence', async () => {
      await page.goto(status.origin + '/');
      await expect(page.locator('#entryTransitionFrame')).toBeVisible({ timeout: 60_000 });
      const security = await page.evaluate(() => ({ ua: navigator.userAgent, require: typeof window.require, process: typeof window.process, module: typeof window.module }));
      assert(security.ua.includes('Electron/' + status.runtime.electron));
      assert.equal(security.require, 'undefined'); assert.equal(security.process, 'undefined'); assert.equal(security.module, 'undefined');
      await shot('01-entry-animation');
      await expect(page.locator('#introVideo')).toBeVisible({ timeout: 45_000 });
      await videoProgress(page.locator('#introVideo'));
      await shot('02-intro-video');
      await page.waitForFunction(() => window.__deliveryEvents.some(event => event.id === 'introVideo' && event.type === 'ended'), null, { timeout: 60_000 });
      await expect(page.locator('#entryTransitionFrame, #introVideo')).toHaveCount(0);
      const homeProgress = await videoProgress(page.locator('#entryLionVideo'));
      assert.equal(homeProgress.after.loop, true);
      await page.waitForFunction(() => window.__deliveryEvents.some(event => event.id === 'entryLionVideo' && event.wrapped), null, { timeout: 60_000 });
      const events = await page.evaluate(() => window.__deliveryEvents);
      const animation = events.find(item => item.type === 'phase' && item.phase === 'animation');
      const complete = events.find(item => item.type === 'animation-complete');
      const intro = events.find(item => item.type === 'phase' && item.phase === 'intro');
      const ended = events.find(item => item.type === 'ended' && item.id === 'introVideo');
      const home = events.find(item => item.type === 'phase' && item.phase === 'home' && item.at >= ended?.at);
      assert(animation && complete && intro && ended && home, 'Missing observed natural entry phases');
      assert(animation.at <= complete.at && complete.at <= intro.at && intro.at < ended.at && ended.at <= home.at);
      assert(ended.frames > 1 && ended.width > 0 && ended.height > 0);
      assert(!events.some(item => item.type === 'playing' && item.id === 'introVideo' && item.at < complete.at), 'Intro played before the animation completed');
      assert(!events.some(item => item.type === 'playing' && item.id === 'entryLionVideo' && item.at < ended.at), 'Home loop played before the intro ended');
      report.mediaEvents = events;
      await shot('03-home-loop');
      return { security, phases: { animation, complete, intro, ended, home }, homeProgress };
    });
    await step('seven-book-pages-render-and-switch', async () => {
      await page.bringToFront();
      await page.locator('#homeLionBook').scrollIntoViewIfNeeded();
      // Match the existing paper regressions: allow the host and opaque iframe
      // compositor to publish the new exposure before sending a timeline input.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const book = page.locator('.lion-book-experience');
      await expect(book).toHaveAttribute('data-book-ready', 'true', { timeout: 60_000 });
      await expect(book).toHaveAttribute('data-book-error', 'false');
      await expect(book.locator('.lion-book-timeline button')).toHaveCount(lionBookPages.length);
      const results = [];
      for (const [index, data] of lionBookPages.entries()) {
        const clickedAt = Date.now();
        await book.locator(`[data-book-page="${data.id}"]`).click();
        // The standalone expect API does not inherit playwright.config.js's
        // 15-second budget. Normal paper turns use an RAF-driven spring whose
        // wall time depends on compositing, not the 8-second reading interval.
        await expect(book).toHaveAttribute('data-book-index', String(index), { timeout: 15_000 });
        await expect(book).toHaveAttribute('data-book-turning', 'false', { timeout: 15_000 });
        await expect(book.locator('.lion-book-reading h3')).toHaveText(data.title);
        const image = page.frameLocator('#homeLionBook iframe').locator('#sbBook>.sb-full img');
        await expect(image).toHaveAttribute('src', new RegExp('/' + data.file.replaceAll('.', '\\.') + '$'));
        await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
        results.push({ id: data.id, index, commitLatencyMs: Date.now() - clickedAt, image: await image.getAttribute('src') });
      }
      await shot('04-seven-book-pages'); return results;
    });
    const route = async name => {
      await page.locator(`.site-header [data-route="${name}"]`).click();
      await expect(page.locator('#react-app')).toHaveAttribute('data-route', name);
    };
    await step('structure-real-model-webgl-and-hair', async () => {
      await route('model');
      await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 120_000 });
      const canvas = page.locator('#sceneContainer canvas');
      await expect(canvas).toHaveCount(1);
      await expect.poll(() => canvas.evaluate(node => Number(node.dataset.fullHairDrawnGroups)), { timeout: 90_000 }).toBeGreaterThan(0);
      const result = await webglState(canvas);
      const hair = await readJson(path.join(expectedSiteDir, 'assets/models/lion-user-hair.json'));
      assert.equal(Number(result.dataset.fullHairGroups), hair.groups.length);
      assert.equal(Number(result.dataset.fullHairStrands), hair.groups.reduce((sum, item) => sum + item.strands, 0));
      assert(Number(result.dataset.fullHairDrawnStrands) > 0);
      await shot('05-structure-model'); return result;
    });
    await step('all-eight-expression-states-decode', async () => {
      await route('state');
      const menu = page.getByRole('navigation', { name: '醒狮八态', exact: true });
      await expect(menu.getByRole('button')).toHaveCount(lionExpressions.length);
      const results = [];
      for (const item of lionExpressions) {
        await menu.getByRole('button', { name: item.name, exact: true }).click();
        await expect(page.locator('#chapterStage')).toHaveAttribute('data-expression', item.name);
        await expect(page.locator('#expressionStateTitle')).toHaveText(item.name);
        const image = page.locator('#expressionLion');
        await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
        results.push({ name: item.name, src: await image.getAttribute('src') });
      }
      await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-motion', 'idle', { timeout: 15_000 });
      await expect(page.locator('[data-expression-ghost]')).toHaveCount(0);
      await expect.poll(() => page.locator('#chapterStage').evaluate(stage => {
        const moving = stage.getAnimations({ subtree: true }).filter(animation =>
          animation.effect?.getTiming().iterations !== Infinity && (animation.playState === 'running' || animation.pending));
        const current = stage.querySelector('.expression-lion-layer.is-current');
        const previous = stage.querySelector('.expression-lion-layer.is-leaving');
        const revealed = [...stage.querySelectorAll('[data-expression-reveal]')];
        return moving.length === 0 && current && Number(getComputedStyle(current).opacity) === 1
          && (!previous || Number(getComputedStyle(previous).opacity) === 0)
          && revealed.length > 0 && revealed.every(node => Number(getComputedStyle(node).opacity) === 1);
      }), { timeout: 15_000, message: 'Wait for the actual lion transition and all explanation reveals to finish' }).toBe(true);
      await shot('06-expression-eight-states'); return results;
    });
    await step('four-action-videos-play-and-real-scene-switches', async () => {
      await route('action');
      const canvas = page.locator('#theaterSceneContainer canvas');
      await expect(canvas).toHaveAttribute('data-scene-ready', 'true', { timeout: 120_000 });
      await expect.poll(() => canvas.evaluate(node => Number(node.dataset.renderedFrames)), { timeout: 60_000 }).toBeGreaterThan(0);
      const play = page.getByRole('button', { name: '播放动作视频', exact: true });
      if (await play.isVisible()) await play.click();
      const results = [];
      for (const item of theaterActions) {
        await page.locator(`button[data-action-id="${item.id}"]`).click();
        await expect(canvas).toHaveAttribute('data-active-screen', item.id);
        await expect(canvas).toHaveAttribute('data-camera-state', 'idle');
        await expect(page.locator(`button[data-action-id="${item.id}"]`)).toHaveAttribute('aria-pressed', 'true');
        const progress = await videoProgress(page.locator(`video[data-action-id="${item.id}"]`));
        results.push({ id: item.id, progress });
      }
      await expect(canvas).toHaveAttribute('data-drum-state', 'ready', { timeout: 60_000 });
      const scene = await webglState(canvas);
      assert(Number(scene.dataset.fullHairGroups) > 0);
      assert.equal(scene.dataset.drumState, 'ready');
      assert.equal(Number(scene.dataset.drumCount), 4);
      await shot('07-action-four-videos'); return { videos: results, scene };
    });
    await step('native-offline-policy-blocks-outside-origin', async () => {
      const leaks = [];
      const listener = http.createServer((req, res) => { leaks.push(req.url); res.end('unexpected external-origin request'); });
      await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
      try {
        const urls = [`http://127.0.0.1:${listener.address().port}/delivery-offline-probe-${randomUUID()}`, `https://example.invalid/delivery-offline-probe-${randomUUID()}`];
        const failures = [];
        const record = req => { if (urls.includes(req.url())) failures.push({ url: req.url(), error: req.failure()?.errorText }); };
        page.context().on('requestfailed', record);
        let results;
        try {
          results = await page.evaluate(async urls => Promise.all(urls.map(async url => {
            try { const response = await fetch(url, { mode: 'no-cors', signal: AbortSignal.timeout(10_000) }); return { url, resolved: true, status: response.status }; }
            catch (error) { return { url, resolved: false, error: error.message }; }
          })), urls);
          await poll(() => failures.length === urls.length, 15_000);
        } finally { page.context().off('requestfailed', record); }
        assert(results.every(item => item.resolved === false));
        assert(failures.every(item => /ERR_BLOCKED_BY_CLIENT|ERR_ACCESS_DENIED/.test(item.error)), JSON.stringify(failures));
        assert.deepEqual(leaks, []); return { results, failures, actualLeaks: leaks };
      } finally { await new Promise(resolve => listener.close(resolve)); }
    });
    await step('no-page-http-or-external-resource-errors', async () => {
      report.mediaEvents = await page.evaluate(() => window.__deliveryEvents);
      assert.deepEqual(report.pageErrors, []);
      assert.deepEqual(report.httpFailures, []);
      assert.deepEqual(report.outsideRequests, []);
      assert.deepEqual(report.requestFailures.filter(item => !item.expectedCancellation), []);
      const errors = report.consoleErrors.filter(item => !item.location.url?.includes('/delivery-offline-probe-'));
      assert.deepEqual(errors, []);
      return { pageErrors: 0, httpFailures: 0, outsideRequests: 0, unexpectedRequestFailures: 0,
        expectedNavigationCancellations: report.requestFailures.filter(item => item.expectedCancellation).length };
    });
    await step('token-shutdown-releases-wrapper-main-and-ports', async () => {
      const response = await request(status.origin + '/_portable/shutdown?token=' + status.shutdownToken, { method: 'POST' });
      assert.equal(response.status, 200); shutdownRequested = true;
      await poll(() => Boolean(exitResult), 45_000, 'Portable wrapper did not exit');
      assert.equal(exitResult.code, 0);
      await poll(async () => !(await processInfo(status.pid)), 30_000, 'Electron main process did not exit');
      assert.equal(await listening(status.origin), false);
      assert.equal(await listening('http://127.0.0.1:' + status.debugPort), false);
      return { wrapper: exitResult, mainExited: true, httpClosed: true, cdpClosed: true };
    });
    report.verdict = 'PASS';
  } catch (error) {
    report.failure = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    if (status?.origin && !shutdownRequested) {
      try { await request(status.origin + '/_portable/shutdown?token=' + status.shutdownToken, { method: 'POST' }); shutdownRequested = true; } catch {}
    }
    if (child && !exitResult) {
      try { await poll(() => Boolean(exitResult), 15_000); }
      catch { await execute(path.join(system, 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }).catch(() => {}); }
    }
    if (ownedMain) {
      try {
        const current = await processInfo(ownedMain.ProcessId);
        if (current?.ExecutablePath === ownedMain.ExecutablePath)
          await execute(path.join(system, 'taskkill.exe'), ['/PID', String(ownedMain.ProcessId), '/T', '/F'], { windowsHide: true });
      } catch {}
    }
    try { await browser?.close(); } catch {}
    report.finishedAt = new Date().toISOString();
    await save();
    console.log(report.verdict + ' ' + path.join(runDir, 'validation.json'));
  }
}

async function videoProgress(video) {
  await expect.poll(() => video.evaluate(node => !node.paused && node.readyState >= 2 && node.videoWidth > 0 && node.videoHeight > 0), { timeout: 60_000 }).toBe(true);
  const sample = () => video.evaluate(node => ({ time: node.currentTime, duration: node.duration, paused: node.paused, loop: node.loop,
    width: node.videoWidth, height: node.videoHeight, frames: node.getVideoPlaybackQuality?.().totalVideoFrames || 0, error: node.error?.message }));
  const before = await sample();
  let after;
  await expect.poll(async () => {
    after = await sample();
    return !after.paused && !after.error && after.frames > before.frames && (after.time > before.time + 0.15 || (after.loop && after.time < before.time));
  }, { timeout: 30_000 }).toBe(true);
  return { before, after };
}
async function webglState(canvas) {
  const result = await canvas.evaluate(node => {
    const gl = node.getContext('webgl2') || node.getContext('webgl');
    return { available: Boolean(gl), contextLost: gl?.isContextLost(), width: node.width, height: node.height,
      version: gl?.getParameter(gl.VERSION), dataset: { ...node.dataset } };
  });
  assert(result.available && !result.contextLost && result.width > 0 && result.height > 0);
  return result;
}
