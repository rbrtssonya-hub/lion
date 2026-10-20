#!/usr/bin/env node
// Independent acceptance tool. Node/Playwright/PowerShell/C# are verifier tools,
// never dependencies of the packaged EXE. The native observer uses Windows APIs.
// No builder/runtime imports, installed-browser discovery, browser launch, or installs.
// Evidence and uniquely owned extracted files remain in reviewDir for review.
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

const ELECTRON = '44.9.1';
const BASELINE = '3207eda';
const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SYSTEM = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
const SHELL = path.join(SYSTEM, 'WindowsPowerShell/v1.0/powershell.exe');
const usage = 'node scripts/portable/verify-bundled.mjs <exe> <expectedSiteDir> <reviewDir>';
if (process.argv.length !== 5) {
  console.error('Usage: ' + usage);
  process.exitCode = 2;
} else {
  await main(...process.argv.slice(2).map(value => path.resolve(value)));
}

async function main(exePath, expectedSiteDir, reviewDir) {
  const report = {
    schemaVersion: 2, verifier: 'bundled-electron', verdict: 'RED', startedAt: new Date().toISOString(),
    inputs: { exePath, expectedSiteDir, reviewDir, baseline: BASELINE, expectedElectron: ELECTRON },
    environment: { platform: process.platform, arch: process.arch, verifierNode: process.version },
    checks: [], screenshots: [], processes: [], browsers: [],
    coverage: { preflight: false, isolatedLaunch: false, processOwnership: false, bundledRuntime: false,
      extractedFiles: false, manifest: false, httpFiles: false, httpProtocol: false,
      loopbackBinding: false, portConflict: false, embeddedBrowser: false,
      sharedTempInstances: false, independentProfiles: false, menuRelaunch: false,
      softwareRendering: false, noExternalBrowser: false, shutdown: false },
  };
  const live = [];
  let runDir, monitor, interrupted = false;
  const interrupt = () => { interrupted = true; }; // Cleanup validates ownership before terminating anything.
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  const check = async (name, fn, { page } = {}) => {
    const entry = { name, required: true, status: 'running', startedAt: new Date().toISOString() };
    report.checks.push(entry);
    const started = Date.now();
    try {
      assert(!interrupted, 'Verifier interrupted');
      entry.evidence = await fn();
      entry.status = 'passed';
      console.log('PASS ' + name);
      return entry.evidence ?? true;
    } catch (error) {
      entry.status = 'failed';
      entry.error = { message: error.message, stack: error.stack };
      console.error('RED ' + name + ': ' + error.message);
      if (page && !page.isClosed()) {
        try { entry.screenshot = await screenshot(page, name + '-failure', false); }
        catch (captureError) { entry.screenshotError = captureError.message; }
      }
      return null;
    } finally { entry.durationMs = Date.now() - started; }
  };
  const screenshot = async (page, name, settle = true) => {
    const file = path.join(runDir, String(report.screenshots.length + 1).padStart(2, '0') + '-' + name.replace(/[^\p{L}\p{N}._-]+/gu, '-') + '.png');
    const settled = settle ? await settleScreenshot(page) : { skippedForFailure: true };
    await page.screenshot({ path: file, timeout: 20_000 });
    report.screenshots.push({ name, path: file, url: page.url(), settled, sha256: await hashFile(file) });
    return file;
  };

  try {
    assert(!inside(expectedSiteDir, reviewDir) && !inside(reviewDir, expectedSiteDir),
      'reviewDir and expectedSiteDir must not contain each other');
    await fs.mkdir(reviewDir, { recursive: true });
    runDir = await fs.mkdtemp(path.join(reviewDir, '内置浏览器验收 '));
    report.runDir = runDir;
    report.verifierSource = { path: fileURLToPath(import.meta.url), sha256: await hashFile(fileURLToPath(import.meta.url)) };
    // Keep this before *all* third-party/project imports and Windows diagnostics.
    const exe = await check('preflight/exe-exists', async () => {
      let info;
      try { info = await fs.stat(exePath); }
      catch (error) { throw new Error('Expected RED: EXE artifact does not exist: ' + exePath + ' (' + error.code + ')'); }
      assert(info.isFile() && info.size > 0, 'EXE must be a nonempty file');
      assert.equal(path.extname(exePath).toLowerCase(), '.exe');
      return { path: exePath, bytes: info.size, sha256: await hashFile(exePath) };
    });
    if (!exe) return;
    report.artifact = exe;
    const expected = await check('preflight/expected-site', async () => {
      assert.equal(process.platform, 'win32', 'Real EXE verification requires Windows');
      const files = await inventory(expectedSiteDir);
      assert(files.some(file => file.path === 'index.html'), 'expectedSiteDir must contain index.html');
      assert.equal(files.length, 100, 'The approved complete site contains 100 files');
      assert.equal(files.filter(file => /\.mp4$/i.test(file.path)).length, 6, 'All six videos are required');
      report.expectedFiles = files;
      return files;
    });
    if (!expected) return;
    await check('preflight/all-public-assets-and-licenses', async () => {
      const original = await inventory(path.join(PROJECT, 'source/public'));
      const published = new Map(expected.map(file => [file.path, file]));
      for (const file of original) {
        const actual = published.get(file.path);
        assert(actual, 'Omitted public asset: ' + file.path);
        // The six publish-only H.264 conversions intentionally differ from source.
        if (!/\.mp4$/i.test(file.path)) assert.deepEqual(actual, file, 'Changed/omitted original image, font, license or other public asset: ' + file.path);
      }
      const licenses = original.filter(file => /licen[cs]e|(^|\/)ofl[.-]/i.test(file.path));
      const fonts = original.filter(file => /\.(woff2?|ttf|otf)$/i.test(file.path));
      assert(licenses.length > 0 && fonts.length > 0, 'Expected public licenses and fonts');
      const codecs = [];
      for (const file of expected.filter(file => /\.mp4$/i.test(file.path))) {
        const sampleEntries = await mp4SampleEntries(path.join(expectedSiteDir, file.path));
        assert(sampleEntries.some(tag => ['avc1', 'avc3'].includes(tag)), 'Publish video is not H.264: ' + file.path);
        assert(!sampleEntries.some(tag => ['hvc1', 'hev1'].includes(tag)), 'HEVC still present in published video: ' + file.path);
        codecs.push({ path: file.path, sampleEntries });
      }
      report.publishedVideoCodecs = codecs;
      return { publicFiles: original.length, licenses, fonts, codecs };
    });
    report.coverage.preflight = !report.checks.some(item => item.name.startsWith('preflight/') && item.status === 'failed');

    const exeDir = path.join(runDir, '只有 EXE 的中文 空格目录');
    await fs.mkdir(exeDir);
    const copiedExe = path.join(exeDir, path.basename(exePath));
    await fs.copyFile(exePath, copiedExe, fs.constants.COPYFILE_EXCL);
    monitor = await check('runtime/process-start-stop-observer', startProcessMonitor);
    if (!monitor) return;
    // Process objects must never enter JSON evidence.
    report.checks.at(-1).evidence = { ready: true, mechanism: monitor.backend };

    // All outer EXEs, including a menu relaunch, inherit this SAME TEMP/TMP.
    // Per-instance TEMP would hide electron-builder's fixed-unpack-directory bug.
    const sharedTempDir = path.join(runDir, '共同 TEMP 解包 空间');
    const sharedDataDir = path.join(runDir, '共同 data-dir 基址');
    await fs.mkdir(sharedTempDir);
    await fs.mkdir(sharedDataDir);
    report.sharedLaunchPaths = { TEMP: sharedTempDir, TMP: sharedTempDir, dataDir: sharedDataDir };
    const wireSupervisor = target => {
      target.ended = target.child.exitCode !== null || target.child.signalCode !== null;
      target.child.once('error', error => { target.error = error; target.evidence.spawnError = error.message; });
      target.child.once('exit', (code, signal) => {
        target.ended = true;
        target.evidence.supervisorExitCode = code;
        target.evidence.signal = signal;
      });
    };
    const awaitReady = async (target, softwareRendering, previousPid) => {
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        assert(!interrupted, 'Verifier interrupted');
        assert(!target.error, 'EXE spawn failed: ' + target.error?.message);
        assert.deepEqual(monitor.errors, [], 'Native process observer failed');
        assert(!(target.ended && target.evidence.supervisorExitCode !== 0), 'Portable supervisor exited unsuccessfully: ' + JSON.stringify(target.evidence));
        try {
          const candidate = JSON.parse((await fs.readFile(target.statusFile, 'utf8')).replace(/^\uFEFF/, ''));
          assert(!['error', 'failed'].includes(candidate.state), 'Launcher failed: ' + JSON.stringify(candidate));
          if (candidate.state === 'ready' && candidate.pid !== previousPid) { target.status = candidate; break; }
        } catch (error) {
          if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
        }
        await delay(100);
      }
      validateStatus(target.status, softwareRendering, expected.length);
      return target.status;
    };
    const acceptReady = async target => {
      const { shutdownToken, ...publicStatus } = target.status;
      target.evidence.status = publicStatus;
      const executable = await fs.realpath(target.status.runtime.executablePath);
      const realTemp = await fs.realpath(sharedTempDir);
      const extractionRoot = path.dirname(executable);
      assert(inside(realTemp, extractionRoot) && normalPath(extractionRoot) !== normalPath(realTemp),
        'Electron must have a unique extracted directory beneath the shared TEMP: ' + executable);
      const realSite = await fs.realpath(target.status.siteRoot);
      assert(inside(extractionRoot, realSite), 'siteRoot escaped the same extracted Electron package: ' + realSite);
      assert(!inside(expectedSiteDir, realSite), 'Runtime is serving expectedSiteDir instead of the EXE');
      const userData = await fs.realpath(target.status.runtime.userDataPath);
      assert(inside(await fs.realpath(sharedDataDir), userData) && normalPath(userData) !== normalPath(sharedDataDir),
        'Chromium profile must be an independent child of the shared data-dir base');
      assert(path.basename(userData).startsWith('instance-' + target.status.pid + '-'), 'userDataPath is not associated with this Electron main PID');
      const actualDebugPort = Number((await fs.readFile(path.join(userData, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
      assert.equal(actualDebugPort, target.status.debugPort, 'Chromium DevToolsActivePort must come from the reported independent profile');
      for (const peer of live.filter(item => item !== target && item.status && item.trustedExecutable)) {
        const peerRoot = path.dirname(peer.trustedExecutable);
        assert(!inside(peerRoot, extractionRoot) && !inside(extractionRoot, peerRoot),
          'Independent outer EXEs/relaunches reused or nested their extraction directories despite shared TEMP');
        assert.notEqual(normalPath(peer.status.runtime.userDataPath), normalPath(userData),
          'Independent instances/relaunches reused the same Chromium profile despite shared data-dir');
      }
      const snapshot = await processSnapshot();
      const actual = snapshot.find(item => item.pid === target.status.pid);
      assert(actual, 'Status Electron main PID is not running');
      assert.equal(normalPath(actual.executablePath), normalPath(executable), 'OS process image disagrees with runtime.executablePath');
      assert(!/(?:^|\s)--type=/.test(actual.commandLine || ''), 'Status PID must be Electron main');
      assert(actual.commandLine?.includes('--inspect-ui') && actual.commandLine.includes('--offline'), 'OS command line must confirm inspect/offline');
      assert(actual.commandLine.includes(target.dataDir) && actual.commandLine.includes(target.statusFile), 'OS process does not use the owned status/data paths');
      const softwareFlags = (actual.commandLine.match(/--software-rendering\b/g) || []).length;
      assert.equal(softwareFlags, target.status.runtime.softwareRendering ? 1 : 0, 'Software rendering flag missing or duplicated after relaunch');
      target.trustedPid = actual.pid;
      target.trustedExecutable = executable;
      target.extractionRoot = extractionRoot;
      target.tempDir = sharedTempDir;
      target.evidence.extractionRoot = extractionRoot;
      target.evidence.userDataPath = userData;
      const lineage = await proveLineage(target, snapshot);
      target.evidence.runtimeProcess = { ...actual, lineage, pe: await peMachine(executable), sha256: await hashFile(executable) };
      assert.equal(target.evidence.runtimeProcess.pe, 'x64');
      await verifyListeners(target);
      return target;
    };
    const launch = async (label, { port = 0, softwareRendering = false } = {}) => {
      const ownedDir = await fs.mkdtemp(path.join(runDir, label + ' 自有状态 '));
      const dataDir = sharedDataDir;
      const statusFile = path.join(ownedDir, 'status.json');
      const { env, isolation } = await isolatedEnvironment(ownedDir, sharedTempDir);
      const args = ['--serve-only', '--inspect-ui', '--offline', '--port=' + port,
        '--data-dir=' + dataDir, '--status-file=' + statusFile, ...(softwareRendering ? ['--software-rendering'] : [])];
      const evidence = { label, executable: copiedExe, args, cwd: exeDir, isolation, ownedDir, dataDir,
        statusFile, requestedPort: port, softwareRendering, stdout: '', stderr: '', startedAt: new Date().toISOString() };
      const child = spawnObserved(copiedExe, args, { cwd: exeDir, env, windowsHide: true }, monitor, evidence);
      evidence.supervisorPid = child.pid;
      const target = { child, evidence, ownedDir, dataDir, statusFile, status: null, monitor, tempDir: sharedTempDir };
      live.push(target);
      report.processes.push(evidence);
      child.stderr.on('data', chunk => { evidence.stderr = (evidence.stderr + chunk).slice(-64_000); });
      wireSupervisor(target);
      await awaitReady(target, softwareRendering);
      return acceptReady(target);
    };
    const run = await check('runtime/isolated-exe-launch', async () => {
      assert.deepEqual(await fs.readdir(exeDir), [path.basename(copiedExe)], 'Launch directory must contain ONLY copied EXE');
      assert.equal(await hashFile(copiedExe), exe.sha256);
      return launch('primary');
    });
    if (run) report.checks.at(-1).evidence = run.evidence;
    if (!run) return;
    report.coverage.isolatedLaunch = true;
    report.coverage.processOwnership = true;
    const origin = run.status.origin;

    await check('runtime/bundled-dll-locales-and-licenses', async () => {
      const root = path.dirname(run.trustedExecutable);
      const files = await inventory(root);
      const names = new Set(files.map(file => file.path.toLowerCase()));
      // Electron 44 embeds ANGLE in the EXE. The complete release/packaging
      // manifests below define its runtime files, not an older DLL checklist.
      for (const file of ['locales/en-us.pak', 'locales/zh-cn.pak', 'licenses.chromium.html']) {
        assert(names.has(file), 'Missing bundled Electron locale/license: ' + file);
      }
      assert(names.has('license.electron.txt') || names.has('license'), 'Missing Electron license');
      assert(names.has('resources/app.asar') || names.has('resources/app/package.json'), 'No packaged Electron application');
      const runtimeManifest = JSON.parse(await fs.readFile(path.join(root, 'resources/runtime-manifest.json'), 'utf8'));
      assert.equal(runtimeManifest.electron, ELECTRON);
      assert(Array.isArray(runtimeManifest.files), 'Bundled runtime manifest must enumerate every packaged file');
      const listed = runtimeManifest.files.map(file => {
        assert.equal(typeof file.path, 'string');
        assert(!file.path.includes('\\') && !file.path.startsWith('/') && !file.path.split('/').some(part => ['', '.', '..'].includes(part)), 'Invalid runtime manifest path');
        assert(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
        assert.match(file.sha256, /^[a-f\d]{64}$/i);
        return { path: file.path, bytes: file.bytes, sha256: file.sha256.toLowerCase() };
      }).sort(byPath);
      assert.equal(new Set(listed.map(file => file.path)).size, listed.length, 'Duplicate bundled runtime manifest paths');
      assert.deepEqual(listed, files.filter(file => file.path !== 'resources/runtime-manifest.json'), 'Every packaged runtime DLL/locale/application/site/license must match extracted bytes');
      if (run.status.runtime.verifiedRuntimeFiles !== undefined) assert.equal(run.status.runtime.verifiedRuntimeFiles, listed.length);
      report.runtimeManifest = runtimeManifest;
      const buildInfoPath = path.join(path.dirname(exePath), 'build-info.json');
      let buildInfo;
      try { buildInfo = JSON.parse(await fs.readFile(buildInfoPath, 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (buildInfo) {
        assert.equal(buildInfo.sha256, exe.sha256, 'Build report refers to a different EXE');
        assert.equal(buildInfo.bytes, exe.bytes);
        assert.equal(buildInfo.engine, 'Electron ' + ELECTRON);
        assert.equal(buildInfo.arch, 'x64');
        assert.equal(buildInfo.buildId, run.status.buildId);
        assert.equal(buildInfo.siteFileCount, expected.length);
        assert(buildInfo.sourceRevision?.startsWith(BASELINE), 'Build report is not based on authoritative main ' + BASELINE);
        assert.equal(typeof buildInfo.unpacked, 'string');
        const packaged = await inventory(buildInfo.unpacked);
        assert.deepEqual(files, packaged, 'Extracted runtime must equal every file/hash in the separately packaged expected runtime');
        report.expectedPackagedRuntime = { buildInfoPath, unpacked: buildInfo.unpacked, files: packaged.length, report: buildInfo };
      } else report.expectedPackagedRuntime = { available: false, reason: 'No build-info.json alongside the supplied EXE; complete extracted runtime verified against bundled manifest' };
      report.bundledFiles = files;
      report.coverage.bundledRuntime = true;
      return { root, files: files.length, dlls: files.filter(file => /\.dll$/i.test(file.path)),
        locales: files.filter(file => /^locales\/.*\.pak$/i.test(file.path)),
        licenses: files.filter(file => /licen[cs]e/i.test(file.path)) };
    });
    await check('runtime/extracted-files-exact', async () => {
      const actual = await inventory(run.status.siteRoot);
      assert.deepEqual(actual, expected, 'Extracted siteRoot must contain exactly all expected dist files and bytes');
      assert.equal(run.status.fileCount, expected.length);
      report.coverage.extractedFiles = true;
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
            assert.equal(result.headers['x-content-type-options'], 'nosniff', `${file.path}: MIME sniffing must be disabled`);
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
    await check('http/all-six-video-ranges', async () => {
      const evidence = [];
      for (const file of expected.filter(item => /\.mp4$/i.test(item.path))) {
        const handle = await fs.open(path.join(expectedSiteDir, file.path), 'r');
        try {
          for (const [range, start, end] of [['bytes=0-63', 0, 63], ['bytes=-64', file.bytes - 64, file.bytes - 1],
            ['bytes=' + (file.bytes - 64) + '-', file.bytes - 64, file.bytes - 1]]) {
            const actual = await request(origin, encodedPath(file.path), { headers: { Range: range }, collect: true });
            assert.equal(actual.status, 206, file.path + ': ' + range);
            assert.equal(actual.headers['content-range'], 'bytes ' + start + '-' + end + '/' + file.bytes);
            assert.equal(actual.headers['accept-ranges'], 'bytes');
            assert.equal(Number(actual.headers['content-length']), 64);
            const bytes = Buffer.alloc(64);
            assert.equal((await handle.read(bytes, 0, 64, start)).bytesRead, 64);
            assert.deepEqual(actual.body, bytes, file.path + ': range must match actual publishing bytes');
            evidence.push({ path: file.path, range, status: actual.status, sha256: actual.sha256 });
          }
        } finally { await handle.close(); }
      }
      assert.equal(evidence.length, 18);
      return evidence;
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
        const handle = await fs.open(path.join(expectedSiteDir, sample.path), 'r');
        try {
          const bytes = Buffer.alloc(end - start + 1);
          const read = await handle.read(bytes, 0, bytes.length, start);
          assert.equal(read.bytesRead, bytes.length); assert.deepEqual(result.body, bytes);
        } finally { await handle.close(); }
        return { range, status: result.status, bytes: result.bytes, file: sample.path };
      });
      for (const range of [`bytes=${sample.bytes}-`, 'bytes=63-1', 'bytes=not-a-range', 'bytes=0-1,4-5', 'bytes=-0']) {
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
        ['runtime-manifest-private', '/runtime-manifest.json', {}, [404]],
        ['status-file-private', '/status.json', {}, [404]],
        ['malformed-url-encoding', '/%zz/index.html', {}, [400, 403]],
        ['shutdown-get', '/_portable/shutdown?token=' + encodeURIComponent(run.status.shutdownToken), {}, [405]],
        ['double-encoded-traversal', '/%252e%252e%252findex.html', {}, [400, 403, 404]],
        ['shutdown-no-token', '/_portable/shutdown', { method: 'POST' }, [403]],
        ['shutdown-wrong-token', '/_portable/shutdown?token=invalid-review-token', { method: 'POST' }, [403]],
      ]) await probe(name, async () => {
        // http.request preserves the raw encoded path (URL/fetch may normalize it).
        const result = await request(origin, urlPath, options);
        assert(codes.includes(result.status), `${name}: expected ${codes.join('/')}, got ${result.status}`);
        return { path: urlPath.replace(/token=[^&]+/g, 'token=<redacted>'), status: result.status };
      });
      const status = await getJson(origin, '/_portable/status');
      assert.equal(status.state, 'ready', 'Invalid shutdown tokens must leave the server alive');
      assert(results.every(Boolean), 'One or more HTTP protocol/security checks failed');
      report.coverage.httpProtocol = true;
      return { checks: results.length, rangeFile: sample.path };
    });

    const verifyBrowser = async (target, softwareOnly = false, phase) => {
      const label = phase || target.evidence.label;
      return check('browser/' + label, async () => {
        const { chromium, expect } = await import('@playwright/test');
        const [{ settingsPages, selectSettingsPage, settingsPanel },
          { actions, scene, stage, actionVideo, selectAction, canvasPixels }, { lionBookPages },
          { lionExpressions }, { assetPaths }, { homeCultureSources, homeCultureStories }, { heritageSources }] = await Promise.all([
          import('../../tests/e2e/settings-navigation.helpers.js'), import('../../tests/e2e/action-theater.helpers.js'),
          import('../../src/data/lion-book.js'), import('../../src/data/lion-expressions.js'),
          import('../../src/config/assetPaths.js'), import('../../src/data/home-culture.js'), import('../../src/data/home-heritage.js'),
        ]);
        const origin = target.status.origin;
        const evidence = { label, origin, debugPort: target.status.debugPort,
          runtime: target.status.runtime, console: [], pageErrors: [], failedLocalURLs: [],
          outsideRequests: [], webSockets: [], offlineProbes: [], screenshots: [], status: 'running' };
        report.browsers.push(evidence);
        const continuing = Boolean(target.browser);
        if (continuing) {
          assert(target.browser.isConnected(), 'The original primary CDP connection was lost');
          assert(target.page && !target.page.isClosed(), 'The original primary page was closed');
          target.observerCleanup?.();
          evidence.reusedOriginalSessionAndPage = true;
        }
        // This attaches to the EXE-owned existing BrowserWindow. Never launch a
        // browser, create a context or create a replacement application page.
        evidence.initialTargets = await getJson('http://127.0.0.1:' + target.status.debugPort, '/json/list');
        const browser = target.browser || await chromium.connectOverCDP('http://127.0.0.1:' + target.status.debugPort, { timeout: 30_000 });
        let browserCDP;
        try {
          assert.equal(browser.contexts().length, 1, 'Expected the existing Electron default context');
          const context = browser.contexts()[0];
          const appPages = () => context.pages().filter(page => {
            try { return new URL(page.url()).origin === origin; } catch { return false; }
          });
          await expect.poll(() => appPages().length, { timeout: 15_000, message: 'Existing Electron app target must finish CDP attachment' }).toBe(1);
          const pages = appPages();
          evidence.existingPageURLs = context.pages().map(page => page.url());
          const page = pages[0];
          if (continuing) assert.equal(page, target.page, 'Peer shutdown replaced the original application page');
          target.page = page;
          evidence.attachedURL = page.url();
          page.on('close', () => { evidence.pageClosedAt = new Date().toISOString(); });
          page.on('crash', () => { evidence.pageCrashedAt = new Date().toISOString(); });
          page.setDefaultTimeout(20_000);
          page.setDefaultNavigationTimeout(60_000);
          const observed = new WeakSet();
          const probeURLs = new Set();
          const observers = [];
          const observe = (emitter, event, fn) => { emitter.on(event, fn); observers.push(() => emitter.off(event, fn)); };
          target.observerCleanup = () => observers.forEach(remove => remove());
          const observePage = other => {
            if (observed.has(other)) return;
            observed.add(other);
            observe(other, 'console', message => evidence.console.push({ type: message.type(), text: message.text(), location: message.location() }));
            observe(other, 'pageerror', error => evidence.pageErrors.push({ message: error.message, stack: error.stack }));
            observe(other, 'websocket', socket => evidence.webSockets.push(socket.url()));
          };
          for (const other of context.pages()) observePage(other);
          observe(context, 'page', observePage);
          observe(context, 'request', req => {
            const value = req.url();
            if (!/^(https?|wss?):/i.test(value) || probeURLs.has(value)) return;
            if (new URL(value).origin !== origin) evidence.outsideRequests.push({ url: value, resourceType: req.resourceType() });
          });
          observe(context, 'requestfailed', req => {
            const error = req.failure()?.errorText || '';
            if (probeURLs.has(req.url())) {
              evidence.offlineProbes.push({ url: req.url(), error });
              return;
            }
            if (!req.url().startsWith(origin + '/')) return;
            evidence.failedLocalURLs.push({ url: req.url(), error, resourceType: req.resourceType(),
              expectedCancellation: error === 'net::ERR_ABORTED' && req.resourceType() === 'media' });
          });
          observe(context, 'response', response => {
            if (response.url().startsWith(origin + '/') && response.status() >= 400)
              evidence.failedLocalURLs.push({ url: response.url(), status: response.status(), expectedCancellation: false });
          });
          browserCDP = target.inspector || await browser.newBrowserCDPSession();
          evidence.cdpVersion = await browserCDP.send('Browser.getVersion');
          await page.bringToFront();
          const targets = await browserCDP.send('Target.getTargets');
          const appTarget = targets.targetInfos.find(item => item.type === 'page' && new URL(item.url).origin === origin);
          assert(appTarget, 'Actual existing app target absent from CDP metadata');
          if (continuing) assert.equal(appTarget.targetId, target.pageTargetId, 'Original Electron page target was replaced');
          target.pageTargetId = appTarget.targetId;
          evidence.pageTargetId = appTarget.targetId;
          try {
            const window = await browserCDP.send('Browser.getWindowForTarget', { targetId: appTarget.targetId });
            await browserCDP.send('Browser.setWindowBounds', { windowId: window.windowId, bounds: { windowState: 'maximized' } });
            evidence.window = { ...window, temporarilyMaximized: true };
          } catch (error) { evidence.windowMetadataUnavailable = error.message; }
          evidence.browserVersion = browser.version();
          evidence.processInfo = await browserCDP.send('SystemInfo.getProcessInfo');
          assert(evidence.processInfo.processInfo.some(item => item.type === 'browser' && item.id === target.status.pid), 'CDP browser process must be status.pid');
          try { evidence.gpu = (await browserCDP.send('SystemInfo.getInfo')).gpu; }
          catch (error) { evidence.gpuMetadataUnavailable = error.message; }
          try { evidence.commandLine = (await browserCDP.send('Browser.getBrowserCommandLine')).arguments; }
          catch (error) { evidence.commandLineUnavailable = error.message; }

          await page.setViewportSize({ width: 1920, height: 1080 });
          await page.emulateMedia({ reducedMotion: 'no-preference' });
          // Only media observation/preferences. Security metadata is read from
          // actual CDP/OS/status sources, never manufactured in a renderer.
          if (!continuing) await page.addInitScript(() => {
            if (window !== top) return;
            localStorage.setItem('nanfeng-lion:developer-settings:v1', JSON.stringify({ carouselAutoplay: false, pushPage: false, bookIntroDuration: 3 }));
            sessionStorage.removeItem('nanfeng-lion:intro-seen:v1');
            sessionStorage.removeItem('nanfeng-lion:book-intro-seen:v1');
            window.__bundledMedia = [];
            const previous = new WeakMap();
            for (const type of ['loadeddata', 'timeupdate', 'ended', 'error']) document.addEventListener(type, event => {
              const video = event.target;
              if (!(video instanceof HTMLVideoElement)) return;
              const frames = video.getVideoPlaybackQuality?.().totalVideoFrames ?? video.webkitDecodedFrameCount ?? 0;
              const last = previous.get(video);
              const events = window.__bundledMedia;
              if (events.length > 6000) events.shift();
              events.push({ type, id: video.id, actionId: video.dataset.actionId, time: video.currentTime, duration: video.duration,
                width: video.videoWidth, height: video.videoHeight, frames, loop: video.loop,
                wrapped: Boolean(last > video.duration - 1 && video.currentTime < 1), error: video.error?.message, src: video.currentSrc });
              previous.set(video, video.currentTime);
            }, true);
          });
          const bcheck = (name, fn) => check('browser/' + label + '/' + name, fn, { page });
          const shot = async name => { const file = await screenshot(page, label + '-' + name); evidence.screenshots.push(file); return file; };
          const route = async name => {
            await page.locator('.site-header [data-route="' + name + '"]').click();
            await expect(page.locator('#react-app')).toHaveAttribute('data-route', name, { timeout: 30_000 });
          };

          await bcheck(continuing ? 'original-page-continuity-and-electron-security' : 'startup-natural-intro-and-electron-security', async () => {
            if (continuing) {
              await route('entry');
              await page.locator('#entryLionVideo').scrollIntoViewIfNeeded();
            } else await page.goto(origin + '/');
            await expect(page.locator('#startupLoading')).toHaveCount(0, { timeout: 60_000 });
            const security = await page.evaluate(() => ({
              userAgent: navigator.userAgent, require: typeof window.require, process: typeof window.process,
              module: typeof window.module, platform: navigator.platform, origin: location.origin,
            }));
            assert.match(security.userAgent, /Electron\/44\.9\.1(?:\s|$)/);
            assert.match(security.userAgent, /Windows NT/);
            assert.equal(security.require, 'undefined');
            assert.equal(security.process, 'undefined');
            assert.equal(security.module, 'undefined');
            assert.equal(security.origin, origin);
            const chrome = security.userAgent.match(/Chrome\/([\d.]+)/)?.[1];
            assert.equal(chrome, target.status.runtime.chrome, 'Status Chrome version must agree with the real renderer');
            assert(evidence.cdpVersion.product.endsWith('/' + chrome), 'CDP engine disagrees with status/renderer Chrome version');
            const preferences = target.status.webPreferences || target.status.ui?.webPreferences || target.status.runtime.webPreferences ||
              ('sandbox' in target.status.runtime ? target.status.runtime : undefined);
            evidence.webPreferences = preferences || { unavailable: 'No main-process webPreferences metadata exposed; no renderer-injected substitute' };
            if (preferences) {
              assert.equal(preferences.contextIsolation, true);
              assert.equal(preferences.sandbox, true);
              assert.equal(preferences.nodeIntegration, false);
              if ('webSecurity' in preferences) assert.equal(preferences.webSecurity, true);
            }
            await page.waitForFunction(() => window.__bundledMedia.some(event =>
              event.id === 'introVideo' && event.type === 'ended' && event.frames > 1 && event.time > 1), null, { timeout: 60_000 });
            const intro = await page.evaluate(() => window.__bundledMedia.filter(event => event.id === 'introVideo'));
            assert(intro.some(event => event.width > 0 && event.height > 0 && event.frames > 1));
            evidence.security = security;
            evidence.intro = intro;
            await shot('homepage');
            return { security, mainProcessWebPreferences: evidence.webPreferences, intro };
          });
          await bcheck('home-video-real-frame-progress', async () => {
            const progress = await videoProgress(page.locator('#entryLionVideo'), expect);
            assert.equal(progress.after.loop, true);
            if (!softwareOnly) {
              await page.waitForFunction(() => window.__bundledMedia.some(event => event.id === 'entryLionVideo' && event.wrapped),
                null, { timeout: 60_000 });
            }
            return { progress, naturalLoop: !softwareOnly,
              loopEvent: await page.evaluate(() => window.__bundledMedia.find(event => event.id === 'entryLionVideo' && event.wrapped)) };
          });

          if (!softwareOnly) {
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
            let oldModel;
            await bcheck('model-loaded-real-webgl', async () => {
              await route('model');
              await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 60_000 });
              const canvas = page.locator('#sceneContainer canvas');
              await expect(canvas).toHaveCount(1);
              oldModel = await canvas.elementHandle();
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
              assert(oldModel, 'No prewarmed model canvas to verify');
              // App intentionally retains the prewarmed model between routes;
              // ModelPage.setActive pauses it. Only the action theater disposes.
              await expect(page.locator('#modelStage')).toBeHidden();
              assert.equal(await oldModel.evaluate(el => el.isConnected && el === document.querySelector('#sceneContainer canvas')), true);
              assert.equal(await oldModel.evaluate(el => (el.getContext('webgl2') || el.getContext('webgl')).isContextLost()), false);
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
                return actions.every(({ id }) => bindings[id]?.bound && bindings[id].width > 0 && bindings[id].height > 0);
              }, { timeout: 45_000 }).toBe(true);
              const progress = [];
              for (const { id } of actions) {
                const video = actionVideo(page, id);
                const measurement = await videoProgress(video, expect);
                assert(measurement.after.width > 0 && measurement.after.height > 0);
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

            await bcheck('all-six-published-videos-decoded-in-app', async () => {
              const events = [...(evidence.intro || []), ...await page.evaluate(() => window.__bundledMedia)];
              evidence.mediaEvents = events;
              const decoded = [...new Set(events.filter(event => event.width > 0 && event.height > 0 && event.frames > 1 && event.time > 0)
                .map(event => new URL(event.src).pathname))].sort();
              const wanted = expected.filter(file => /\.mp4$/i.test(file.path)).map(file => encodedPath(file.path)).sort();
              assert.deepEqual(decoded, wanted, 'All six distinct published video sources must decode and progress in the real app');
              return { decoded, expected: wanted };
            });
            await bcheck('sources-photography-and-local-licenses', async () => {
              const sources = page.locator('#homeCultureSources');
              await sources.scrollIntoViewIfNeeded();
              const expectedLinks = [...homeCultureSources, ...heritageSources.filter(item => item.group === 'types')];
              for (const item of expectedLinks) {
                const link = sources.locator('a').filter({ hasText: item.title }).first();
                await expect(link).toHaveAttribute('href', item.url);
                await expect(link).toHaveAttribute('target', '_blank');
                assert(/(?:^|\s)(?:noreferrer|noopener)(?:\s|$)/.test(await link.getAttribute('rel') || ''), 'External source must isolate opener');
                assert.equal(new URL(item.url).protocol, 'https:');
              }
              await sources.locator('.home-culture-photo-licenses summary').click();
              const credits = sources.locator('.home-culture-photo-license');
              await expect(credits).toHaveCount(homeCultureStories.length);
              for (const credit of await credits.all()) {
                assert((await credit.innerText()).trim().length > 15, 'Missing photography credit');
                const links = await credit.locator('a').evaluateAll(nodes => nodes.map(node => node.href));
                assert(links.length >= 2 && links.every(href => /^https?:\/\//.test(href)), 'Photography source and license links required');
              }
              await sources.locator('.archive-provenance summary').click();
              await expect(sources.locator('.archive-provenance')).toContainText('AI辅助示意');
              const windowsBefore = context.pages().length;
              await sources.locator('.home-culture-source-card').first().click();
              await delay(350);
              assert.equal(context.pages().length, windowsBefore, 'Offline source-link click opened another application window');
              for (const asset of [assetPaths.lionBookLicense, assetPaths.lionBookFontLicense, assetPaths.cultureDepthLicense]) {
                const file = expected.find(item => item.path === asset);
                assert(file, 'Missing local project license: ' + asset);
                const result = await request(origin, encodedPath(asset));
                assert.equal(result.status, 200);
                assert.equal(result.sha256, file.sha256);
                assert(result.bytes > 20, 'License file is empty');
              }
              await shot('sources-and-licenses');
              return { sources: expectedLinks.length, photographyCredits: homeCultureStories.length, localLicenses: 3, offlineSourceLinkClicked: true };
            });
            await bcheck('all-published-images-and-fonts-decode', async () => {
              const assets = expected.filter(file => /\.(png|jpe?g|gif|webp|svg|woff2?|ttf|otf)$/i.test(file.path)).map(file => file.path);
              const decoded = await page.evaluate(async assets => {
                const results = [];
                // Sequential to avoid decoding all large textures at once.
                for (const asset of assets) {
                  try {
                    if (/\.(woff2?|ttf|otf)$/i.test(asset)) {
                      const font = new FontFace('bundled-review-' + results.length, 'url(' + JSON.stringify('/' + asset) + ')');
                      await font.load();
                      results.push({ path: asset, kind: 'font', status: font.status });
                    } else {
                      const image = new Image(); image.src = '/' + asset;
                      await image.decode();
                      if (!(image.naturalWidth > 0 && image.naturalHeight > 0)) throw new Error('Zero image dimensions');
                      results.push({ path: asset, kind: 'image', width: image.naturalWidth, height: image.naturalHeight });
                      image.src = '';
                    }
                  } catch (error) { results.push({ path: asset, error: error.message }); }
                }
                return results;
              }, assets);
              evidence.decodedAssets = decoded;
              assert.deepEqual(decoded.filter(item => item.error), [], 'Bundled image/font decode failures');
              await page.evaluate(() => document.fonts.ready);
              return decoded;
            });
          } else {
            let oldModel;
            await bcheck('model-loaded-real-webgl', async () => {
              await route('model');
              await expect(page.locator('#modelStatus')).toContainText('模型已载入', { timeout: 60_000 });
              const canvas = page.locator('#sceneContainer canvas');
              await expect(canvas).toHaveCount(1);
              oldModel = await canvas.elementHandle();
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

            if (target.status.runtime.softwareRendering) await bcheck('software-renderer-confirmed', async () => {
              assert.equal(target.status.runtime.softwareRendering, true);
              const gpu = JSON.stringify(evidence.gpu || {});
              assert(/swiftshader|software|llvmpipe/i.test(gpu),
                'CDP GPU information must independently identify the software renderer: ' + gpu);
              return { gpu: evidence.gpu, modelAndVideoChecked: true };
            });
          }
          await bcheck('offline-policy-rejects-outside-origin', async () => {
            // A separate live loopback listener detects actual leaks without
            // needing Internet/DNS. No verifier request-routing can mask them.
            const leaks = [];
            const other = http.createServer((req, res) => { leaks.push(req.url); res.end('offline policy leaked'); });
            await new Promise((resolve, reject) => { other.once('error', reject); other.listen(0, '127.0.0.1', resolve); });
            try {
              const urls = ['http://127.0.0.1:' + other.address().port + '/offline-probe-' + randomUUID(),
                'https://example.invalid/offline-probe-' + randomUUID()];
              urls.forEach(url => probeURLs.add(url));
              evidence.offlineProbeResults = await page.evaluate(async urls => Promise.all(urls.map(async url => {
                const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
                try { const result = await fetch(url, { mode: 'no-cors', signal: controller.signal }); return { url, resolved: true, status: result.status }; }
                catch (error) { return { url, resolved: false, error: error.message }; }
                finally { clearTimeout(timer); }
              })), urls);
              await expect.poll(() => evidence.offlineProbes.length).toBe(2);
              assert(evidence.offlineProbeResults.every(item => !item.resolved), 'Offline fetch unexpectedly resolved');
              assert.deepEqual(leaks, [], 'Offline mode made an actual request to another origin');
              for (const url of urls) {
                const failure = evidence.offlineProbes.find(item => item.url === url);
                assert(failure && /ERR_BLOCKED_BY_CLIENT|ERR_ACCESS_DENIED/.test(failure.error),
                  'Offline rejection must come from application policy, not DNS, CORS or verifier interception: ' + JSON.stringify(failure));
              }
              return { results: evidence.offlineProbeResults, networkFailures: evidence.offlineProbes, actualLeaks: leaks };
            } finally { await new Promise(resolve => other.close(resolve)); }
          });
          await bcheck('no-browser-or-local-resource-errors', async () => {
            const probeMessage = item => /offline-probe-/.test(item.location?.url || '');
            evidence.expectedProbeConsole = evidence.console.filter(item => item.type === 'error' && probeMessage(item));
            const errors = evidence.console.filter(item => item.type === 'error' && !probeMessage(item));
            assert.deepEqual(evidence.pageErrors, [], 'Browser page errors');
            assert.deepEqual(evidence.failedLocalURLs.filter(item => !item.expectedCancellation), [], 'Failed local HTTP resources');
            assert.deepEqual(evidence.outsideRequests, [], 'Application attempted a request outside its own EXE origin');
            assert.deepEqual(evidence.webSockets, [], 'Unexpected application WebSocket');
            assert.deepEqual(errors, [], 'Browser console errors (all retained in report)');
            assert(pidAlive(target.status.pid), 'Electron main exited during browser checks');
            await verifyListeners(target);
            return { pageErrors: 0, failedLocalResources: 0, unexpectedConsoleErrors: 0, outsideRequests: 0 };
          });
          const failures = report.checks.filter(item => item.name.startsWith('browser/' + label + '/') && item.status === 'failed');
          evidence.status = failures.length ? 'failed' : 'passed';
          assert.equal(failures.length, 0, label + ': browser checks failed');
          return { electron: ELECTRON, chrome: target.status.runtime.chrome, screenshots: evidence.screenshots };
        } catch (error) {
          evidence.failureExistingPageURLs = browser.contexts().flatMap(context => context.pages().map(page => page.url()));
          try { evidence.failureTargets = await getJson('http://127.0.0.1:' + target.status.debugPort, '/json/list'); }
          catch (captureError) { evidence.failureTargetsError = captureError.message; }
          throw error;
        } finally {
          if (evidence.status === 'running') evidence.status = 'failed';
          // Keep the same transport, inspector session and original Page alive
          // across peer launch/shutdown and the real native menu transition.
          target.inspector = browserCDP;
          target.browser = browser;
        }
      });
    };
    if (await verifyBrowser(run)) report.coverage.embeddedBrowser = true;

    const restartFromCompatibilityMenu = async previous => {
      assert(previous.browser?.isConnected(), 'No live app CDP connection for menu test');
      const page = previous.browser.contexts()[0].pages().find(item => {
        try { return new URL(item.url()).origin === previous.status.origin; } catch { return false; }
      });
      assert(page, 'No actual app page for compatibility shortcut');
      await page.bringToFront();
      const eventCursor = monitor.events.length;
      const beforeStatus = previous.status;
      const evidence = { label: 'menu-restarted', executable: copiedExe,
        args: previous.evidence.args.filter(arg => arg !== '--software-rendering').concat('--software-rendering'),
        cwd: exeDir, isolation: previous.evidence.isolation, ownedDir: previous.ownedDir,
        dataDir: sharedDataDir, statusFile: previous.statusFile, softwareRendering: true,
        supervisorPid: previous.child.pid, stdout: '', stderr: '', startedAt: new Date().toISOString() };
      const restarted = { child: previous.child, evidence, ownedDir: previous.ownedDir,
        dataDir: sharedDataDir, statusFile: previous.statusFile, status: null, monitor, tempDir: sharedTempDir };
      live.push(restarted);
      report.processes.push(evidence);
      wireSupervisor(restarted);
      const transition = { before: previous.evidence.status, eventCursor, trigger: null, status: 'running' };
      report.menuTransition = transition;
      // Win32 SendInput, with foreground PID checked, exercises the real native
      // accelerator. No Menu callback, IPC hook, relaunch call or DOM substitute.
      transition.trigger = await pressCompatibilityShortcut(beforeStatus.pid);
      await awaitReady(restarted, true, beforeStatus.pid);
      const outerStarts = monitor.events.slice(eventCursor).filter(item => item.kind === 'start' &&
        item.executablePath && normalPath(item.executablePath) === normalPath(copiedExe));
      assert.equal(outerStarts.length, 1, 'One Ctrl+Shift+S must start exactly one new outer portable EXE');
      evidence.wrapperPid = outerStarts[0].pid;
      assert.notEqual(evidence.wrapperPid, previous.evidence.wrapperPid, 'Outer EXE did not restart with a new PID');
      assert(pidAlive(evidence.wrapperPid), 'New outer portable EXE must remain alive while its Electron child runs');
      await acceptReady(restarted);
      assert.notEqual(restarted.status.pid, beforeStatus.pid, 'Electron main PID did not change');
      assert.equal(restarted.status.buildId, beforeStatus.buildId);
      assert.equal(restarted.evidence.isolation.TEMP, previous.evidence.isolation.TEMP);
      assert.equal(restarted.dataDir, previous.dataDir);
      const deadline = Date.now() + 30_000;
      while ((pidAlive(beforeStatus.pid) || pidAlive(previous.evidence.wrapperPid)) && Date.now() < deadline) await delay(100);
      assert(!pidAlive(beforeStatus.pid), 'Old Electron main survived menu relaunch');
      assert(!pidAlive(previous.evidence.wrapperPid), 'Old outer portable EXE survived menu relaunch');
      const oldExits = monitor.events.slice(eventCursor).filter(item => item.kind === 'stop' &&
        [beforeStatus.pid, previous.evidence.wrapperPid].includes(item.pid));
      for (const pid of [beforeStatus.pid, previous.evidence.wrapperPid]) {
        const exit = oldExits.find(item => item.pid === pid);
        assert(exit && exit.exitCode === 0, 'Native observer must capture successful old main/outer EXE exits: ' + pid);
      }
      const leakedOld = (await processSnapshot()).filter(item => item.executablePath && inside(previous.extractionRoot, item.executablePath));
      assert.deepEqual(leakedOld, [], 'Old extracted Electron generation still has live processes');
      // If Windows reuses a port, ownership of that port was already checked
      // against the new main PID; otherwise the old listener must refuse traffic.
      for (const oldOrigin of [beforeStatus.origin, 'http://127.0.0.1:' + beforeStatus.debugPort]) {
        if ([restarted.status.origin, 'http://127.0.0.1:' + restarted.status.debugPort].includes(oldOrigin)) continue;
        let reachable = false;
        try { await request(oldOrigin, '/_portable/status', { timeout: 2500 }); reachable = true; } catch { /* expected refusal */ }
        assert(!reachable, 'Old menu-restarted generation left a listener reachable: ' + oldOrigin);
      }
      previous.stopped = true;
      previous.restarted = true;
      previous.evidence.shutdown = { byNativeCompatibilityMenu: true, runtimePidStopped: beforeStatus.pid,
        wrapperPidStopped: previous.evidence.wrapperPid, exits: oldExits, listenersStoppedOrReowned: true };
      transition.after = restarted.evidence.status;
      transition.outerStart = outerStarts[0];
      transition.oldExits = oldExits;
      transition.newOuterSha256 = await hashFile(copiedExe);
      assert.equal(transition.newOuterSha256, exe.sha256);
      return restarted;
    };

    await check('runtime/loopback-owned-http-and-cdp', async () => {
      const listeners = await verifyListeners(run);
      report.coverage.loopbackBinding = true;
      return listeners;
    });
    await check('runtime/occupied-port-software-rendering-second-run', async () => {
      const blocker = net.createServer(socket => socket.destroy());
      await new Promise((resolve, reject) => { blocker.once('error', reject); blocker.listen(0, '127.0.0.1', resolve); });
      let other;
      const continuity = report.primaryContinuity = [];
      const capturePrimary = async phase => {
        const entry = { phase, at: new Date().toISOString(), originalPageTargetId: run.pageTargetId,
          originalPageClosed: run.page?.isClosed(), cdpConnected: run.browser?.isConnected() };
        continuity.push(entry);
        entry.targets = await getJson('http://127.0.0.1:' + run.status.debugPort, '/json/list');
        entry.nativeWindow = JSON.parse(await powershell("$p=Get-Process -Id " + run.status.pid +
          "; [pscustomobject]@{pid=$p.Id;windowHandle=$p.MainWindowHandle.ToInt64();title=$p.MainWindowTitle;responding=$p.Responding} | ConvertTo-Json -Compress"));
      };
      try {
        const occupied = blocker.address().port;
        await capturePrimary('before-peer-launch');
        other = await launch('software', { port: occupied, softwareRendering: true });
        await capturePrimary('after-peer-ready');
        assert.notEqual(Number(new URL(other.status.origin).port), occupied, 'Occupied HTTP port must fall back');
        assert.notEqual(other.status.origin, origin, 'Instances must own independent HTTP ports');
        assert.notEqual(other.status.debugPort, run.status.debugPort, 'Instances must own independent CDP ports');
        assert.notEqual(other.status.pid, run.status.pid);
        assert.equal(other.status.buildId, run.status.buildId);
        assert.equal(other.evidence.isolation.TEMP, run.evidence.isolation.TEMP, 'Two instances must share the identical TEMP');
        assert.equal(other.evidence.isolation.TMP, run.evidence.isolation.TMP, 'Two instances must share the identical TMP');
        assert.equal(other.dataDir, run.dataDir, 'Two instances must share the data-dir base');
        assert.notEqual(normalPath(other.extractionRoot), normalPath(run.extractionRoot));
        assert.notEqual(normalPath(other.status.runtime.userDataPath), normalPath(run.status.runtime.userDataPath));
        assert.equal((await getJson(other.status.origin, '/_portable/status')).state, 'ready');
        report.coverage.portConflict = true;
        assert(await verifyBrowser(other, true), 'Software renderer model/video validation failed');
        report.coverage.softwareRendering = true;
        await capturePrimary('before-peer-shutdown');
        await stop(other);
        await capturePrimary('after-peer-shutdown');
        assert.equal((await getJson(origin, '/_portable/status')).state, 'ready', 'Stopping second instance affected primary');
        assert.deepEqual(await inventory(run.status.siteRoot), expected, 'Peer shutdown removed or altered the primary extraction');
        assert(await verifyBrowser(run, true, 'primary-after-peer-exit'), 'Primary model/video failed after the other EXE exited under shared TEMP');
        report.coverage.sharedTempInstances = true;
        report.coverage.independentProfiles = true;
        return { occupied, fallback: other.evidence.status, shutdown: other.evidence.shutdown,
          sharedTEMP: sharedTempDir, sharedDataDir, primaryExtraction: run.extractionRoot,
          peerExtraction: other.extractionRoot, profiles: [run.status.runtime.userDataPath, other.status.runtime.userDataPath] };
      } finally {
        if (other && !other.stopped) await stop(other);
        await new Promise(resolve => blocker.close(resolve));
      }
    });
    let activeRun = run;
    const menuVerified = await check('runtime/native-compatibility-menu-relaunch', async () => {
      const restarted = await restartFromCompatibilityMenu(run);
      activeRun = restarted;
      assert.deepEqual(await inventory(restarted.status.siteRoot), expected, 'Menu-restarted site lost expected assets');
      assert.deepEqual(await inventory(restarted.extractionRoot), report.bundledFiles, 'Menu restart did not extract the complete same packaged runtime/site');
      const liveIndex = await request(restarted.status.origin, '/');
      assert.equal(liveIndex.status, 200);
      assert.equal(liveIndex.sha256, expected.find(item => item.path === 'index.html').sha256);
      assert(await verifyBrowser(restarted, true), 'Menu-restarted app failed real video/model/software-renderer checks');
      const outerStarts = monitor.events.slice(report.menuTransition.eventCursor).filter(item => item.kind === 'start' &&
        item.executablePath && normalPath(item.executablePath) === normalPath(copiedExe));
      assert.equal(outerStarts.length, 1, 'Compatibility menu caused duplicate/delayed outer EXE restarts');
      report.menuTransition.status = 'passed';
      report.coverage.menuRelaunch = true;
      return report.menuTransition;
    });
    if (report.menuTransition && !menuVerified) report.menuTransition.status = 'failed';
    await check('runtime/authenticated-shutdown', async () => {
      const result = await stop(activeRun);
      report.coverage.shutdown = true;
      return result;
    });
    await check('runtime/no-installed-browser-node-or-dotnet-spawn', async () => {
      const audit = await auditProcesses(live, monitor);
      report.processAudit = audit;
      report.coverage.noExternalBrowser = true;
      return audit;
    });
    await check('runtime/launch-directory-still-only-exe', async () => {
      assert.deepEqual(await fs.readdir(exeDir), [path.basename(copiedExe)]);
      assert.equal(await hashFile(copiedExe), exe.sha256);
      return { copiedExe, sha256: exe.sha256 };
    });
  } catch (error) {
    await check('verifier/unhandled', async () => { throw error; });
  } finally {
    for (const run of live) {
      if (!run.stopped) await check('cleanup/' + run.evidence.label, async () => stop(run));
      if (!run.stopped) {
        try { await forceCleanup(run); }
        catch (error) { report.checks.push({ name: 'cleanup/forced/' + run.evidence.label, required: true, status: 'failed', error: { message: error.message } }); }
      }
      // Only after the owned runtime has been stopped/cleaned up.
      await run.browser?.close().catch(error => { run.evidence.disconnectError = error.message; });
    }
    if (monitor) {
      // Capture the complete owned process trace, including short-lived
      // external-browser attempts and main-process exit codes.
      const ownedIds = descendants(live.map(run => run.evidence.wrapperPid), monitor.events.filter(item => item.kind === 'start'));
      report.processTrace = monitor.events.filter(item => ownedIds.has(item.pid));
      report.processObserver = { stderr: monitor.stderr, errors: monitor.errors };
      try {
        const audit = await auditProcesses(live, monitor);
        report.processAudit = audit;
      } catch (error) {
        report.checks.push({ name: 'cleanup/process-audit', required: true, status: 'failed', error: { message: error.message } });
      }

    }
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    const failures = report.checks.filter(item => item.status === 'failed' && item.required);
    report.finishedAt = new Date().toISOString();
    report.interrupted = interrupted;
    report.summary = { passed: report.checks.filter(item => item.status === 'passed').length, failed: failures.length,
      failureNames: failures.map(item => item.name),
      unverified: Object.entries(report.coverage).filter(([, value]) => !value).map(([key]) => key) };
    report.verdict = !interrupted && failures.length === 0 && report.summary.unverified.length === 0 ? 'GREEN' : 'RED';
    process.exitCode = report.verdict === 'GREEN' ? 0 : 1;
    if (runDir) {
      const reportPath = path.join(runDir, 'report.json');
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
      console.log(report.verdict + ': ' + report.summary.passed + ' passed, ' + failures.length + ' failed; unverified: ' + (report.summary.unverified.join(', ') || 'none'));
      console.log('Report: ' + reportPath);
    } else console.error('RED: Unable to create a separate review output directory');
  }
}

function normalPath(value) { return path.resolve(value || '').toLowerCase(); }
function inside(root, target) { const relative = path.relative(root, target); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); }
function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}
function validateStatus(status, softwareRendering, fileCount) {
  assert.equal(status?.state, 'ready', 'Electron readiness timed out or status is not ready');
  const origin = new URL(status.origin);
  assert.equal(origin.protocol, 'http:');
  assert.equal(origin.hostname, '127.0.0.1');
  assert(Number(origin.port) > 0 && Number(origin.port) <= 65535);
  assert.equal(origin.origin, status.origin);
  assert(Number.isInteger(status.pid) && status.pid > 0, 'Invalid Electron main PID');
  assert(Number.isInteger(status.debugPort) && status.debugPort > 0 && status.debugPort <= 65535);
  assert.notEqual(status.debugPort, Number(origin.port), 'CDP and app HTTP ports must be distinct');
  assert.equal(status.fileCount, fileCount);
  assert.equal(typeof status.siteRoot, 'string');
  assert(path.isAbsolute(status.siteRoot));
  assert.equal(typeof status.shutdownToken, 'string');
  assert(status.shutdownToken.length >= 16, 'Shutdown token must be a nonempty private capability');
  assert.equal(typeof status.buildId, 'string');
  assert(status.buildId.trim(), 'Missing build ID');
  assert.equal(status.runtime?.electron, ELECTRON);
  assert.equal(status.runtime?.arch, 'x64');
  assert.equal(status.runtime?.platform, 'win32');
  assert.equal(status.runtime?.bundled, true);
  assert.equal(status.runtime?.softwareRendering, softwareRendering);
  assert.match(status.runtime?.chrome || '', /^\d+\.\d+\.\d+\.\d+$/);
  assert.match(status.runtime?.node || '', /^v?\d+\.\d+\.\d+$/);
  assert(path.isAbsolute(status.runtime?.executablePath || ''), 'runtime.executablePath must be absolute');
  assert(path.isAbsolute(status.runtime?.userDataPath || ''), 'runtime.userDataPath must expose the actual independent Chromium profile');
}
async function isolatedEnvironment(ownedDir, sharedTempDir = path.join(ownedDir, 'extracted temp')) {
  const excluded = /^(path|node.*|electron.*|chrome.*|chromium.*|playwright.*|browser|userprofile|appdata|localappdata|temp|tmp|home|homedrive|homepath|programfiles(?:\(x86\))?|programw6432|commonprogramfiles(?:\(x86\))?|commonprogramw6432)$/i;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !excluded.test(key)));
  const profile = path.join(ownedDir, 'isolated profile');
  const paths = { USERPROFILE: profile, LOCALAPPDATA: path.join(profile, 'AppData/Local'),
    APPDATA: path.join(profile, 'AppData/Roaming'), TEMP: sharedTempDir,
    TMP: sharedTempDir, ProgramFiles: path.join(ownedDir, 'empty Program Files'),
    'ProgramFiles(x86)': path.join(ownedDir, 'empty Program Files x86'),
    ProgramW6432: path.join(ownedDir, 'empty Program Files'),
    CommonProgramFiles: path.join(ownedDir, 'empty Common Files'),
    'CommonProgramFiles(x86)': path.join(ownedDir, 'empty Common Files x86'),
    CommonProgramW6432: path.join(ownedDir, 'empty Common Files') };
  for (const directory of new Set(Object.values(paths))) await fs.mkdir(directory, { recursive: true });
  Object.assign(env, paths);
  env.HOMEDRIVE = path.parse(profile).root.replace(/[\\/]$/, '');
  env.HOMEPATH = profile.slice(env.HOMEDRIVE.length);
  env.PATH = SYSTEM;
  return { env, isolation: { PATH: env.PATH, ...paths, hostProfileChanged: false, removedRuntimeEnvironment: true } };
}
async function pressCompatibilityShortcut(pid) {
  assert(Number.isInteger(pid) && pid > 0 && pidAlive(pid), 'Shortcut requires the live verified Electron main PID');
  const command = String.raw`
Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class PortableCompatibilityKeys {
  [StructLayout(LayoutKind.Sequential)] public struct KEY {
    public ushort vk,scan; public uint flags,time; public UIntPtr extra;
  }
  [StructLayout(LayoutKind.Explicit,Size=40)] public struct INPUT {
    [FieldOffset(0)] public uint type;
    [FieldOffset(8)] public KEY key;
  }
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr window,int state);
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint from,uint to,bool attach);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll",SetLastError=true)] static extern uint SendInput(uint count,INPUT[] input,int size);
  static INPUT Key(ushort vk,bool up) {
    var input=new INPUT(); input.type=1; input.key.vk=vk; input.key.flags=up?2u:0u; return input;
  }
  public static string Press(int expectedPid) {
    var process=Process.GetProcessById(expectedPid); process.Refresh();
    IntPtr window=process.MainWindowHandle;
    if(window==IntPtr.Zero) throw new Exception("Verified Electron main has no native window");
    uint foregroundPid,unused;
    uint foregroundThread=GetWindowThreadProcessId(GetForegroundWindow(),out foregroundPid);
    uint ownThread=GetCurrentThreadId();
    bool attached=foregroundThread!=ownThread && AttachThreadInput(ownThread,foregroundThread,true);
    try { ShowWindow(window,3); SetForegroundWindow(window); }
    finally { if(attached) AttachThreadInput(ownThread,foregroundThread,false); }
    GetWindowThreadProcessId(GetForegroundWindow(),out foregroundPid);
    GetWindowThreadProcessId(window,out unused);
    if(foregroundPid!=(uint)expectedPid || unused!=(uint)expectedPid)
      throw new Exception("Cannot safely focus verified Electron window; no keys sent");
    foreach(int vk in new int[]{0x11,0x10,0x12,0x5b,0x5c})
      if((GetAsyncKeyState(vk)&0x8000)!=0) throw new Exception("A physical modifier key is held; no shortcut sent");
    var keys=new INPUT[]{Key(0x11,false),Key(0x10,false),Key(0x53,false),Key(0x53,true),Key(0x10,true),Key(0x11,true)};
    uint sent=SendInput((uint)keys.Length,keys,Marshal.SizeOf(typeof(INPUT)));
    if(sent!=keys.Length) {
      var release=new INPUT[]{Key(0x53,true),Key(0x10,true),Key(0x11,true)};
      SendInput((uint)release.Length,release,Marshal.SizeOf(typeof(INPUT)));
      throw new Win32Exception(Marshal.GetLastWin32Error(),"Native shortcut input incomplete");
    }
    return "{\"method\":\"Win32 SendInput\",\"keys\":\"Ctrl+Shift+S\",\"foregroundPid\":"+foregroundPid+",\"windowHandle\":"+window.ToInt64()+",\"inputEvents\":"+sent+"}";
  }
}
'@
`;
  return JSON.parse(await powershell(command + '\n[PortableCompatibilityKeys]::Press(' + pid + ')'));
}
async function powershell(command) {
  const prefix = "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); ";
  const result = await promisify(execFile)(SHELL, ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden',
    '-EncodedCommand', Buffer.from(prefix + command, 'utf16le').toString('base64')],
    { windowsHide: true, timeout: 30_000, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8',
      // The desktop harness uses pwsh 7. Its inherited PSModulePath points at
      // modules that Windows PowerShell 5 cannot import (notably Authenticode).
      env: { ...process.env, PSModulePath: path.join(SYSTEM, 'WindowsPowerShell/v1.0/Modules') } });
  return result.stdout.replace(/^\uFEFF/, '').trim();
}
async function processSnapshot() {
  const result = await powershell("@(Get-CimInstance Win32_Process | Select-Object @{n='pid';e={[int]$_.ProcessId}},@{n='parentPid';e={[int]$_.ParentProcessId}},@{n='name';e={$_.Name}},@{n='executablePath';e={$_.ExecutablePath}},@{n='commandLine';e={$_.CommandLine}},@{n='createdAt';e={$_.CreationDate.ToUniversalTime().ToString('o')}},@{n='birthFileTime';e={$_.CreationDate.ToUniversalTime().ToFileTimeUtc().ToString()}}) | ConvertTo-Json -Compress");
  return JSON.parse(result || '[]');
}
function startProcessMonitor() {
  // A global WMI/ETW process trace requires elevated rights on ordinary Windows.
  // DEBUG_PROCESS observes only our own new tree, including short-lived children,
  // before their first instruction; it needs neither elevation nor polling.
  return { ready: true, ended: false, events: [], errors: [], stderr: '', backend: 'Windows DEBUG_PROCESS' };
}
function spawnObserved(executable, args, options, monitor, evidence) {
  const script = String.raw`
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding=[System.Text.UTF8Encoding]::new($false)
try {
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.ComponentModel;
using System.IO;
public static class PortableTreeObserver {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct SI {
    public int cb; public string reserved,desktop,title;
    public int x,y,xSize,ySize,xChars,yChars,fill,flags;
    public short show,reservedSize; public IntPtr reservedData,input,output,error;
  }
  [StructLayout(LayoutKind.Sequential)] public struct PI { public IntPtr process,thread; public uint pid,tid; }
  [StructLayout(LayoutKind.Sequential)] public struct PBI { public IntPtr reserved,peb,r2a,r2b,pid,parent; }
  [StructLayout(LayoutKind.Explicit, Size=176)] public struct DE {
    [FieldOffset(0)] public uint code; [FieldOffset(4)] public uint pid; [FieldOffset(8)] public uint tid;
    [FieldOffset(16)] public IntPtr file; [FieldOffset(24)] public IntPtr process; [FieldOffset(32)] public IntPtr thread;
    [FieldOffset(16)] public uint exitOrException;
  }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool CreateProcess(string app,StringBuilder cmd,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref SI si,out PI pi);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool WaitForDebugEvent(out DE value,uint timeout);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool ContinueDebugEvent(uint pid,uint tid,uint status);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryFullProcessImageName(IntPtr process,uint flags,StringBuilder path,ref int size);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetProcessTimes(IntPtr process,out long creation,out long exit,out long kernel,out long user);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool DebugSetProcessKillOnExit(bool kill);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int handle);
  [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr process,int kind,ref PBI info,int size,out int returned);
  static string Json(string value) {
    if(value==null) return "null";
    var b=new StringBuilder("\"");
    foreach(char c in value) {
      if(c=='\\' || c=='"') { b.Append('\\'); b.Append(c); }
      else if(c<32) b.Append("\\u"+((int)c).ToString("x4"));
      else b.Append(c);
    }
    return b.Append('"').ToString();
  }
  static void Emit(string value) { Console.Out.WriteLine("@@PORTABLE@@"+value); Console.Out.Flush(); }
  public static int Run(string executable,string command,string cwd) {
    var si=new SI(); si.cb=Marshal.SizeOf(typeof(SI)); si.flags=0x101; si.show=0;
    si.input=GetStdHandle(-10); si.output=GetStdHandle(-11); si.error=GetStdHandle(-12);
    PI pi;
    if(!CreateProcess(executable,new StringBuilder(command),IntPtr.Zero,IntPtr.Zero,true,0x08000401,IntPtr.Zero,cwd,ref si,out pi))
      throw new Win32Exception(Marshal.GetLastWin32Error());
    // Forced verifier cleanup must never kill a Windows-created user IME host.
    // Explicit cleanup below terminates only proved owned executable identities.
    if(!DebugSetProcessKillOnExit(false)) throw new Win32Exception(Marshal.GetLastWin32Error());
    Emit("{\"kind\":\"root\",\"pid\":"+pi.pid+"}");
    CloseHandle(pi.process); CloseHandle(pi.thread);
    var births=new System.Collections.Generic.Dictionary<uint,long>();
    int count=0,exitCode=1;
    while(true) {
      DE ev;
      if(!WaitForDebugEvent(out ev,1000)) {
        int error=Marshal.GetLastWin32Error();
        if(error==121) continue;
        throw new Win32Exception(error);
      }
      uint disposition=0x00010002; // DBG_CONTINUE
      if(ev.code==3) { // CREATE_PROCESS_DEBUG_EVENT
        count++;
        var full=new StringBuilder(32768); int length=full.Capacity;
        bool known=QueryFullProcessImageName(ev.process,0,full,ref length);
        var pbi=new PBI(); int returned;
        if(NtQueryInformationProcess(ev.process,0,ref pbi,Marshal.SizeOf(typeof(PBI)),out returned)!=0)
          throw new Exception("Cannot independently obtain debug child parent PID");
        string image=known?full.ToString():null;
        long birth,exit,kernel,user;
        if(!GetProcessTimes(ev.process,out birth,out exit,out kernel,out user)) throw new Win32Exception(Marshal.GetLastWin32Error());
        births[ev.pid]=birth;
        Emit("{\"kind\":\"start\",\"pid\":"+ev.pid+",\"parentPid\":"+pbi.parent.ToInt64()+",\"name\":"+Json(image==null?null:Path.GetFileName(image))+",\"executablePath\":"+Json(image)+",\"createdAt\":"+Json(DateTime.FromFileTimeUtc(birth).ToString("o"))+",\"birthFileTime\":"+Json(birth.ToString())+",\"observedAt\":"+Json(DateTime.UtcNow.ToString("o"))+"}");
        if(!known) throw new Exception("Cannot identify debug child process image");
        if(ev.file!=IntPtr.Zero) CloseHandle(ev.file);
      } else if(ev.code==5) { // EXIT_PROCESS_DEBUG_EVENT
        count--;
        Emit("{\"kind\":\"stop\",\"pid\":"+ev.pid+",\"exitCode\":"+ev.exitOrException+",\"birthFileTime\":"+Json(births[ev.pid].ToString())+",\"observedAt\":"+Json(DateTime.UtcNow.ToString("o"))+"}");
        births.Remove(ev.pid);
        if(ev.pid==pi.pid) exitCode=unchecked((int)ev.exitOrException);
      } else if(ev.code==6 && ev.file!=IntPtr.Zero) { CloseHandle(ev.file); }
      else if(ev.code==1 && ev.exitOrException!=0x80000003 && ev.exitOrException!=0x4000001f) disposition=0x80010001;
      if(!ContinueDebugEvent(ev.pid,ev.tid,disposition)) throw new Win32Exception(Marshal.GetLastWin32Error());
      if(count==0) return exitCode;
    }
  }
}
'@
$request=[Console]::In.ReadLine() | ConvertFrom-Json
$code=[PortableTreeObserver]::Run($request.executable,$request.command,$request.cwd)
exit $code
} catch {
  [Console]::Out.WriteLine(('@@PORTABLE@@'+(@{kind='observer-error';message=$_.Exception.Message} | ConvertTo-Json -Compress)))
  exit 1
}
`;
  const child = spawn(SHELL, ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden',
    '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { ...options, stdio: ['pipe', 'pipe', 'pipe'] });
  const quote = value => '"' + value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1') + '"';
  child.stdin.on('error', error => { if (error.code !== 'EPIPE') monitor.errors.push(error.message); });
  child.stdin.end(JSON.stringify({ executable, command: [executable, ...args].map(quote).join(' '), cwd: options.cwd }) + '\n');
  let pending = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    pending += chunk;
    let end;
    while ((end = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, end).replace(/^\uFEFF/, '').trim(); pending = pending.slice(end + 1);
      if (!line.startsWith('@@PORTABLE@@')) {
        evidence.stdout = (evidence.stdout + line + '\n').slice(-64_000);
        continue;
      }
      try {
        const event = JSON.parse(line.slice('@@PORTABLE@@'.length));
        event.at = new Date().toISOString();
        if (event.kind === 'root') evidence.wrapperPid = event.pid;
        else if (event.kind === 'observer-error') monitor.errors.push(event.message);
        else monitor.events.push(event);
      } catch { monitor.errors.push('Invalid owned process observer output: ' + line); }
    }
  });
  return child;
}
function descendants(roots, records) {
  const ids = new Set(roots.filter(Number.isInteger));
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of records) if (ids.has(item.parentPid) && !ids.has(item.pid)) { ids.add(item.pid); changed = true; }
  }
  return ids;
}
async function proveLineage(run, snapshot) {
  // Trace remains useful when NSIS has already exited/reparented Electron.
  const deadline = Date.now() + 6000;
  let ids;
  do {
    ids = descendants([run.evidence.wrapperPid], [...snapshot, ...run.monitor.events.filter(item => item.kind === 'start')]);
    if (ids.has(run.status.pid)) return [...ids];
    await delay(100);
  } while (Date.now() < deadline);
  assert.fail('Electron PID does not descend from the copied portable wrapper: ' + JSON.stringify({ wrapper: run.evidence.wrapperPid, runtime: run.status.pid }));
}
async function verifyListeners(run) {
  assert(Number.isInteger(run.trustedPid), 'Cannot inspect an untrusted PID');
  const parsed = JSON.parse(await powershell("@(Get-NetTCPConnection -State Listen -OwningProcess " + run.trustedPid +
    " -ErrorAction Stop | Select-Object LocalAddress,LocalPort,OwningProcess) | ConvertTo-Json -Compress"));
  const listeners = Array.isArray(parsed) ? parsed : [parsed];
  const httpPort = Number(new URL(run.status.origin).port);
  for (const port of [httpPort, run.status.debugPort]) {
    assert(listeners.some(item => item.LocalPort === port && item.OwningProcess === run.trustedPid), 'HTTP/CDP listener is not owned by status.pid: ' + port);
  }
  for (const item of listeners) {
    assert(['127.0.0.1', '::1'].includes(item.LocalAddress), 'Electron listener exposed outside loopback: ' + JSON.stringify(item));
    if (item.LocalPort === httpPort) assert.equal(item.LocalAddress, '127.0.0.1');
  }
  run.evidence.listeners = listeners;
  return listeners;
}
async function peMachine(file) {
  const handle = await fs.open(file, 'r');
  try {
    const header = Buffer.alloc(64);
    await handle.read(header, 0, 64, 0);
    assert.equal(header.toString('ascii', 0, 2), 'MZ', 'Not a Windows PE executable');
    const offset = header.readUInt32LE(0x3c), pe = Buffer.alloc(6);
    assert(offset > 0 && offset < (await handle.stat()).size - 6, 'Invalid PE header location');
    await handle.read(pe, 0, 6, offset);
    assert.equal(pe.toString('ascii', 0, 4), 'PE\0\0');
    return pe.readUInt16LE(4) === 0x8664 ? 'x64' : '0x' + pe.readUInt16LE(4).toString(16);
  } finally { await handle.close(); }
}
async function inspectHostInputMethod(executablePath) {
  // Windows loads the user's active IME into GUI applications; its signed host
  // may be parented to Electron. This is not an app-launched runtime/browser.
  // Retain every such process and its physical-file/signature proof in JSON.
  const installed = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'SogouInput/SogouExe/SogouExe.exe');
  if (normalPath(executablePath) !== normalPath(installed)) return null;
  const literal = executablePath.replaceAll("'", "''");
  const proof = JSON.parse(await powershell("$file='" + literal + "'; $sig=Get-AuthenticodeSignature -LiteralPath $file; $version=(Get-Item -LiteralPath $file).VersionInfo; " +
    "[pscustomobject]@{path=$file;signatureStatus=[string]$sig.Status;signer=$sig.SignerCertificate.Subject;company=$version.CompanyName;product=$version.ProductName;version=$version.FileVersion} | ConvertTo-Json -Compress"));
  if (proof.signatureStatus !== 'Valid' || !/Beijing Sogou Technology Development Co\., Ltd\./i.test(proof.signer || '') ||
    !/^Sogou/i.test(proof.company || '') || !/搜狗|Sogou/i.test(proof.product || '')) return null;
  proof.sha256 = await hashFile(executablePath);
  return proof;
}
async function auditProcesses(runs, monitor) {
  assert(monitor.ready && !monitor.ended && monitor.errors.length === 0, 'Process observer stopped or lost events');
  // Allow the event consumer to drain the most recent exit indications.
  await delay(300);
  const snapshot = await processSnapshot();
  const identity = processAuditIdentities(nativeRootIdentities(runs, monitor.events), monitor.events, snapshot);
  const { ids, owned } = identity;
  const forbidden = owned.filter(item => /^(?:msedge|chrome|node(?:_repl)?|dotnet|powershell|pwsh|csc|msbuild)(?:\.exe)?$/i.test(item.name || ''));
  // Only the actual independently proved outer/main executable paths qualify.
  // Neither an arbitrary executable under TEMP nor any System32 binary is an
  // automatic dependency exception. Incidental signed IME hosts are separate.
  const allowedExecutables = new Set(runs.flatMap(run => [run.evidence.executable, run.trustedExecutable].filter(Boolean)).map(normalPath));
  const outside = owned.filter(item => !item.executablePath || !allowedExecutables.has(normalPath(item.executablePath)));
  const hostInputMethods = [], unexpected = [], proofs = new Map();
  for (const item of outside) {
    if (!item.executablePath) { unexpected.push(item); continue; }
    if (!proofs.has(item.executablePath)) proofs.set(item.executablePath, await inspectHostInputMethod(item.executablePath));
    const proof = proofs.get(item.executablePath);
    if (proof) hostInputMethods.push({ process: item, proof });
    else unexpected.push(item);
  }
  const result = { roots: runs.map(run => ({ wrapperPid: run.evidence.wrapperPid, runtimePid: run.trustedPid })),
    descendants: [...ids], processes: owned, forbidden, outsideOwnedRuntime: outside, hostInputMethods, unexpectedOutsideRuntime: unexpected,
    identitySource: 'Complete native DEBUG_PROCESS CREATE/EXIT events, not historical numeric PID membership',
    snapshotPidReuse: identity.snapshotPidReuse };
  assert.deepEqual(forbidden, [], 'Copied EXE spawned an installed browser/Node/.NET: ' + JSON.stringify(forbidden));
  assert.deepEqual(unexpected, [], 'Unexpected executable outside owned runtime/system: ' + JSON.stringify(unexpected));
  return result;
}
function nativeRootIdentities(runs, events) {
  return runs.map(run => {
    const root = events.find(event => event.kind === 'start' && event.pid === run.evidence.wrapperPid &&
      event.executablePath && normalPath(event.executablePath) === normalPath(run.evidence.executable) &&
      Date.parse(event.createdAt || event.at) >= Date.parse(run.evidence.startedAt));
    assert(root, 'Cannot identify the exact native root CREATE generation: ' + run.evidence.label);
    return root;
  });
}
function processAuditIdentities(roots, events, snapshot) {
  const lifetimes = [], active = new Map(), rootsSet = new Set(roots);
  assert(roots.every(root => root.kind === 'start' && events.includes(root)), 'Root identities must be actual CREATE records, not numeric PIDs');
  for (const event of events) {
    if (event.kind === 'start') {
      const life = { start: event, birth: Date.parse(event.createdAt || event.at), stop: null };
      lifetimes.push(life);
      active.set(event.pid, life);
    } else if (event.kind === 'stop') {
      const life = event.birthFileTime ? lifetimes.find(item => item.start.pid === event.pid && item.start.birthFileTime === event.birthFileTime) : active.get(event.pid);
      assert(life, 'Native EXIT has no corresponding CREATE identity: ' + JSON.stringify(event));
      life.stop = event;
      if (active.get(event.pid) === life) active.delete(event.pid);
    }
  }
  const belongs = (life, visiting = new Set()) => {
    if (life.owned !== undefined) return life.owned;
    assert(!visiting.has(life), 'Native parent lifetime cycle');
    if (rootsSet.has(life.start)) return life.owned = true;
    visiting.add(life);
    // An old parent's numeric PID is not authority after its lifetime ends.
    const parent = lifetimes.filter(item => item !== life && item.start.pid === life.start.parentPid &&
      item.birth <= life.birth && (!item.stop || Date.parse(item.stop.observedAt || item.stop.at) >= life.birth))
      .sort((a, b) => b.birth - a.birth)[0];
    life.owned = Boolean(parent && belongs(parent, visiting));
    visiting.delete(life);
    return life.owned;
  };
  const ownedLifetimes = lifetimes.filter(life => belongs(life));
  const ids = new Set(ownedLifetimes.map(life => life.start.pid));
  const current = [], snapshotPidReuse = [];
  for (const process of snapshot.filter(item => ids.has(item.pid))) {
    const life = active.get(process.pid), start = life?.start;
    // CIM's DMTF timestamp has microsecond precision; GetProcessTimes is 100 ns.
    const sameBirth = start?.birthFileTime && process.birthFileTime ? BigInt(start.birthFileTime) / 10n === BigInt(process.birthFileTime) / 10n :
      Number.isFinite(Date.parse(process.createdAt)) && Date.parse(process.createdAt) <= Date.parse(start?.at);
    if (life?.owned && !life.stop && start && sameBirth && process.executablePath && start.executablePath &&
        normalPath(process.executablePath) === normalPath(start.executablePath) &&
        process.parentPid === start.parentPid) {
      current.push(process);
    } else snapshotPidReuse.push({ snapshot: process, historicalLifetimes: ownedLifetimes.filter(item => item.start.pid === process.pid),
      reason: start ? 'Snapshot does not match the live native process identity' : 'Native EXIT preceded the snapshot; numeric PID is no longer owned' });
  }
  // The debugger sees every descendant before its first instruction, including
  // short-lived forbidden children. A stale/recycled PID in a later global
  // snapshot must never enroll an unrelated user process into that owned tree.
  return { ids, owned: [...ownedLifetimes.map(item => item.start), ...current], current, snapshotPidReuse };
}
async function stop(run) {
  if (run.stopped) return run.evidence.shutdown;
  assert(run.trustedPid && pidAlive(run.trustedPid), 'Electron main already exited before authenticated shutdown: ' + run.evidence.label);
  await verifyListeners(run);
  assert(run.status.shutdownToken && run.status.origin, 'No authenticated shutdown capability');
  const response = await request(run.status.origin, '/_portable/shutdown?token=' + encodeURIComponent(run.status.shutdownToken), { method: 'POST' });
  assert([200, 202, 204].includes(response.status), 'Authenticated shutdown failed: ' + response.status);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && (pidAlive(run.trustedPid) || !run.ended)) await delay(100);
  assert(!pidAlive(run.trustedPid), 'Electron main did not exit after authenticated shutdown');
  assert(run.ended, 'Owned native supervisor did not finish after the complete portable tree exited');
  assert.equal(run.evidence.supervisorExitCode, 0, 'Portable native supervisor exit must be zero');
  const wrapperExits = run.monitor.events.filter(item => item.kind === 'stop' && item.pid === run.evidence.wrapperPid);
  assert.equal(wrapperExits.length, 1, 'Native observer must independently capture the current outer EXE exit');
  assert.equal(wrapperExits[0].exitCode, 0, 'Current outer portable EXE exit must be zero');
  run.evidence.wrapperExitCode = wrapperExits[0].exitCode;
  for (const origin of [run.status.origin, 'http://127.0.0.1:' + run.status.debugPort]) {
    let reachable = false;
    try { await request(origin, '/_portable/status', { timeout: 2500 }); reachable = true; } catch { /* expected refusal */ }
    assert(!reachable, 'HTTP/CDP listener survived shutdown: ' + origin);
  }
  const snapshot = await processSnapshot();
  const identity = processAuditIdentities(nativeRootIdentities([run], run.monitor.events), run.monitor.events, snapshot);
  const leaked = identity.current.filter(item => item.executablePath &&
    [run.ownedDir, run.tempDir].filter(Boolean).some(root => inside(root, item.executablePath)));
  assert.deepEqual(leaked, [], 'Owned Electron child processes survived shutdown');
  const exits = run.monitor.events.filter(item => item.kind === 'stop' && item.pid === run.trustedPid);
  assert.equal(exits.length, 1, 'Native observer must independently capture the Electron main exit');
  for (const exit of exits) assert.equal(exit.exitCode, 0, 'Electron main nonzero exit');
  run.stopped = true;
  return run.evidence.shutdown = { authenticated: true, status: response.status,
    runtimePidStopped: run.trustedPid, wrapperExitCode: run.evidence.wrapperExitCode,
    runtimeExitTrace: exits, wrapperExitTrace: wrapperExits, listenersStopped: true, leakedChildren: leaked };
}
async function forceCleanup(run) {
  run.evidence.forcedCleanup = true;
  // Never trust an arbitrary status PID or kill by browser/process name.
  const snapshot = await processSnapshot();
  const roots = run.evidence.wrapperPid ? nativeRootIdentities([run], run.monitor.events) : [];
  const identity = processAuditIdentities(roots, run.monitor.events, snapshot);
  const victims = identity.current.filter(item => item.executablePath &&
    ([run.ownedDir, run.tempDir].filter(Boolean).some(root => inside(root, item.executablePath)) || normalPath(item.executablePath) === normalPath(run.evidence.executable)));
  run.evidence.forcedCleanupPids = victims.map(item => item.pid);
  for (const item of victims) {
    try { process.kill(item.pid); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  // Terminate the owned supervisor even if interruption preceded its root-PID
  // announcement. Kill-on-debugger-exit is disabled: unrelated user IME services
  // are detached, never killed as a side effect of stopping our supervisor.
  if (!run.ended) { run.evidence.forcedSupervisorCleanup = true; run.child.kill(); }
  await delay(300);
  const remaining = victims.filter(item => pidAlive(item.pid));
  assert.deepEqual(remaining, [], 'Owned process cleanup incomplete');
}
async function mp4SampleEntries(file) {
  const buffer = await fs.readFile(file), found = new Set();
  // Parse the real moov/trak/mdia/minf/stbl/stsd hierarchy; do not mistake a
  // codec brand in ftyp or arbitrary compressed bytes for a sample entry.
  function walk(start, end) {
    for (let offset = start; offset + 8 <= end;) {
      let size = buffer.readUInt32BE(offset), header = 8;
      const type = buffer.toString('ascii', offset + 4, offset + 8);
      if (size === 1) { assert(offset + 16 <= end); size = Number(buffer.readBigUInt64BE(offset + 8)); header = 16; }
      if (size === 0) size = end - offset;
      assert(Number.isSafeInteger(size) && size >= header && offset + size <= end, 'Invalid MP4 box in ' + file);
      if (type === 'stsd') {
        assert(offset + header + 8 <= offset + size, 'Truncated MP4 stsd');
        const count = buffer.readUInt32BE(offset + header + 4);
        let cursor = offset + header + 8;
        for (let index = 0; index < count; index++) {
          assert(cursor + 8 <= offset + size, 'Truncated MP4 sample entry');
          const length = buffer.readUInt32BE(cursor);
          assert(length >= 8 && cursor + length <= offset + size, 'Invalid MP4 sample entry');
          found.add(buffer.toString('ascii', cursor + 4, cursor + 8));
          cursor += length;
        }
      } else if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) walk(offset + header, offset + size);
      offset += size;
    }
  }
  walk(0, buffer.length);
  return [...found];
}
function byPath(a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; }
function encodedPath(file) { return '/' + file.split('/').map(encodeURIComponent).join('/'); }
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
    '.glb': /^model\/gltf-binary\b/i, '.mp4': /^video\/mp4\b/i, '.txt': /^text\/plain\b/i,
    '.jpg': /^image\/jpeg\b/i, '.jpeg': /^image\/jpeg\b/i, '.svg': /^image\/svg\+xml\b/i,
    '.webp': /^image\/webp\b/i, '.gif': /^image\/gif\b/i, '.ttf': /^font\/ttf\b/i, '.otf': /^font\/otf\b/i })[path.extname(file).toLowerCase()];
}
function request(origin, rawPath, { method = 'GET', headers = {}, collect = false, timeout = 60_000 } = {}) {
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
      response.on('aborted', () => reject(new Error(method + ' ' + rawPath + ': response aborted')));
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, bytes, sha256: hash.digest('hex'), ...(collect ? { body: Buffer.concat(chunks) } : {}) }));
    });
    req.setTimeout(timeout, () => req.destroy(new Error(`${method} ${rawPath}: HTTP timeout`)));
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
