// Build-only dependencies live under ignored tmp, never in the React application.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { resolveBundledIcon } from './build-options.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '../..');
const output = path.resolve(process.argv.slice(2).find(arg => !arg.startsWith('--')) || path.join(process.env.USERPROFILE, 'Desktop/南风有狮'));
const delivery = path.join(output, '南风有狮-离线版');
const sourceIcon = resolveBundledIcon(process.argv.slice(2), project, path.join(project, 'source/public/assets/entry/nav-lion-head.png'));
const reuseWork = process.argv.find(arg => arg.startsWith('--reuse-site='))?.slice('--reuse-site='.length);
assert(!output.toLowerCase().startsWith(project.toLowerCase() + path.sep) && output.toLowerCase() !== project.toLowerCase(), 'Delivery belongs outside the development checkout');
assert.equal(process.platform, 'win32', 'Build the Windows executable on Windows');
assert(!existsSync(delivery), `Preserve the existing delivery; choose a new output directory: ${delivery}`);
assert(existsSync(sourceIcon), `Icon PNG does not exist: ${sourceIcon}`);
const ELECTRON = '44.9.1', BUILDER = '26.15.3', FFMPEG = '5.3.0';
const hash = async file => { const h = createHash('sha256'); for await (const chunk of createReadStream(file)) h.update(chunk); return h.digest('hex'); };
async function inventory(root) {
  const result = [];
  async function walk(dir, prefix = '') {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, item.name), relative = prefix + item.name;
      if (item.isDirectory()) await walk(absolute, relative + '/');
      else { assert(item.isFile() && !item.isSymbolicLink()); result.push({ path: relative, bytes: (await fs.stat(absolute)).size, sha256: await hash(absolute) }); }
    }
  }
  await walk(root); return result.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
