import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { startAssistantServer } from '../../scripts/assistant/server.mjs';
import { copyAssistantRuntime } from '../../scripts/assistant/package-runtime.mjs';
import { xiaoxingPlugin } from '../../scripts/assistant/vite-plugin.mjs';

const WAV = Buffer.alloc(46);
WAV.write('RIFF'); WAV.writeUInt32LE(38, 4); WAV.write('WAVEfmt ', 8);
WAV.writeUInt32LE(16, 16); WAV.writeUInt16LE(1, 20); WAV.writeUInt16LE(1, 22);
WAV.writeUInt32LE(32000, 24); WAV.writeUInt32LE(64000, 28); WAV.writeUInt16LE(2, 32); WAV.writeUInt16LE(16, 34);
WAV.write('data', 36); WAV.writeUInt32LE(2, 40);
const MAX_AUDIO = 20 * 1024 * 1024;
const SPEECH = '/api/xiaoxing/speech';

async function listen(handler) {
  const server = http.createServer((req, res) => { Promise.resolve(handler(req, res)).catch(error => res.destroy(error)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
const post = (url, body = { text: '你好，我是小醒。' }, headers = {}, options = {}) => fetch(url + SPEECH, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: url, ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body), ...options,
});
async function speech(options = {}) {
  const { createSpeechHandler } = await import('../../scripts/assistant/speech.mjs');
  return createSpeechHandler(options);
}
async function readInput(req) {
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks));
}
const wavReply = (_req, res) => { res.writeHead(200, { 'Content-Type': 'audio/wav' }); res.end(WAV); };
const until = async promise => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(Error('HTTP event did not arrive')), 2500).unref())]);

test('standalone server registers speech and forwards only fixed GPT-SoVITS parameters', async () => {
  let request;
  const upstream = await listen(async (req, res) => { assert.equal(req.url, '/tts'); request = await readInput(req); wavReply(req, res); });
  const server = await startAssistantServer({ port: 0, env: { XIAOXING_TTS_URL: upstream.url + '/tts', XIAOXING_TTS_REFERENCE_TEXT: '固定参考文字。' } });
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await post(url, { text: '  你好，我是小醒。  ' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'audio/wav');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), WAV);
    assert.deepEqual(request, {
      text: '你好，我是小醒。', text_lang: 'all_zh',
      ref_audio_path: path.resolve('source/characters/xiaoxing/voice/reference.wav'),
      prompt_text: '固定参考文字。', prompt_lang: 'zh', text_split_method: 'cut5', batch_size: 1,
      media_type: 'wav', streaming_mode: false, parallel_infer: false, use_cuda_graph: false, use_flash_attention: false, seed: 42,
    });
  } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); await upstream.close(); }
});

test('speech normalizes AI for speech and selects pure Chinese or mixed language without changing the text contract', async () => {
  const requests = [];
  const upstream = await listen(async (req, res) => { requests.push(await readInput(req)); wavReply(req, res); });
  const app = await listen(await speech({ env: { XIAOXING_TTS_URL: upstream.url + '/tts' } }));
  try {
    for (const text of ['  你好，我是小醒。  ', '此处是AI辅助创作，ai只是辅助。', '此页面使用React与AI。']) {
      const response = await post(app.url, { text }); assert.equal(response.status, 200); await response.arrayBuffer();
    }
    assert.deepEqual(requests.map(({ text, text_lang, prompt_lang }) => ({ text, text_lang, prompt_lang })), [
      { text: '你好，我是小醒。', text_lang: 'all_zh', prompt_lang: 'zh' },
      { text: '此处是人工智能辅助创作，人工智能只是辅助。', text_lang: 'all_zh', prompt_lang: 'zh' },
      { text: '此页面使用React与人工智能。', text_lang: 'zh', prompt_lang: 'zh' },
    ]);
  } finally { await app.close(); await upstream.close(); }
});

