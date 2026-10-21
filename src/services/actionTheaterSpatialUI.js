import { Box3, Frustum, Matrix4, Vector3 } from 'three';

const UP = new Vector3(0, 1, 0);
const PANEL_SIZES = {
  title: { width: 360, height: 140, worldWidth: 3.1 },
  caption: { width: 360, height: 260, worldWidth: 3.2 },
  screen: { width: 160, height: 180, worldWidth: 2.0 },
};

/**
 * DOM planes share the room's actual view/projection matrix. Homogeneous CSS
 * transforms preserve all four corners and the browser's transformed hit area;
 * there is no billboard, position tween, React frame update or second RAF.
 */
export function createTheaterSpatialUI({ layer, screenRecords }) {
  const projectionView = new Matrix4();
  const viewport = new Matrix4();
  const clip = new Matrix4();
  const css = new Matrix4();
  const frustum = new Frustum();
  const toScreen = new Vector3();
  const toCamera = new Vector3();
  const forward = new Vector3();
  const point = new Vector3();
  const panels = [];
  const scores = [];
  const screens = [];
  const compass = layer?.parentElement?.querySelector('[data-view-compass]');
  let enabled = true;
  let layoutWidth = 0;
  let layoutHeight = 0;

  screenRecords.forEach((record, id) => {
    const center = record.object.getWorldPosition(new Vector3());
    const normal = new Vector3().fromBufferAttribute(record.object.geometry.attributes.normal, 0).transformDirection(record.object.matrixWorld);
    const right = new Vector3().crossVectors(UP, normal).normalize();
    const score = { id, angle: 0, visible: false, frontFacing: false };
    const bounds = new Box3().setFromObject(record.object);
    screens.push({ id, center, normal, right, bounds, score });
    scores.push(score);
  });

  layer?.querySelectorAll('[data-spatial-panel]').forEach(element => {
    const kind = element.dataset.spatialPanel;
    const size = PANEL_SIZES[kind];
    const screen = screens.find(item => item.id === element.dataset.screenId);
    if (!screen || !size) return;
    const { normal, right, center } = screen;
    const scale = size.worldWidth / size.width;
    const position = new Vector3();
    if (kind === 'title') position.copy(right).multiplyScalar(-4.55).addScaledVector(normal, 1.0).setY(3.9);
    else if (kind === 'caption') position.copy(right).multiplyScalar(5.1).addScaledVector(normal, 1.2).setY(.65);
    else position.copy(center).addScaledVector(right, -5.7).addScaledVector(normal, .14).setY(center.y + 2.7);
    // The reference's title and reading plaques angle inward. This orientation
    // is authored once in world space, and never changes to face the camera.
    const yaw = (kind === 'title' ? 20 : kind === 'caption' ? -16 : 0) * Math.PI / 180;
    const panelRight = right.clone().applyAxisAngle(UP, yaw);
    const panelNormal = normal.clone().applyAxisAngle(UP, yaw);
    // Convert a top-left-origin CSS rectangle into a fixed inward-facing plane.
    const world = new Matrix4().set(
      panelRight.x * scale, 0, panelNormal.x * scale, position.x - panelRight.x * size.worldWidth / 2,
      panelRight.y * scale, -scale, panelNormal.y * scale, position.y + size.height * scale / 2,
      panelRight.z * scale, 0, panelNormal.z * scale, position.z - panelRight.z * size.worldWidth / 2,
      0, 0, 0, 1,
    );
    const halfW = size.worldWidth / 2, halfH = size.height * scale / 2;
    const corners = [
      position.clone().addScaledVector(panelRight, -halfW).addScaledVector(UP, halfH),
      position.clone().addScaledVector(panelRight, halfW).addScaledVector(UP, halfH),
      position.clone().addScaledVector(panelRight, -halfW).addScaledVector(UP, -halfH),
      position.clone().addScaledVector(panelRight, halfW).addScaledVector(UP, -halfH),
    ];
    element.dataset.worldPanel = kind;
    element.dataset.worldPosition = JSON.stringify(position.toArray());
    element.style.width = `${size.width}px`;
    element.style.height = `${size.height}px`;
    element.style.transformOrigin = '0 0';
    panels.push({ element, kind, screen, world, position, right: panelRight, normal: panelNormal, halfW, halfH, corners });
  });

  // Adapt the authored room layout only when the desktop viewport changes.
  // Orbiting never moves an anchor or rebuilds its corners/world transform.
  function resize(width, height) {
    if (width === layoutWidth && height === layoutHeight) return;
    layoutWidth = width;
    layoutHeight = height;
    const compact = width < 1100;
    for (const panel of panels) {
      const { element, kind, screen, world, position, right, halfW, halfH, corners } = panel;
      if (kind === 'screen') continue;
      if (kind === 'title') position.copy(screen.right).multiplyScalar(compact ? -3.4 : -4.55).addScaledVector(screen.normal, 1.0).setY(3.9);
      else position.copy(screen.right).multiplyScalar(compact ? 3.6 : 5.1).addScaledVector(screen.normal, 1.2).setY(height < 800 ? 1.65 : 1.0);
      world.setPosition(position.x - right.x * halfW, position.y + halfH, position.z - right.z * halfW);
      corners[0].copy(position).addScaledVector(right, -halfW).addScaledVector(UP, halfH);
      corners[1].copy(position).addScaledVector(right, halfW).addScaledVector(UP, halfH);
      corners[2].copy(position).addScaledVector(right, -halfW).addScaledVector(UP, -halfH);
      corners[3].copy(position).addScaledVector(right, halfW).addScaledVector(UP, -halfH);
      element.dataset.worldPosition = JSON.stringify(position.toArray());
    }
  }

  function hide() {
    panels.forEach(({ element }) => {
      element.style.visibility = 'hidden';
      element.dataset.visible = 'false';
      element.inert = true;
    });
    if (layer) layer.dataset.visible = 'false';
  }

  return {
    scores,
    resize,
    updateCamera(camera) {
      projectionView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projectionView);
      camera.getWorldDirection(forward);
      for (const screen of screens) {
        toScreen.subVectors(screen.center, camera.position).normalize();
        toCamera.subVectors(camera.position, screen.center);
        screen.score.angle = Math.acos(Math.max(-1, Math.min(1, forward.dot(toScreen))));
        screen.score.frontFacing = screen.normal.dot(toCamera) > .01;
        screen.score.visible = frustum.intersectsBox(screen.bounds);
      }
      return forward;
    },
    updatePanels(camera, activeId, width, height, frame) {
      if (!enabled) return;
      // CSS depth points toward the viewer; WebGL clip depth points away.
      // Flip Z as well as Y so CSS backface culling agrees with our normal test.
      viewport.set(width / 2, 0, 0, width / 2, 0, -height / 2, 0, height / 2, 0, 0, -1, 0, 0, 0, 0, 1);
      for (const panel of panels) {
        const { element, kind, screen, position, normal, corners, world } = panel;
        const active = screen.id === activeId;
        const show = screen.score.frontFacing && (kind !== 'caption' || active);
        toCamera.subVectors(camera.position, position);
        let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        let nearVisible = true;
        for (const corner of corners) {
          point.copy(corner).project(camera);
          if (point.z <= -1 || point.z >= 1) nearVisible = false;
          left = Math.min(left, point.x); right = Math.max(right, point.x);
          top = Math.min(top, point.y); bottom = Math.max(bottom, point.y);
        }
        const visible = show && nearVisible && normal.dot(toCamera) > .01 && right > -1 && left < 1 && bottom > -1 && top < 1;
        // Compose even inactive planes so reactivation cannot display an old pose.
        clip.multiplyMatrices(projectionView, world);
        css.multiplyMatrices(viewport, clip);
        element.style.transform = `matrix3d(${css.elements.join(',')})`;
        element.style.visibility = visible ? 'visible' : 'hidden';
        element.style.pointerEvents = visible ? 'auto' : 'none';
        element.dataset.active = String(active);
        element.dataset.visible = String(visible);
        element.dataset.spatialFrame = String(frame);
        element.inert = !visible;
      }
      if (layer) {
        layer.dataset.visible = 'true';
        layer.dataset.spatialFrame = String(frame);
      }
      if (compass) {
        const yaw = Math.atan2(camera.position.x, camera.position.z);
        compass.style.setProperty('--view-angle', `${-yaw}rad`);
        compass.style.setProperty('--camera-yaw', `${yaw}rad`);
        compass.dataset.cameraYaw = String(yaw);
        compass.dataset.spatialFrame = String(frame);
      }
    },
    setVisible(value) { enabled = Boolean(value); if (!enabled) hide(); },
    dispose: hide,
  };
}
