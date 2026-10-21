import { Matrix4, Raycaster, Vector3 } from 'three';

const UP = new Vector3(0, 1, 0);
const MAX_YAW = Math.PI / 10;
const vector = value => value?.isVector3 ? value.clone() : new Vector3(...value);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const clean = value => Math.abs(value) < 1e-10 ? 0 : value;

/**
 * World-space DOM planes. The same camera projection used by WebGL is composed
 * into each DOM matrix, including its perspective divide. React retains DOM
 * ownership; no CSS renderer reparents its nodes and no extra RAF is created.
 */
export function createTheaterSpatialUI({
  camera, container, introElement, screenElements = new Map(), playElements = new Map(),
  screens, occluders = [],
}) {
  let width = Math.max(1, container.clientWidth);
  let height = Math.max(1, container.clientHeight);
  let disposed = false;
  let lastOcclusion = -Infinity;
  let previousActive = null;
  const raycaster = new Raycaster();
  const model = new Matrix4();
  const clipMatrix = new Matrix4();
  const viewProjection = new Matrix4();
  const lastOcclusionPose = new Matrix4();
  const right = new Vector3();
  const normal = new Vector3();
  const point = new Vector3();
  const toCamera = new Vector3();
  const blockers = [];
  // Invisible historical architecture and the full strand asset must never
  // enter this small, throttled UI visibility pass.
  occluders.forEach(root => root?.traverseVisible(object => {
    if (object.isMesh && !object.userData.fullHair && !object.userData.sharedLionResources
      && !object.material?.transparent) blockers.push(object);
  }));
  const records = [];
  const add = (element, id, kind, position, baseYaw, worldWidth, worldHeight, pixelWidth, pixelHeight) => {
    if (!element) return;
    records.push({
      element, id, kind, position, baseYaw, yaw: baseYaw, worldWidth, worldHeight,
      pixelWidth, pixelHeight, inView: false, occluded: false, overlapping: false, opacity: 0,
      fade: null, target: 0, lastTransform: '', bounds: null,
    });
    element.style.position = 'absolute';
    element.style.left = '0'; element.style.top = '0';
    element.style.transformOrigin = '0 0';
    element.style.backfaceVisibility = 'hidden';
    element.style.opacity = '0'; element.style.pointerEvents = 'none';
    element.inert = true;
    element.setAttribute('aria-hidden', 'true');
    element.dataset.spatialKind = kind;
    element.dataset.spatialAnchor = JSON.stringify(position.toArray());
  };
  add(introElement, 'intro', 'intro', new Vector3(-5.4, 2.7, 0), 0, 3.3, 3.3 * 180 / 390, 390, 180);
  screens.forEach(screen => {
    const center = vector(screen.center);
    const inward = vector(screen.normal).normalize();
    const localRight = new Vector3().crossVectors(UP, inward).normalize();
    const yaw = Math.atan2(inward.x, inward.z);
    // Each sector has a permanent side-aisle lectern, in front of its giant
    // screen and outside the lion dais. Orbiting never translates a lectern.
    const infoPosition = localRight.clone().multiplyScalar(5.5);
    infoPosition.y = 1.7;
    add(screenElements.get(screen.id), screen.id, 'info', infoPosition, yaw, 3.4, 3.4 * 270 / 380, 380, 270);
    const playPosition = center.clone().addScaledVector(localRight, -screen.width * .32)
      .addScaledVector(UP, -screen.height * .39).addScaledVector(inward, .12);
    add(playElements.get(screen.id), screen.id, 'play', playPosition, yaw, 3.6, .624, 300, 52);
  });

  function measure(record) {
    // Layout is measured on resize, never in the animation loop. Fixed world
    // width keeps the perspective physical while the actual text height grows.
    const measuredWidth = record.element.offsetWidth;
    const measuredHeight = record.element.offsetHeight;
    if (measuredWidth > 0) record.pixelWidth = measuredWidth;
    if (measuredHeight > 0) record.pixelHeight = measuredHeight;
    record.worldHeight = record.worldWidth * record.pixelHeight / record.pixelWidth;
  }

  function establishPlane(record) {
    const { position } = record;
    const desiredYaw = Math.atan2(camera.position.x - position.x, camera.position.z - position.z);
    record.yaw = record.kind === 'play' ? record.baseYaw
      : record.baseYaw + clamp(angleDelta(record.baseYaw, desiredYaw), -MAX_YAW, MAX_YAW);
    right.set(Math.cos(record.yaw), 0, -Math.sin(record.yaw));
    normal.set(Math.sin(record.yaw), 0, Math.cos(record.yaw));
    const sx = record.worldWidth / record.pixelWidth;
    const sy = record.worldHeight / record.pixelHeight;
    const origin = point.copy(position).addScaledVector(right, -record.worldWidth / 2)
      .addScaledVector(UP, record.worldHeight / 2);
    model.set(
      right.x * sx, 0, normal.x, origin.x,
      0, -sy, 0, origin.y,
      right.z * sx, 0, normal.z, origin.z,
      0, 0, 0, 1,
    );
    clipMatrix.multiplyMatrices(viewProjection, model);
    const m = clipMatrix.elements;
    // A 2D projective homography embedded in CSS matrix3d. Row four carries
    // camera depth, so the browser projects and hit-tests the actual plane.
    const values = [
      width / 2 * (m[0] + m[3]), height / 2 * (-m[1] + m[3]), 0, m[3],
      width / 2 * (m[4] + m[7]), height / 2 * (-m[5] + m[7]), 0, m[7],
      0, 0, 1, 0,
      width / 2 * (m[12] + m[15]), height / 2 * (-m[13] + m[15]), 0, m[15],
    ];
    const divisor = Math.max(.001, m[15]);
    const css = `matrix3d(${values.map(value => clean(value / divisor)).join(',')})`;
    if (css !== record.lastTransform) {
      record.element.style.transform = css;
      record.lastTransform = css;
    }
    const corners = [];
    let nearestDepth = Infinity;
    for (const x of [-.5, .5]) for (const y of [-.5, .5]) {
      point.copy(position).addScaledVector(right, x * record.worldWidth)
        .addScaledVector(UP, y * record.worldHeight);
      const projected = point.clone().project(camera);
      nearestDepth = Math.min(nearestDepth, projected.z);
      corners.push(projected);
    }
    const bounds = {
      left: Math.min(...corners.map(corner => corner.x)), right: Math.max(...corners.map(corner => corner.x)),
      top: Math.max(...corners.map(corner => corner.y)), bottom: Math.min(...corners.map(corner => corner.y)),
    };
    record.bounds = bounds;
    toCamera.subVectors(camera.position, position);
    const distance = toCamera.length();
    record.inView = distance > .5 && distance < 35 && normal.dot(toCamera.normalize()) > .35
      && nearestDepth > -1 && corners.every(corner => corner.z < 1)
      && bounds.left < 1 && bounds.right > -1 && bounds.top > -1 && bounds.bottom < 1;
  }

  function checkOcclusion(record) {
    if (!record.inView || !blockers.length) { record.occluded = false; return; }
    right.set(Math.cos(record.yaw), 0, -Math.sin(record.yaw));
    // A central or corner obstruction hides the whole small DOM surface. This
    // is conservative, but never lets text shine through a column or a wall.
    record.occluded = [[0, 0], [-.43, -.43], [.43, -.43], [-.43, .43], [.43, .43]].some(([x, y]) => {
      point.copy(record.position).addScaledVector(right, x * record.worldWidth)
        .addScaledVector(UP, y * record.worldHeight);
      toCamera.subVectors(point, camera.position);
      const distance = toCamera.length();
      raycaster.set(camera.position, toCamera.normalize());
      raycaster.near = .1;
      raycaster.far = distance - .06;
      return raycaster.intersectObjects(blockers, false).some(hit => hit.distance < distance - .06);
    });
  }

  const api = {
    resize(nextWidth, nextHeight) {
      width = Math.max(1, nextWidth); height = Math.max(1, nextHeight);
      records.forEach(measure);
      lastOcclusion = -Infinity;
    },
    update({ now, activeId, visible = true }) {
      if (disposed) return;
      viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const poseChanged = camera.matrixWorld.elements.some((value, index) => Math.abs(value - lastOcclusionPose.elements[index]) > .00001);
      // These blockers are static architecture. A stationary camera therefore
      // needs no repeated raycasts while the independent lion/video animate.
      const recheck = lastOcclusion === -Infinity || previousActive !== activeId
        || (poseChanged && now - lastOcclusion >= 120);
      records.forEach(record => {
        establishPlane(record);
        if (recheck && (record.kind !== 'info' || record.id === activeId || record.opacity > .001)) checkOcclusion(record);
      });
      const activeInfo = records.find(record => record.kind === 'info' && record.id === activeId
        && record.inView && !record.occluded);
      records.forEach(record => {
        const a = record.bounds, b = activeInfo?.bounds;
        // Controls on an adjacent oblique screen can project over the active
        // lectern. Keep its reading surface clear; the current giant-screen
        // control is always retained and adjacent controls return when clear.
        record.overlapping = record.kind === 'play' && record.id !== activeId && Boolean(b)
          && a.left < b.right + 16 / width && a.right > b.left - 16 / width
          && a.top > b.bottom - 16 / height && a.bottom < b.top + 16 / height;
        const wanted = visible && record.inView && !record.occluded
          && !record.overlapping && (record.kind !== 'info' || record.id === activeId);
        const target = wanted ? 1 : 0;
        if (record.target !== target) {
          record.target = target;
          record.fade = { from: record.opacity, at: now, duration: target ? 380 : 280 };
        }
        if (record.fade) {
          const t = clamp((now - record.fade.at) / record.fade.duration, 0, 1);
          record.opacity = record.fade.from + (target - record.fade.from) * (1 - (1 - t) ** 3);
          if (t === 1) record.fade = null;
        }
        const safe = visible && record.inView && !record.occluded;
        const interactive = wanted && record.opacity > .5;
        record.element.style.opacity = record.opacity.toFixed(4);
        record.element.style.visibility = safe && record.opacity > .001 ? 'visible' : 'hidden';
        record.element.style.pointerEvents = interactive ? 'auto' : 'none';
        record.element.inert = !interactive;
        record.element.setAttribute('aria-hidden', interactive ? 'false' : 'true');
        record.element.dataset.spatialVisible = String(wanted);
        record.element.dataset.spatialOccluded = String(record.occluded);
        record.element.dataset.spatialOverlapping = String(record.overlapping);
        record.element.dataset.visible = String(wanted);
        record.element.dataset.opacity = record.opacity.toFixed(4);
      });
      if (recheck) { lastOcclusion = now; lastOcclusionPose.copy(camera.matrixWorld); }
      previousActive = activeId;
    },
    diagnostics() {
      return records.map(record => ({
        id: record.id, kind: record.kind, position: record.position.toArray(), yaw: record.yaw,
        inView: record.inView, occluded: record.occluded, overlapping: record.overlapping, visible: record.target > 0,
        opacity: record.opacity, bounds: record.bounds,
      }));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      records.forEach(({ element }) => {
        element.style.opacity = '0'; element.style.visibility = 'hidden';
        element.style.pointerEvents = 'none'; element.inert = true;
        element.setAttribute('aria-hidden', 'true');
      });
      blockers.length = 0;
      records.length = 0;
    },
  };
  records.forEach(measure);
  return api;
}
