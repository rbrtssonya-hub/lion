import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_PATH = '/api/xiaoxing/speech';
const MAX_BODY = 16_384;
const MAX_AUDIO = 20 * 1024 * 1024;
const referenceAudio = fileURLToPath(new URL('../../source/characters/xiaoxing/voice/reference.wav', import.meta.url));
const isLoopback = url => ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);

function json(res, status, data, headers = {}) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(data));
}

function configuredUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback(url))) && !url.username && !url.password && !url.search && !url.hash ? url : null;
  } catch { return null; }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let bytes = 0, tooLarge = false;
    const chunks = [];
    req.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > MAX_BODY) { tooLarge = true; chunks.length = 0; } else if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return reject(Object.assign(Error('size'), { status: 413 }));
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(Error('json'), { status: 400 })); }
    });
    req.on('error', reject);
    req.on('aborted', () => reject(Error('aborted')));
  });
}

async function responseWav(response) {
  if (!response.ok || !response.body || !/^audio\/(?:wav|x-wav|wave)(?:;|$)/i.test(response.headers.get('content-type') || '') || Number(response.headers.get('content-length')) > MAX_AUDIO) throw Error('upstream');
  let bytes = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > MAX_AUDIO) throw Error('upstream-size');
    chunks.push(chunk);
  }
  const audio = Buffer.concat(chunks);
  if (audio.length < 12 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') throw Error('upstream-format');
  return audio;
}

export function createSpeechHandler({ env = process.env, offline = false, fetchImpl = globalThis.fetch, rateLimit = 20 } = {}) {
  const requests = new Map();
  const allowedOrigins = new Set((env.XIAOXING_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
  const upstream = configuredUrl(env.XIAOXING_TTS_URL || 'http://127.0.0.1:9880/tts');
  const timeoutMs = Math.max(500, Math.min(180_000, Number(env.XIAOXING_TTS_TIMEOUT_MS) || 120_000));
  const refAudioPath = env.XIAOXING_TTS_REFERENCE_AUDIO ? path.resolve(env.XIAOXING_TTS_REFERENCE_AUDIO) : referenceAudio;
  let active = false;
  return async function xiaoxingSpeech(req, res, next) {
    if (req.url?.split('?')[0] !== API_PATH) { if (next) return next(); return json(res, 404, { error: '未找到接口' }); }
    const requestOrigin = req.headers.origin;
    const port = req.socket.localPort;
    const localOrigins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`, `http://[::1]:${port}`]);
    if (requestOrigin && !allowedOrigins.has(requestOrigin) && !localOrigins.has(requestOrigin)) return json(res, 403, { error: '来源不受支持' });
    if (env.XIAOXING_ACCESS_TOKEN && req.headers.authorization !== `Bearer ${env.XIAOXING_ACCESS_TOKEN}`) return json(res, 401, { error: '访问未授权' });
    const cors = requestOrigin && allowedOrigins.has(requestOrigin) ? { 'Access-Control-Allow-Origin': requestOrigin, Vary: 'Origin' } : {};
    if (req.method === 'OPTIONS') return json(res, 204, null, { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' });
    if (req.method !== 'POST') return json(res, 405, { error: '请使用POST请求' }, { ...cors, Allow: 'POST' });
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(res, 415, { error: '请发送JSON格式' }, cors);
    if (Number(req.headers['content-length']) > MAX_BODY) { req.resume(); return json(res, 413, { error: '请求过长' }, cors); }
    const now = Date.now(), address = req.socket.remoteAddress || 'local';
    for (const [key, record] of requests) if (now - record.started > 60_000) requests.delete(key);
    const record = requests.get(address) || { started: now, count: 0 };
    if (++record.count > rateLimit) return json(res, 429, { error: '语音请求有点密集，请稍等片刻再试。' }, { ...cors, 'Retry-After': '60' });
    requests.set(address, record);
    let input;
    try { input = await readJson(req); } catch (error) { return json(res, error.status || 400, { error: '语音请求格式不正确或内容过长' }, cors); }
    if (!input || Array.isArray(input) || Object.keys(input).length !== 1 || typeof input.text !== 'string' || !input.text.trim() || input.text.trim().length > 1200) return json(res, 400, { error: '请提供1200字以内的讲解文字' }, cors);
    if (!upstream || ((offline || env.XIAOXING_OFFLINE === '1') && !isLoopback(upstream))) return json(res, 503, { error: '小醒声音暂时不可用' }, cors);
    if (res.destroyed || req.aborted) return;
    // One local model serves this exhibit; avoid queuing GPU work after repeated clicks.
    if (active) return json(res, 429, { error: '小醒正在准备声音，请稍后再试。' }, { ...cors, 'Retry-After': '1' });
    active = true;
    const controller = new AbortController();
    let timedOut = false, abandoned = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs); timer.unref?.();
    // GPT-SoVITS does not stop inference when HTTP disconnects. Drain abandoned
    // work while keeping the single slot; the timeout bounds our wait, not model execution.
    const cancel = () => { if (!res.writableEnded) abandoned = true; };
    res.once('close', cancel); req.once('aborted', cancel);
    try {
      const spokenText = input.text.trim().replace(/\bAI\b/gi, '人工智能');
      const body = {
        text: spokenText, text_lang: /[A-Za-z]/.test(spokenText) ? 'zh' : 'all_zh', ref_audio_path: refAudioPath,
        prompt_text: env.XIAOXING_TTS_REFERENCE_TEXT || '', prompt_lang: 'zh', text_split_method: 'cut5', batch_size: 1,
        media_type: 'wav', streaming_mode: false, parallel_infer: false, use_cuda_graph: false, use_flash_attention: false, seed: 42,
      };
      const audio = await responseWav(await fetchImpl(upstream, { method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'error', signal: controller.signal, body: JSON.stringify(body) }));
      if (abandoned || res.destroyed || res.writableEnded || controller.signal.aborted) return;
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': audio.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cors });
      res.end(audio);
    } catch {
      controller.abort();
      if (!abandoned) json(res, timedOut ? 504 : 502, { error: timedOut ? '小醒声音准备超时，请稍后再试。' : '小醒声音暂时不可用，请稍后再试。' }, cors);
    } finally { clearTimeout(timer); res.off('close', cancel); req.off('aborted', cancel); active = false; }
  };
}
