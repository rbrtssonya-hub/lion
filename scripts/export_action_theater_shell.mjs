import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Box3, Matrix4, Quaternion, Vector3 } from 'three';
import { theaterActions } from '../src/features/action/actionClips.js';
import { assetPaths } from '../src/config/assetPaths.js';

export const authoringTheater = new URL('../source/models/immersive-theater/SouthWindLion_Immersive_Theater.glb', import.meta.url);
export const runtimeTheater = new URL(`../source/public/${assetPaths.actionTheaterScene}`, import.meta.url);
const lionName = 'Lion_RotationRoot';

function referenceHeight(document, rootIndex) {
  const bounds = new Box3();
  function visit(index, parentMatrix) {
    const node = document.nodes[index];
    assert.ok(node.skin === undefined, 'Expected the original static lion');
    const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
      new Vector3(...(node.translation ?? [0, 0, 0])),
      new Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
      new Vector3(...(node.scale ?? [1, 1, 1])),
    );
    const world = parentMatrix.clone().multiply(local);
    for (const primitive of document.meshes[node.mesh]?.primitives ?? []) {
      const position = document.accessors[primitive.attributes.POSITION];
      assert.ok(position?.min && position.max && !position.normalized && !primitive.targets,
        'Expected static POSITION bounds from Blender');
      bounds.union(new Box3(new Vector3(...position.min), new Vector3(...position.max)).applyMatrix4(world));
    }
    for (const child of node.children ?? []) visit(child, world);
  }
  visit(rootIndex, new Matrix4());
  const height = bounds.max.y - bounds.min.y;
  assert.ok(Number.isFinite(height) && height > 0, 'The original lion must have positive height');
  return height;
}

function chunk(type, data, padding) {
  const aligned = data.length + (4 - data.length % 4) % 4;
  const bytes = Buffer.alloc(aligned + 8, padding);
  bytes.writeUInt32LE(aligned);
  bytes.write(type, 4, 'ascii');
  data.copy(bytes, 8);
  return bytes;
}

// Copy the authored room and screen geometry, then retain the mount scale as data.
export function exportTheaterShell(source) {
  assert.equal(source.toString('ascii', 0, 4), 'glTF');
  assert.equal(source.readUInt32LE(4), 2);
  assert.equal(source.readUInt32LE(8), source.length);
  assert.equal(source.toString('ascii', 16, 20), 'JSON');
  const binHeader = 20 + source.readUInt32LE(12);
  assert.equal(source.toString('ascii', binHeader + 4, binHeader + 8), 'BIN\0');
  const document = JSON.parse(source.toString('utf8', 20, binHeader));
  const binary = source.subarray(binHeader + 8);
  assert.equal(document.buffers.length, 1);
  const rootIndices = document.scenes[document.scene ?? 0].nodes;
  const required = new Set([lionName, ...theaterActions.flatMap(clip => [clip.objectName, clip.anchorName])]);
  const selected = rootIndices.filter(index => {
    const { name } = document.nodes[index];
    return required.has(name) || name.startsWith('Room_');
  });
  for (const name of required) assert.equal(selected.filter(index => document.nodes[index].name === name).length, 1, name);

  const output = { asset: document.asset, scene: 0, scenes: [{ nodes: selected.map((_, index) => index) }],
    nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [] };
  const mappings = new Map();
  function copy(kind, sourceIndex, convert) {
    if (!mappings.has(kind)) mappings.set(kind, new Map());
    const map = mappings.get(kind);
    if (!map.has(sourceIndex)) {
      const value = convert(document[kind][sourceIndex]);
      map.set(sourceIndex, output[kind].push(value) - 1);
    }
    return map.get(sourceIndex);
  }
  const payload = [];
  let offset = 0;
  const retainAccessor = index => copy('accessors', index, accessor => {
    assert.ok(!accessor.sparse && accessor.bufferView !== undefined);
    const bufferView = copy('bufferViews', accessor.bufferView, view => {
      assert.ok(view.buffer === 0 && !view.extensions);
      const start = view.byteOffset ?? 0;
      const bytes = binary.subarray(start, start + view.byteLength);
      assert.equal(bytes.length, view.byteLength);
      const alignedOffset = offset + (4 - offset % 4) % 4;
      payload.push(Buffer.alloc(alignedOffset - offset), bytes);
      offset = alignedOffset + bytes.length;
      return { ...view, byteOffset: alignedOffset };
    });
    return { ...accessor, bufferView };
  });
  output.nodes = selected.map(index => {
    const { children, mesh, extras, ...node } = document.nodes[index];
    if (node.name === lionName) return { ...node, extras: { mountHeight: referenceHeight(document, index) } };
    assert.ok(!children && !node.skin, 'Expected standalone room, screen and anchor nodes');
    if (mesh === undefined) return node;
    return { ...node, mesh: copy('meshes', mesh, sourceMesh => ({
      name: sourceMesh.name,
      primitives: sourceMesh.primitives.map(primitive => {
        assert.ok(!primitive.targets && !primitive.extensions && primitive.indices !== undefined);
        const material = copy('materials', primitive.material, original => {
          assert.ok(!original.extensions && !JSON.stringify(original).includes('Texture"'), 'Expected untextured room materials');
          return original;
        });
        const attributes = Object.fromEntries(Object.entries(primitive.attributes).map(([name, accessor]) => [name, retainAccessor(accessor)]));
        return { ...primitive, attributes, indices: retainAccessor(primitive.indices), material };
      }),
    })) };
  });
  output.buffers = [{ byteLength: offset }];
  const jsonChunk = chunk('JSON', Buffer.from(JSON.stringify(output)), 0x20);
  const binChunk = chunk('BIN\0', Buffer.concat(payload), 0);
  const header = Buffer.alloc(12);
  header.write('glTF');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(header.length + jsonChunk.length + binChunk.length, 8);
  return Buffer.concat([header, jsonChunk, binChunk]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = readFileSync(authoringTheater);
  const shell = exportTheaterShell(source);
  writeFileSync(runtimeTheater, shell);
  console.log(`Theater GLB: ${source.length} -> ${shell.length} bytes`);
}
