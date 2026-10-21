import { Frustum, Matrix4, Quaternion, Sphere, Vector3 } from 'three';

const radians = degrees => degrees * Math.PI / 180;
const asVector = value => value?.isVector3 ? value.clone() : new Vector3(...value);
const clamp = value => Math.max(-1, Math.min(1, value));

/** Selects a wall from the actual camera pose; the rotating exhibit is irrelevant. */
export function createActiveScreenController({
  screens,
  initialId = screens[0]?.id ?? null,
  onChange = () => {},
  settleMs = 500,
  hysteresisDegrees = 12,
}) {
  const definitions = screens.map(screen => {
    const normal = asVector(screen.normal).normalize();
    const right = screen.right ? asVector(screen.right).normalize() : new Vector3().crossVectors(new Vector3(0, 1, 0), normal).normalize();
    const up = new Vector3().crossVectors(normal, right).normalize();
    const center = asVector(screen.center);
    const width = Math.max(.01, screen.width || 1);
    const height = Math.max(.01, screen.height || 1);
    return { ...screen, center, normal, right, up, width, height, sphere: new Sphere(center, Math.hypot(width, height) / 2) };
  });
  const frustum = new Frustum();
  const projectionView = new Matrix4();
  const position = new Vector3();
  const previousPosition = new Vector3();
  const quaternion = new Quaternion();
  const previousQuaternion = new Quaternion();
  const forward = new Vector3();
  const offset = new Vector3();
  const point = new Vector3();
  let sampled = false;
  let activeId = initialId;
  let pendingId = null;
  let pendingSince = 0;
  let lastMotion = 0;
  let manualLock = false;
  let metrics = [];

  const clearPending = () => { pendingId = null; pendingSince = 0; };
  const commit = (id, reason) => {
    if (id === activeId) return;
    activeId = id;
    onChange(id, { reason });
  };

  const measure = camera => {
    camera.updateMatrixWorld();
    camera.getWorldPosition(position);
    camera.getWorldQuaternion(quaternion);
    camera.getWorldDirection(forward);
    frustum.setFromProjectionMatrix(projectionView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    return definitions.map(screen => {
      offset.subVectors(screen.center, position);
      const distance = offset.length();
      const alignment = forward.dot(offset.normalize());
      const angle = Math.acos(clamp(alignment));
      const facing = -screen.normal.dot(offset);
      const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
      let projected = 0;
      for (const x of [-.5, .5]) for (const y of [-.5, .5]) {
        point.copy(screen.center).addScaledVector(screen.right, screen.width * x).addScaledVector(screen.up, screen.height * y).project(camera);
        if (point.z < -1 || point.z > 1) continue;
        projected += 1;
        bounds.left = Math.min(bounds.left, point.x); bounds.right = Math.max(bounds.right, point.x);
        bounds.bottom = Math.min(bounds.bottom, point.y); bounds.top = Math.max(bounds.top, point.y);
      }
      const visibleWidth = Math.max(0, Math.min(1, bounds.right) - Math.max(-1, bounds.left));
      const visibleHeight = Math.max(0, Math.min(1, bounds.top) - Math.max(-1, bounds.bottom));
      const coverage = projected ? visibleWidth * visibleHeight / 4 : 0;
      const visible = facing > .08 && alignment > 0 && distance < camera.far && frustum.intersectsSphere(screen.sphere) && coverage > .015;
      // Coverage is a conservative projected-rectangle metric, not a GPU
      // occlusion query. Inward wall normals reject screens behind their wall.
      return { id: screen.id, angle, distance, facing, coverage, visible,
        score: visible ? alignment * .78 + coverage * .16 + facing * .06 : -Infinity };
    });
  };

  const api = {
    update({ camera, now, interacting = false, moving = false }) {
      metrics = measure(camera);
      const poseChanged = sampled && (position.distanceToSquared(previousPosition) > .00000009 || quaternion.angleTo(previousQuaternion) > .00015);
      previousPosition.copy(position); previousQuaternion.copy(quaternion); sampled = true;
      if (poseChanged || moving || interacting) {
        lastMotion = now;
        clearPending();
      }
      if (poseChanged && interacting) manualLock = false;
      if (manualLock || interacting || moving) return api.getState();
      const best = metrics.reduce((result, item) => item.score > (result?.score ?? -Infinity) ? item : result, null);
      const current = metrics.find(item => item.id === activeId);
      if (!best || !best.visible || best.angle > radians(58) || best.id === activeId
        || (current?.visible && current.angle - best.angle < radians(hysteresisDegrees))) {
        clearPending();
        return api.getState();
      }
      if (pendingId !== best.id) { pendingId = best.id; pendingSince = now; }
      if (now - lastMotion >= settleMs && now - pendingSince >= settleMs) {
        commit(best.id, 'observation');
        clearPending();
      }
      return api.getState();
    },
    select(id) {
      if (!definitions.some(screen => screen.id === id)) return false;
      manualLock = true;
      clearPending();
      commit(id, 'manual');
      return true;
    },
    // Call only for an actual user-driven pose change (e.g. wheel zoom with
    // start/end emitted within one frame), never for a focus animation.
    noteUserMovement(now) { manualLock = false; lastMotion = now; clearPending(); },
    resetMotion(now) { lastMotion = now; clearPending(); },
    getState() { return { activeId, pendingId, pendingSince, lastMotion, manualLock, metrics }; },
  };
  return api;
}
