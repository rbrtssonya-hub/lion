import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadXiaoxingEnv } from '../assistant/config.mjs';

const root = path.resolve(import.meta.dirname, '../..');
loadXiaoxingEnv(root);
const engine = process.env.XIAOXING_GPT_SOVITS_ROOT;
const python = process.env.XIAOXING_TTS_PYTHON || 'python';
const port = Number(process.env.XIAOXING_TTS_PORT || 9880);
if (!engine || !fs.existsSync(path.join(engine, 'api_v2.py'))) {
  console.error('请在 .env.xiaoxing.local 设置 XIAOXING_GPT_SOVITS_ROOT，指向已安装官方模型的 GPT-SoVITS 目录。');
  process.exit(1);
}
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('XIAOXING_TTS_PORT 必须是1024至65535的端口。');
const config = process.env.XIAOXING_TTS_CONFIG
  ? path.resolve(root, process.env.XIAOXING_TTS_CONFIG)
  : path.join(import.meta.dirname, 'gpt-sovits-v2proplus.yaml');
if (!fs.existsSync(config)) throw Error(`未找到语音配置：${config}`);
const child = spawn(python, ['-X', 'utf8', path.join(engine, 'api_v2.py'), '-a', '127.0.0.1', '-p', String(port), '-c', config], {
  cwd: engine, stdio: 'inherit', env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }, windowsHide: true,
});
child.once('error', error => { console.error(`小醒语音服务未启动：${error.message}`); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
