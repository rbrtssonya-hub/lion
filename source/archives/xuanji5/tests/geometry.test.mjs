import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, BufferGeometry, Float32BufferAttribute, MeshBasicMaterial, InstancedMesh, Matrix4 } from 'three';
import { convexHull, projectedHull, radialProfile, sliceProfile, areaWeightedPalette, measureBounds } from '../src/analysis/geometry.mjs';
import { sampleObjectGeometry } from '../src/analysis/sampleGeometry.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test('convex hull rejects interior/duplicate points and preserves CCW corners', () => {
  const points = [[1, 1], [0, 0], [1, 0], [0, 1], [.5, .5], [0, 0], [.5, 0]];
  assert.deepEqual(convexHull(points), [[0, 0], [1, 0], [1, 1], [0, 1]]);
  assert.deepEqual(convexHull([[0, 0], [1, 1], [2, 2]]), [[0, 0], [2, 2]]);
});

test('projection respects requested axes; bounds filter invalid samples', () => {
  const points = [[0, 4, 0], [2, 5, 0], [2, 6, 3], [0, 7, 3], [NaN, 0, 0]];
  assert.deepEqual(projectedHull(points, 'xz'), [[0, 0], [2, 0], [2, 3], [0, 3]]);
  assert.deepEqual(measureBounds(points).size, [2, 3, 3]);
  assert.equal(measureBounds(points).count, 4);
  assert.deepEqual(measureBounds([]).center, [0, 0, 0]);
  assert.throws(() => projectedHull(points, 'bad'), RangeError);
});

test('radial bins measure source radius and preserve empty-bin status', () => {
  const result = radialProfile([[2, 0, 0], [0, 2, 0], [-2, 0, 0], [0, -2, 0]], 8);
  assert.deepEqual(result.center, [0, 0]);
  assert.equal(result.samples.reduce((sum, sample) => sum + sample.count, 0), 4);
  near(result.maxRadius, 2);
  assert.equal(result.samples.filter(sample => sample.point === null).length, 4);
  assert.throws(() => radialProfile([], 0), RangeError);
});

test('axis slabs report widths and sample centroid rather than volume centroid', () => {
  const result = sliceProfile([[0, 0, 1], [4, 0, 7], [2, 10, 2], [3, 10, 4]], 'y', 3);
  assert.deepEqual(result.crossAxes, ['x', 'z']);
  assert.equal(result.samples[0].width, 4);
  assert.equal(result.samples[0].depth, 6);
  assert.deepEqual(result.samples[0].center, [2, 0, 4]);
  assert.equal(result.samples[1].width, null);
  assert.equal(result.samples[2].count, 2);
});

test('palette uses surface-area weighting, normalizes colors, ignores invalid areas', () => {
  const result = areaWeightedPalette([
    { color: '#f00', area: 1 }, { color: '#FF0000', area: 2 },
    { color: [0, 0, 1], area: 1 }, { color: '#fff', area: -2 },
  ]);
  assert.equal(result.totalArea, 4);
  assert.deepEqual(result.colors[0], { color: '#ff0000', area: 3, share: .75, count: 2 });
});

function triangle() {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  return geometry;
}

test('mesh sampling applies world transforms and computes transformed triangle area', () => {
  const root = new Group();
  root.position.set(5, 3, 1);
  const mesh = new Mesh(triangle(), new MeshBasicMaterial({ color: '#ff0000' }));
  mesh.scale.set(2, 3, 1); root.add(mesh);
  const result = sampleObjectGeometry(root, 3);
  assert.deepEqual(result.points, [[5, 3, 1], [7, 3, 1], [5, 6, 1]]);
  near(result.totalSurfaceArea, 3);
  assert.equal(result.triangleCount, 1);
  assert.equal(result.palette.colors[0].color, '#ff0000');
  assert.equal(result.sampling.approximate, false);
});

test('instanced meshes count all geometry while enforcing a global sample cap', () => {
  const mesh = new InstancedMesh(triangle(), new MeshBasicMaterial(), 2);
  mesh.setMatrixAt(1, new Matrix4().makeTranslation(5, 0, 0));
  const result = sampleObjectGeometry(mesh, 4);
  assert.equal(result.points.length, 4);
  assert.equal(result.vertexCount, 6);
  assert.equal(result.triangleCount, 2);
  near(result.totalSurfaceArea, 1);
  assert.equal(result.sampling.approximate, true);
  mesh.visible = false;
  assert.equal(sampleObjectGeometry(mesh).meshCount, 0);
});

test('part mesh arrays deduplicate objects and expose material areas', () => {
  const mesh = new Mesh(triangle(), new MeshBasicMaterial({ color: '#00ff00' }));
  const root = new Group(); root.add(mesh);
  const result = sampleObjectGeometry([root, mesh, mesh]);
  assert.equal(result.triangleCount, 1);
  assert.deepEqual(result.materialAreas, [{ color: '#00ff00', area: .5 }]);
  assert.deepEqual(sampleObjectGeometry([]).points, []);
});
