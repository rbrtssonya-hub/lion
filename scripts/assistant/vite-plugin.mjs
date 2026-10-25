import { createChatHandler } from './api.mjs';
import { loadXiaoxingEnv } from './config.mjs';

export function xiaoxingPlugin() {
  let root;
  const install = server => { loadXiaoxingEnv(root); server.middlewares.use(createChatHandler()); };
  return { name: 'xiaoxing-local-api', configResolved(config) { root = config.root; }, configureServer: install, configurePreviewServer: install };
}
