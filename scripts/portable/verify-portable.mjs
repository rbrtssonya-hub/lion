#!/usr/bin/env node
// Run from the existing project (Node + @playwright/test are verifier tools only):
// node scripts/portable/verify-portable.mjs <exePath> <expectedDistDir> <reviewOutputDir>
// Does not build, start Vite, install browsers, or modify the application.
// Each run owns a new directory. Evidence/caches are retained for review.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createReadStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const usage = 'node scripts/portable/verify-portable.mjs <exePath> <expectedDistDir> <reviewOutputDir>';
if (process.argv.length !== 5) {
  console.error(`Usage: ${usage}`);
  process.exitCode = 2;
} else {
  await main(...process.argv.slice(2).map(value => path.resolve(value)));
}

async function main(exePath, expectedDistDir, reviewOutputDir) {
  const report = {
    schemaVersion: 1, verdict: 'RED', startedAt: new Date().toISOString(),
    inputs: { exePath, expectedDistDir, reviewOutputDir },
    environment: { platform: process.platform, node: process.version },
    checks: [], screenshots: [], processes: [], browsers: [],
    coverage: { preflight: false, isolatedLaunch: false, manifest: false, httpFiles: false,
      httpProtocol: false, loopbackBinding: false, portConflict: false, browsers: false, shutdown: false },
  };
  const live = [];
  let runDir;
  let interrupted = false;
  const interrupt = () => { interrupted = true; for (const run of live) if (alive(run)) run.child.kill(); };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  const check = async (name, fn, { page, required = true } = {}) => {
    const entry = { name, required, status: 'running', startedAt: new Date().toISOString() };
    report.checks.push(entry);
    const start = Date.now();
    try {
      assert(!interrupted, 'Verifier interrupted');
      entry.evidence = await fn();
      entry.status = 'passed';
      console.log(`PASS ${name}`);
      return entry.evidence ?? true;
    } catch (error) {
      entry.status = 'failed';
      entry.error = { message: error.message, stack: error.stack };
      console.error(`RED ${name}: ${error.message}`);
      if (page && !page.isClosed()) {
        try { entry.screenshot = await screenshot(page, `${name}-failure`); }
        catch (captureError) { entry.screenshotError = captureError.message; }
      }
      return null;
    } finally { entry.durationMs = Date.now() - start; }
  };
  const screenshot = async (page, name) => {
    const file = path.join(runDir, `${String(report.screenshots.length + 1).padStart(2, '0')}-${name.replace(/[^\p{L}\p{N}._-]+/gu, '-')}.png`);
    const settled = await settleScreenshot(page);
    await page.screenshot({ path: file, timeout: 20_000 });
    report.screenshots.push({ name, path: file, url: page.url(), settled });
    return file;
  };

  try {
    await fs.mkdir(reviewOutputDir, { recursive: true });
    runDir = await fs.mkdtemp(path.join(reviewOutputDir, '便携验收 '));
    report.runDir = runDir;
    // Deliberately before any Playwright or project import: missing artifacts are
    // an expected RED with a report, never hidden by dependency resolution errors.
    const exe = await check('preflight/exe-exists', async () => {
      let info;
      try { info = await fs.stat(exePath); }
      catch (error) { throw new Error(`Expected RED: EXE artifact does not exist: ${exePath} (${error.code})`); }
      assert(info.isFile() && info.size > 0, 'EXE must be a nonempty file');
      assert.equal(path.extname(exePath).toLowerCase(), '.exe', 'Expected an .exe artifact');
      return { bytes: info.size, sha256: await hashFile(exePath) };
    });
    if (!exe) return;
    const expected = await check('preflight/expected-dist', async () => {
      assert.equal(process.platform, 'win32', 'Real portable EXE verification requires Windows');
      const files = await inventory(expectedDistDir);
      assert(files.some(file => file.path === 'index.html'), 'expectedDistDir must contain index.html');
      return files;
    });
    if (!expected) return;
    report.coverage.preflight = true;

    const exeDir = path.join(runDir, '只有 EXE 中文路径');
    await fs.mkdir(exeDir);
    const copiedExe = path.join(exeDir, path.basename(exePath));
    await fs.copyFile(exePath, copiedExe, fs.constants.COPYFILE_EXCL);
    const launch = async (label, port = 0) => {
      const ownedDir = await fs.mkdtemp(path.join(runDir, `${label} cache `));
      const dataDir = path.join(ownedDir, 'data');
      await fs.mkdir(dataDir);
      const statusFile = path.join(ownedDir, 'status.json');
      const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'path'));
      env.PATH = String.raw`C:\Windows\System32`;
      const args = ['--serve-only', `--port=${port}`, `--status-file=${statusFile}`, `--data-dir=${dataDir}`];
      const child = spawn(copiedExe, args, { cwd: exeDir, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      const evidence = { label, executable: copiedExe, args, cwd: exeDir, childPath: env.PATH,
        pid: child.pid, statusFile, dataDir, stdout: '', stderr: '' };
      report.processes.push(evidence);
      const run = { child, evidence, dataDir, statusFile, status: null, ended: false };
      live.push(run);
      child.stdout.on('data', chunk => { evidence.stdout = (evidence.stdout + chunk).slice(-64_000); });
      child.stderr.on('data', chunk => { evidence.stderr = (evidence.stderr + chunk).slice(-64_000); });
      child.on('error', error => { run.error = error; evidence.spawnError = error.message; });
      child.on('exit', (code, signal) => { run.ended = true; evidence.exitCode = code; evidence.signal = signal; });
      const deadline = Date.now() + 60_000;
      let lastState = 'no status file';
      while (Date.now() < deadline) {
        assert(!interrupted, 'Verifier interrupted');
        assert(!run.error, `EXE spawn failed: ${run.error?.message}`);
        assert(alive(run), `EXE ended before readiness: ${JSON.stringify(evidence)}`);
        try {
          const parsed = JSON.parse((await fs.readFile(statusFile, 'utf8')).replace(/^\uFEFF/, ''));
          run.status = parsed;
          lastState = parsed.state;
          if (parsed.state === 'ready') break;
          assert(!['error', 'failed'].includes(parsed.state), `Launcher status failure: ${JSON.stringify(parsed)}`);
        } catch (error) {
          if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
        }
        await delay(100);
      }
      assert.equal(run.status?.state, 'ready', `Readiness timeout; last state: ${lastState}`);
      assert(alive(run), 'EXE exited immediately after ready');
      const { shutdownToken, ...publicStatus } = run.status;
      evidence.status = publicStatus;
      const origin = new URL(run.status.origin);
      assert.equal(origin.protocol, 'http:');
      assert.equal(origin.hostname, '127.0.0.1');
      assert(Number(origin.port) > 0 && Number(origin.port) <= 65535, 'Status must expose its assigned port');
      assert.equal(origin.origin, run.status.origin, 'origin must contain only scheme, IPv4 loopback and port');
      assert.equal(run.status.pid, child.pid, 'Status PID must be the directly spawned native EXE');
      assert.equal(typeof shutdownToken, 'string');
      assert(shutdownToken.length > 0, 'Missing shutdown token');
      assert.equal(typeof run.status.buildId, 'string');
      assert(run.status.buildId.length > 0, 'Missing build ID');
      assert(Number.isInteger(run.status.fileCount), 'fileCount must be an integer');
      const realData = await fs.realpath(dataDir);
      const realSite = await fs.realpath(run.status.siteRoot);
      assert(inside(realData, realSite), `siteRoot escaped the uniquely owned data directory: ${realSite}`);
      return run;
    };
    const run = await check('runtime/isolated-exe-launch', async () => {
      assert.deepEqual(await fs.readdir(exeDir), [path.basename(copiedExe)], 'Review launch directory must contain ONLY the copied EXE');
      assert.equal(await hashFile(copiedExe), exe.sha256);
      const started = await launch('primary');
      report.coverage.isolatedLaunch = true;
      return started;
    });
    // Avoid serializing ChildProcess objects in the structured report.
    const launchCheck = report.checks.at(-1);
    if (run) launchCheck.evidence = run.evidence;
    if (!run) return;
    const origin = run.status.origin;

    await check('runtime/extracted-files-exact', async () => {
      const actual = await inventory(run.status.siteRoot);
      assert.deepEqual(actual, expected, 'Extracted siteRoot must contain exactly all expected dist files and bytes');
      assert.equal(run.status.fileCount, expected.length);
      return { fileCount: actual.length, bytes: actual.reduce((sum, file) => sum + file.bytes, 0) };
    });
    await check('runtime/manifest-exact', async () => {
      const manifest = await getJson(origin, '/_portable/manifest');
      assert.equal(manifest.buildId, run.status.buildId);
      assert.equal(typeof manifest.revision, 'string');
      assert(manifest.revision.trim(), 'Manifest revision is required');
      assert(Array.isArray(manifest.files), 'Manifest files must be an array');
      const files = manifest.files.map(file => {
        assert.equal(typeof file.path, 'string');
        assert(!file.path.includes('\\') && !file.path.startsWith('/') && !file.path.split('/').some(part => ['.', '..', ''].includes(part)), `Noncanonical manifest path: ${file.path}`);
        assert(Number.isInteger(file.bytes) && file.bytes >= 0, `Invalid size: ${file.path}`);
        assert.match(file.sha256, /^[a-f\d]{64}$/i);
        return { path: file.path, bytes: file.bytes, sha256: file.sha256.toLowerCase() };
      }).sort(byPath);
      assert.equal(new Set(files.map(file => file.path)).size, files.length, 'Duplicate manifest entries');
      assert.deepEqual(files, expected, 'Manifest must equal ALL expected dist files (no omissions or extras)');
      report.manifest = { ...manifest, files };
      report.coverage.manifest = true;
      return { buildId: manifest.buildId, revision: manifest.revision, fileCount: files.length };
    });
    await check('http/status-redacts-private-fields', async () => {
      const status = await getJson(origin, '/_portable/status');
      assert.deepEqual(Object.keys(status).sort(), ['buildId', 'fileCount', 'state']);
      assert.deepEqual(status, { state: 'ready', buildId: run.status.buildId, fileCount: expected.length });
      return status;
    });
    const httpFiles = [];
    report.httpFiles = httpFiles;
    await check('http/all-files-get-head-hash-and-mime', async () => {
      let next = 0;
      await Promise.all(Array.from({ length: Math.min(4, expected.length) }, async () => {
        while (next < expected.length) {
          const file = expected[next++];
          await check(`http/file/${file.path}`, async () => {
            const urlPath = encodedPath(file.path);
            const result = await request(origin, urlPath);
            const head = await request(origin, urlPath, { method: 'HEAD' });
            const actual = { path: file.path, status: result.status, bytes: result.bytes, sha256: result.sha256,
              contentType: result.headers['content-type'], headStatus: head.status, headBytes: head.bytes };
            httpFiles.push(actual);
            assert.equal(result.status, 200, `${file.path}: GET`);
            assert.equal(result.bytes, file.bytes, `${file.path}: HTTP size`);
            assert.equal(result.sha256, file.sha256, `${file.path}: HTTP SHA256`);
            assert.equal(Number(result.headers['content-length']), file.bytes, `${file.path}: Content-Length`);
            assert.equal(head.status, 200, `${file.path}: HEAD`);
            assert.equal(head.bytes, 0, `${file.path}: HEAD must have no body`);
            assert.equal(Number(head.headers['content-length']), file.bytes, `${file.path}: HEAD size`);
            assert.equal(head.headers['content-type'], result.headers['content-type'], `${file.path}: HEAD MIME`);
            const mime = mimeFor(file.path);
            if (mime) assert.match(result.headers['content-type'] || '', mime, `${file.path}: incorrect MIME`);
            return actual;
          });
        }
      }));
      assert.equal(httpFiles.length, expected.length);
      assert(!report.checks.some(item => item.name.startsWith('http/file/') && item.status === 'failed'), 'One or more real HTTP files failed verification');
      report.coverage.httpFiles = true;
      return { verified: httpFiles.length, totalBytes: httpFiles.reduce((sum, file) => sum + file.bytes, 0) };
    });
    await check('http/protocol-ranges-security', async () => {
      const results = [];
      const probe = async (name, fn) => { const result = await check(`http/protocol/${name}`, fn); results.push(result !== null); };
      await probe('root-get-head', async () => {
        const index = expected.find(file => file.path === 'index.html');
        const result = await request(origin, '/');
        assert.equal(result.status, 200); assert.equal(result.sha256, index.sha256);
        const head = await request(origin, '/', { method: 'HEAD' });
        assert.equal(head.status, 200); assert.equal(head.bytes, 0);
        assert.equal(Number(head.headers['content-length']), index.bytes);
        return { get: result.status, head: head.status };
      });
      const sample = expected.find(file => /\.mp4$/i.test(file.path) && file.bytes > 128);
      assert(sample, 'Expected at least one real video for byte-range verification');
      for (const [name, range, start, end] of [
        ['bounded', 'bytes=0-63', 0, 63],
        ['suffix', 'bytes=-64', sample.bytes - 64, sample.bytes - 1],
        ['open-end', `bytes=${sample.bytes - 64}-`, sample.bytes - 64, sample.bytes - 1],
      ]) await probe(`range-${name}`, async () => {
        const result = await request(origin, encodedPath(sample.path), { headers: { Range: range }, collect: true });
        assert.equal(result.status, 206);
        assert.equal(result.headers['content-range'], `bytes ${start}-${end}/${sample.bytes}`);
        assert.equal(Number(result.headers['content-length']), end - start + 1);
        assert.equal(result.headers['accept-ranges'], 'bytes');
        const handle = await fs.open(path.join(expectedDistDir, sample.path), 'r');
        try {
          const bytes = Buffer.alloc(end - start + 1);
          const read = await handle.read(bytes, 0, bytes.length, start);
          assert.equal(read.bytesRead, bytes.length); assert.deepEqual(result.body, bytes);
        } finally { await handle.close(); }
        return { range, status: result.status, bytes: result.bytes, file: sample.path };
      });
      for (const range of [`bytes=${sample.bytes}-`, 'bytes=63-1', 'bytes=not-a-range']) {
        await probe(`invalid-range-${range}`, async () => {
          const result = await request(origin, encodedPath(sample.path), { headers: { Range: range } });
          assert.equal(result.status, 416);
          assert.equal(result.headers['content-range'], `bytes */${sample.bytes}`);
          return { range, status: result.status };
        });
      }
      for (const [name, urlPath, options, codes] of [
        ['unknown-file', `/missing-${randomUUID()}.js`, {}, [404]],
        ['unknown-html', `/missing-${randomUUID()}.html`, {}, [404]],
        ['post-asset', '/index.html', { method: 'POST' }, [405]],
        ['encoded-traversal', '/%2e%2e/index.html', {}, [400, 403]],
        ['encoded-slash-traversal', '/%2e%2e%2findex.html', {}, [400, 403]],
        ['encoded-backslash-traversal', '/%2e%2e%5cindex.html', {}, [400, 403]],
        ['nested-encoded-traversal', '/assets/%2e%2e/%2e%2e/index.html', {}, [400, 403]],
        ['wrong-host', '/', { headers: { Host: 'attacker.invalid' } }, [400, 403]],
        ['shutdown-no-token', '/_portable/shutdown', { method: 'POST' }, [403]],
        ['shutdown-wrong-token', '/_portable/shutdown?token=invalid-review-token', { method: 'POST' }, [403]],
      ]) await probe(name, async () => {
        // http.request preserves the raw encoded path (URL/fetch may normalize it).
        const result = await request(origin, urlPath, options);
        assert(codes.includes(result.status), `${name}: expected ${codes.join('/')}, got ${result.status}`);
        return { path: urlPath, status: result.status };
      });
      const status = await getJson(origin, '/_portable/status');
      assert.equal(status.state, 'ready', 'Invalid shutdown tokens must leave the server alive');
      assert(results.every(Boolean), 'One or more HTTP protocol/security checks failed');
      report.coverage.httpProtocol = true;
      return { checks: results.length, rangeFile: sample.path };
    });
    await check('runtime/ipv4-loopback-binding', async () => {
      const shell = String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`;
      const port = Number(new URL(origin).port);
      const command = `@(Get-NetTCPConnection -State Listen -OwningProcess ${run.child.pid} -ErrorAction Stop | Select-Object LocalAddress,LocalPort,OwningProcess) | ConvertTo-Json -Compress`;
      const result = await promisify(execFile)(shell, ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', command], { windowsHide: true, timeout: 20_000 });
      const parsed = JSON.parse(result.stdout.replace(/^\uFEFF/, ''));
      const listeners = Array.isArray(parsed) ? parsed : [parsed];
      assert(listeners.length > 0, 'No listener owned by EXE PID');
      assert(listeners.some(item => item.LocalPort === port), 'Status port is not owned by EXE PID');
      for (const item of listeners) assert.equal(item.LocalAddress, '127.0.0.1', 'EXE must bind exclusively to IPv4 loopback');
      report.coverage.loopbackBinding = true;
      return listeners;
    });
    await check('runtime/occupied-port-falls-back', async () => {
      const blocker = net.createServer(socket => socket.destroy());
      await new Promise((resolve, reject) => { blocker.once('error', reject); blocker.listen(0, '127.0.0.1', resolve); });
      let other;
      try {
        const occupied = blocker.address().port;
        other = await launch('conflict', occupied);
        assert.notEqual(Number(new URL(other.status.origin).port), occupied, 'Must choose a free port when requested port is occupied');
        assert.notEqual(other.status.origin, origin, 'Second instance must have an independent listener');
        assert.equal(other.status.buildId, run.status.buildId);
        assert.equal((await getJson(other.status.origin, '/_portable/status')).state, 'ready');
        await stop(other);
        assert.equal((await getJson(origin, '/_portable/status')).state, 'ready', 'Stopping second instance must not stop the first');
        report.coverage.portConflict = true;
        return { occupied, fallback: other.status.origin, primary: origin };
      } finally {
        if (other && alive(other)) await stop(other);
        await new Promise(resolve => blocker.close(resolve));
      }
    });

    await check('browser/real-system-browsers', async () => {
      // Dynamic imports keep missing-EXE preflight independent of Playwright.
      const { chromium, expect } = await import('@playwright/test');
      const [{ settingsPages, selectSettingsPage, settingsPanel }, { actions, scene, stage, actionVideo, selectAction, canvasPixels }, { lionBookPages }, { lionExpressions }, { assetPaths }] = await Promise.all([
        import('../../tests/e2e/settings-navigation.helpers.js'),
        import('../../tests/e2e/action-theater.helpers.js'),
        import('../../src/data/lion-book.js'), import('../../src/data/lion-expressions.js'), import('../../src/config/assetPaths.js'),
      ]);
      const candidates = [
        { name: 'chrome', paths: [path.join(process.env.ProgramFiles || String.raw`C:\Program Files`, 'Google/Chrome/Application/chrome.exe'), path.join(process.env['ProgramFiles(x86)'] || String.raw`C:\Program Files (x86)`, 'Google/Chrome/Application/chrome.exe'), path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe')] },
        { name: 'edge', paths: [path.join(process.env['ProgramFiles(x86)'] || String.raw`C:\Program Files (x86)`, 'Microsoft/Edge/Application/msedge.exe'), path.join(process.env.ProgramFiles || String.raw`C:\Program Files`, 'Microsoft/Edge/Application/msedge.exe')] },
      ];
      let tested = 0;
      for (const candidate of candidates) {
        let executablePath;
        for (const file of candidate.paths) if (await fs.stat(file).then(info => info.isFile(), () => false)) { executablePath = file; break; }
        if (!executablePath) {
          report.browsers.push({ name: candidate.name, status: 'not-installed', searched: candidate.paths });
          continue;
        }
        tested++;
        await check(`browser/${candidate.name}`, async () => {
          const evidence = { name: candidate.name, executablePath, origin, console: [], pageErrors: [], failedLocalURLs: [], blockedNetwork: [], unexpectedLoopback: [], screenshots: [] };
          report.browsers.push(evidence);
          const browser = await chromium.launch({ executablePath, headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--disable-features=OverlayScrollbar'] });
          evidence.version = browser.version();
          let context;
          try {
            context = await browser.newContext({ baseURL: origin, viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
            await context.route('**/*', route => {
              const url = new URL(route.request().url());
              if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) return route.continue();
              if (!isLoopback(url.hostname)) { evidence.blockedNetwork.push(url.href); return route.abort('blockedbyclient'); }
              if (url.origin !== origin) { evidence.unexpectedLoopback.push(url.href); return route.abort('blockedbyclient'); }
              return route.continue();
            });
            if (context.routeWebSocket) await context.routeWebSocket('**/*', socket => { evidence.blockedNetwork.push(socket.url()); socket.close(); });
            const page = await context.newPage();
            page.setDefaultTimeout(15_000);
            page.setDefaultNavigationTimeout(60_000);
            page.on('console', message => evidence.console.push({ type: message.type(), text: message.text(), location: message.location() }));
            page.on('pageerror', error => evidence.pageErrors.push({ message: error.message, stack: error.stack }));
            page.on('requestfailed', req => {
              if (!req.url().startsWith(origin + '/')) return;
              const error = req.failure()?.errorText || '';
              // Chromium cancels range streams when a video or route is disposed.
              const expectedCancellation = error === 'net::ERR_ABORTED' && req.resourceType() === 'media';
              evidence.failedLocalURLs.push({ url: req.url(), error, resourceType: req.resourceType(), expectedCancellation });
            });
            page.on('response', response => {
              if (response.url().startsWith(origin + '/') && response.status() >= 400) evidence.failedLocalURLs.push({ url: response.url(), status: response.status(), expectedCancellation: false });
            });
            await page.addInitScript(() => {
              if (window !== top) return;
              localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, pushPage: false, bookIntroDuration: 3 }));
              window.__portableMedia = [];
              const previous = new WeakMap();
              for (const type of ['loadeddata', 'timeupdate', 'ended', 'error']) document.addEventListener(type, event => {
                const video = event.target;
                if (!(video instanceof HTMLVideoElement) || !['introVideo', 'entryLionVideo'].includes(video.id)) return;
                const frames = video.getVideoPlaybackQuality?.().totalVideoFrames ?? video.webkitDecodedFrameCount ?? 0;
                const last = previous.get(video);
                window.__portableMedia.push({ type, id: video.id, time: video.currentTime, duration: video.duration, width: video.videoWidth, height: video.videoHeight, frames,
                  wrapped: Boolean(last > video.duration - 1 && video.currentTime < 1), error: video.error?.message, src: video.currentSrc });
                previous.set(video, video.currentTime);
              }, true);
            });
            const bcheck = (name, fn) => check(`browser/${candidate.name}/${name}`, fn, { page });
            const shot = async name => { const file = await screenshot(page, `${candidate.name}-${name}`); evidence.screenshots.push(file); return file; };
            const route = async name => {
              await page.locator(`.site-header [data-route="${name}"]`).click();
              await expect(page.locator('#react-app')).toHaveAttribute('data-route', name, { timeout: 30_000 });
            };
            await bcheck('startup-and-natural-hevc-intro', async () => {
              await page.goto('/');
              await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
              await page.waitForFunction(() => window.__portableMedia.some(event => event.id === 'introVideo' && event.type === 'ended' && event.frames > 1 && event.time > 1), null, { timeout: 35_000 });
              const events = await page.evaluate(() => window.__portableMedia.filter(event => event.id === 'introVideo'));
              assert(events.some(event => event.width === 2560 && event.height === 1440 && event.frames > 1));
              const source = expected.find(file => file.path.endsWith('/intro/entry-intro.mp4'));
              assert(source, 'Intro MP4 missing from expected dist');
              const codec = await hevcTag(path.join(expectedDistDir, source.path));
              await shot('homepage');
              return { codec, events };
            });
            await bcheck('home-video-decodes-and-naturally-loops', async () => {
              const video = page.locator('#entryLionVideo');
              const progress = await videoProgress(video, expect);
              assert.equal(progress.after.loop, true);
              assert.equal(progress.after.width, 2560); assert.equal(progress.after.height, 1440);
              await page.waitForFunction(() => window.__portableMedia.some(event => event.id === 'entryLionVideo' && event.wrapped), null, { timeout: 24_000 });
              const source = expected.find(file => file.path.endsWith('/entry/home-lion-loop.mp4'));
              assert(source, 'Loop MP4 missing from expected dist');
              return { codec: await hevcTag(path.join(expectedDistDir, source.path)), progress, loopEvent: await page.evaluate(() => window.__portableMedia.find(event => event.wrapped)) };
            });
            await bcheck('book-ready-all-seven-pages', async () => {
              await page.locator('#homeLionBook').scrollIntoViewIfNeeded();
              const book = page.locator('.lion-book-experience');
              await expect(book).toHaveAttribute('data-book-ready', 'true', { timeout: 45_000 });
              await expect(book).toHaveAttribute('data-book-intro', 'done', { timeout: 30_000 });
              await expect(book.locator('.lion-book-timeline button')).toHaveCount(7);
              const frame = page.frameLocator('#homeLionBook iframe');
              const pages = [];
              for (const [index, data] of lionBookPages.entries()) {
                await book.locator(`[data-book-page="${data.id}"]`).click();
                await expect(book).toHaveAttribute('data-book-index', String(index));
                await expect(book).toHaveAttribute('data-book-turning', 'false');
                await expect(book.locator('[aria-current="step"]')).toHaveAttribute('data-book-page', data.id);
                await expect(book.locator('.lion-book-reading h3')).toHaveText(data.title);
                await expect(book.locator('.lion-book-reading-copy>p')).toHaveText(data.description);
                const image = frame.locator('#sbBook>.sb-full img');
                await expect(image).toHaveAttribute('src', new RegExp(`/${data.file.replaceAll('.', '\\.')}$`));
                await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
                pages.push({ id: data.id, title: data.title, image: await image.getAttribute('src') });
              }
              await shot('book-seven-pages');
              return pages;
            });
            await bcheck('type-images-centered-and-reveal', async () => {
              const types = page.locator('#homeLionTypes');
              await types.scrollIntoViewIfNeeded();
              const tabs = types.getByRole('tab');
              await expect(tabs).toHaveCount(3);
              const results = [];
              for (let index = 0; index < 3; index++) {
                await tabs.nth(index).click();
                const button = types.locator('.heritage-type-image');
                await expect(button).toHaveAttribute('aria-expanded', 'false');
                await expect(types.locator('.heritage-copy')).toBeHidden();
                await expect.poll(() => types.locator('.heritage-figure').evaluate(el => {
                  const a = el.getBoundingClientRect(), b = el.parentElement.getBoundingClientRect();
                  return Math.abs((a.left + a.right - b.left - b.right) / 2);
                })).toBeLessThan(2);
                await expect.poll(() => button.locator('img').evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
                if (index === 0) await shot('type-centered');
                await button.click();
                await expect(button).toHaveAttribute('aria-expanded', 'true');
                await expect(types.locator('.heritage-copy')).toBeVisible();
                results.push({ tab: await tabs.nth(index).innerText(), copy: await types.locator('.heritage-copy').innerText() });
                if (index === 0) await shot('type-revealed');
                await button.press('Escape');
                await expect(button).toHaveAttribute('aria-expanded', 'false');
              }
              return results;
            });
            await bcheck('four-section-archive-rail', async () => {
              await page.evaluate(() => {
                const section = document.getElementById('homeLionBook'), header = document.querySelector('.site-header').getBoundingClientRect();
                scrollTo({ top: scrollY + section.getBoundingClientRect().top - header.bottom, behavior: 'instant' });
              });
              const rail = page.locator('.home-archive-nav');
              await expect(rail).toBeVisible();
              await expect(rail.locator('button[data-home-section]')).toHaveCount(4);
              for (const id of ['homeLionBook', 'homeCulture', 'homeLionTypes', 'homeCultureSources']) {
                const button = rail.locator(`[data-home-section="${id}"]`);
                await button.click();
                await expect(button).toHaveAttribute('aria-current', 'location');
                await expect.poll(() => page.locator(`#${id}`).evaluate(el => {
                  const box = el.getBoundingClientRect();
                  return box.top < innerHeight && box.bottom > document.querySelector('.site-header').getBoundingClientRect().bottom;
                })).toBe(true);
              }
              await shot('four-section-rail');
              return { sections: 4 };
            });
            await bcheck('settings-nine-pages-and-material-apply', async () => {
              await page.locator('.site-navigation [data-action="settings"]').click();
              const panel = settingsPanel(page);
              await expect(panel.getByRole('tablist', { name: '设置分类', exact: true }).getByRole('tab')).toHaveText(settingsPages);
              for (const name of settingsPages) { await selectSettingsPage(page, name); await expect(panel.locator('.developer-settings-page:not([hidden])')).toBeVisible(); }
              await selectSettingsPage(page, '公共模块');
              const key = 'nanfeng-lion:developer-settings:v1';
              const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
              const setNumber = async (label, value) => {
                const input = panel.getByRole('spinbutton', { name: `${label}数值`, exact: true });
                await input.fill(String(value)); await input.press('Tab');
              };
              await setNumber('公共透明度', 65);
              const untouched = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
              assert.equal(untouched.bookTitleTransparency, before.bookTitleTransparency, 'Editing template must not apply automatically');
              const prefixes = { home: ['bookTitle', 'bookDetails', 'cultureTitle', 'cultureBody'], chapters: ['modelOverlay', 'expressionOverlay', 'actionOverlay', 'videoOverlay'], sources: ['cultureSources', 'cultureSourceCard'] };
              const applications = [];
              for (const [scope, transparency] of [['home', 65], ['chapters', 80], ['sources', 55], ['all', 45]]) {
                const all = Object.values(prefixes).flat();
                const selected = scope === 'all' ? all : prefixes[scope];
                const previous = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
                const material = { Transparency: transparency, Blur: 9, Radius: 20, Color: '#e6d4b8' };
                await setNumber('公共透明度', transparency);
                await setNumber('公共模糊强度', material.Blur);
                await setNumber('公共圆角', material.Radius);
                await panel.getByLabel('公共底色', { exact: true }).fill(material.Color);
                await panel.getByRole('combobox', { name: '应用范围', exact: true }).selectOption(scope);
                await panel.getByRole('button', { name: '应用公共材质', exact: true }).click();
                const applied = Object.fromEntries(selected.flatMap(prefix => Object.entries(material).map(([suffix, value]) => [prefix + suffix, value])));
                await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).toMatchObject(applied);
                const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
                for (const prefix of all.filter(prefix => !selected.includes(prefix))) for (const suffix of Object.keys(material)) {
                  assert.deepEqual(saved[prefix + suffix], previous[prefix + suffix], `${scope} modified out-of-scope ${prefix + suffix}`);
                }
                await expect(panel.locator('.developer-settings-feedback')).toContainText(`已应用到${selected.length}处底板`);
                applications.push({ scope, surfaces: selected, material });
              }
              await expect(page.locator('[data-surface="bookTitle"]')).toHaveCSS('--surface-opacity', '0.55');
              const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
              for (const [name, value] of Object.entries(before)) if (/(Width|Height|FontSize)$/.test(name)) assert.deepEqual(after[name], value, `Material application changed ${name}`);
              await shot('settings-nine-pages-material');
              await panel.getByRole('button', { name: '恢复默认参数', exact: true }).click();
              await panel.getByRole('button', { name: '关闭开发者参数', exact: true }).click();
              return { pages: settingsPages, applications };
            });
            // Recover a settings panel left open by a failed assertion using its
            // actual close control, before exercising the chapter navigation.
            if (await page.locator('#developerSettingsPanel').isVisible()) await page.getByRole('button', { name: '关闭开发者参数', exact: true }).click();
            await bcheck('model-loaded-real-webgl', async () => {
              await route('model');
              await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 60_000 });
              const canvas = page.locator('#sceneContainer canvas');
              await expect(canvas).toHaveCount(1);
              const gl = await canvas.evaluate(el => {
                const gl = el.getContext('webgl2') || el.getContext('webgl');
                return { available: Boolean(gl), contextLost: gl?.isContextLost(), width: el.width, height: el.height, version: gl?.getParameter(gl.VERSION) };
              });
              assert(gl.available && !gl.contextLost && gl.width > 0 && gl.height > 0);
              const png = await canvas.screenshot({ omitBackground: true, style: 'html,body{background:transparent!important}body *{visibility:hidden!important}#sceneContainer,#sceneContainer canvas{visibility:visible!important}' });
              const painted = await page.evaluate(async base64 => {
                const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
                const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
                const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
                const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                let painted = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++;
                return painted;
              }, png.toString('base64'));
              assert(painted > 1000, `Model canvas has insufficient actual pixels: ${painted}`);
              await shot('model-webgl');
              return { ...gl, paintedPixels: painted };
            });
            await bcheck('expression-all-eight-synchronized', async () => {
              await route('state');
              const menu = page.getByRole('navigation', { name: '醒狮八态', exact: true });
              await expect(menu.getByRole('button')).toHaveText(['喜', '怒', '哀', '乐', '动', '静', '惊', '疑']);
              const images = [];
              for (const data of lionExpressions) {
                const button = menu.getByRole('button', { name: data.name, exact: true });
                await button.click();
                await expect(page.locator('#chapterStage')).toHaveAttribute('data-expression', data.name);
                await expect(page.locator('#expressionStateTitle')).toHaveText(data.name);
                await expect(button).toHaveAttribute('aria-pressed', 'true');
                await expect(menu.locator('[aria-pressed="true"]')).toHaveCount(1);
                const image = page.locator('#expressionLion');
                await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
                const expectedPath = new URL(assetPaths[data.imageKey], page.url()).pathname;
                await expect.poll(() => image.evaluate(el => new URL(el.currentSrc || el.src).pathname)).toBe(expectedPath);
                await expect(page.locator('.expression-badge-lion')).toHaveAttribute('src', await image.getAttribute('src'));
                await expect(page.locator('#expressionSummary')).toHaveText(data.summary);
                await page.locator('#expressionLionTrigger').click();
                await expect(page.locator('#expressionStateCopy')).toHaveAttribute('data-view', 'details');
                await expect(page.locator('#expressionEmotionCue')).toHaveText(data.emotion);
                await expect(page.locator('#expressionMotionCue')).toHaveText(data.motion);
                images.push(expectedPath);
              }
              assert.equal(images.length, 8); assert.equal(new Set(images).size, 8);
              await shot('expression-eight');
              return { states: 8, images };
            });
            let oldCanvas, oldVideos;
            await bcheck('action-four-real-videos-and-screen-controls', async () => {
              await route('action');
              await expect(scene(page)).toHaveAttribute('data-active-screen', 'tanqing', { timeout: 60_000 });
              await expect.poll(async () => Number(await scene(page).getAttribute('data-rendered-frames')), { timeout: 45_000 }).toBeGreaterThan(0);
              await expect(stage(page).locator('canvas')).toHaveCount(1);
              await expect(stage(page).locator('video[data-action-id]')).toHaveCount(4);
              oldCanvas = await scene(page).elementHandle();
              oldVideos = await stage(page).locator('video[data-action-id]').elementHandles();
              await expect.poll(async () => {
                const bindings = JSON.parse(await scene(page).getAttribute('data-video-bindings') || '{}');
                return actions.every(({ id }) => bindings[id]?.bound && bindings[id].width === 2560 && bindings[id].height === 1440);
              }, { timeout: 45_000 }).toBe(true);
              const progress = [];
              for (const { id } of actions) {
                const video = actionVideo(page, id);
                const measurement = await videoProgress(video, expect);
                assert.equal(measurement.after.width, 2560); assert.equal(measurement.after.height, 1440);
                progress.push({ id, ...measurement });
                await selectAction(page, id);
                await shot(`action-${id}`);
              }
              const pixels = await canvasPixels(page);
              assert(pixels.bright / pixels.count > .05 && pixels.colored / pixels.count > .02, 'Theater must render visible colored pixels');
              await expect.poll(() => page.locator('#entryLionVideo').evaluate(el => el.paused)).toBe(true);
              return { progress, pixels, bindings: JSON.parse(await scene(page).getAttribute('data-video-bindings')) };
            });
            await bcheck('action-route-disposes-gpu-and-media', async () => {
              assert(oldCanvas && oldVideos?.length === 4, 'No successfully created theater resources to verify cleanup');
              await route('entry');
              await expect(page.locator('#chapterStage canvas, #chapterStage video[data-action-id]')).toHaveCount(0);
              assert.equal(await oldCanvas.evaluate(el => el.isConnected), false);
              await expect.poll(() => oldCanvas.evaluate(el => (el.getContext('webgl2') || el.getContext('webgl')).isContextLost())).toBe(true);
              for (const video of oldVideos) assert.deepEqual(await video.evaluate(el => ({ connected: el.isConnected, paused: el.paused, muted: el.muted, src: el.getAttribute('src') })), { connected: false, paused: true, muted: true, src: null });
              const home = await videoProgress(page.locator('#entryLionVideo'), expect);
              await route('action');
              await expect(scene(page)).toHaveAttribute('data-active-screen', 'tanqing', { timeout: 60_000 });
              await expect(stage(page).locator('canvas')).toHaveCount(1);
              await expect(stage(page).locator('video[data-action-id]')).toHaveCount(4);
              assert.equal(await oldCanvas.evaluate(el => el === document.querySelector('#chapterStage canvas')), false);
              await route('entry');
              await expect(page.locator('#chapterStage canvas, #chapterStage video[data-action-id]')).toHaveCount(0);
              await shot('returned-home');
              return { disposedCanvas: true, disposedVideos: 4, homeResumed: home, rebuiltSingleCanvas: true };
            });
            await bcheck('no-browser-or-local-resource-errors', async () => {
              assert.deepEqual(evidence.pageErrors, [], 'Browser page errors');
              assert.deepEqual(evidence.failedLocalURLs.filter(item => !item.expectedCancellation), [], 'Failed local HTTP resources');
              assert.deepEqual(evidence.unexpectedLoopback, [], 'Application attempted to use another local server');
              assert.deepEqual(evidence.blockedNetwork, [], 'Application attempted network access outside its EXE origin');
              assert.deepEqual(evidence.console.filter(item => item.type === 'error'), [], 'Browser console errors');
              assert(alive(run), 'EXE exited during browser integration');
              return { pageErrors: 0, failedLocalResources: 0, consoleErrors: 0, blockedNetwork: 0 };
            });
            const failures = report.checks.filter(item => item.name.startsWith(`browser/${candidate.name}/`) && item.status === 'failed');
            evidence.status = failures.length ? 'failed' : 'passed';
            assert.equal(failures.length, 0, `${candidate.name}: ${failures.length} integration check(s) failed`);
            return { name: candidate.name, version: evidence.version, screenshots: evidence.screenshots };
          } finally {
            await context?.close();
            await browser.close();
          }
        });
      }
      assert(tested > 0, 'No installed system Chrome or Edge found; no bundled Chromium fallback is allowed');
      assert(!report.checks.some(item => /^browser\/(chrome|edge)$/.test(item.name) && item.status === 'failed'), 'System browser integration failed; inspect the per-step evidence');
      report.coverage.browsers = true;
      return { systemBrowsersTested: tested };
    });
    await check('runtime/authenticated-shutdown', async () => {
      const result = await stop(run);
      report.coverage.shutdown = true;
      return result;
    });
  } catch (error) {
    await check('verifier/unhandled', async () => { throw error; });
  } finally {
    for (const run of live) {
      if (alive(run)) await check(`cleanup/${run.evidence.label}`, async () => stop(run));
    }
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    const failures = report.checks.filter(item => item.status === 'failed' && item.required);
    report.finishedAt = new Date().toISOString();
    report.interrupted = interrupted;
    report.summary = { passed: report.checks.filter(item => item.status === 'passed').length, failed: failures.length,
      failureNames: failures.map(item => item.name), unverified: Object.entries(report.coverage).filter(([, value]) => !value).map(([key]) => key) };
    report.verdict = !interrupted && failures.length === 0 && report.summary.unverified.length === 0 ? 'GREEN' : 'RED';
    process.exitCode = report.verdict === 'GREEN' ? 0 : 1;
    if (runDir) {
      const reportPath = path.join(runDir, 'report.json');
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
      console.log(`${report.verdict}: ${report.summary.passed} passed, ${failures.length} failed; unverified: ${report.summary.unverified.join(', ') || 'none'}`);
      console.log(`Report: ${reportPath}`);
    } else console.error('RED: Unable to create the review output directory');
  }
}

