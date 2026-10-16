/** Internal offline Spine 3.6 pre-renderer. Never import this tool into the app. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archiveDir = path.join(root, 'source/design/action/2026-10-17-game-guide');
const archive = path.join(archiveDir, 'adam-lion-v2-original.zip');
const cache = path.join(root, 'tmp/action-guide-renderer');
const extracted = path.join(cache, 'source');
const output = path.join(root, 'source/public/assets/action-guide');
const reviews = path.join(root, 'source/reviews/action/2026-10-17-game-guide');
const revision = '8d79291441394b3a279d5d36f054d563dbc15e16';
const origin = `https://raw.githubusercontent.com/esterTion/spine-runtimes/${revision}/spine-ts`;
const sourceHash = 'eb10f5e1e2c5b97ab038c5dbadce24809349af966bbe8ef6d32de36264efc44c';
const runtimeHash = 'c626474dc3af7840cde499cd07f38f6d104606954293994c7fcd85401000cd70';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const probe = process.argv.includes('--probe');
const zipIndex = process.argv.indexOf('--zip');
if (process.argv.includes('--verify')) {
  const metadata = JSON.parse(await readFile(path.join(archiveDir, 'render-metadata.json'), 'utf8'));
  for (const file of metadata.files) {
    const bytes = await readFile(path.join(root, file.path));
    assert.equal(bytes.length, file.bytes, file.path);
    assert.equal(hash(bytes), file.sha256, file.path);
  }
  assert.equal(hash(await readFile(archive)), sourceHash);
  assert(!(await readdir(output)).some((name) => /\.(?:js|mjs|skel|atlas|spine)$/i.test(name)), 'Runtime/source files in deploy assets.');
  const verifyBrowser = await chromium.launch({ headless: true });
  try {
    const verifyPage = await verifyBrowser.newPage();
    await verifyPage.route('**/*', (route) => route.abort());
    const inputs = [];
    for (const name of ['adam-idle.png', 'adam-move.png', 'adam-poster.png']) {
      inputs.push({ name, base64: (await readFile(path.join(output, name))).toString('base64') });
    }
    const result = await verifyPage.evaluate(async ({ inputs, clips }) => {
      const images = new Map();
      for (const { name, base64 } of inputs) {
        const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
        const target = Object.assign(document.createElement('canvas'), { width: image.width, height: image.height });
        target.getContext('2d').drawImage(image, 0, 0);
        images.set(name, target);
      }
      const checks = [];
      let firstFrame;
      for (const clip of clips) {
        const image = images.get(clip.file);
        if (image.width !== clip.width || image.height !== clip.height) throw new Error(`Wrong size ${clip.file}`);
        const hashes = [];
        const signatureCanvas = Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
        for (let i = 0; i < clip.columns * clip.rows; i++) {
          const pixels = image.getContext('2d').getImageData((i % clip.columns) * 256, Math.floor(i / clip.columns) * 256, 256, 256).data;
          let opaque = 0, edges = 0;
          for (let p = 3; p < pixels.length; p += 4) if (pixels[p]) {
            opaque++; const pixel = (p - 3) / 4, x = pixel % 256, y = Math.floor(pixel / 256);
            if (x === 0 || y === 0 || x === 255 || y === 255) edges++;
          }
          if (i >= clip.frames) { if (opaque) throw new Error('Nontransparent unused cell'); continue; }
          if (edges || opaque !== clip.frameInfo[i].opaquePixels) throw new Error(`Bad alpha ${clip.animation} ${i}`);
          signatureCanvas.getContext('2d').putImageData(new ImageData(pixels, 256, 256), 0, 0);
          hashes.push(signatureCanvas.toDataURL());
          if (clip.animation === 'idle' && i === 0) firstFrame = pixels;
        }
        if (new Set(hashes).size < 4) throw new Error('Animation frames do not vary.');
        checks.push({ animation: clip.animation, decodedFrames: clip.frames, distinctFrames: new Set(hashes).size, edgePixels: 0, unusedCellsTransparent: true });
      }
      const poster = images.get('adam-poster.png');
      if (poster.width !== 256 || poster.height !== 256) throw new Error('Wrong fallback dimensions.');
      const posterPixels = poster.getContext('2d').getImageData(0, 0, 256, 256).data;
      if (!posterPixels.every((value, i) => value === firstFrame[i])) throw new Error('Fallback differs from idle frame 0.');
      return { checks, posterMatchesIdleFrame0: true, runtimeLoaded: false };
    }, { inputs, clips: metadata.clips });
    console.log(JSON.stringify({ verified: true, fileHashes: metadata.files.length, ...result }, null, 2));
  } finally { await verifyBrowser.close(); }
  process.exit(0);
}
await mkdir(cache, { recursive: true });
await mkdir(archiveDir, { recursive: true });
if (!existsSync(archive)) {
  assert(zipIndex >= 0 && process.argv[zipIndex + 1], 'Provide --zip ORIGINAL.zip for first preparation.');
  const source = path.resolve(process.argv[zipIndex + 1]);
  assert.equal(hash(await readFile(source)), sourceHash, 'Original ZIP hash mismatch.');
  await copyFile(source, archive);
}
assert.equal(hash(await readFile(archive)), sourceHash, 'Archived ZIP hash mismatch.');
for (const [name, suffix] of [['spine-canvas.js', 'build/spine-canvas.js'], ['LICENSE', 'LICENSE']]) {
  const target = path.join(cache, name);
  if (!existsSync(target)) {
    const response = await fetch(`${origin}/${suffix}`);
    assert(response.ok, `Cannot download internal renderer ${response.status}`);
    await writeFile(target, new Uint8Array(await response.arrayBuffer()));
  }
}
const runtime = await readFile(path.join(cache, 'spine-canvas.js'), 'utf8');
assert.equal(hash(runtime), runtimeHash, 'Runtime bytes differ from the pinned unmodified build.');
assert.equal(hash(await readFile(path.join(cache, 'LICENSE'))),
  'd2af98ecac7e4bb6e4c4491fc734db7762b94626b18bcc87c7eac6febd86e1b5', 'Runtime license bytes changed.');
