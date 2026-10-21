import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { assetPaths } from '../../src/config/assetPaths.js';

const report = JSON.parse(fs.readFileSync(new URL('../../source/references/action-drum-2026-10-21.json', import.meta.url)));
const runtime = fs.readFileSync(new URL(`../../source/public/${assetPaths.actionTheaterDrum}`, import.meta.url));
const gltf = JSON.parse(runtime.toString('utf8', 20, 20 + runtime.readUInt32LE(12)));
const binaryStart = 20 + runtime.readUInt32LE(12) + 8;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('鼓运行资产保留全部评估三角、UV、PBR纹理，源文件原字节归档', () => {
  assert.equal(sha(runtime), report.output_sha256);
  assert.equal(runtime.byteLength, report.output_bytes);
  const archived = fs.readFileSync(new URL(`../../${report.source_archive}`, import.meta.url));
  assert.equal(sha(archived), report.source_sha256);
  assert.equal(archived.byteLength, report.source_bytes);
  assert.equal(gltf.meshes.length, 7);
  assert.equal(gltf.materials.length, 7);
  assert.equal(gltf.images.length, 12);
  assert(gltf.images.every(image => image.bufferView !== undefined && !image.uri));
  for (const material of gltf.materials.slice(0, 5)) {
    assert(material.pbrMetallicRoughness.baseColorTexture);
    assert(material.pbrMetallicRoughness.metallicRoughnessTexture);
    assert(material.normalTexture);
  }
  let triangles = 0;
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    const position = gltf.accessors[primitive.attributes.POSITION];
    const normal = gltf.accessors[primitive.attributes.NORMAL];
    const uv = gltf.accessors[primitive.attributes.TEXCOORD_0];
    assert.equal(normal.count, position.count);
    assert.equal(uv.count, position.count);
    const index = gltf.accessors[primitive.indices];
    const view = gltf.bufferViews[index.bufferView];
    const offset = binaryStart + (view.byteOffset ?? 0) + (index.byteOffset ?? 0);
    const readIndex = index.componentType === 5125 ? 'readUInt32LE' : 'readUInt16LE';
    const stride = index.componentType === 5125 ? 4 : 2;
    for (let i = 0; i < index.count; i += 1) assert(runtime[readIndex](offset + i * stride) < position.count);
    triangles += index.count / 3;
  }
  assert.equal(triangles, report.source_evaluated_triangles);
  assert.equal(triangles, 295280);
});