function alive(run) { return !run.ended && !run.error && run.child.exitCode === null && run.child.signalCode === null; }
function inside(root, target) { const relative = path.relative(root, target); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); }
function byPath(a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; }
function encodedPath(file) { return '/' + file.split('/').map(encodeURIComponent).join('/'); }
function isLoopback(hostname) { return hostname === 'localhost' || hostname === '[::1]' || /^127\.\d+\.\d+\.\d+$/.test(hostname); }
async function hashFile(file) { const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex'); }
async function inventory(root) {
  assert((await fs.stat(root)).isDirectory(), `Not a directory: ${root}`);
  const files = [];
  const walk = async (directory, prefix = '') => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name), relative = prefix + entry.name;
      assert(!entry.isSymbolicLink(), `Symlink is not an exact portable runtime file: ${absolute}`);
      if (entry.isDirectory()) await walk(absolute, relative + '/');
      else { assert(entry.isFile(), `Unsupported runtime entry: ${absolute}`); files.push({ path: relative, bytes: (await fs.stat(absolute)).size, sha256: await hashFile(absolute) }); }
    }
  };
  await walk(root);
  return files.sort(byPath);
}
function mimeFor(file) {
  return ({ '.html': /^text\/html\b/i, '.css': /^text\/css\b/i, '.js': /^(text|application)\/(javascript|ecmascript)\b/i,
    '.mjs': /^(text|application)\/(javascript|ecmascript)\b/i, '.json': /^application\/json\b/i, '.png': /^image\/png\b/i,
    '.woff': /^(font\/woff|application\/(font-woff|x-font-woff))\b/i, '.woff2': /^font\/woff2\b/i,
    '.glb': /^model\/gltf-binary\b/i, '.mp4': /^video\/mp4\b/i })[path.extname(file).toLowerCase()];
}
function request(origin, rawPath, { method = 'GET', headers = {}, collect = false } = {}) {
  const url = new URL(origin);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: url.hostname, port: Number(url.port), path: rawPath, method,
      headers: { 'Accept-Encoding': 'identity', ...headers } }, response => {
      const hash = createHash('sha256'), chunks = [];
      let bytes = 0;
      response.on('data', chunk => {
        bytes += chunk.length; hash.update(chunk);
        if (collect) {
          if (bytes > 16 * 1024 * 1024) { response.destroy(new Error('Collected response exceeded 16 MiB')); return; }
          chunks.push(chunk);
        }
      });
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, bytes, sha256: hash.digest('hex'), ...(collect ? { body: Buffer.concat(chunks) } : {}) }));
    });
    req.setTimeout(60_000, () => req.destroy(new Error(`${method} ${rawPath}: HTTP timeout`)));
    req.on('error', reject);
    req.end();
  });
}
async function getJson(origin, rawPath) {
  const result = await request(origin, rawPath, { collect: true });
  assert.equal(result.status, 200, rawPath);
  assert.match(result.headers['content-type'] || '', /^application\/json\b/i);
  return JSON.parse(result.body.toString('utf8').replace(/^\uFEFF/, ''));
}
async function stop(run) {
  if (!alive(run)) throw new Error(`EXE already ended before authenticated shutdown: ${run.evidence.label}`);
  try {
    assert(run.status?.shutdownToken && run.status?.origin, 'Cannot authenticate shutdown without ready status');
    const result = await request(run.status.origin, '/_portable/shutdown?token=' + encodeURIComponent(run.status.shutdownToken), { method: 'POST' });
    assert([200, 202, 204].includes(result.status), `Shutdown status: ${result.status}`);
    const deadline = Date.now() + 15_000;
    while (alive(run) && Date.now() < deadline) await delay(100);
    assert(!alive(run), 'EXE did not exit after authenticated shutdown');
    assert.equal(run.evidence.exitCode, 0, 'Graceful native EXE exit must return 0');
    let reachable = false;
    try { await request(run.status.origin, '/_portable/status'); reachable = true; } catch { /* Connection refusal is expected. */ }
    assert(!reachable, 'Listener remained reachable after EXE exit');
    run.evidence.shutdown = 'authenticated-and-exited';
    return { status: result.status, exitCode: run.evidence.exitCode, listenerStopped: true };
  } finally {
    if (alive(run)) { run.evidence.forcedCleanup = true; run.child.kill(); await delay(200); }
  }
}
async function videoProgress(locator, expect) {
  const snapshot = () => locator.evaluate(video => ({ time: video.currentTime, frames: video.getVideoPlaybackQuality?.().totalVideoFrames ?? video.webkitDecodedFrameCount ?? 0,
    readyState: video.readyState, width: video.videoWidth, height: video.videoHeight, paused: video.paused, loop: video.loop, duration: video.duration, src: video.currentSrc, error: video.error?.message || null }));
  await expect.poll(async () => { const value = await snapshot(); return value.readyState >= 2 && value.width > 0 && !value.paused && !value.error; }, { timeout: 35_000 }).toBe(true);
  const before = await snapshot();
  await expect.poll(async () => {
    const after = await snapshot();
    const elapsed = after.time >= before.time ? after.time - before.time : after.duration - before.time + after.time;
    return elapsed > .15 && after.frames > before.frames;
  }, { timeout: 20_000 }).toBe(true);
  return { before, after: await snapshot() };
}
async function hevcTag(file) {
  // The bytes were independently matched to the EXE's manifest and HTTP stream.
  // Actual decoder/frame progress is asserted separately in the system browser.
  const bytes = await fs.readFile(file);
  const tag = ['hvc1', 'hev1'].find(value => bytes.includes(Buffer.from(value)));
  assert(tag, `Expected HEVC sample-entry tag in ${file}`);
  return tag;
}

