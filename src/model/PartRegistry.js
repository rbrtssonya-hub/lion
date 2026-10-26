import { Box3, Matrix4, Vector3 } from 'three';
import { sampleObjectGeometry } from '../analysis/sampleGeometry.js';
import { projectedHull, radialProfile, sliceProfile, measureBounds, areaWeightedPalette } from '../analysis/geometry.mjs';

// Visit every native vertex, rather than the sampling subset or the transformed
// corners of a local box. Descendant hair proxies are deliberately not visited.
function completeMeshBounds(mesh) {
  const box = new Box3(), point = new Vector3();
  const matrix = new Matrix4(), instanceMatrix = new Matrix4();
  const positions = mesh.geometry.getAttribute('position');
  const instances = mesh.isInstancedMesh ? mesh.count : 1;
  mesh.updateWorldMatrix(true, false);
  for (let instance = 0; instance < instances; instance++) {
    matrix.copy(mesh.matrixWorld);
    if (mesh.isInstancedMesh) {
      mesh.getMatrixAt(instance, instanceMatrix);
      matrix.multiply(instanceMatrix);
    }
    for (let index = 0; index < positions.count; index++) {
      mesh.getVertexPosition(index, point);
      point.applyMatrix4(matrix);
      if ([point.x, point.y, point.z].every(Number.isFinite)) box.expandByPoint(point);
    }
  }
  return box;
}

/** One mapping authority. Names and manual regions belong in content/parts.js. */
export class PartRegistry {
  constructor(root, definitions) {
    this.root = root;
    this.meshToPart = new Map();
    this.parts = new Map();
    root.updateMatrixWorld(true);
    for (const definition of definitions) {
      const meshes = [];
      root.traverse(object => {
        if (object.isMesh && definition.matches(object)) meshes.push(object);
      });
      if (!meshes.length) continue;
      const bounds = new Box3();
      meshes.forEach(mesh => bounds.union(new Box3().setFromObject(mesh)));
      const center = bounds.getCenter(new Vector3());
      const size = bounds.getSize(new Vector3());
      const part = { ...definition, meshes, bounds, center, size, analysis: null };
      this.parts.set(definition.id, part);
      meshes.forEach(mesh => this.meshToPart.set(mesh.uuid, part));
    }
    root.traverse(mesh => {
      if (!mesh.isMesh || this.meshToPart.has(mesh.uuid)) return;
      const alias = definitions.find(d => d.pickAliases?.includes(mesh.userData.atlasPart));
      if (alias && this.parts.has(alias.id)) this.meshToPart.set(mesh.uuid, this.parts.get(alias.id));
    });
  }

  get(id) { return this.parts.get(id); }
  all() { return [...this.parts.values()]; }

  analyze(id) {
    const part = this.get(id);
    if (!part) return null;
    if (part.analysis) return part.analysis;
    const nativeMeshes = part.meshes.filter(mesh => !mesh.userData.derivedHair);
    const sample = sampleObjectGeometry(nativeMeshes, 7000);
    const points = sample.points;
    const boxes = nativeMeshes.map(mesh => ({ mesh, box: completeMeshBounds(mesh) }));
    const completeBox = new Box3();
    boxes.forEach(({ box }) => completeBox.union(box));
    const bounds = completeBox.isEmpty() ? measureBounds([]) : {
      min: completeBox.min.toArray(), max: completeBox.max.toArray(),
      size: completeBox.getSize(new Vector3()).toArray(),
      center: completeBox.getCenter(new Vector3()).toArray(),
      count: sample.vertexCount,
      diagonal: completeBox.min.distanceTo(completeBox.max),
    };
    const sourceObjects = new Map();
    boxes.forEach(({ mesh, box }) => {
      const name = mesh.userData.sourceName || mesh.name;
      if (!sourceObjects.has(name)) sourceObjects.set(name, new Box3());
      sourceObjects.get(name).union(box);
    });
    part.analysis = {
      ...sample,
      bounds,
      sampleBounds: sample.bounds,
      hull: projectedHull(points, part.plane || 'xy'),
      radial: radialProfile(points, 48, part.plane || 'xy'),
      profile: sliceProfile(points, part.axis || 'y', 28),
      palette: areaWeightedPalette(sample.materialAreas),
      objectCount: sourceObjects.size,
      components: [...sourceObjects].filter(([, box]) => !box.isEmpty()).map(([name, box]) => ({ name, center: box.getCenter(new Vector3()).toArray(), size: box.getSize(new Vector3()).toArray() })),
    };
    return part.analysis;
  }
}
