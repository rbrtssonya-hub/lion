import { existsSync } from 'node:fs';
import path from 'node:path';

export function loadXiaoxingEnv(root = process.cwd()) {
  const file = path.join(root, '.env.xiaoxing.local');
  if (existsSync(file)) process.loadEnvFile(file);
}
