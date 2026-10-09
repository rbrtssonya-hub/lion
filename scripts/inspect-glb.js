import fs from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const file = resolve(root, process.argv[2] ?? 'source/public/assets/models/lion-overall.glb');

const bytes = fs.readFileSync(file);
if (bytes.toString('ascii', 0, 4) !== 'glTF') throw new Error('Not a GLB file');
const jsonLength = bytes.readUInt32LE(12);
const json = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
const binaryStart = 20 + jsonLength + 8;
const binary = bytes.subarray(binaryStart);

function accessorView(index) {
  const accessor = json.accessors[index];
  const view = json.bufferViews[accessor.bufferView];
  return {
    accessor,
    offset: (view.byteOffset || 0) + (accessor.byteOffset || 0),
  };
}

const positionView = accessorView(json.meshes[0].primitives[0].attributes.POSITION);
const normalView = accessorView(json.meshes[0].primitives[0].attributes.NORMAL);
const indexView = accessorView(json.meshes[0].primitives[0].indices);

const positions = new Float32Array(
  binary.buffer,
  binary.byteOffset + positionView.offset,
  positionView.accessor.count * 3,
);
const normals = new Float32Array(
  binary.buffer,
  binary.byteOffset + normalView.offset,
  normalView.accessor.count * 3,
);
const indices = new Uint32Array(
  binary.buffer,
  binary.byteOffset + indexView.offset,
  indexView.accessor.count,
);

let invalidIndices = 0;
let degenerateTriangles = 0;
let minCrossMagnitude = Infinity;
let maxCrossMagnitude = 0;
const edges = new Map();

for (let i = 0; i < indices.length; i += 3) {
  const a = indices[i];
  const b = indices[i + 1];
  const c = indices[i + 2];
  if (a >= positionView.accessor.count || b >= positionView.accessor.count || c >= positionView.accessor.count) {
    invalidIndices += 1;
    continue;
  }

  const ax = positions[a * 3];
  const ay = positions[a * 3 + 1];
  const az = positions[a * 3 + 2];
  const bx = positions[b * 3];
  const by = positions[b * 3 + 1];
  const bz = positions[b * 3 + 2];
  const cx = positions[c * 3];
  const cy = positions[c * 3 + 1];
  const cz = positions[c * 3 + 2];
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;
  const crossMagnitude = Math.hypot(
    aby * acz - abz * acy,
    abz * acx - abx * acz,
    abx * acy - aby * acx,
  );
  if (crossMagnitude < 1e-10) degenerateTriangles += 1;
  minCrossMagnitude = Math.min(minCrossMagnitude, crossMagnitude);
  maxCrossMagnitude = Math.max(maxCrossMagnitude, crossMagnitude);

  for (const [u, v] of [[a, b], [b, c], [c, a]]) {
    const key = u < v ? `${u},${v}` : `${v},${u}`;
    edges.set(key, (edges.get(key) || 0) + 1);
  }
}

let nonUnitNormals = 0;
for (let i = 0; i < normals.length; i += 3) {
  const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
  if (Math.abs(length - 1) > 1e-3) nonUnitNormals += 1;
}

let boundaryEdges = 0;
let nonManifoldEdges = 0;
for (const count of edges.values()) {
  if (count === 1) boundaryEdges += 1;
  if (count > 2) nonManifoldEdges += 1;
}

console.log(JSON.stringify({
  file,
  bytes: bytes.length,
  nodes: json.nodes?.length || 0,
  meshes: json.meshes?.length || 0,
  materials: json.materials?.length || 0,
  textures: json.textures?.length || 0,
  images: json.images?.length || 0,
  vertices: positionView.accessor.count,
  triangles: indices.length / 3,
  invalidIndices,
  degenerateTriangles,
  boundaryEdges,
  nonManifoldEdges,
  nonUnitNormals,
  minCrossMagnitude,
  maxCrossMagnitude,
}, null, 2));