// Original-byte extraction only; application source is never written through a shell.
const quote = (s) => `'${s.replaceAll("'", "''")}'`;
if (!existsSync(extracted)) {
  const extraction = spawnSync('powershell.exe', ['-NoProfile', '-Command',
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::ExtractToDirectory(${quote(archive)}, ${quote(extracted)})`], { encoding: 'utf8' });
  assert.equal(extraction.status, 0, extraction.stderr);
}
const sourceDir = path.join(extracted, 'adam_醒狮替换包_v2');
const sourceHashes = {
  'adam.skel': '827f077a6c9d63df85c4b4121d3cb29ed40fccfa63627e05ceca6cc4569411dd',
  'adam.atlas': '46d7629df10a0fc9cd6a90e6e6349c1bfbc001c4c23e9b2b464538d78c1a6130',
  'adam.png': '3cded822ef80168bb0c7fde6cec15895351585fe007d7a8241d37027dcce4278',
  'adam.spine': '7130bfc262e0b449aaa14bdf65a29a720da36b3a85a75707ccceaf47e120f22d',
};
for (const [name, expected] of Object.entries(sourceHashes)) {
  assert.equal(hash(await readFile(path.join(sourceDir, name))), expected, `Cached ${name} differs from the archived source.`);
}
const payload = {
  atlas: await readFile(path.join(sourceDir, 'adam.atlas'), 'utf8'),
  image: (await readFile(path.join(sourceDir, 'adam.png'))).toString('base64'),
  skeleton: (await readFile(path.join(sourceDir, 'adam.skel'))).toString('base64'),
  probe,
};
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // Rendering is offline: all bytes are supplied in memory, with network blocked.
  await page.route('**/*', (route) => route.abort());
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addScriptTag({ content: runtime });
  const rendered = await page.evaluate(async ({ atlas, image, skeleton: binary, probe }) => {
    const textureImage = new Image();
    textureImage.src = `data:image/png;base64,${image}`;
    await textureImage.decode();
    const atlasData = new spine.TextureAtlas(atlas, () => new spine.canvas.CanvasTexture(textureImage));
    const reader = new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlasData));
    const skeletonData = reader.readSkeletonData(Uint8Array.from(atob(binary), (char) => char.charCodeAt(0)));
    const slotNames = skeletonData.slots.map((slot) => slot.name);
    const animations = skeletonData.animations.map(({ name, duration }) => ({ name, duration }));
    const canvas = (width, height) => Object.assign(document.createElement('canvas'), { width, height });
    const clips = [{ name: 'idle', frames: 20, file: 'adam-idle.png' }, { name: 'mov', frames: 12, file: 'adam-move.png' }];
    const cell = 256;
    const padding = 14;
    const fps = 24;
    const columns = 8;
    // These source slots are filtered after each animation evaluation, never in the skel.
    const characterSlots = new Set(['cape', 'thigh_left', 'foot_left', 'thigh_right', 'foot_right', 'skirt', 'hip_lower',
      'arm_left', 'neck_deco', 'body', 'shoulder_left', 'face', 'hip_mid', 'neck', 'eye', 'arm_right', 'shoulder_right', 'hand_right', 'hand_left']);
    const hiddenSlots = slotNames.filter((name) => !characterSlots.has(name));
    const poseAt = (animation, time) => {
      const skeleton = new spine.Skeleton(skeletonData);
      animation.apply(skeleton, -1, time, false, [], 1, spine.MixPose.setup, spine.MixDirection.mixIn);
      for (const slot of skeleton.slots) if (hiddenSlots.includes(slot.data.name)) slot.setAttachment(null);
      skeleton.updateWorldTransform();
      return skeleton;
    };
    const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const clip of clips) {
      const animation = skeletonData.findAnimation(clip.name);
      if (!animation) throw new Error(`Missing ${clip.name}`);
      // Dense shared union across BOTH loops, including endpoints, keeps cape and feet stable.
      for (let sample = 0; sample <= Math.ceil(animation.duration * 120); sample++) {
        const skeleton = poseAt(animation, Math.min(sample / 120, animation.duration));
        const offset = new spine.Vector2();
        const size = new spine.Vector2();
        skeleton.getBounds(offset, size, []);
        bounds.minX = Math.min(bounds.minX, offset.x);
        bounds.minY = Math.min(bounds.minY, offset.y);
        bounds.maxX = Math.max(bounds.maxX, offset.x + size.x);
        bounds.maxY = Math.max(bounds.maxY, offset.y + size.y);
      }
    }
    const scale = Math.min((cell - 2 * padding) / (bounds.maxX - bounds.minX), (cell - 2 * padding) / (bounds.maxY - bounds.minY));
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const draw = (animation, time) => {
      const target = canvas(cell, cell);
      const context = target.getContext('2d');
      context.setTransform(scale, 0, 0, -scale, cell / 2 - centerX * scale, cell / 2 + centerY * scale);
      const renderer = new spine.canvas.SkeletonRenderer(context);
      renderer.triangleRendering = true;
      renderer.draw(poseAt(animation, time));
      return target;
    };
    const inspect = (target) => {
      const pixels = target.getContext('2d').getImageData(0, 0, cell, cell).data;
      let count = 0, edges = 0;
      let minX = cell, minY = cell, maxX = -1, maxY = -1;
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
        if (!pixels[(y * cell + x) * 4 + 3]) continue;
        count++;
        if (x === 0 || y === 0 || x === cell - 1 || y === cell - 1) edges++;
        minX = Math.min(x, minX); minY = Math.min(y, minY);
        maxX = Math.max(x, maxX); maxY = Math.max(y, maxY);
      }
      if (count < 1000 || edges > 0) throw new Error(`Empty/clipped frame: pixels=${count} edges=${edges}`);
      return { opaquePixels: count, edgePixels: edges, alphaBounds: { minX, minY, maxX, maxY } };
    };
    const sheets = [];
    const info = [];
    const contact = canvas(8 * 320, 4 * 352 + 112);
    const review = contact.getContext('2d');
    review.fillStyle = '#eae5da'; review.fillRect(0, 0, contact.width, contact.height);
    review.font = '24px sans-serif'; review.fillStyle = '#382d28';
    review.fillText('Adam lion costume | idle 20 / mov 12 | 24 fps | shared union / fixed 256 cell', 20, 36);
    review.fillText('Offline Canvas2D triangle rendering. Decorative guide character, not a lion-dance motion sample.', 20, 72);
    let reviewIndex = 0;
    let poster;
    for (const clip of clips) {
      const animation = skeletonData.findAnimation(clip.name);
      const rows = Math.ceil(clip.frames / columns);
      const sheet = canvas(columns * cell, rows * cell);
      const sheetContext = sheet.getContext('2d');
      const frameInfo = [];
      for (let frame = 0; frame < clip.frames; frame++) {
        const time = frame / fps;
        const renderedFrame = draw(animation, time);
        frameInfo.push({ frame, time, ...inspect(renderedFrame) });
        sheetContext.drawImage(renderedFrame, (frame % columns) * cell, Math.floor(frame / columns) * cell);
        if (clip.name === 'idle' && frame === 0) poster = renderedFrame.toDataURL();
        const x = (reviewIndex % 8) * 320;
        const y = 112 + Math.floor(reviewIndex / 8) * 352;
        for (let cy = 0; cy < 320; cy += 20) for (let cx = 0; cx < 320; cx += 20) {
          review.fillStyle = ((cx + cy) / 20) % 2 ? '#504b49' : '#625d59';
          review.fillRect(x + cx, y + cy, 20, 20);
        }
        review.drawImage(renderedFrame, x, y, 320, 320);
        review.fillStyle = '#382d28'; review.font = '19px sans-serif';
        review.fillText(`${clip.name} ${String(frame).padStart(2, '0')}  ${time.toFixed(3)}s`, x + 8, y + 343);
        reviewIndex++;
      }
      sheets.push({ file: clip.file, png: sheet.toDataURL() });
      info.push({ animation: clip.name, file: clip.file, frames: clip.frames, columns, rows, seconds: clip.frames / fps,
        sourceSeconds: animation.duration, fps, cellWidth: cell, cellHeight: cell, width: sheet.width, height: sheet.height, frameInfo });
    }
    return { sheets, poster, contact: contact.toDataURL(), metadata: { sourceVersion: skeletonData.version, bones: skeletonData.bones.length,
      visibleSlots: [...characterSlots],
      slots: skeletonData.slots.length, slotNames, hiddenSlots, animations, renderer: 'Canvas2D triangleRendering=true',
      boundsSamplingFps: 120, unionBounds: bounds, transform: { scale, centerX, centerY, padding, cellWidth: cell, cellHeight: cell }, clips: info } };
  }, payload);
  assert.deepEqual(errors, [], 'Browser errors.');
  assert.equal(rendered.metadata.sourceVersion, '3.6.53');
  assert.equal(rendered.metadata.bones, 58);
  assert.equal(rendered.metadata.slots, 54);
  assert.equal(rendered.metadata.animations.length, 15);
  const destination = probe ? cache : output;
  await mkdir(destination, { recursive: true });
  await mkdir(reviews, { recursive: true });
  const savePng = async (target, data) => {
    const bytes = Buffer.from(data.split(',')[1], 'base64');
    await writeFile(target, bytes);
    return { path: path.relative(root, target).replaceAll('\\', '/'), bytes: bytes.length, sha256: hash(bytes) };
  };
  const files = [];
  for (const sheet of rendered.sheets) files.push(await savePng(path.join(destination, sheet.file), sheet.png));
  files.push(await savePng(path.join(destination, 'adam-poster.png'), rendered.poster));
  files.push(await savePng(path.join(probe ? cache : reviews, 'adam-contact-sheet.png'), rendered.contact));
  const archiveRecord = { path: path.relative(root, archive).replaceAll('\\', '/'), bytes: (await readFile(archive)).length, sha256: sourceHash };
  files.push(archiveRecord);
  const coreFiles = ['adam.skel', 'adam.atlas', 'adam.png', 'adam.spine'];
  const sourceFiles = [];
  for (const name of coreFiles) {
    const bytes = await readFile(path.join(sourceDir, name));
    sourceFiles.push({ name, bytes: bytes.length, sha256: hash(bytes) });
  }
  const metadata = { sourceArchive: archiveRecord.path,
    sourceArchiveSha256: sourceHash, runtimeUrl: `${origin}/build/spine-canvas.js`, runtimeSha256: runtimeHash,
    runtimeLicenseUrl: `${origin}/LICENSE`, runtimeLicenseSha256: hash(await readFile(path.join(cache, 'LICENSE'))),
    runtimeCacheOnly: true, sourceFiles, browser: browser.version(), ...rendered.metadata, files, browserErrors: errors };
  // Tool-generated metadata contains measurements and hashes, not hand-authored source.
  await writeFile(path.join(probe ? cache : archiveDir, 'render-metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  if (!probe) await writeFile(path.join(archiveDir, 'manifest-suggestions.json'), `${JSON.stringify(files.map((file) => ({
    from: file.path.endsWith('.zip') ? 'user-supplied:adam_醒狮替换包_v2 (2)(1).zip' :
      file.path.includes('/reviews/') ? 'generated:chromium-offline-action-guide-review' : 'generated:adam-spine-3.6.53-offline-render', ...file,
  })), null, 2)}\n`);
  console.log(JSON.stringify({ probe, browser: metadata.browser, sourceFiles, slotNames: metadata.slotNames,
    hiddenSlots: metadata.hiddenSlots, animations: metadata.animations, unionBounds: metadata.unionBounds, files,
    clips: metadata.clips.map(({ frameInfo, ...clip }) => ({ ...clip, framesVerified: frameInfo.length, edgePixels: frameInfo.reduce((n, f) => n + f.edgePixels, 0) })) }, null, 2));
} finally {
  await browser.close();
}
