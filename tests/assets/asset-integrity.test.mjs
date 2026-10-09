import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import test from 'node:test';
import { assetPaths } from '../../src/config/assetPaths.js';

const root = resolve(import.meta.dirname, '../..');
const sourceRoot = resolve(root, 'source');
const publicRoot = resolve(sourceRoot, 'public');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const binaryExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.webm', '.glb', '.moc3', '.psd', '.cmo3', '.blend']);

function containedPath(base, path) {
  assert.equal(typeof path, 'string');
  assert.ok(path.length > 0 && !isAbsolute(path), `Expected a relative path: ${path}`);
  const resolved = resolve(base, path);
  const location = relative(base, resolved);
  assert.ok(location !== '..' && !location.startsWith(`..${sep}`) && !isAbsolute(location), `Path escapes its asset directory: ${path}`);
  return resolved;
}

function* filesWithin(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    assert.equal(entry.isSymbolicLink(), false, `Asset directories must contain local files: ${path}`);
    if (entry.isDirectory()) yield* filesWithin(path);
    else if (entry.isFile()) yield path;
  }
}

test('migration snapshot preserves the size and SHA256 of every archived binary asset', () => {
  // This manifest is the migration baseline. After intentionally changing an
  // asset, review and update that asset's record; never rewrite it to hide loss.
  const manifest = readJson(resolve(sourceRoot, 'asset-manifest.json'));
  assert.equal(manifest.version, 1);
  assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0);
  const paths = new Set();
  for (const entry of manifest.files) {
    assert.equal(paths.has(entry.path), false, `Duplicate snapshot destination: ${entry.path}`);
    paths.add(entry.path);
    assert.equal(typeof entry.from, 'string');
    assert.equal(entry.from.startsWith('source/public/'), false, `Use the original migration source: ${entry.from}`);
    assert.ok(entry.path.startsWith('source/'), `Asset must remain under source/: ${entry.path}`);
    const path = containedPath(sourceRoot, entry.path.slice('source/'.length));
    const file = statSync(path);
    assert.equal(file.isFile(), true, `Asset is not a file: ${entry.path}`);
    assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes > 0);
    assert.equal(file.size, entry.bytes, `Asset size changed: ${entry.path}`);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
    assert.equal(hash, entry.sha256, `Asset content changed: ${entry.path}`);
  }
  for (const file of filesWithin(sourceRoot)) {
    if (!binaryExtensions.has(extname(file).toLowerCase())) continue;
    const path = relative(root, file).split(sep).join('/');
    assert.equal(paths.has(path), true, `Binary asset is absent from the migration snapshot: ${path}`);
  }
});

test('public assets include configured media and exclude private creative or review files', () => {
  const runtimeMedia = new Set(Object.values(assetPaths));
  assert.ok(runtimeMedia.size > 0);
  for (const [name, path] of Object.entries(assetPaths)) {
    const file = containedPath(publicRoot, path);
    assert.equal(statSync(file).isFile(), true, `Missing configured ${name}: ${path}`);
    assert.ok(statSync(file).size > 0, `Empty configured ${name}: ${path}`);
  }
  for (const file of filesWithin(publicRoot)) {
    const path = relative(publicRoot, file).split(sep).join('/');
    const extension = extname(path).toLowerCase();
    assert.equal(['.psd', '.cmo3', '.blend', '.blend1'].includes(extension), false, `Private editable asset in publicDir: ${path}`);
    const folders = path.split('/').slice(0, -1);
    assert.equal(folders.some((name) => /^(?:source(?:-v\d+)?|reviews?|design|private|cubism|root-export)$/.test(name)), false, `Private asset directory in publicDir: ${path}`);
    if (runtimeMedia.has(path)) continue;
    const live2dAsset = path === 'assets/live2d/README.md'
      || (path.startsWith('assets/live2d/runtime/') && ['.js', '.md'].includes(extension))
      || (path.startsWith('assets/live2d/nanfeng-lion/') && ['.json', '.moc3', '.png'].includes(extension));
    assert.equal(live2dAsset, true, `Unconfigured media or non-runtime file in publicDir: ${path}`);
  }
});

test('all six structure hotspots have unique IDs and valid percentage positions', () => {
  const structure = readJson(resolve(root, 'src/data/lion-structure.json'));
  assert.equal(structure.hotspots.length, 6);
  const ids = new Set();
  for (const hotspot of structure.hotspots) {
    assert.equal(typeof hotspot.id, 'string');
    assert.ok(hotspot.id.length > 0);
    assert.equal(ids.has(hotspot.id), false, `Duplicate hotspot ID: ${hotspot.id}`);
    ids.add(hotspot.id);
    for (const coordinate of ['left', 'top']) {
      const value = hotspot.position?.[coordinate];
      assert.equal(typeof value, 'string', `${hotspot.id}: ${coordinate} must be a percentage`);
      assert.match(value, /^\d+(?:\.\d+)?%$/, `${hotspot.id}: invalid ${coordinate} percentage`);
      const percentage = Number.parseFloat(value);
      assert.ok(percentage >= 0 && percentage <= 100, `${hotspot.id}: ${coordinate} is outside the viewport`);
    }
  }
});

test('Live2D layer specification resolves the source cover after migration', () => {
  const directory = resolve(sourceRoot, 'live2d/source');
  const specification = readJson(resolve(directory, 'layer-spec.json'));
  const cover = resolve(directory, specification.source);
  assert.equal(cover, containedPath(publicRoot, assetPaths.cover));
  assert.equal(statSync(cover).isFile(), true);
  assert.equal(specification.canvas.width, 2048);
  assert.equal(specification.canvas.height, 1152);
});
