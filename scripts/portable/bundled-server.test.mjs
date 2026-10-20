import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Catches serving arbitrary disk files, broken video seeking and unauthenticated
// shutdown in the real portable application's local server, without Electron mocks.
test('bundled server serves only verified assets with exact ranges and private shutdown', async () => {
  let module;
  try { module = await import('./bundled-server.cjs'); } catch (error) {
    assert.fail(`Embedded-browser server has not been implemented: ${error.code}`);
  }
  const root = await mkdtemp(join(tmpdir(), 'lion-bundled-test-'));
  const bytes = Buffer.from('0123456789');
  await writeFile(join(root, 'index.html'), bytes);
  await writeFile(join(root, 'private.txt'), 'not published');
  const manifest = { buildId: 'test', files: [{ path: 'index.html', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }] };
  let stopped = false;
  const server = await module.default.startServer({ root, manifest, port: 0, token: 'secret', onShutdown() { stopped = true; } });
  const request = (path, options = {}) => new Promise((resolve, reject) => {
    const req = http.request(server.origin, { ...options, path }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ code: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }); req.on('error', reject); req.end();
  });
  try {
    assert.deepEqual((await request('/')).body, bytes);
    assert.equal((await request('/private.txt')).code, 404);
    assert.equal((await request('/%2e%2e/private.txt')).code, 403);
    assert.equal((await request('/', { headers: { Host: 'evil.invalid' } })).code, 403);
    assert.equal((await request('/', { method: 'POST' })).code, 405);
    const head = await request('/', { method: 'HEAD' });
    assert.equal(head.body.length, 0); assert.equal(head.headers['content-length'], '10');
    for (const [range, expected] of [['bytes=2-4', '234'], ['bytes=7-', '789'], ['bytes=-2', '89']]) {
      const res = await request('/', { headers: { Range: range } });
      assert.equal(res.code, 206); assert.equal(res.body.toString(), expected);
    }
    for (const range of ['bytes=20-', 'bytes=4-2', 'bytes=0-1,4-5', 'bytes=-0'])
      assert.equal((await request('/', { headers: { Range: range } })).code, 416);
    assert.equal((await request('/_portable/shutdown?token=wrong', { method: 'POST' })).code, 403);
    assert.equal(stopped, false);
    assert.equal((await request('/_portable/shutdown?token=secret', { method: 'POST' })).code, 200);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(stopped, true);
  } finally { await server.close(); }
});
