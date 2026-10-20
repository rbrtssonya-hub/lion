import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { assetPaths } from '../../src/config/assetPaths.js';

const root = resolve(import.meta.dirname, '../..');
const sourceRoot = resolve(root, 'source');
const publicRoot = resolve(sourceRoot, 'public');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const binaryExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.webm', '.glb', '.gz', '.gzip', '.exr', '.moc3', '.psd', '.cmo3', '.blend', '.woff', '.woff2', '.ttf', '.otf']);
const localSourcePath = 'source/models/user-lion-2026-10-20.blend';
const userSourceSha256 = 'dcfd8b97a27c371381aa7a0b1c26f5081fc4a35976a571979596aec353d6f770';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

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
    assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes > 0);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    if (entry.localOnly !== undefined) {
      assert.equal(entry.localOnly, true, `Unsupported local-only flag: ${entry.path}`);
      assert.equal(entry.path, localSourcePath, 'Only the original oversized user source may be absent from a GitHub checkout');
      assert.equal(entry.bytes, 136_543_222);
      assert.equal(entry.sha256, userSourceSha256);
      if (!existsSync(path)) continue;
    }
    const file = statSync(path);
    assert.equal(file.isFile(), true, `Asset is not a file: ${entry.path}`);
    assert.equal(file.size, entry.bytes, `Asset size changed: ${entry.path}`);
    const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
    assert.equal(hash, entry.sha256, `Asset content changed: ${entry.path}`);
  }
  for (const file of filesWithin(sourceRoot)) {
    if (!binaryExtensions.has(extname(file).toLowerCase())) continue;
    const path = relative(root, file).split(sep).join('/');
    assert.equal(paths.has(path), true, `Binary asset is absent from the migration snapshot: ${path}`);
  }
  assert.equal(manifest.files.find(entry => entry.path === localSourcePath)?.localOnly, true, 'Record the original user source even when its oversized local archive is absent');
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

