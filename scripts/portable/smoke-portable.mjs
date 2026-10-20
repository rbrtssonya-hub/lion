import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import http from 'node:http';

// A missing embedded site, broken range response or exposed local file fails
// against the real EXE, not a mock server or source-text assertion.
const exe = resolve(process.argv[2] || 'tmp/portable-not-built/南风有狮.exe');
assert.ok(existsSync(exe), 'The complete single-file portable EXE has not been built');
const root = resolve('tmp/portable-smoke', randomUUID());
mkdirSync(root, { recursive: true });
const statusFile = join(root, 'status.json');
const child = spawn(exe, ['--serve-only', '--port=0', `--status-file=${statusFile}`, `--data-dir=${join(root, 'cache')}`], {
  windowsHide: true, env: { ...process.env, PATH: `${process.env.SystemRoot}\\System32` }, stdio: 'ignore',
});
let status;
const request = (origin, path, options = {}) => new Promise((resolve, reject) => {
  // Keep the raw path: URL construction otherwise normalizes ../ before sending.
  const req = http.request(origin, { ...options, path }, res => {
    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => resolve({ code: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks) }));
  });
  req.on('error', reject); req.end();
});
try {
  const started = Date.now();
  while (Date.now() - started < 60_000) {
    if (existsSync(statusFile)) {
      try { status = JSON.parse(readFileSync(statusFile, 'utf8')); } catch {}
      if (status?.state === 'ready' || status?.state === 'error') break;
    }
    assert.equal(child.exitCode, null, 'EXE must stay alive while preparing its embedded site');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(status?.state, 'ready', JSON.stringify(status));
  const manifestResponse = await request(status.origin, '/_portable/manifest');
  assert.equal(manifestResponse.code, 200);
  const manifest = JSON.parse(manifestResponse.bytes);
  assert.equal(manifest.files.length, status.fileCount);
  assert.ok(manifest.files.length >= 90, 'Include the Vite bundles and every public asset');
  for (const path of ['index.html', 'assets/loading/index.html', 'assets/models/lion-structure-optimized.glb']) {
    const file = manifest.files.find(file => file.path === path);
    assert.ok(file, `${path} is embedded`);
    const res = await request(status.origin, `/${path}`);
    assert.equal(res.code, 200);
    assert.equal(res.bytes.length, file.bytes);
    assert.equal(createHash('sha256').update(res.bytes).digest('hex'), file.sha256);
    const head = await request(status.origin, `/${path}`, { method: 'HEAD' });
    assert.equal(head.code, 200); assert.equal(head.bytes.length, 0);
    assert.equal(Number(head.headers['content-length']), file.bytes);
  }
  const path = '/assets/entry/home-lion-loop.mp4';
  const complete = readFileSync(join(status.siteRoot, path.slice(1)));
  for (const [range, from, until] of [['bytes=0-63', 0, 64], ['bytes=100-', 100, complete.length], ['bytes=-64', complete.length - 64, complete.length]]) {
    const res = await request(status.origin, path, { headers: { Range: range } });
    assert.equal(res.code, 206, range);
    assert.deepEqual(res.bytes, complete.subarray(from, until));
    assert.equal(res.headers['content-range'], `bytes ${from}-${until - 1}/${complete.length}`);
  }
  assert.equal((await request(status.origin, path, { headers: { Range: 'bytes=999999999-' } })).code, 416);
  assert.equal((await request(status.origin, '/assets/missing.glb')).code, 404);
  assert.equal((await request(status.origin, path, { method: 'POST' })).code, 405);
  assert.ok([400, 403].includes((await request(status.origin, '/%2e%2e/AGENTS.md')).code));
  assert.ok([400, 403].includes((await request(status.origin, '/', { headers: { Host: 'attacker.invalid' } })).code));
  assert.equal((await request(status.origin, '/_portable/shutdown?token=wrong', { method: 'POST' })).code, 403);
  assert.equal((await request(status.origin, '/')).code, 200, 'Bad requests cannot kill the server');
  console.log(JSON.stringify({ status: 'passed', fileCount: manifest.files.length, buildId: status.buildId, origin: status.origin }));
} finally {
  if (status?.shutdownToken) await request(status.origin, `/_portable/shutdown?token=${status.shutdownToken}`, { method: 'POST' }).catch(() => {});
  if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 3000))]);
  if (child.exitCode === null) child.kill();
}
