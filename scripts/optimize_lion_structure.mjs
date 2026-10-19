/** Offline authoring helper. Run through the pinned CLI's npm exec environment. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    report: { type: 'string' },
    ratio: { type: 'string', default: '0.25' },
    error: { type: 'string', default: '0.003' },
  },
});
const [input, output] = positionals;
const ratio = Number(values.ratio);
const error = Number(values.error);
if (!input || !output || !(ratio > 0 && ratio <= 1) || !(error > 0 && error < 1)) {
  throw new Error('Expected input.glb output.glb --ratio (0,1] --error (0,1).');
}
if (path.resolve(input) === path.resolve(output)) throw new Error('Input and output must differ.');

// npm exec exposes its pinned tool's .bin directory through PATH. Resolve the
// sibling authoring packages there, without adding application dependencies.
const executable = process.platform === 'win32' ? 'gltf-transform.cmd' : 'gltf-transform';
const bin = process.env.PATH.split(path.delimiter).find((entry) => fs.existsSync(path.join(entry, executable)));
if (!bin) throw new Error('Run with npm exec --package=@gltf-transform/cli@4.2.1 -- node ...');
const requireTool = createRequire(path.join(bin, '__lion-offline.cjs'));
const load = (specifier) => import(pathToFileURL(requireTool.resolve(specifier)));
const [{ NodeIO }, { ALL_EXTENSIONS }, { weld, prune, dedup, quantize }, { MeshoptSimplifier }] = await Promise.all([
  load('@gltf-transform/core'), load('@gltf-transform/extensions'), load('@gltf-transform/functions'), load('meshoptimizer'),
]);
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document = await io.read(input);
const root = document.getRoot();
await document.transform(weld());

const primitiveResults = [];
for (const mesh of root.listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    const positions = primitive.getAttribute('POSITION');
    const normals = primitive.getAttribute('NORMAL');
    const sourceIndices = primitive.getIndices();
    if (!positions || !normals || !sourceIndices) continue;
    if (!(positions.getArray() instanceof Float32Array) || !(normals.getArray() instanceof Float32Array)) {
      throw new Error('Expected the unquantized Blender export; quantization belongs after simplification.');
    }
    const before = sourceIndices.getCount() / 3;
    // Ribbon points were reduced in world space before export. Simplifying
    // independent thin strands as triangles could erase whole authored hairs.
    if (mesh.getName().endsWith('_WebRibbons')) {
      primitiveResults.push({ mesh: mesh.getName(), before, after: before, method: 'World-space centerline reduction only; preserve every sampled strand.' });
      continue;
    }
    const uvs = primitive.listSemantics().filter((semantic) => semantic.startsWith('TEXCOORD_')).map((semantic) => primitive.getAttribute(semantic));
    const stride = 3 + uvs.length * 2;
    const attributes = new Float32Array(positions.getCount() * stride);
    const normal = [0, 0, 0];
    const uv = [0, 0];
    for (let index = 0; index < positions.getCount(); index++) {
      normals.getElement(index, normal);
      attributes.set(normal, index * stride);
      uvs.forEach((accessor, uvIndex) => {
        accessor.getElement(index, uv);
        attributes.set(uv, index * stride + 3 + uvIndex * 2);
      });
    }
    const weights = [0.1, 0.1, 0.1, ...uvs.flatMap(() => [0.01, 0.01])];
    const indices = Uint32Array.from(sourceIndices.getArray());
    const targetCount = Math.floor(indices.length * ratio / 3) * 3;
    const [simplified, measuredError] = MeshoptSimplifier.simplifyWithAttributes(
      indices, positions.getArray(), 3, attributes, stride, weights, null, targetCount, error,
    );
    const [remap, unique] = MeshoptSimplifier.compactMesh(simplified);
    // Keep the original surviving vertex's complete attribute tuple. This
    // neither repacks the atlas nor projects a new UV onto the authored mesh.
    for (const semantic of primitive.listSemantics()) {
      const accessor = primitive.getAttribute(semantic);
      const original = accessor.getArray();
      const size = accessor.getElementSize();
      const compact = new original.constructor(unique * size);
      for (let index = 0; index < remap.length; index++) {
        if (remap[index] !== 0xffffffff) compact.set(original.subarray(index * size, (index + 1) * size), remap[index] * size);
      }
      primitive.setAttribute(semantic, accessor.clone().setArray(compact));
    }
    primitive.setIndices(sourceIndices.clone().setArray(unique <= 65534 ? Uint16Array.from(simplified) : simplified));
    primitiveResults.push({ mesh: mesh.getName(), before, after: simplified.length / 3, attributeError: measuredError });
  }
}
await document.transform(
  prune(),
  dedup({ propertyTypes: ['Material', 'Texture'] }),
  quantize({ quantizePosition: 16, quantizeNormal: 8, quantizeTexcoord: 16 }),
  // Quantization makes tiny authored attribute differences equal. Weld again
  // to upload those identical tuples only once; no surface detail is changed.
  weld(),
);
const collapsedTriangles = [];
for (const mesh of root.listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    const accessor = primitive.getIndices();
    if (!accessor) continue;
    const indices = accessor.getArray();
    const retained = [];
    for (let index = 0; index < indices.length; index += 3) {
      const a = indices[index], b = indices[index + 1], c = indices[index + 2];
      if (a !== b && b !== c && c !== a) retained.push(a, b, c);
    }
    const removed = (indices.length - retained.length) / 3;
    if (removed) {
      primitive.setIndices(accessor.clone().setArray(new indices.constructor(retained)));
      collapsedTriangles.push({ mesh: mesh.getName(), removed });
    }
  }
}
// Quantization can make subpixel triangles collapse to one repeated index.
// Such triangles have exactly zero drawable area; discard only those, then
// compact their now-unreferenced vertices without an additional lossy step.
await document.transform(weld(), prune());
await io.write(output, document);
const report = {
  tool: '@gltf-transform/cli@4.2.1 / meshoptimizer@0.24.0',
  ratio,
  maximumRelativeAttributeError: error,
  normalWeights: [0.1, 0.1, 0.1],
  uvWeights: [0.01, 0.01],
  primitives: primitiveResults,
  removedQuantizedDegenerateTriangles: collapsedTriangles,
  trianglesBefore: primitiveResults.reduce((total, result) => total + result.before, 0),
  trianglesAfterSimplification: primitiveResults.reduce((total, result) => total + result.after, 0),
  trianglesAfter: root.listMeshes().reduce((total, mesh) => total + mesh.listPrimitives().reduce((subtotal, primitive) => subtotal + primitive.getIndices().getCount() / 3, 0), 0),
};
if (values.report) fs.writeFileSync(values.report, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ trianglesBefore: report.trianglesBefore, trianglesAfter: report.trianglesAfter }));
