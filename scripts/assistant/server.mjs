import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { createChatHandler } from './api.mjs';
import { loadXiaoxingEnv } from './config.mjs';

export async function startAssistantServer({ env = process.env, port = Number(env.XIAOXING_PORT || 8787), host = env.XIAOXING_HOST || '127.0.0.1' } = {}) {
  const handler = createChatHandler({ env, offline: env.XIAOXING_OFFLINE === '1' });
  const server = http.createServer((req, res) => { void handler(req, res); });
  server.requestTimeout = 20_000; server.headersTimeout = 10_000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadXiaoxingEnv();
  const server = await startAssistantServer();
  console.log(`小醒问答服务正在监听 ${server.address().address}:${server.address().port}`);
  for (const event of ['SIGINT', 'SIGTERM']) process.once(event, () => { server.close(); server.closeAllConnections(); });
}
