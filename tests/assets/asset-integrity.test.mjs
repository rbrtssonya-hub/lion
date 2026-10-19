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
const binaryExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.webm', '.glb', '.moc3', '.psd', '.cmo3', '.blend', '.woff', '.woff2', '.ttf', '.otf']);

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
    if (path === 'assets/fonts/OFL.txt') continue;
    const live2dAsset = path === 'assets/live2d/README.md'
      || (path.startsWith('assets/live2d/runtime/') && ['.js', '.md'].includes(extension))
      || (path.startsWith('assets/live2d/nanfeng-lion/') && ['.json', '.moc3', '.png'].includes(extension));
    assert.equal(live2dAsset, true, `Unconfigured media or non-runtime file in publicDir: ${path}`);
  }
});

test('navigation lion is a configured transparent PNG', () => {
  const path = containedPath(publicRoot, assetPaths.navLion);
  const bytes = readFileSync(path);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes[25], 6, 'Navigation lion PNG must use RGBA color type');
  assert.ok(bytes.readUInt32BE(16) > 0, 'Navigation lion PNG must have a width');
  assert.ok(bytes.readUInt32BE(20) > 0, 'Navigation lion PNG must have a height');
});

test('navigation brush font is a WOFF with its redistributable license', () => {
  const bytes = readFileSync(containedPath(publicRoot, assetPaths.navBrushFont));
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'wOFF');
  assert.equal(bytes.readUInt32BE(8), bytes.length, 'WOFF header length must match the delivered font');
  assert.ok(bytes.readUInt16BE(12) > 0, 'WOFF must contain font tables');
  const license = readFileSync(containedPath(publicRoot, 'assets/fonts/OFL.txt'), 'utf8');
  assert.match(license, /Copyright 2019-2020 The SlideFont Project Authors/);
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
});

test('structure web export preserves source sheen weights and stays within the desktop geometry budget', () => {
  const bytes = readFileSync(containedPath(publicRoot, assetPaths.model));
  const model = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  const report = readJson(resolve(sourceRoot, 'references/lion-structure-model.json'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), report.export.sha256);
  const triangles = model.meshes.reduce((total, mesh) => total + mesh.primitives.reduce((sum, primitive) => (
    sum + model.accessors[primitive.indices].count / 3
  ), 0), 0);
  assert.equal(triangles, report.export.gltf_triangles);
  assert.ok(triangles < 550_000, `Desktop web geometry exceeds the reviewed budget: ${triangles}`);
  assert.equal(model.nodes.length, 41, 'Keep the complete named model instead of dropping body parts for speed');

  const authoredWeights = new Map([
    ['Lion_Atlas_PBR_Refined', .12], ['HighDetail_Head_Atlas_PBR', .12],
  ]);
  for (const [name, weight] of authoredWeights) {
    const material = model.materials.find(item => item.name === name);
    assert.ok(material, `Missing authored atlas material: ${name}`);
    const sheen = material.extensions?.KHR_materials_sheen?.sheenColorFactor;
    assert.ok(sheen?.every(channel => Math.abs(channel - weight) < 1e-6), `${name}: white sheen must retain the source's 12% weight`);
    assert.ok(material.pbrMetallicRoughness.baseColorTexture, `${name}: preserve the source color texture`);
  }
  assert.ok(report.material_sheen_corrections.length >= 10);
  for (const correction of report.material_sheen_corrections) {
    const material = model.materials.find(item => item.name === correction.material);
    // Dedup may merge identical material copies; the retained materials must
    // preserve their actual authored reflection rather than full white sheen.
    if (!material) continue;
    const actual = material.extensions.KHR_materials_sheen.sheenColorFactor;
    correction.source_tint.forEach((channel, index) => {
      assert.ok(Math.abs(actual[index] - channel * correction.source_weight) < 1e-6);
    });
  }
});

test('all six structure regions describe real model meshes or finite surface volumes', () => {
  const structure = readJson(resolve(root, 'src/data/lion-structure.json'));
  const bytes = readFileSync(containedPath(publicRoot, assetPaths.model));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'The configured model must be GLB');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, 'GLB must begin with its JSON chunk');
  const model = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  const meshNames = (model.nodes ?? []).filter(node => Number.isInteger(node.mesh)).map(node => node.name ?? '');
  assert.ok(meshNames.length > 1, 'The replacement model must retain its authored mesh structure');
  assert.equal(structure.hotspots.length, 6);
  const ids = new Set();
  const point = (value, label) => {
    assert.ok(Array.isArray(value) && value.length === 3 && value.every(Number.isFinite), `${label}: expected three finite coordinates`);
  };
  for (const hotspot of structure.hotspots) {
    assert.equal(typeof hotspot.id, 'string');
    assert.ok(hotspot.id.length > 0);
    assert.equal(ids.has(hotspot.id), false, `Duplicate structure ID: ${hotspot.id}`);
    ids.add(hotspot.id);
    assert.equal(hotspot.position, undefined, `${hotspot.id}: screen-fixed hotspots must not replace surface picking`);
    assert.ok(Array.isArray(hotspot.objectNames), `${hotspot.id}: mesh prefixes must be explicit`);
    assert.ok(Array.isArray(hotspot.surfaceRegions), `${hotspot.id}: surface regions must be explicit`);
    assert.ok(hotspot.objectNames.length + hotspot.surfaceRegions.length > 0, `${hotspot.id}: missing mesh or surface mapping`);
    for (const prefix of hotspot.objectNames) {
      assert.equal(typeof prefix, 'string');
      assert.ok(prefix.length > 0);
      assert.ok(meshNames.some(name => name.startsWith(prefix)), `${hotspot.id}: mesh prefix does not exist in the delivered GLB: ${prefix}`);
    }
    for (const region of hotspot.surfaceRegions) {
      point(region.center, `${hotspot.id}: region center`);
      point(region.radii, `${hotspot.id}: region radii`);
      assert.ok(region.radii.every(value => value > 0), `${hotspot.id}: region radii must be positive`);
    }
    assert.ok(Array.isArray(hotspot.pickPoints) && hotspot.pickPoints.length > 0, `${hotspot.id}: missing real surface anchors`);
    hotspot.pickPoints.forEach(value => point(value, `${hotspot.id}: surface anchor`));
  }
});