test('actual Vite dev and preview both install the same-origin speech endpoint', async () => {
  const { createServer, preview } = await import('vite');
  const parent = path.resolve('tmp'); await fs.mkdir(parent, { recursive: true });
  const root = await fs.mkdtemp(path.join(parent, 'xiaoxing-vite-speech-'));
  await fs.mkdir(path.join(root, 'dist')); await fs.writeFile(path.join(root, 'index.html'), '<!doctype html><title>fixture</title>');
  await fs.copyFile(path.join(root, 'index.html'), path.join(root, 'dist/index.html'));
  const upstream = await listen(wavReply);
  const previousUrl = process.env.XIAOXING_TTS_URL;
  process.env.XIAOXING_TTS_URL = upstream.url + '/tts';
  try {
    for (const mode of ['dev', 'preview']) {
      const config = { configFile: false, root, plugins: [xiaoxingPlugin()], logLevel: 'silent', server: { host: '127.0.0.1', port: 0 }, preview: { host: '127.0.0.1', port: 0 } };
      const server = mode === 'dev' ? await createServer(config) : await preview(config);
      try {
        if (mode === 'dev') await server.listen();
        const response = await post(`http://127.0.0.1:${server.httpServer.address().port}`);
        assert.equal(response.status, 200, mode); assert.deepEqual(Buffer.from(await response.arrayBuffer()), WAV);
      } finally { await server.close(); }
    }
  } finally {
    if (previousUrl === undefined) delete process.env.XIAOXING_TTS_URL; else process.env.XIAOXING_TTS_URL = previousUrl;
    await upstream.close();
  }
});

test('speech validates text, JSON size, method and disallows client reference/config overrides over HTTP', async () => {
  let calls = 0;
  const upstream = await listen((req, res) => { calls++; wavReply(req, res); });
  const app = await listen(await speech({ env: { XIAOXING_TTS_URL: upstream.url + '/tts' } }));
  try {
    for (const value of [null, [], {}, { text: '' }, { text: '   ' }, { text: 123 }, { text: '好'.repeat(1201) }, { text: '你好', ref_audio_path: '/private/other.wav' }, { text: '你好', url: 'https://other.invalid' }]) {
      assert.equal((await post(app.url, value)).status, 400, JSON.stringify(value).slice(0, 90));
    }
    assert.equal((await post(app.url, '{invalid')).status, 400);
    assert.equal((await post(app.url, { text: '你好' }, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await post(app.url, 'x'.repeat(17000))).status, 413);
    const chunked = await new Promise((resolve, reject) => {
      const req = http.request(app.url + SPEECH, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
      req.on('error', reject); req.write('x'.repeat(9000)); req.end('x'.repeat(9000));
    });
    assert.equal(chunked, 413);
    assert.equal((await fetch(app.url + SPEECH)).status, 405);
    assert.equal(calls, 0);
    const valid = await post(app.url, { text: '好'.repeat(1200) });
    assert.equal(valid.status, 200); await valid.arrayBuffer(); assert.equal(calls, 1);
  } finally { await app.close(); await upstream.close(); }
});

test('speech applies chat-equivalent origin, token and OPTIONS rules', async () => {
  const upstream = await listen(wavReply);
  const app = await listen(await speech({ env: { XIAOXING_TTS_URL: upstream.url + '/tts', XIAOXING_ACCESS_TOKEN: 'server-only', XIAOXING_ALLOWED_ORIGINS: 'https://exhibit.example' } }));
  try {
    assert.equal((await post(app.url, undefined, { Origin: 'https://evil.invalid' })).status, 403);
    assert.equal((await post(app.url)).status, 401);
    const headers = { Origin: 'https://exhibit.example', Authorization: 'Bearer server-only' };
    const preflight = await fetch(app.url + SPEECH, { method: 'OPTIONS', headers });
    assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), headers.Origin);
    assert.equal(preflight.headers.get('access-control-allow-methods'), 'POST');
    const response = await post(app.url, undefined, headers);
    assert.equal(response.status, 200); assert.equal(response.headers.get('access-control-allow-origin'), headers.Origin);
    await response.arrayBuffer();
  } finally { await app.close(); await upstream.close(); }
});

