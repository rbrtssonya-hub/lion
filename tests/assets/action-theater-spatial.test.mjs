import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { createActiveScreenController } from '../../src/services/actionTheaterActiveScreen.js';

const radians = value => value * Math.PI / 180;
const screens = [
  { id: 'tanqing', center: [0, 4.85, -10.4], normal: [0, 0, 1] },
  { id: 'doumao', center: [10.4, 4.85, 0], normal: [-1, 0, 0] },
  { id: 'tuqiu', center: [0, 4.85, 10.4], normal: [0, 0, -1] },
  { id: 'meihuazhuang', center: [-10.4, 4.85, 0], normal: [1, 0, 0] },
].map(screen => ({ ...screen, width: 14.4, height: 8.1 }));

function cameraAt(degrees) {
  const camera = new PerspectiveCamera(56, 1920 / 1080, .12, 45);
  aim(camera, degrees);
  return camera;
}
function aim(camera, degrees) {
  camera.position.set(-Math.sin(radians(degrees)) * 8.6, 1.6, Math.cos(radians(degrees)) * 8.6);
  camera.lookAt(0, 1.45, 0);
  camera.updateMatrixWorld();
}
function stable(controller, camera, time) {
  controller.update({ camera, now: time });
  return controller.update({ camera, now: time + 500 });
}

test('actual four wall positions and inward normals identify every cardinal viewing direction', () => {
  for (const [degrees, id] of [[0, 'tanqing'], [90, 'doumao'], [180, 'tuqiu'], [-180, 'tuqiu'], [-90, 'meihuazhuang'], [360, 'tanqing']]) {
    const camera = cameraAt(degrees);
    const controller = createActiveScreenController({ screens, initialId: null });
    const state = stable(controller, camera, 0);
    assert.equal(state.activeId, id, `${degrees}° must correspond to ${id}`);
    const selected = state.metrics.find(item => item.id === id);
    assert.ok(selected.visible && selected.coverage > .1 && selected.facing > .5);
  }
});

test('camera drag and damping never commit, then observation requires 500 ms without movement', () => {
  const changes = [];
  const controller = createActiveScreenController({ screens, onChange: (...value) => changes.push(value) });
  const camera = cameraAt(0);
  controller.update({ camera, now: 0 });
  for (const [degrees, now] of [[20, 100], [50, 700], [90, 1500]]) {
    aim(camera, degrees);
    assert.equal(controller.update({ camera, now, interacting: true }).activeId, 'tanqing');
  }
  controller.update({ camera, now: 1600, moving: true });
  controller.update({ camera, now: 1700 });
  assert.equal(controller.update({ camera, now: 2199 }).activeId, 'tanqing');
  assert.equal(controller.update({ camera, now: 2200 }).activeId, 'doumao');
  assert.deepEqual(changes, [['doumao', { reason: 'observation' }]]);
});

test('small motions around wall boundaries retain the current screen with no flashing', () => {
  const changes = [];
  const controller = createActiveScreenController({ screens, onChange: id => changes.push(id) });
  const camera = cameraAt(0);
  controller.update({ camera, now: 0 });
  for (let index = 1; index <= 20; index += 1) {
    aim(camera, index % 2 ? 42 : 48);
    stable(controller, camera, index * 1000);
    assert.equal(controller.getState().activeId, 'tanqing');
  }
  assert.deepEqual(changes, []);
  aim(camera, 90);
  assert.equal(stable(controller, camera, 22000).activeId, 'doumao');
});

test('manual selection commits immediately and survives focus tween and idle model rotation', () => {
  const changes = [];
  const controller = createActiveScreenController({ screens, onChange: id => changes.push(id) });
  const camera = cameraAt(0);
  controller.update({ camera, now: 0 });
  assert.equal(controller.select('tuqiu'), true);
  assert.equal(controller.getState().activeId, 'tuqiu');
  for (const degrees of [20, 40, 80, 120, 180, 90]) {
    aim(camera, degrees);
    assert.equal(stable(controller, camera, degrees * 1000).activeId, 'tuqiu');
  }
  // There is no exhibit transform input: model rotation cannot unlock selection.
  for (let now = 200000; now < 203000; now += 100) controller.update({ camera, now });
  assert.equal(controller.getState().manualLock, true);
  assert.deepEqual(changes, ['tuqiu']);
  assert.equal(controller.select('missing-screen'), false);
  assert.equal(controller.getState().activeId, 'tuqiu');
  aim(camera, 91);
  controller.update({ camera, now: 204000, interacting: true });
  assert.equal(controller.getState().manualLock, false);
  assert.equal(stable(controller, camera, 204100).activeId, 'doumao');
});

test('wheel motion can explicitly unlock manual priority without treating focus motion as user input', () => {
  const camera = cameraAt(90);
  const controller = createActiveScreenController({ screens });
  controller.select('tuqiu');
  stable(controller, camera, 0);
  assert.equal(controller.getState().activeId, 'tuqiu');
  controller.noteUserMovement(600);
  assert.equal(stable(controller, camera, 600).activeId, 'doumao');
  assert.equal(controller.getState().manualLock, false);
});

test('backfaces and off-frustum screens cannot become primary despite arbitrary ID/order', () => {
  const camera = cameraAt(0);
  const controller = createActiveScreenController({ screens: [
    { id: 'back', center: [0, 4.85, -5], normal: [0, 0, -1], width: 14, height: 8 },
    { id: 'behind', center: [0, 4.85, 11], normal: [0, 0, -1], width: 14, height: 8 },
    screens[0],
  ], initialId: null });
  const state = stable(controller, camera, 0);
  assert.equal(state.activeId, 'tanqing');
  assert.equal(state.metrics.find(item => item.id === 'back').visible, false);
  assert.equal(state.metrics.find(item => item.id === 'behind').visible, false);
  camera.lookAt(0, -100, 0);
  assert.equal(stable(controller, camera, 1000).pendingId, null);
});

test('world camera pose rather than local transform determines screen and reset cancels stale dwell', () => {
  const camera = cameraAt(0);
  const parent = new Group();
  parent.rotation.y = -Math.PI / 2;
  parent.add(camera);
  parent.updateMatrixWorld(true);
  const controller = createActiveScreenController({ screens, initialId: null });
  controller.update({ camera, now: 0 });
  controller.resetMotion(450);
  assert.equal(controller.update({ camera, now: 500 }).activeId, null);
  assert.equal(controller.update({ camera, now: 999 }).activeId, null);
  assert.equal(controller.update({ camera, now: 1000 }).activeId, 'doumao');
});