async function run(command, args, cwd = project, capture = false) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      env: { ...process.env, ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES: 'false' } });
    let log = '';
    if (capture) { child.stdout.on('data', chunk => { log += chunk; }); child.stderr.on('data', chunk => { log += chunk; }); }
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve(log) : reject(new Error(`${command} exited ${code}\n${log.slice(-8000)}`)));
  });
}
async function protectedSnapshot() {
  const files = [];
  for (const name of ['src', 'source/public', 'dist']) if (existsSync(path.join(project, name)))
    files.push(...(await inventory(path.join(project, name))).map(file => ({ ...file, path: name + '/' + file.path })));
  for (const name of ['package.json', 'package-lock.json', 'vite.config.js', 'index.html'])
    files.push({ path: name, sha256: await hash(path.join(project, name)) });
  return files;
}
const before = await protectedSnapshot();
const work = path.join(project, 'tmp/bundled-exe', randomUUID());
const toolsRoot = path.join(project, 'tmp/portable-toolchain');
// Keep downloaded packaging helpers on the same owned volume as the build;
// redirected Windows profile caches may fail directory rename with EXDEV.
process.env.ELECTRON_BUILDER_CACHE = path.join(toolsRoot, 'builder-cache');
await fs.mkdir(work, { recursive: true }); await fs.mkdir(toolsRoot, { recursive: true });
if (!existsSync(path.join(toolsRoot, 'node_modules/electron-builder/package.json')) || !existsSync(path.join(toolsRoot, 'node_modules/ffmpeg-static/ffmpeg.exe'))) {
  await fs.writeFile(path.join(toolsRoot, 'package.json'), JSON.stringify({ name: 'lion-portable-build-tools', version: '1.0.0', private: true }));
  const npmCli = path.resolve(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  assert(existsSync(npmCli), `npm CLI missing: ${npmCli}`);
  await run(process.execPath, [npmCli, 'install', '--prefix', toolsRoot, '--no-audit', '--no-fund', `electron-builder@${BUILDER}`, `ffmpeg-static@${FFMPEG}`]);
}
// npm 12 can skip dependency install scripts. Fetch only the build tool's
// declared binary without changing the user's global npm script policy.
if (!existsSync(path.join(toolsRoot, 'node_modules/ffmpeg-static/ffmpeg.exe')))
  await run(process.execPath, [path.join(toolsRoot, 'node_modules/ffmpeg-static/install.js')]);
const requireTools = createRequire(path.join(toolsRoot, 'package.json'));
assert.equal(requireTools('electron-builder/package.json').version, BUILDER);
assert.equal(requireTools('ffmpeg-static/package.json').version, FFMPEG);
const ffmpeg = requireTools('ffmpeg-static');
const site = path.join(work, 'site');
let originalFiles, media = [];
if (reuseWork) {
  const previous = path.resolve(reuseWork);
  assert.equal(path.dirname(previous).toLowerCase(), path.join(project, 'tmp/bundled-exe').toLowerCase(), 'Reuse only this tool\'s owned build snapshots');
  const prior = JSON.parse(await fs.readFile(path.join(previous, 'site.manifest.json'), 'utf8'));
  assert.equal(prior.revision, (await run('git', ['rev-parse', 'HEAD'], project, true)).trim(), 'Cannot reuse a different web revision');
  assert.equal((await run('git', ['status', '--porcelain', '--untracked-files=all', '--', 'src', 'source/public', 'package.json', 'package-lock.json', 'vite.config.js', 'index.html'], project, true)).trim(), '', 'Cannot reuse with uncommitted web changes');
  assert.deepEqual(await inventory(path.join(previous, 'site')), prior.files, 'Reused publish bytes were changed');
  await fs.cp(path.join(previous, 'site'), site, { recursive: true, errorOnExist: true, force: false });
  media = JSON.parse(await fs.readFile(path.join(previous, 'media-compatibility.json'), 'utf8'));
  originalFiles = prior.files;
} else {
await run(process.execPath, [path.join(project, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', site]);
originalFiles = await inventory(site);
for (const file of originalFiles.filter(item => item.path.endsWith('.mp4'))) {
  const source = path.join(site, file.path);
  let log;
  // ffmpeg reports metadata with a zero-output null mux without decoding a frame.
  log = await run(ffmpeg, ['-hide_banner', '-i', source, '-t', '0', '-f', 'null', '-'], project, true);
  const codec = /Video: ([^,\s]+)/.exec(log)?.[1];
  assert(codec, `Unknown video codec: ${file.path}`);
  if (codec === 'hevc' || codec === 'h265') {
    const converted = path.join(work, `${media.length}-compatible.mp4`);
    console.log(`Compatibility conversion: ${file.path}: ${codec} -> H.264 / AAC (publish copy only)`);
    await run(ffmpeg, ['-hide_banner', '-loglevel', 'warning', '-nostdin', '-i', source,
      '-map', '0:v:0', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', converted]);
    await fs.copyFile(converted, source);
  }
  // Decode the actual final publishing bytes with the build codec tool.
  await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', source, '-f', 'null', '-'], project, true);
  media.push({ path: file.path, sourceCodec: codec, publishedCodec: ['hevc', 'h265'].includes(codec) ? 'h264' : codec,
    originalBytes: file.bytes, originalSha256: file.sha256, publishedBytes: (await fs.stat(source)).size, publishedSha256: await hash(source) });
}
}
const revision = (await run('git', ['rev-parse', 'HEAD'], project, true)).trim();
const files = await inventory(site);
assert.equal(files.length, originalFiles.length, 'No runtime file may be omitted');
const manifest = { buildId: createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 20), revision, files };
const manifestPath = path.join(work, 'site.manifest.json');
const mediaPath = path.join(work, 'media-compatibility.json');
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2)); await fs.writeFile(mediaPath, JSON.stringify(media, null, 2));
const appDir = path.join(work, 'app'); await fs.mkdir(appDir);
await fs.writeFile(path.join(appDir, 'package.json'), JSON.stringify({ name: 'south-wind-lion-bundled', version: '1.0.0', private: true,
  description: 'South Wind Lion self-contained offline desktop exhibition', author: 'South Wind Lion', main: 'main.cjs' }));
await fs.copyFile(path.join(here, 'bundled-main.cjs'), path.join(appDir, 'main.cjs'));
await fs.copyFile(path.join(here, 'bundled-server.cjs'), path.join(appDir, 'bundled-server.cjs'));
const { build, Platform, Arch } = requireTools('electron-builder');
const { getNsisElevatePath } = requireTools('app-builder-lib/out/toolsets/windows.js');
const { editWindowsResources } = requireTools('app-builder-lib/out/util/resEdit.js');
const buildOut = path.join(work, 'out');
let windowsIcon;
const artifacts = await build({ projectDir: appDir, targets: Platform.WINDOWS.createTarget(['portable'], Arch.x64), config: {
  appId: 'org.southwindlion.offline', productName: '南风有狮', electronVersion: ELECTRON,
  directories: { output: buildOut }, npmRebuild: false, buildDependenciesFromSource: false,
  asar: true, files: ['main.cjs', 'bundled-server.cjs', 'package.json'],
  extraResources: [{ from: site, to: 'site' }, { from: manifestPath, to: 'site.manifest.json' }, { from: mediaPath, to: 'media-compatibility.json' },
    { from: sourceIcon, to: 'app-icon.png' }],
  win: { artifactName: '南风有狮.exe', icon: sourceIcon, signAndEditExecutable: false, signExecutable: false },
  // Locked builder 26.15.3: true omits UNPACK_DIR_NAME and uses each launch's
  // unique $PLUGINSDIR. false unexpectedly embeds a fixed build-time directory.
  portable: { requestExecutionLevel: 'user', unpackDirName: true },
  publish: null,
  async afterPack(context) {
    // Edit before hashing: builder's ordinary post-afterPack resource editing
    // would otherwise invalidate the runtime manifest on every launch.
    windowsIcon = await context.packager.getIconPath();
    assert(windowsIcon, 'Windows icon conversion failed');
    await editWindowsResources({ file: path.join(context.appOutDir, '南风有狮.exe'),
      iconPath: windowsIcon, fileVersion: '1.0.0', productVersion: '1.0.0',
      versionStrings: { FileDescription: '南风有狮', ProductName: '南风有狮', InternalName: 'SouthWindLion' },
      requestedExecutionLevel: 'asInvoker' });
    // NSIS normally adds this byte-identical helper after afterPack. Stage it
    // first so the complete payload (not just Chromium/site) is in the manifest.
    await fs.copyFile(await getNsisElevatePath(), path.join(context.appOutDir, 'resources/elevate.exe'));
    const runtime = await inventory(context.appOutDir);
    assert(runtime.some(file => file.path === 'LICENSE.electron.txt'));
    assert(runtime.some(file => file.path === 'LICENSES.chromium.html'));
    // Pin against this Electron release's real official ZIP, not legacy ANGLE DLL names.
    for (const critical of ['ffmpeg.dll', 'icudtl.dat', 'resources.pak', 'v8_context_snapshot.bin', 'vk_swiftshader.dll', 'vk_swiftshader_icd.json', 'vulkan-1.dll'])
      assert(runtime.some(file => file.path === critical), `Missing bundled engine file: ${critical}`);
    await fs.writeFile(path.join(context.appOutDir, 'resources/runtime-manifest.json'), JSON.stringify({ electron: ELECTRON, files: runtime }, null, 2));
  },
} });
assert.deepEqual(await protectedSnapshot(), before, 'Development files changed during packaging');
const artifact = artifacts.find(file => file.endsWith('.exe'));
assert(artifact, 'No real portable executable was produced');
await fs.mkdir(delivery, { recursive: true });
const target = path.join(delivery, '南风有狮.exe');
await fs.copyFile(artifact, target);
const info = { executable: target, bytes: (await fs.stat(target)).size, sha256: await hash(target),
  engine: `Electron ${ELECTRON}`, arch: 'x64', minimumOS: 'Windows 10/11 x64', needsInstalledBrowser: false, needsSystemNodeOrDotNet: false,
  buildId: manifest.buildId, sourceRevision: revision, expectedSiteDir: site, unpacked: path.join(buildOut, 'win-unpacked'),
  icon: { source: path.relative(project, sourceIcon).replaceAll(path.sep, '/'), sha256: await hash(sourceIcon),
    icoSha256: await hash(windowsIcon) },
  siteFileCount: files.length, runtimeFiles: (await inventory(path.join(buildOut, 'win-unpacked'))).length,
  developmentFilesUnchanged: before.length, media, builtAt: new Date().toISOString() };
await fs.writeFile(path.join(delivery, 'build-info.json'), JSON.stringify(info, null, 2));
await fs.writeFile(path.join(delivery, 'SHA256.txt'), `${info.sha256}  ${path.basename(target)}\r\n`);
await fs.copyFile(manifestPath, path.join(delivery, '完整网页文件清单.json'));
await fs.copyFile(mediaPath, path.join(delivery, '视频兼容转换记录.json'));
await fs.copyFile(path.join(buildOut, 'win-unpacked/resources/runtime-manifest.json'), path.join(delivery, '完整内核文件清单.json'));
await fs.writeFile(path.join(delivery, '使用说明.txt'), [
  '南风有狮 · Windows 离线展示版', '',
  '双击“南风有狮.exe”运行。首次启动需要解包并校验文件，请稍候。',
  '适用于 Windows 10 / 11 64位电脑。已内置 Chromium 浏览器内核、Node 运行环境、网页、字体、图片、模型和视频，无需安装浏览器、Node 或 npm。',
  '程序可整体复制到其他电脑；单独复制 EXE 也可以运行。ZIP 解压后内容与本文件夹相同。', '',
  'F11：进入或退出全屏。Alt：显示菜单。Ctrl+Shift+S：重新以软件渲染兼容模式启动。',
  '关闭程序窗口即可退出。展示设置在本次独立会话内使用，不读取日常浏览器的数据。',
  '默认展示内容可离线使用；HDRI 请选内置预设或本地文件。主动查阅资料原文链接时需要网络。', '',
  '内核许可随 EXE 携带，原网页的摄影、字体、组件许可与 AI 辅助创作说明保留。',
  'build-info.json、文件清单与 SHA256.txt 用于版本及完整性核对。', '',
].join('\r\n'));
console.log(JSON.stringify(info, null, 2));