test('speech only accepts server-configured HTTPS or loopback HTTP, and offline allows local inference', async () => {
  for (const value of ['http://example.com/tts', 'file:///private.wav', 'https://user:secret@example.com/tts', 'https://example.com/tts?key=secret', 'https://example.com/tts#ref', 'invalid']) {
    let called = false;
    const app = await listen(await speech({ env: { XIAOXING_TTS_URL: value }, fetchImpl: () => { called = true; throw Error(); } }));
    try { const response = await post(app.url); assert.equal(response.status, 503); assert.equal(called, false); assert.ok(!(await response.text()).includes(value)); }
    finally { await app.close(); }
  }
  let called = false;
  const remote = await listen(await speech({ offline: true, env: { XIAOXING_TTS_URL: 'https://tts.example/tts' }, fetchImpl: () => { called = true; throw Error(); } }));
  try { assert.equal((await post(remote.url)).status, 503); assert.equal(called, false); } finally { await remote.close(); }
  const upstream = await listen(wavReply);
  const local = await listen(await speech({ offline: true, env: { XIAOXING_TTS_URL: upstream.url + '/tts' } }));
  try { const response = await post(local.url); assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), WAV); }
  finally { await local.close(); await upstream.close(); }
});

test('speech returns explicit JSON for upstream errors, redirects, wrong MIME and fake WAV without leaking details', async () => {
  let redirects = 0;
  const target = await listen((req, res) => { redirects++; wavReply(req, res); });
  for (const scenario of [
    { status: 503, type: 'application/json', body: '{"private":"secret-model-path"}' },
    { status: 200, type: 'application/json', body: '{"secret":"private"}' },
    { status: 200, type: 'audio/wav', body: 'not really wave' },
    { status: 200, type: 'audio/wav', body: 'RIFF' },
    { status: 302, type: 'audio/wav', body: WAV, location: target.url + '/tts' },
  ]) {
    const upstream = await listen((_req, res) => { res.writeHead(scenario.status, { 'Content-Type': scenario.type, ...(scenario.location ? { Location: scenario.location } : {}) }); res.end(scenario.body); });
    const app = await listen(await speech({ env: { XIAOXING_TTS_URL: upstream.url + '/tts', XIAOXING_TTS_REFERENCE_AUDIO: '/private/secret-model-path.wav' } }));
    try {
      const response = await post(app.url); assert.equal(response.status, 502); assert.match(response.headers.get('content-type'), /application\/json/);
      const body = await response.text(); assert.ok(JSON.parse(body).error); assert.ok(!/secret|private|127\.0\.0\.1/.test(body));
    } finally { await app.close(); await upstream.close(); }
  }
  assert.equal(redirects, 0); await target.close();
});

test('speech bounds WAV bytes with declared and chunked response bodies', async () => {
  for (const declared of [true, false]) {
    const upstream = await listen((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'audio/wav', ...(declared ? { 'Content-Length': MAX_AUDIO + 1 } : {}) });
      res.write(WAV); res.end(Buffer.alloc(MAX_AUDIO));
    });
    const app = await listen(await speech({ env: { XIAOXING_TTS_URL: upstream.url + '/tts' } }));
    try { const response = await post(app.url); assert.equal(response.status, 502); assert.ok((await response.json()).error); }
    finally { await app.close(); await upstream.close(); }
  }
});