test('replacement GLB preserves UVs, embedded textures and valid indices across all meshes', () => {
  const bytes = readFileSync(containedPath(publicRoot, assetPaths.model));
  const jsonLength = bytes.readUInt32LE(12);
  const model = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  const binaryHeader = 20 + jsonLength;
  assert.equal(bytes.readUInt32LE(binaryHeader + 4), 0x004e4942, 'Model textures and geometry must be embedded');
  const binary = bytes.subarray(binaryHeader + 8);
  assert.ok(model.meshes.length > 1);
  assert.ok(model.images.length > 0, 'The authored model must retain its texture images');
  for (const image of model.images) {
    assert.equal(image.uri, undefined, 'Textures must not depend on local Blender paths');
    assert.ok(Number.isInteger(image.bufferView));
    assert.match(image.mimeType, /^image\/(?:png|jpeg|webp)$/);
    assert.ok(model.bufferViews[image.bufferView].byteLength > 0);
  }
  let uvMeshes = 0;
  let triangleCount = 0;
  for (const mesh of model.meshes) {
    for (const primitive of mesh.primitives) {
      assert.equal(primitive.mode ?? 4, 4, `${mesh.name}: expected renderable triangles`);
      const positions = model.accessors[primitive.attributes.POSITION];
      assert.equal(positions.type, 'VEC3');
      assert.ok(positions.count > 0);
      if (primitive.attributes.TEXCOORD_0 !== undefined) {
        uvMeshes++;
        const uv = model.accessors[primitive.attributes.TEXCOORD_0];
        assert.equal(uv.type, 'VEC2');
        assert.equal(uv.count, positions.count, `${mesh.name}: UVs must cover every vertex`);
      }
      const indices = model.accessors[primitive.indices];
      assert.equal(indices.type, 'SCALAR');
      assert.equal(indices.count % 3, 0);
      triangleCount += indices.count / 3;
      const view = model.bufferViews[indices.bufferView];
      const componentBytes = { 5121: 1, 5123: 2, 5125: 4 }[indices.componentType];
      assert.ok(componentBytes, `${mesh.name}: invalid index component type`);
      const stride = view.byteStride ?? componentBytes;
      const offset = (view.byteOffset ?? 0) + (indices.byteOffset ?? 0);
      for (let index = 0; index < indices.count; index++) {
        const value = binary.readUIntLE(offset + index * stride, componentBytes);
        assert.ok(value < positions.count, `${mesh.name}: index ${value} exceeds ${positions.count} vertices`);
      }
    }
  }
  assert.ok(uvMeshes > 0, 'At least the authored mesh must retain its original UV coordinates');
  assert.ok(triangleCount > 0, 'The delivered model must contain nonempty geometry');
});

test('structure hotspots provide cultural, technical and camera focus metadata', () => {
  const structure = readJson(resolve(root, 'src/data/lion-structure.json'));
  for (const hotspot of structure.hotspots) {
    assert.equal(typeof hotspot.culture?.meaning, 'string');
    assert.ok(hotspot.culture.meaning.length > 0, `${hotspot.id}: missing cultural meaning`);
    assert.equal(typeof hotspot.culture?.pattern, 'string');
    assert.ok(hotspot.culture.pattern.length > 0, `${hotspot.id}: missing pattern description`);
    assert.equal(typeof hotspot.structure?.craft, 'string');
    assert.ok(hotspot.structure.craft.length > 0, `${hotspot.id}: missing craft description`);
    assert.ok(Array.isArray(hotspot.structure?.parts) && hotspot.structure.parts.length > 0, `${hotspot.id}: missing structure parts`);
    assert.ok(Array.isArray(hotspot.focusTarget) && hotspot.focusTarget.length === 3, `${hotspot.id}: invalid focus target`);
    assert.ok(hotspot.focusTarget.every((value) => Number.isFinite(value)), `${hotspot.id}: focus target must be numeric`);
    assert.equal(typeof hotspot.focusDistance, 'number');
    assert.ok(hotspot.focusDistance > 0, `${hotspot.id}: focus distance must be positive`);
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
