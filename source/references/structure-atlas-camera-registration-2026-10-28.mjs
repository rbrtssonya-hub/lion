// Reproduce six image-registration endpoints from input snapshots only.
// No WebGL, model downloads or external repository checkout is required.
// Run from any directory: node <this file's path>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const snapshot = JSON.parse(read('source/references/structure-atlas-camera-registration-2026-10-28.json'));
const cameras = JSON.parse(read(snapshot.cameraSnapshot));
const service = read('src/services/lionAtlasScene.js');
const literal = name => {
  const match = service.match(new RegExp(`const ${name} = ([\\s\\S]*?);`));
  assert.ok(match, `${name} literal is present`);
  return vm.runInNewContext(`(${match[1]})`, Object.create(null), { timeout: 1000 });
};
const framings = literal('framings');
const bounds = literal('registeredBounds');
const original = snapshot.externalOriginalBounds;
// Same normalization as the external LionWorld: center X/Z and place minY=0.
const translation = original.min.map((value, axis) => axis === 1
  ? -value : -(value + original.max[axis]) / 2);
const distance = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
const results = cameras.parts.map(shot => {
  const box = bounds[shot.id], framing = framings[shot.id];
  assert.ok(box && framing, shot.id);
  const min = box.min.map((value, axis) => (value + translation[axis]) * shot.sourceScale);
  const max = box.max.map((value, axis) => (value + translation[axis]) * shot.sourceScale);
  const size = max.map((value, axis) => value - min[axis]);
  const target = min.map((value, axis) => (value + max[axis]) / 2 + framing.offset[axis] * size[axis]);
  const radius = Math.max(...size, .65) / (2 * Math.tan(shot.fov * Math.PI / 360)) * framing.distanceFactor;
  const length = Math.hypot(...framing.direction);
  const position = target.map((value, axis) => value + framing.direction[axis] / length * radius);
  const result = { id: shot.id, targetError: distance(target, shot.target), positionError: distance(position, shot.position) };
  assert.ok(result.targetError < snapshot.tolerance, `${shot.id}: target agrees with registered snapshot`);
  assert.ok(result.positionError < snapshot.tolerance, `${shot.id}: camera agrees with registered snapshot`);
  return result;
});
assert.equal(results.length, 6);
console.log(JSON.stringify({ command: `node ${fileURLToPath(import.meta.url)}`, passed: true, results }, null, 2));