test('speech timeout aborts a real upstream HTTP connection', async () => {
  let closed;
  const upstreamClosed = new Promise(resolve => { closed = resolve; });
  const upstream = await listen(async (req, res) => { await readInput(req); res.once('close', closed); });
  const app = await listen(await speech({ env: { XIAOXING_TTS_URL: upstream.url + '/tts', XIAOXING_TTS_TIMEOUT_MS: '500' } }));
  try {
    const started = Date.now(), response = await post(app.url);
    assert.equal(response.status, 504); assert.ok((await response.json()).error);
    assert.ok(Date.now() - started < 2000); await until(upstreamClosed);
  } finally { await app.close(); await upstream.close(); }
});

test('client cancellation keeps the upstream and generation gate until inference completes, then discards the result', async () => {
  for (const startedAudio of [false, true]) {
    let arrived, release, finished, upstreamClosed = false, calls = 0;
    const upstreamArrived = new Promise(resolve => { arrived = resolve; });
    const generation = new Promise(resolve => { release = resolve; });
    const upstreamFinished = new Promise(resolve => { finished = resolve; });
    const upstream = await listen(async (req, res) => {
      await readInput(req); calls++;
      if (calls > 1) return wavReply(req, res);
      res.once('close', () => { upstreamClosed = true; }); res.once('finish', finished);
      if (startedAudio) { res.writeHead(200, { 'Content-Type': 'audio/wav' }); res.write(WAV); }
      arrived(); await generation;
      if (startedAudio) res.end(); else wavReply(req, res);
    });
    const app = await listen(await speech({ env: { XIAOXING_TTS_URL: upstream.url + '/tts' } }));
    const controller = new AbortController();
    try {
      const pending = post(app.url, undefined, {}, { signal: controller.signal });
      await until(upstreamArrived); controller.abort();
      await assert.rejects(pending, { name: 'AbortError' });
      await new Promise(resolve => setTimeout(resolve, 60));
      assert.equal(upstreamClosed, false, 'client cancellation must not be mistaken for stopping model inference');
      const blocked = await post(app.url);
      assert.equal(blocked.status, 429); assert.equal(calls, 1, 'no second synthesis may be queued while the first still runs');
      release(); await until(upstreamFinished);
      let restored;
      for (let attempt = 0; attempt < 5; attempt++) {
        restored = await post(app.url);
        if (restored.status !== 429) break;
        await restored.json(); await new Promise(resolve => setTimeout(resolve, 25));
      }
      assert.equal(restored.status, 200); assert.deepEqual(Buffer.from(await restored.arrayBuffer()), WAV);
      assert.equal(calls, 2, 'inference becomes available after the abandoned generation actually finishes');
    } finally { release(); await app.close(); await upstream.close(); }
  }
});

test('speech rate limit and one active generation bound GPU use over real HTTP', async () => {
  let release, arrived;
  const gate = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { arrived = resolve; });
  const upstream = await listen(async (req, res) => { await readInput(req); arrived(); await gate; wavReply(req, res); });
  const app = await listen(await speech({ env: { XIAOXING_TTS_URL: upstream.url + '/tts' }, rateLimit: 3 }));
  try {
    const first = post(app.url); await until(entered);
    const busy = await post(app.url); assert.equal(busy.status, 429); assert.equal(busy.headers.get('retry-after'), '1');
    release(); assert.equal((await first).status, 200);
    const third = await post(app.url); assert.equal(third.status, 200); await third.arrayBuffer();
    const limited = await post(app.url); assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '60');
  } finally { release(); await app.close(); await upstream.close(); }
});