async function settleScreenshot(page) {
  const started = Date.now();
  // Section buttons update aria-current before smooth scrolling ends. Wait for
  // the real viewport to settle, then let finite reveal/route animations finish.
  // Infinite title/particle motion and real video playback continue naturally.
  await page.evaluate(() => new Promise((resolve, reject) => {
    let lastX = scrollX, lastY = scrollY, stableSince = performance.now(), frame;
    const timer = setTimeout(() => { cancelAnimationFrame(frame); reject(new Error('Screenshot viewport did not settle')); }, 5000);
    const sample = time => {
      if (scrollX !== lastX || scrollY !== lastY) { stableSince = time; lastX = scrollX; lastY = scrollY; }
      if (time - stableSince >= 150) { clearTimeout(timer); resolve(); }
      else frame = requestAnimationFrame(sample);
    };
    frame = requestAnimationFrame(sample);
  }));
  await page.waitForFunction(() => document.getAnimations().every(animation => {
    const target = animation.effect?.target;
    return animation.playState !== 'running' || !target?.getClientRects().length ||
      !Number.isFinite(animation.effect.getComputedTiming().endTime);
  }), null, { timeout: 10_000, polling: 50 });
  return { waitMs: Date.now() - started, scroll: await page.evaluate(() => ({ x: scrollX, y: scrollY })), finiteAnimationsFinished: true };
}