test('structure web export preserves every source mesh and its authored sheen weights', () => {
  const bytes = readFileSync(containedPath(publicRoot, assetPaths.model));
  const model = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  const report = readJson(resolve(sourceRoot, 'references/lion-structure-model.json'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), report.export.sha256);
  const triangles = model.meshes.reduce((total, mesh) => total + mesh.primitives.reduce((sum, primitive) => (
    sum + model.accessors[primitive.indices].count / 3
  ), 0), 0);
  assert.equal(triangles, report.export.gltf_triangles);
  assert.equal(triangles, 657_831, 'Keep every evaluated source triangle, including the 72 degenerate faces the stock exporter repairs');
  assert.equal(triangles, report.evaluated_source_triangles, 'Export must match the source before any exporter repair');
  assert.equal(report.exporter_mesh_validation_disabled, true);
  assert.equal(model.meshes.length, 53);
  assert.equal(model.meshes.length, report.scene_object_counts.MESH);
  assert.equal(model.meshes.length, report.export.gltf_meshes);
  assert.equal(model.nodes.length, 102, 'Keep the complete mesh hierarchy instead of dropping body parts for speed');
  assert.equal(model.nodes.length, report.export.gltf_nodes);
  const meshNames = model.nodes.filter(node => Number.isInteger(node.mesh)).map(node => node.name).sort();
  assert.deepEqual(meshNames, report.mesh_objects.map(mesh => mesh.name).sort());
  assert.deepEqual(meshNames, report.export.mesh_object_names.slice().sort());
  assert.equal(report.source, localSourcePath);
  assert.equal(report.source_sha256, userSourceSha256);
  assert.equal(report.source_unchanged, true);
  for (const key of ['mesh_decimation', 'mesh_deduplication', 'mesh_repair', 'hair_sampling', 'hair_point_simplification', 'quantization', 'texture_resize', 'source_saved']) {
    assert.equal(report.policy[key], false, `The user source must not be simplified or rewritten: ${key}`);
  }

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

test('complete user hair preserves all 33 groups, source points, radii and emitter UVs', () => {
  const report = readJson(resolve(sourceRoot, 'references/lion-structure-model.json'));
  const manifest = readJson(containedPath(publicRoot, assetPaths.modelHair));
  assert.equal(manifest.version, 1);
  assert.equal(manifest.coordinateSystem, 'GLTF_Y_UP');
  assert.equal(manifest.sourceSha256, userSourceSha256);
  assert.deepEqual(report.source_render, { engine: 'BLENDER_EEVEE', hair_type: 'STRAND', hair_subdiv: 0 });
  assert.equal(manifest.groups.length, 33);
  assert.equal(report.hair_source.length, 33);
  assert.equal(report.export.hair_groups, 33);
  const auditById = new Map(report.hair_source.map(group => [group.id, group]));
  assert.equal(auditById.size, 33);
  const names = new Set();
  const paths = new Set();
  const authoredCurveCounts = new Map([['粒子系统', 99_854], ['粒子系统.001', 35_567], ['粒子系统.002', 40_000]]);
  let particleStrands = 0;
  let curveStrands = 0;
  let sourcePoints = 0;
  let particleGroups = 0;
  let curveGroups = 0;
  for (const group of manifest.groups) {
    assert.equal(names.has(group.name), false, `Duplicate hair object: ${group.name}`);
    names.add(group.name);
    assert.equal(paths.has(group.path), false, `Duplicate hair asset: ${group.path}`);
    paths.add(group.path);
    assert.equal(assetPaths[group.assetKey], group.path, `${group.name}: hair must use the central asset configuration`);
    assert.match(group.path, /^assets\/models\/lion-user-hair-\d{2}\.bin\.gz$/);
    assert.equal(group.displayMode, 'STRAND', `${group.name}: retain the source EEVEE line rendering mode`);
    const audit = auditById.get(group.id);
    assert.ok(audit, `${group.name}: missing source audit`);
    for (const [key, value] of Object.entries(group)) {
      assert.deepEqual(audit[key], value, `${group.name}: runtime/source audit differ at ${key}`);
    }
    const bytes = readFileSync(containedPath(publicRoot, group.path));
    assert.equal(bytes.length, group.bytes, `${group.name}: gzip size`);
    assert.match(group.sha256, /^[a-f0-9]{64}$/);
    assert.equal(sha256(bytes), group.sha256, `${group.name}: gzip content changed`);
    const raw = gunzipSync(bytes);
    assert.equal(raw.length, group.rawBytes, `${group.name}: uncompressed size`);
    assert.match(group.rawSha256, /^[a-f0-9]{64}$/);
    assert.equal(sha256(raw), group.rawSha256, `${group.name}: hair points or UVs changed`);
    assert.ok(Number.isSafeInteger(group.strands) && group.strands > 0);
    const pointCount = group.strands * group.pointsPerStrand;
    const pointBytes = pointCount * 4 * Float32Array.BYTES_PER_ELEMENT;
    assert.equal(raw.length, pointBytes + (group.hasRootUV ? group.strands * 2 * Float32Array.BYTES_PER_ELEMENT : 0));
    sourcePoints += pointCount;

    let expectedRadii;
    if (group.kind === 'CURVES') {
      curveGroups++;
      curveStrands += group.strands;
      assert.equal(group.strands, authoredCurveCounts.get(group.name), `${group.name}: preserve this source object's full curve count`);
      assert.equal(group.pointsPerStrand, 5, `${group.name}: keep all five authored control points`);
      assert.equal(group.interpolation, 'CATMULL_ROM');
      assert.equal(group.segmentsPerSourceSegment, 12, `${group.name}: retain Blender's default evaluated resolution`);
      assert.equal(audit.source_curves, group.strands, `${group.name}: no curve density reduction`);
      assert.equal(audit.source_points, pointCount, `${group.name}: no authored point reduction`);
      assert.equal(audit.radius_attribute, false);
      assert.equal(audit.radius_default_m, .01, `${group.name}: missing radius uses the source EEVEE default`);
      assert.deepEqual(audit.curve_types, ['CATMULL_ROM']);
      assert.equal(group.hasRootUV, false);
      expectedRadii = Array(group.pointsPerStrand).fill(.01);
    } else {
      assert.equal(group.kind, 'PARTICLE_HAIR');
      particleGroups++;
      particleStrands += group.strands;
      assert.equal(group.pointsPerStrand, 9, `${group.name}: render step 3 must retain all nine cached points`);
      assert.equal(group.interpolation, 'LINEAR');
      assert.equal(group.segmentsPerSourceSegment, 1, `${group.name}: source hair subdivision is zero`);
      assert.equal(audit.source_render_step, 3);
      assert.equal(audit.source_child_type, 'INTERPOLATED');
      assert.equal(audit.evaluated_parent_guides, 1_000);
      assert.equal(audit.evaluated_rendered_children, group.strands);
      assert.equal(audit.evaluated_rendered_strands, group.strands);
      assert.equal(group.strands, audit.evaluated_parent_guides * audit.source_child_count, `${group.name}: retain every source child`);
      assert.equal(audit.rendered_parents, 0, `${group.name}: parent guides must not be drawn again over their children`);
      assert.equal(group.hasRootUV, true, `${group.name}: preserve every child root's emitter UV`);
      assert.equal(audit.source_shape, 0);
      assert.equal(audit.source_close_tip, true);
      expectedRadii = Array.from({ length: group.pointsPerStrand }, (_, key) => (
        .5 * audit.source_radius_scale * ((1 - key / (group.pointsPerStrand - 1)) * (audit.source_root_radius - audit.source_tip_radius) + audit.source_tip_radius)
      ));
      expectedRadii[expectedRadii.length - 1] = 0;
    }
    // Inspect every retained point, including the radius at every key. Widths
    // remain in the asset even though the source STRAND mode draws centerlines.
    for (let point = 0; point < pointCount; point++) {
      const offset = point * 16;
      for (let axis = 0; axis < 3; axis++) {
        assert.ok(Number.isFinite(raw.readFloatLE(offset + axis * 4)), `${group.name}: nonfinite position at point ${point}`);
      }
      assert.ok(Math.abs(raw.readFloatLE(offset + 12) - expectedRadii[point % group.pointsPerStrand]) < 1e-8, `${group.name}: authored radius changed at point ${point}`);
    }
    for (let offset = pointBytes; offset < raw.length; offset += 4) {
      assert.ok(Number.isFinite(raw.readFloatLE(offset)), `${group.name}: nonfinite emitter UV`);
    }
  }
  assert.equal(curveGroups, 3);
  assert.equal(particleGroups, 30);
  assert.equal(curveStrands, 175_421);
  assert.equal(particleStrands, 2_120_000);
  assert.equal(manifest.totalStrands, 2_295_421);
  assert.equal(manifest.totalStrands, curveStrands + particleStrands);
  assert.equal(sourcePoints, 19_957_105);
  assert.equal(manifest.totalPoints, sourcePoints);
  assert.equal(report.export.hair_strands, manifest.totalStrands);
  assert.equal(report.export.hair_points, sourcePoints);
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