test('portable runtime includes only required speech source/reference and routes local TTS while offline', async () => {
  const { startServer } = await import('../../scripts/portable/bundled-server.cjs');
  const parent = path.resolve('tmp'); await fs.mkdir(parent, { recursive: true });
  const fixture = await fs.mkdtemp(path.join(parent, 'xiaoxing-speech-package-'));
  const project = path.join(fixture, 'project'), appDir = path.join(fixture, 'app');
  const runtimeFiles = ['scripts/assistant/api.mjs', 'scripts/assistant/speech.mjs', 'src/features/assistant/knowledge.js'];
  for (const name of runtimeFiles) { const destination = path.join(project, name); await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.copyFile(path.resolve(name), destination); }
  const reference = 'source/characters/xiaoxing/voice/reference.wav';
  await fs.mkdir(path.dirname(path.join(project, reference)), { recursive: true }); await fs.writeFile(path.join(project, reference), WAV);
  await fs.writeFile(path.join(project, '.env.xiaoxing.local'), 'XIAOXING_AI_API_KEY=private');
  await fs.writeFile(path.join(project, 'model.ckpt'), 'do not copy');
  await copyAssistantRuntime(project, appDir); await fs.writeFile(path.join(appDir, 'package.json'), '{"type":"module"}');
  assert.deepEqual(await fs.readFile(path.join(appDir, reference)), WAV);
  assert.equal(await fs.stat(path.join(appDir, '.env.xiaoxing.local')).catch(() => null), null);
  assert.equal(await fs.stat(path.join(appDir, 'model.ckpt')).catch(() => null), null);
  const { createSpeechHandler } = await import(pathToFileURL(path.join(appDir, 'scripts/assistant/speech.mjs')));
  let request;
  const upstream = await listen(async (req, res) => { request = await readInput(req); wavReply(req, res); });
  const app = await startServer({ root: appDir, manifest: { files: [] }, token: 'fixture', speechHandler: createSpeechHandler({ offline: true, env: { XIAOXING_TTS_URL: upstream.url + '/tts' } }) });
  try {
    const response = await post(app.origin); assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), WAV);
    assert.equal(request.ref_audio_path, path.join(appDir, reference)); assert.equal(request.prompt_text, '');
    assert.equal((await fetch(app.origin + '/' + reference)).status, 404);
    assert.equal((await post(app.origin, undefined, { Origin: 'https://evil.invalid' })).status, 403);
  } finally { await app.close(); await upstream.close(); }
});

test('real Electron build configuration includes speech code and an external reference WAV', async () => {
  const source = await fs.readFile('scripts/portable/build-bundled.mjs', 'utf8');
  const start = source.indexOf('const artifacts = await build('), end = source.indexOf('\n} });', start) + '\n} });'.length;
  assert.ok(start >= 0 && end > start, 'locate the actual builder call without running the EXE build');
  const config = await vm.runInNewContext(`(async () => { ${source.slice(start, end)} return artifacts.config; })()`, {
    build: async options => options, appDir: '/fixture/app', Platform: { WINDOWS: { createTarget: () => [] } }, Arch: { x64: 'x64' },
    ELECTRON: 'fixture', buildOut: '/fixture/out', site: '/fixture/site', manifestPath: '/fixture/site.manifest.json', mediaPath: '/fixture/media.json', sourceIcon: '/fixture/icon.png', path,
  });
  assert.ok(config.files.includes('scripts/assistant/speech.mjs'));
  const reference = config.extraResources.find(item => item.to === 'source/characters/xiaoxing/voice/reference.wav');
  assert.ok(reference, 'Python inference requires a real WAV outside app.asar');
  assert.equal(reference.from, path.join('/fixture/app', 'source/characters/xiaoxing/voice/reference.wav'));
  const main = await fs.readFile('scripts/portable/bundled-main.cjs', 'utf8');
  const call = main.slice(main.indexOf('  const speechEnv ='), main.indexOf('  server = await startServer'));
  for (const override of [undefined, '/configured/reference.wav']) {
    const options = vm.runInNewContext(`${call}; speechHandler`, {
      createSpeechHandler: options => options, flag: () => true, path,
      process: { env: override ? { XIAOXING_TTS_REFERENCE_AUDIO: override } : {}, resourcesPath: '/installed/resources' },
    });
    assert.equal(options.offline, true);
    assert.equal(options.env?.XIAOXING_TTS_REFERENCE_AUDIO, override || path.join('/installed/resources', reference.to));
  }
});
