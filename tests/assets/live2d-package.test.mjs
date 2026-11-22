import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const live2dRoot = resolve(root, 'source/public/assets/live2d');
const modelRoot = resolve(live2dRoot, 'nanfeng-lion');
const manifestPath = resolve(modelRoot, 'model-manifest.json');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

function localFile(base, name, boundary = base) {
  assert.equal(typeof name, 'string', 'Asset references must be strings');
  assert.ok(name.length > 0 && !isAbsolute(name), `Expected a relative asset path: ${name}`);
  const path = resolve(base, name);
  const location = relative(boundary, path);
  assert.ok(location !== '..' && !location.startsWith(`..${sep}`) && !isAbsolute(location), `Asset escapes its directory: ${name}`);
  assert.equal(statSync(path).isFile(), true, `Missing asset: ${path}`);
  assert.ok(statSync(path).size > 0, `Empty asset: ${path}`);
  return path;
}

test('preserved Live2D package resolves model exports and local runtime dependencies', () => {
  const manifest = readJson(manifestPath);
  assert.ok(['needs-layer-rebuild', 'ready'].includes(manifest.status), 'Keep the visual acceptance state explicit');
  assert.ok(Array.isArray(manifest.motions) && manifest.motions.length > 0);
  const model = readJson(localFile(modelRoot, manifest.model));
  assert.equal(model.Version, 3);
  const references = model.FileReferences;
  assert.ok(references, 'Cubism FileReferences are required');
  const moc = localFile(modelRoot, references.Moc);
  assert.equal(readFileSync(moc).subarray(0, 4).toString('ascii'), 'MOC3');
  assert.ok(Array.isArray(references.Textures) && references.Textures.length > 0);
  for (const texture of references.Textures) localFile(modelRoot, texture);
  for (const name of ['Physics', 'DisplayInfo', 'Pose', 'UserData']) {
    if (references[name]) readJson(localFile(modelRoot, references[name]));
  }
  for (const expression of references.Expressions ?? []) readJson(localFile(modelRoot, expression.File));

  for (const name of manifest.motions) {
    assert.ok(references.Motions?.[name]?.length > 0, `Missing model motion group: ${name}`);
  }
  for (const entries of Object.values(references.Motions ?? {})) {
    for (const entry of entries) {
      readJson(localFile(modelRoot, entry.File));
      if (entry.Sound) localFile(modelRoot, entry.Sound);
    }
  }

  const runtime = manifest.runtime;
  assert.ok(runtime && Array.isArray(runtime.localDependencies));
  localFile(modelRoot, runtime.localRuntime ?? runtime.adapter, live2dRoot);
  for (const dependency of runtime.localDependencies) localFile(modelRoot, dependency, live2dRoot);
  localFile(resolve(live2dRoot, 'runtime'), 'THIRD-PARTY-NOTICES.md');
});

test('Cubism motion curves have valid segments and matching metadata', () => {
  const manifest = readJson(manifestPath);
  const model = readJson(localFile(modelRoot, manifest.model));
  for (const entries of Object.values(model.FileReferences.Motions ?? {})) {
    for (const entry of entries) {
      const motion = readJson(localFile(modelRoot, entry.File));
      const curves = motion.Curves ?? [];
      assert.equal(curves.length, motion.Meta.CurveCount, `${entry.File}: CurveCount mismatch`);
      let segmentCount = 0;
      let pointCount = 0;
      for (const curve of curves) {
        const segments = curve.Segments ?? [];
        const label = `${entry.File}:${curve.Id}`;
        assert.ok(segments.length >= 5, `${label}: at least one segment is required`);
        assert.ok(segments.every(Number.isFinite), `${label}: segment values must be finite`);
        pointCount += 1;
        let previousTime = segments[0];
        let cursor = 2;
        while (cursor < segments.length) {
          const type = segments[cursor];
          assert.ok([0, 1, 2, 3].includes(type), `${label}: invalid segment type`);
          const width = type === 1 ? 7 : 3;
          assert.ok(cursor + width <= segments.length, `${label}: incomplete segment`);
          const endTime = segments[cursor + width - 2];
          assert.ok(endTime >= previousTime && endTime <= motion.Meta.Duration, `${label}: segment time outside motion duration`);
          previousTime = endTime;
          cursor += width;
          segmentCount += 1;
          pointCount += type === 1 ? 3 : 1;
        }
        assert.equal(cursor, segments.length, `${label}: malformed segments`);
      }
      assert.equal(segmentCount, motion.Meta.TotalSegmentCount, `${entry.File}: TotalSegmentCount mismatch`);
      assert.equal(pointCount, motion.Meta.TotalPointCount, `${entry.File}: TotalPointCount mismatch`);
    }
  }
});
