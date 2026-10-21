import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three';
import { createTheaterSpatialUI } from '../../src/services/actionTheaterSpatialUI.js';

const WIDTH = 1920;
const HEIGHT = 990;
const screens = [
  ['tanqing', [0, 0, -1]], ['doumao', [1, 0, 0]],
  ['tuqiu', [0, 0, 1]], ['meihuazhuang', [-1, 0, 0]],
].map(([id, direction]) => ({
  id, center: new Vector3(...direction).multiplyScalar(9.55).setY(4.85),
  normal: new Vector3(...direction).negate(), width: 12.96, height: 7.29,
}));

function element(width, height) {
  const attributes = new Map();
  return {
    style: {}, dataset: {}, offsetWidth: width, offsetHeight: height,
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
  };
}

function aim(camera, angle = 0) {
  camera.position.set(-Math.sin(angle) * 8.6, 1.6, Math.cos(angle) * 8.6);
  camera.lookAt(0, 1.45, 0);
  camera.updateMatrixWorld();
}

function fixture(t, { occluders = [] } = {}) {
  const camera = new PerspectiveCamera(56, WIDTH / HEIGHT, .12, 45);
  aim(camera);
  const intro = element(390, 180);
  const infos = new Map(screens.map(screen => [screen.id, element(380, 270)]));
  const plays = new Map(screens.map(screen => [screen.id, element(300, 52)]));
  const ui = createTheaterSpatialUI({
    camera, container: { clientWidth: WIDTH, clientHeight: HEIGHT },
    introElement: intro, screenElements: infos, playElements: plays, screens, occluders,
  });
  t.after(() => ui.dispose());
  const update = (now, activeId = 'tanqing') => ui.update({ now, activeId, visible: true });
  const state = (kind, id) => ui.diagnostics().find(record => record.kind === kind && record.id === id);
  return { camera, intro, infos, plays, ui, update, state };
}

test('projective DOM matrices place plane centers at the same pixels as the WebGL camera', t => {
  const { intro, infos, plays, ui, camera, update } = fixture(t);
  update(0); update(400);
  const records = ui.diagnostics().filter(record => record.visible);
  assert.ok(records.some(record => record.kind === 'intro'));
  assert.ok(records.some(record => record.kind === 'info'));
  assert.ok(records.some(record => record.kind === 'play'));
  for (const record of records) {
    const node = record.kind === 'intro' ? intro : record.kind === 'info' ? infos.get(record.id) : plays.get(record.id);
    const values = /^matrix3d\((.+)\)$/.exec(node.style.transform)?.[1].split(',').map(Number);
    assert.equal(values?.length, 16);
    const cssCenter = new Vector3(node.offsetWidth / 2, node.offsetHeight / 2, 0)
      .applyMatrix4(new Matrix4().fromArray(values));
    const projected = new Vector3(...record.position).project(camera);
    const expected = new Vector3((projected.x + 1) * WIDTH / 2, (1 - projected.y) * HEIGHT / 2, 0);
    assert.ok(cssCenter.distanceTo(expected) < 1e-7, `${record.kind}/${record.id} must share camera projection`);
    assert.equal(node.inert, false);
    assert.equal(node.getAttribute('aria-hidden'), 'false');
    assert.equal(node.style.pointerEvents, 'auto');
  }
});

