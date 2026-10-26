import fs from 'node:fs/promises';
import path from 'node:path';

export async function copyAssistantRuntime(project, appDir) {
  // Explicit runtime list excludes .env files, documentation and development tools.
  for (const name of ['scripts/assistant/api.mjs', 'src/features/assistant/knowledge.js']) {
    const target = path.join(appDir, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(project, name), target);
  }
}
