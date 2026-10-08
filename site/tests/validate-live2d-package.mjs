import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const modelRoot = resolve(root, 'site/assets/live2d/nanfeng-lion');
const manifestPath = resolve(modelRoot, 'model-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

assert.equal(typeof manifest.model, 'string', 'manifest.model is required');
assert.ok(Array.isArray(manifest.motions), 'manifest.motions must be an array');

if (manifest.status !== 'ready') {
  console.log(`live2d: ${manifest.status}; model files are preserved but not published`);
  process.exit(0);
}

const required = [
  manifest.model,
  'nanfeng-lion.moc3',
  'nanfeng-lion.physics3.json',
  ...manifest.motions.map((motion) => `motions/${motion}.motion3.json`),
];

for (const relativePath of required) {
  assert.equal(existsSync(resolve(modelRoot, relativePath)), true, `Missing Live2D export: ${relativePath}`);
}

assert.equal(existsSync(resolve(modelRoot, 'textures')), true, 'Missing Live2D textures directory');

const motionFiles = manifest.motions.map((motion) => `motions/${motion}.motion3.json`);
for (const relativePath of motionFiles) {
  const motion = JSON.parse(readFileSync(resolve(modelRoot, relativePath), 'utf8'));
  const curves = motion.Curves ?? [];
  assert.equal(curves.length, motion.Meta.CurveCount, `${relativePath}: CurveCount mismatch`);

  let segmentCount = 0;
  let pointCount = 0;
  for (const curve of curves) {
    const segments = curve.Segments ?? [];
    assert.ok(segments.length >= 5, `${relativePath}:${curve.Id} must contain at least one segment`);
    assert.equal((segments.length - 2) % 3, 0, `${relativePath}:${curve.Id} has invalid Cubism segment triples`);
    assert.ok(Number.isFinite(segments[0]) && Number.isFinite(segments[1]), `${relativePath}:${curve.Id} has an invalid initial point`);
    pointCount += 1;

    for (let index = 2; index < segments.length; index += 3) {
      const [type, time, value] = segments.slice(index, index + 3);
      assert.ok([0, 1, 2, 3].includes(type), `${relativePath}:${curve.Id} has an invalid segment type`);
      assert.ok(Number.isFinite(time) && Number.isFinite(value), `${relativePath}:${curve.Id} has an invalid segment point`);
      segmentCount += 1;
      pointCount += type === 1 ? 3 : 1;
    }
  }

  assert.equal(segmentCount, motion.Meta.TotalSegmentCount, `${relativePath}: TotalSegmentCount mismatch`);
  assert.equal(pointCount, motion.Meta.TotalPointCount, `${relativePath}: TotalPointCount mismatch`);
}

console.log(`live2d: ready; ${required.length} export files and textures directory are present`);
