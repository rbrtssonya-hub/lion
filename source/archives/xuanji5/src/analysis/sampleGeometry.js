import { Matrix4, Vector3 } from 'three';
import { areaWeightedPalette, measureBounds } from './geometry.mjs';

/**
 * One-time world-space mesh analysis. A deterministic global vertex stride keeps
 * points.length <= maxPoints. Bounds/profiles derived from `points` are sampled.
 * Surface areas use EVERY rendered triangle, after object/instance transforms;
 * palette weights are exact triangle areas, but colors are material baseColor.
 * Textures, vertex colors, lighting, shader displacement and transparency are
 * not baked into the palette. Vertex density can bias the point distribution.
 *
 * Accepts one Object3D or an array of Object3Ds (for PartRegistry mesh lists).
 * Duplicate descendants are measured once. Returns JSON-friendly
 * {points,bounds,vertexCount,triangleCount,meshCount,instanceCount,
 * totalSurfaceArea,materialAreas:[{color,area}],palette,sampling,warnings}.
 */
export function sampleObjectGeometry(root, maxPoints = 6000) {
  const roots = Array.isArray(root) ? root : [root];
  if (!roots.every(item => item?.traverse)) {
    throw new TypeError('root must be a Three.js Object3D or Object3D[]');
  }
  if (!Number.isInteger(maxPoints) || maxPoints < 1) {
    throw new RangeError('maxPoints must be a positive integer');
  }
  roots.forEach(item => item.updateWorldMatrix(true, true));
  const objects = [];
  const warnings = new Set();
  let vertexCount = 0, meshCount = 0, instanceCount = 0;
  const visited = new Set();
  roots.forEach(item => item.traverse(object => {
    if (visited.has(object)) return;
    visited.add(object);
    if (!object.isMesh || !object.geometry?.getAttribute('position')) return;
    // Respect inherited visibility, including a hidden supplied root.
    for (let ancestor = object; ancestor; ancestor = ancestor.parent) {
      if (!ancestor.visible) return;
    }
    const instances = object.isInstancedMesh ? object.count : 1;
    objects.push({ object, instances });
    vertexCount += object.geometry.getAttribute('position').count * instances;
    meshCount++;
    instanceCount += instances;
    if (object.isSkinnedMesh) warnings.add('Skinned meshes are measured in their current pose.');
    const sourceMaterial = object.userData?.atlasOriginal?.material || object.material;
    if (sourceMaterial && (Array.isArray(sourceMaterial) ? sourceMaterial : [sourceMaterial])
      .some(material => material?.map || material?.vertexColors)) {
      warnings.add('Palette reports material baseColor; texture and vertex colors are not sampled.');
    }
  }));

  const sampleTarget = Math.min(maxPoints, vertexCount);
  const stride = sampleTarget ? vertexCount / sampleTarget : 1;
  let nextSample = 0, globalVertex = 0, triangleCount = 0, totalSurfaceArea = 0;
  const points = [], colorAreas = new Map();
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  const ab = new Vector3(), ac = new Vector3(), point = new Vector3();
  const instanceMatrix = new Matrix4(), worldMatrix = new Matrix4();

  for (const { object, instances } of objects) {
    const geometry = object.geometry;
    const positions = geometry.getAttribute('position');
    const index = geometry.getIndex();
    const elementCount = index ? index.count : positions.count;
    const start = Math.max(0, geometry.drawRange.start);
    const end = Math.min(elementCount, start + geometry.drawRange.count);
    // A renderer may temporarily swap hover / wireframe materials. The audit
    // must continue to report original material colors when these are retained.
    const sourceMaterial = object.userData?.atlasOriginal?.material || object.material;
    const materials = Array.isArray(sourceMaterial) ? sourceMaterial : [sourceMaterial];
    const ranges = Array.isArray(sourceMaterial)
      ? geometry.groups : [{ start: 0, count: elementCount, materialIndex: 0 }];

    for (let instance = 0; instance < instances; instance++) {
      worldMatrix.copy(object.matrixWorld);
      if (object.isInstancedMesh) {
        object.getMatrixAt(instance, instanceMatrix);
        worldMatrix.multiply(instanceMatrix);
      }
      const getVertex = (vertex, target) => {
        object.getVertexPosition(vertex, target);
        return target.applyMatrix4(worldMatrix);
      };
      for (let vertex = 0; vertex < positions.count; vertex++, globalVertex++) {
        if (points.length < sampleTarget && globalVertex >= Math.floor(nextSample)) {
          getVertex(vertex, point);
          points.push(point.toArray());
          nextSample += stride;
        }
      }
      for (const range of ranges) {
        const material = materials[range.materialIndex];
        if (!material || material.visible === false) continue;
        const color = material.color ? `#${material.color.getHexString()}` : '#ffffff';
        const rangeStart = Math.max(start, range.start);
        const rangeEnd = Math.min(end, range.start + range.count);
        for (let element = rangeStart; element + 2 < rangeEnd; element += 3) {
          getVertex(index ? index.getX(element) : element, a);
          getVertex(index ? index.getX(element + 1) : element + 1, b);
          getVertex(index ? index.getX(element + 2) : element + 2, c);
          const area = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() * .5;
          triangleCount++;
          if (!Number.isFinite(area)) {
            warnings.add('Non-finite triangles were excluded from surface area.');
            continue;
          }
          totalSurfaceArea += area;
          colorAreas.set(color, (colorAreas.get(color) ?? 0) + area);
        }
      }
    }
  }
  const materialAreas = [...colorAreas].map(([color, area]) => ({ color, area }));
  return {
    points, bounds: measureBounds(points), vertexCount, triangleCount, meshCount,
    instanceCount, totalSurfaceArea,
    materialAreas,
    palette: areaWeightedPalette(materialAreas),
    sampling: {
      method: 'deterministic global vertex stride',
      limit: maxPoints,
      sampled: points.length,
      sourceVertices: vertexCount,
      fraction: vertexCount ? points.length / vertexCount : 0,
      approximate: points.length < vertexCount,
    },
    warnings: [...warnings],
  };
}
