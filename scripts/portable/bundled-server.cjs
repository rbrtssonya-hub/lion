const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.mp4': 'video/mp4', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8' };

function rangeOf(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || !size || (!match[1] && !match[2])) return null;
  const first = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const last = !match[1] || !match[2] ? size - 1 : Math.min(size - 1, Number(match[2]));
  if (![first, last].every(Number.isSafeInteger) || first >= size || last < first || (!match[1] && Number(match[2]) === 0)) return null;
  return [first, last];
}

async function startServer({ root, manifest, port = 0, token, onShutdown, assistantHandler }) {
  const files = new Map(manifest.files.map(file => [file.path, file]));
  let origin;
  const server = http.createServer({ maxHeaderSize: 16384 }, (req, res) => {
    const head = req.method === 'HEAD';
    const reply = (code, body, type = 'text/plain; charset=utf-8', extra = {}) => {
      const data = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
      res.writeHead(code, { 'Content-Type': type, 'Content-Length': data.length, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache', ...extra });
      res.end(head ? undefined : data);
    };
    if (req.headers.host !== new URL(origin).host && req.headers.host !== `localhost:${new URL(origin).port}`) return reply(403, 'Forbidden');
    const raw = req.url.split('?')[0];
    let decoded;
    try { decoded = decodeURIComponent(raw); } catch { return reply(400, 'Bad Request'); }
    if (!decoded.startsWith('/') || /[\\\0:]/.test(decoded) || decoded.split('/').some(part => part === '.' || part === '..')) return reply(403, 'Forbidden');
    if (decoded === '/api/xiaoxing/chat' && assistantHandler) {
      Promise.resolve(assistantHandler(req, res)).catch(() => {
        if (!res.headersSent) reply(503, { error: '讲解服务暂时不可用' }, 'application/json');
        else res.end();
      });
      return;
    }
    if (decoded === '/_portable/shutdown') {
      if (req.method !== 'POST') return reply(405, 'Method Not Allowed');
      if (req.url !== `/_portable/shutdown?token=${token}`) return reply(403, 'Forbidden');
      reply(200, { state: 'stopping' }, 'application/json');
      res.once('finish', () => setImmediate(onShutdown)); return;
    }
    if (req.method !== 'GET' && !head) return reply(405, 'Method Not Allowed');
    if (decoded === '/_portable/manifest') return reply(200, manifest, 'application/json');
    if (decoded === '/_portable/status') return reply(200, { state: 'ready', buildId: manifest.buildId, fileCount: files.size }, 'application/json');
    const key = decoded.slice(1) + (decoded.endsWith('/') ? 'index.html' : '');
    const file = files.get(key);
    if (!file) return reply(404, 'Not Found');
    const range = req.headers.range ? rangeOf(req.headers.range, file.bytes) : [0, file.bytes - 1];
    if (!range) return reply(416, 'Range Not Satisfiable', undefined, { 'Content-Range': `bytes */${file.bytes}` });
    const [start, end] = range;
    res.writeHead(req.headers.range ? 206 : 200, { 'Content-Type': mime[path.extname(key).toLowerCase()] || 'application/octet-stream',
      'Content-Length': file.bytes ? end - start + 1 : 0, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff',
      ...(req.headers.range ? { 'Content-Range': `bytes ${start}-${end}/${file.bytes}` } : {}) });
    if (head || !file.bytes) return res.end();
    const stream = fs.createReadStream(path.join(root, ...key.split('/')), { start, end });
    stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
  });
  server.requestTimeout = 30000; server.headersTimeout = 15000;
  await new Promise((resolve, reject) => {
    const listen = requested => {
      server.once('error', function error(err) {
        if (err.code === 'EADDRINUSE' && requested) listen(0); else reject(err);
      });
      server.listen(requested, '127.0.0.1', () => { server.removeAllListeners('error'); resolve(); });
    }; listen(port);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
module.exports = { startServer };
