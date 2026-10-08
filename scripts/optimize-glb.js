const fs = require('fs');
const path = require('path');

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) throw new Error('Usage: node optimize-glb.js <input.glb> <output.glb>');

const source = fs.readFileSync(input);
if (source.toString('ascii', 0, 4) !== 'glTF') throw new Error('Not a GLB file');
const jsonLength = source.readUInt32LE(12);
const json = JSON.parse(source.toString('utf8', 20, 20 + jsonLength));
const binaryStart = 20 + jsonLength + 8;
const binary = source.subarray(binaryStart);

const primitive = json.meshes[0].primitives[0];
const positionAccessorIndex = primitive.attributes.POSITION;
const indexAccessorIndex = primitive.indices;
const indexAccessor = json.accessors[indexAccessorIndex];
const indexView = json.bufferViews[indexAccessor.bufferView];
const indexOffset = (indexView.byteOffset || 0) + (indexAccessor.byteOffset || 0);

if (indexAccessor.componentType !== 5125 || indexAccessor.type !== 'SCALAR') {
  throw new Error('This optimizer expects a uint32 scalar index accessor');
}

const indices = new Uint32Array(
  binary.buffer,
  binary.byteOffset + indexOffset,
  indexAccessor.count,
);
const positions = new Float32Array(
  binary.buffer,
  binary.byteOffset + (json.bufferViews[json.accessors[positionAccessorIndex].bufferView].byteOffset || 0),
  json.accessors[positionAccessorIndex].count * 3,
);

const kept = [];
let removedDegenerate = 0;
for (let i = 0; i < indices.length; i += 3) {
  const a = indices[i];
  const b = indices[i + 1];
  const c = indices[i + 2];
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
  if (crossMagnitude < 1e-10) {
    removedDegenerate += 1;
  } else {
    kept.push(a, b, c);
  }
}

const keptIndices = Buffer.alloc(kept.length * 4);
for (let i = 0; i < kept.length; i += 1) keptIndices.writeUInt32LE(kept[i], i * 4);

const chunks = [];
let binaryLength = 0;
for (let i = 0; i < json.bufferViews.length; i += 1) {
  const view = json.bufferViews[i];
  const oldData = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  const data = i === indexAccessor.bufferView ? keptIndices : oldData;
  const alignedOffset = (binaryLength + 3) & ~3;
  chunks.push({ index: i, offset: alignedOffset, data });
  binaryLength = alignedOffset + data.length;
}

const rebuiltBinary = Buffer.alloc(binaryLength);
for (const chunk of chunks) chunk.data.copy(rebuiltBinary, chunk.offset);
for (const chunk of chunks) {
  json.bufferViews[chunk.index].byteOffset = chunk.offset;
  json.bufferViews[chunk.index].byteLength = chunk.data.length;
}

indexAccessor.byteOffset = 0;
indexAccessor.count = kept.length;
let minIndex = Infinity;
let maxIndex = -Infinity;
for (const index of kept) {
  minIndex = Math.min(minIndex, index);
  maxIndex = Math.max(maxIndex, index);
}
indexAccessor.min = [minIndex];
indexAccessor.max = [maxIndex];

json.asset.generator = 'Codex GLB optimizer; source Lux3D';
json.scenes[0].name = 'LionHead_Overall';
json.nodes[0].name = 'LionHead_Overall';
json.nodes[0].extras = {
  role: 'overall_lion_head',
  source: 'Aholo Lux3D image-to-3D export',
  structure: 'single merged mesh; semantic parts are not independently separated',
  optimization: 'removed degenerate triangles; preserved materials and embedded textures',
};
json.meshes[0].name = 'LionHead_Overall_MergedMesh';
json.meshes[0].extras = {
  ...(json.meshes[0].extras || {}),
  semanticParts: ['outer_shell', 'eyes', 'mouth', 'horns', 'mirror', 'fur_and_bells'],
  semanticPartsStatus: 'labels for planned visualization; geometry remains merged',
};
json.buffers[0].byteLength = rebuiltBinary.length;

const jsonBuffer = Buffer.from(JSON.stringify(json));
const paddedJsonLength = (jsonBuffer.length + 3) & ~3;
const paddedBinaryLength = (rebuiltBinary.length + 3) & ~3;
const result = Buffer.alloc(12 + 8 + paddedJsonLength + 8 + paddedBinaryLength);
result.writeUInt32LE(0x46546c67, 0);
result.writeUInt32LE(2, 4);
result.writeUInt32LE(result.length, 8);
result.writeUInt32LE(paddedJsonLength, 12);
result.writeUInt32LE(0x4e4f534a, 16);
jsonBuffer.copy(result, 20);
result.fill(0x20, 20 + jsonBuffer.length, 20 + paddedJsonLength);
const binHeader = 20 + paddedJsonLength;
result.writeUInt32LE(paddedBinaryLength, binHeader);
result.writeUInt32LE(0x004e4942, binHeader + 4);
rebuiltBinary.copy(result, binHeader + 8);

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, result);
console.log(JSON.stringify({
  input,
  output,
  inputBytes: source.length,
  outputBytes: result.length,
  inputTriangles: indices.length / 3,
  outputTriangles: kept.length / 3,
  removedDegenerate,
  preservedMaterials: json.materials?.length || 0,
  preservedTextures: json.textures?.length || 0,
  preservedImages: json.images?.length || 0,
}, null, 2));