test('an opaque world wall removes the plaque from visibility and hit targets until the sightline clears', t => {
  const wall = new Mesh(new BoxGeometry(8, 8, .2), new MeshBasicMaterial());
  wall.position.set(-2.7, 2.15, 4.3);
  wall.updateMatrixWorld(true);
  t.after(() => { wall.geometry.dispose(); wall.material.dispose(); });
  const { intro, state, update, ui } = fixture(t, { occluders: [wall] });
  update(0); update(400);
  assert.equal(state('intro', 'intro').occluded, true);
  assert.equal(state('intro', 'intro').visible, false);
  assert.equal(intro.inert, true);
  assert.equal(intro.getAttribute('aria-hidden'), 'true');
  assert.equal(intro.style.pointerEvents, 'none');
  assert.equal(intro.style.visibility, 'hidden');

  // Architecture is static in production. Move this test wall out of the
  // sightline and invalidate the static occlusion cache through its public API.
  wall.position.x = 50;
  wall.updateMatrixWorld(true);
  ui.resize(WIDTH, HEIGHT);
  update(500); update(900);
  assert.equal(state('intro', 'intro').occluded, false);
  assert.equal(state('intro', 'intro').visible, true);
  assert.equal(intro.inert, false);
  assert.equal(intro.getAttribute('aria-hidden'), 'false');
  assert.equal(intro.style.pointerEvents, 'auto');
  assert.equal(intro.style.visibility, 'visible');
});

test('a full orbit keeps every world anchor fixed and hides backfacing or offscreen DOM controls', t => {
  const { camera, intro, plays, ui, update, state } = fixture(t);
  update(0); update(400);
  const anchors = ui.diagnostics().map(({ id, kind, position }) => ({ id, kind, position }));
  const initialTransform = intro.style.transform;
  for (const [index, activeId] of ['doumao', 'tuqiu', 'meihuazhuang', 'tanqing'].entries()) {
    aim(camera, (index + 1) * Math.PI / 2);
    update(1000 + index * 1000, activeId);
    update(1400 + index * 1000, activeId);
    assert.deepEqual(ui.diagnostics().map(({ id, kind, position }) => ({ id, kind, position })), anchors);
    assert.equal(state('info', activeId).visible, true);
    if (activeId !== 'tanqing') {
      assert.equal(state('intro', 'intro').visible, false);
      assert.equal(intro.inert, true);
      assert.equal(intro.style.pointerEvents, 'none');
    }
    if (activeId === 'tuqiu') {
      assert.equal(state('play', 'tanqing').inView, false);
      assert.equal(plays.get('tanqing').style.visibility, 'hidden');
      assert.equal(plays.get('tanqing').inert, true);
    }
  }
  assert.equal(state('intro', 'intro').visible, true);
  // Numerical angle wrapping can change insignificant final matrix digits.
  const initial = initialTransform.slice(9, -1).split(',').map(Number);
  const returned = intro.style.transform.slice(9, -1).split(',').map(Number);
  returned.forEach((value, index) => assert.ok(Math.abs(value - initial[index]) < 1e-7));
});

test('active information fades at its original anchor and suppresses only overlapping adjacent play controls', t => {
  const { camera, update, state, infos, plays } = fixture(t);
  update(0); update(400);
  assert.equal(state('info', 'tanqing').opacity, 1);
  assert.equal(state('play', 'tanqing').visible, true);
  assert.equal(state('play', 'tanqing').overlapping, false);
  assert.equal(state('play', 'doumao').inView, true);
  assert.equal(state('play', 'doumao').overlapping, true);
  assert.equal(state('play', 'doumao').visible, false);
  assert.equal(plays.get('doumao').inert, true);
  const originalAnchor = state('info', 'tanqing').position;

  // At the sector boundary both fixed information anchors are in the view.
  aim(camera, Math.PI / 4);
  update(800, 'doumao');
  assert.equal(state('info', 'tanqing').opacity, 1, 'old content starts from its rendered opacity');
  assert.equal(state('info', 'tanqing').visible, false);
  assert.equal(infos.get('tanqing').inert, true, 'departing content cannot receive stray clicks');
  assert.equal(state('info', 'doumao').opacity, 0, 'new content must not replace the old panel instantly');
  assert.equal(state('info', 'doumao').visible, true);
  update(940, 'doumao');
  for (const id of ['tanqing', 'doumao']) {
    assert.ok(state('info', id).opacity > 0 && state('info', id).opacity < 1);
  }
  update(1180, 'doumao');
  assert.equal(state('info', 'tanqing').opacity, 0);
  assert.equal(state('info', 'doumao').opacity, 1);
  assert.deepEqual(state('info', 'tanqing').position, originalAnchor);
});
