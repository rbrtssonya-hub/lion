const { app, BrowserWindow, Menu, dialog, shell, session, clipboard } = require('electron');
const fs = require('node:fs');
const physicalFs = require('original-fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
const { startServer } = require('./bundled-server.cjs');

const option = (name, fallback) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const flag = name => process.argv.includes(`--${name}`);
const statusPath = option('status-file');
const dataBase = path.resolve(option('data-dir', path.join(process.env.LOCALAPPDATA || app.getPath('appData'), 'SouthWindLionBundled')));
// No two instances share Chromium's profile database, including normal launches.
const dataRoot = path.join(dataBase, `instance-${process.pid}-${randomBytes(6).toString('hex')}`);
app.setPath('userData', dataRoot);
if (flag('software-rendering')) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
}
if (flag('inspect-ui')) {
  app.commandLine.appendSwitch('remote-debugging-port', '0');
  app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
}
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
let server, window;
let exiting = false, restarting = false;
const token = randomBytes(32).toString('hex');
const hash = async file => {
  const value = createHash('sha256');
  // Electron's normal fs treats .asar as a virtual directory; hash the physical
  // archive bytes just like the independent build manifest does.
  for await (const chunk of physicalFs.createReadStream(file)) value.update(chunk);
  return value.digest('hex');
};
const writeStatus = async value => {
  if (!statusPath) return;
  await fsp.mkdir(path.dirname(path.resolve(statusPath)), { recursive: true });
  await fsp.writeFile(statusPath, JSON.stringify(value));
};
async function shutdown() {
  if (exiting) return;
  exiting = true;
  await server?.close();
  app.quit();
}
app.on('window-all-closed', () => { if (!flag('serve-only')) void shutdown(); });
app.on('before-quit', event => {
  if (!exiting) { event.preventDefault(); void shutdown(); }
});
app.whenReady().then(async () => {
  const root = path.join(process.resourcesPath, 'site');
  const manifest = JSON.parse(await fsp.readFile(path.join(process.resourcesPath, 'site.manifest.json'), 'utf8'));
  const runtimeManifest = JSON.parse(await fsp.readFile(path.join(process.resourcesPath, 'runtime-manifest.json'), 'utf8'));
  const appRoot = path.dirname(process.execPath);
  for (const file of runtimeManifest.files) {
    if (!file.path || path.isAbsolute(file.path) || /[\\\0:]/.test(file.path) || file.path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid runtime manifest path');
    const absolute = path.join(appRoot, ...file.path.split('/'));
    if ((await physicalFs.promises.stat(absolute)).size !== file.bytes || await hash(absolute) !== file.sha256) throw new Error(`文件损坏或缺失：${file.path}`);
  }
  const port = Number(option('port', '47851'));
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
  server = await startServer({ root, manifest, port, token, onShutdown: shutdown });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, done) => done(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  // Content remains local, even if an asset/third-party script accidentally adds a remote fetch.
  session.defaultSession.webRequest.onBeforeRequest((details, done) => {
    const allowed = details.url.startsWith(server.origin + '/') || /^(data:|blob:|devtools:)/.test(details.url);
    done({ cancel: !allowed });
  });
  if (!flag('serve-only') || flag('inspect-ui')) {
    window = new BrowserWindow({ width: 1440, height: 900, minWidth: 900, minHeight: 600,
      show: !flag('serve-only') || flag('inspect-ui'), autoHideMenuBar: true, backgroundColor: '#faf4e8', title: '南风有狮',
      icon: path.join(process.resourcesPath, 'app-icon.png'),
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
    window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(server.origin + '/')) event.preventDefault(); });
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.webContents.setWindowOpenHandler(({ url }) => {
      let parsed;
      try { parsed = new URL(url); } catch { return { action: 'deny' }; }
      if (!flag('offline') && parsed.protocol === 'https:' && !parsed.username && !parsed.password) {
        // Renderer window.open alone is never authority to launch another app.
        // The native dialog requires a real user choice and displays the exact URL.
        void dialog.showMessageBox(window, { type: 'question', message: '查阅资料原文（需要联网）', detail: parsed.href,
          buttons: ['复制链接', '用系统浏览器打开', '取消'], defaultId: 0, cancelId: 2, noLink: true }).then(async ({ response }) => {
          if (response === 0) clipboard.writeText(parsed.href);
          if (response === 1) await shell.openExternal(parsed.href);
        }).catch(() => dialog.showMessageBox(window, { message: '无法打开资料外链，可复制链接后查阅。', detail: parsed.href }));
      }
      return { action: 'deny' };
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: '展示', submenu: [
      { label: '兼容模式（软件渲染）', accelerator: 'Ctrl+Shift+S', click() {
        if (restarting) return;
        restarting = true;
        app.relaunch({ execPath: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath,
          args: process.argv.slice(1).filter(arg => arg !== '--software-rendering').concat('--software-rendering') });
        void shutdown();
      } }, { role: 'quit', label: '退出' }] },
    { label: '视图', submenu: [{ role: 'togglefullscreen', label: '全屏' }, { role: 'reload', label: '重新加载' }] }]));
    await window.loadURL(server.origin + '/');
    if (!flag('serve-only')) window.maximize();
  }
  let debugPort;
  if (flag('inspect-ui')) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      try { debugPort = Number((await fsp.readFile(path.join(dataRoot, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch {}
      if (debugPort) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!debugPort) throw new Error('Diagnostic CDP port unavailable');
  }
  await writeStatus({ state: 'ready', origin: server.origin, pid: process.pid, siteRoot: root,
    fileCount: manifest.files.length, shutdownToken: token, buildId: manifest.buildId, debugPort,
    runtime: { bundled: true, electron: process.versions.electron, chrome: process.versions.chrome,
      node: process.versions.node, arch: process.arch, platform: process.platform,
      executablePath: process.execPath, softwareRendering: flag('software-rendering'),
      userDataPath: dataRoot,
      sandbox: true, contextIsolation: true, nodeIntegration: false, verifiedRuntimeFiles: runtimeManifest.files.length } });
}).catch(async error => {
  await writeStatus({ state: 'error', message: error.message }).catch(() => {});
  if (!flag('serve-only')) dialog.showErrorBox('南风有狮启动失败', error.message);
  await server?.close(); app.exit(1);
});
