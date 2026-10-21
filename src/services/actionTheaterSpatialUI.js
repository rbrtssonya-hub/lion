import {
  Box3, BufferGeometry, Float32BufferAttribute, FrontSide, Frustum, Group,
  LineBasicMaterial, LineLoop, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry,
  Raycaster, Vector2, Vector3,
} from 'three';
import { getActionSpatialConfig } from '../config/actionSpatialSettings.js';
import { createActionPanelTextures } from './actionPanelTextures.js';
import { advancePanelOpacity, projectedPanelVisibility } from './actionSpatialMotion.js';

const UP = new Vector3(0, 1, 0);
const PANEL_SIZES = {
  title: { width: 360, height: 140, worldWidth: 5.4 },
  caption: { width: 360, height: 260, worldWidth: 3.2 },
  screen: { width: 160, height: 180, worldWidth: 2 },
};
const EPSILON = .002;

/**
 * Actual scene planes provide per-pixel depth against the complete room/lion.
 * Transparent DOM twins retain semantics and exact projected button hit areas.
 * Camera matrices update every frame; only material alpha has a time response.
 */
export function createTheaterSpatialUI({ layer, screenRecords, scene, renderer, spatialSettings }) {
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
  const group = new Group();
  group.name = 'Theater_Spatial_UI';
  scene.add(group);
  const geometry = new PlaneGeometry(1, 1);
  const compass = layer?.parentElement?.querySelector('[data-view-compass]');
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const rayHits = [];
  const panelHits = [];
  const occluders = [];
  const eventDisposers = [];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let config = getActionSpatialConfig(spatialSettings);
  let enabled = true;
  let layoutWidth = 0;
  let layoutHeight = 0;
  let layoutScale = 0;
  let latestCamera;

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
    const yaw = (kind === 'title' ? 50 : kind === 'caption' ? -16 : 0) * Math.PI / 180;
    const right = screen.right.clone().applyAxisAngle(UP, yaw);
    const normal = screen.normal.clone().applyAxisAngle(UP, yaw);
    const textures = createActionPanelTextures(element, kind, size.width, size.height);
    for (const texture of new Set(Object.values(textures))) renderer.initTexture(texture);
    const material = new MeshBasicMaterial({
      map: textures.inactive, transparent: true, opacity: 0, side: FrontSide,
      depthTest: true, depthWrite: false, toneMapped: false, alphaTest: .001,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = `Theater_Spatial_${kind}_${screen.id}`;
    mesh.matrixAutoUpdate = false;
    mesh.visible = false;
    group.add(mesh);
    const panel = {
      element, kind, screen, size, textures, material, mesh, right, normal,
      world: new Matrix4(), position: new Vector3(), corners: Array.from({ length: 4 }, () => new Vector3()),
      bounds: { left: 0, right: 0, top: 0, bottom: 0 }, alpha: 0, target: 0,
      edge: 0, interactive: false, active: false, geometryVisible: false, halfW: 0, halfH: 0,
    };
    const button = element.querySelector('button');
    if (button) {
      const ringGeometry = new BufferGeometry();
      const ringPoints = [];
      for (let i = 0; i < 48; i += 1) {
        const angle = i / 48 * Math.PI * 2;
        ringPoints.push((36 + Math.cos(angle) * 23) / size.width - .5, .5 - (112 + Math.sin(angle) * 23) / size.height, .001);
      }
      ringGeometry.setAttribute('position', new Float32BufferAttribute(ringPoints, 3));
      const ring = new LineLoop(ringGeometry, new LineBasicMaterial({ color: '#fff0c0', transparent: true, depthTest: true, depthWrite: false, toneMapped: false }));
      ring.name = `${mesh.name}_focus`;
      ring.visible = false;
      mesh.add(ring);
      panel.button = button;
      panel.ring = ring;
      const focus = () => { panel.focused = true; };
      const blur = () => { panel.focused = false; };
      const enter = () => { panel.hovered = true; };
      const leave = () => { panel.hovered = false; };
      button.addEventListener('focus', focus); button.addEventListener('blur', blur);
      button.addEventListener('pointerenter', enter); button.addEventListener('pointerleave', leave);
      eventDisposers.push(() => {
        button.removeEventListener('focus', focus); button.removeEventListener('blur', blur);
        button.removeEventListener('pointerenter', enter); button.removeEventListener('pointerleave', leave);
      });
    }
    element.dataset.worldPanel = kind;
    element.style.width = `${size.width}px`;
    element.style.height = `${size.height}px`;
    element.style.transformOrigin = '0 0';
    // No duplicate DOM painting above the renderer: even partially occluded
    // glyphs/ornaments are resolved by the same depth buffer as the lion.
    element.style.opacity = '0';
    element.style.pointerEvents = 'none';
    panels.push(panel);
  });

  // Pointer-only exact triangle tests. Never traverse/raycast the 20M hair
  // lines per rendering frame, and never approximate visual occlusion by AABBs.
  scene.traverseVisible(object => {
    if (!object.isMesh || object.parent === group || object.userData.fullHair) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.some(material => material?.visible && material.depthWrite && (!material.transparent || material.opacity >= .98))) occluders.push(object);
  });
  const objectVisible = object => {
    for (let item = object; item; item = item.parent) if (!item.visible) return false;
    return true;
  };
  const occluded = (panel, event) => {
    if (!latestCamera) return false;
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2);
    raycaster.setFromCamera(pointer, latestCamera);
    rayHits.length = 0; panelHits.length = 0;
    scene.updateMatrixWorld();
    raycaster.intersectObject(panel.mesh, false, panelHits);
    if (!panelHits.length) return true;
    raycaster.far = panelHits[0].distance - .01;
    for (const object of occluders) if (objectVisible(object)) raycaster.intersectObject(object, false, rayHits);
    raycaster.far = Infinity;
    return rayHits.length > 0;
  };
  const guardPointer = event => {
    const button = event.target.closest?.('button');
    const panel = panels.find(item => item.button === button);
    if (!panel || (event.type === 'click' && event.detail === 0 && panel.interactive)) return;
    const blocked = !panel.interactive || occluded(panel, event);
    panel.element.dataset.occluded = String(blocked);
    if (!blocked) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.type === 'pointerdown') {
      renderer.domElement.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, pointerId: event.pointerId, pointerType: event.pointerType,
        isPrimary: event.isPrimary, clientX: event.clientX, clientY: event.clientY,
        button: event.button, buttons: event.buttons, pressure: event.pressure,
      }));
    }
  };
  layer?.addEventListener('pointerdown', guardPointer, true);
  layer?.addEventListener('click', guardPointer, true);

  // Canonical front-view fit is calculated only on resize/scale edits. Camera
  // orbit never moves a plaque's authored world position or its four corners.
  function resize(width, height, camera = latestCamera) {
    latestCamera = camera ?? latestCamera;
    if (width === layoutWidth && height === layoutHeight && layoutScale === config.scale) return;
    layoutWidth = width; layoutHeight = height; layoutScale = config.scale;
    const horizontalTangent = camera ? 1 / camera.projectionMatrix.elements[0] : width / height * Math.tan(28 * Math.PI / 180);
    for (const panel of panels) {
      const { element, kind, screen, size, position, right, normal, world, mesh, corners } = panel;
      const pixelScale = size.worldWidth * config.scale / size.width;
      const halfW = size.worldWidth * config.scale / 2;
      const halfH = size.height * pixelScale / 2;
      panel.halfW = halfW; panel.halfH = halfH;
      let localX, localZ, localY;
      if (kind === 'title') { localX = -7.6; localZ = width < 1100 ? -6.5 : -4.8; localY = 5.65; }
      else if (kind === 'caption') {
        localX = width < 1100 ? 3.6 : 5.1; localZ = 1.2;
        localY = (height < 800 ? 1.65 : 1.62) + (config.scale - 1) * size.worldWidth * size.height / size.width / 2;
      } else {
        localX = screen.center.dot(screen.right) - 5.7;
        localZ = screen.center.dot(screen.normal) + .14;
        localY = Math.min(screen.center.y + 2.7, 8.75 - halfH);
      }
      if (kind !== 'screen') {
        const rx = right.dot(screen.right), rz = right.dot(screen.normal);
        let minimum = -Infinity, maximum = Infinity;
        for (const dx of [-halfW, halfW]) {
          const span = (8.6 - localZ - rz * dx) * horizontalTangent * .92;
          minimum = Math.max(minimum, -span - rx * dx);
          maximum = Math.min(maximum, span - rx * dx);
        }
        localX = Math.max(minimum, Math.min(maximum, localX));
        if (kind === 'title') localX = Math.max(-9.45 + Math.abs(rx) * halfW, localX);
      }
      position.copy(screen.right).multiplyScalar(localX).addScaledVector(screen.normal, localZ).setY(localY);
      world.set(
        right.x * pixelScale, 0, normal.x * pixelScale, position.x - right.x * halfW,
        right.y * pixelScale, -pixelScale, normal.y * pixelScale, position.y + halfH,
        right.z * pixelScale, 0, normal.z * pixelScale, position.z - right.z * halfW,
        0, 0, 0, 1,
      );
      mesh.matrix.set(
        right.x * halfW * 2, 0, normal.x, position.x,
        right.y * halfW * 2, halfH * 2, normal.y, position.y,
        right.z * halfW * 2, 0, normal.z, position.z,
        0, 0, 0, 1,
      );
      mesh.matrixWorldNeedsUpdate = true;
      corners[0].copy(position).addScaledVector(right, -halfW).addScaledVector(UP, halfH);
      corners[1].copy(position).addScaledVector(right, halfW).addScaledVector(UP, halfH);
      corners[2].copy(position).addScaledVector(right, -halfW).addScaledVector(UP, -halfH);
      corners[3].copy(position).addScaledVector(right, halfW).addScaledVector(UP, -halfH);
      element.dataset.worldPosition = JSON.stringify(position.toArray());
    }
    renderer.domElement.dataset.spatialRenderer = 'webgl-depth';
    renderer.domElement.dataset.spatialSettings = JSON.stringify(config);
  }

  function hide() {
    group.visible = false;
    panels.forEach(({ element, button }) => {
      element.style.visibility = 'hidden';
      element.dataset.visible = 'false'; element.dataset.interactive = 'false';
      element.inert = true;
      if (button) button.style.pointerEvents = 'none';
    });
    if (layer) layer.dataset.visible = 'false';
  }

  return {
    scores,
    resize,
    updateCamera(camera) {
      latestCamera = camera;
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
    updatePanels(camera, activeId, width, height, frame, dt) {
      if (!enabled) return;
      group.visible = true;
      viewport.set(width / 2, 0, 0, width / 2, 0, -height / 2, 0, height / 2, 0, 0, -1, 0, 0, 0, 0, 1);
      for (const panel of panels) {
        const { element, kind, screen, position, normal, corners, world, material, mesh, bounds, button, ring } = panel;
        const active = screen.id === activeId;
        toCamera.subVectors(camera.position, position).normalize();
        const facing = normal.dot(toCamera);
        bounds.left = Infinity; bounds.top = Infinity; bounds.right = -Infinity; bounds.bottom = -Infinity;
        let nearVisible = true;
        for (const corner of corners) {
          point.copy(corner).project(camera);
          if (point.z <= -1 || point.z >= 1) nearVisible = false;
          bounds.left = Math.min(bounds.left, (point.x + 1) / 2);
          bounds.right = Math.max(bounds.right, (point.x + 1) / 2);
          bounds.top = Math.min(bounds.top, (1 - point.y) / 2);
          bounds.bottom = Math.max(bounds.bottom, (1 - point.y) / 2);
        }
        panel.geometryVisible = nearVisible && facing > 0 && bounds.right > 0 && bounds.left < 1 && bounds.bottom > 0 && bounds.top < 1;
        panel.edge = nearVisible ? projectedPanelVisibility(bounds, config.edgeZone, facing) : 0;
        panel.target = panel.edge * (kind === 'caption' && !active ? 0 : config.opacity);
        panel.alpha = advancePanelOpacity(panel.alpha, panel.target, dt, reducedMotion.matches ? 80 : config.fadeInMs, reducedMotion.matches ? 80 : config.fadeOutMs);
        material.opacity = panel.alpha;
        material.map = active ? panel.textures.active : panel.textures.inactive;
        panel.active = active;
        mesh.visible = panel.alpha > EPSILON;
        panel.interactive = Boolean(button && panel.geometryVisible && panel.alpha >= config.interactionOpacity);
        if (button) button.style.pointerEvents = panel.interactive ? 'auto' : 'none';
        if (ring) {
          ring.visible = panel.interactive && Boolean(panel.focused || panel.hovered);
          ring.material.opacity = panel.alpha;
        }
        // CSS and GPU planes use the identical world rectangle and this frame's
        // camera matrices, even while inactive captions are finishing a fade.
        clip.multiplyMatrices(projectionView, world);
        css.multiplyMatrices(viewport, clip);
        element.style.transform = `matrix3d(${css.elements.join(',')})`;
        element.style.visibility = panel.geometryVisible && mesh.visible ? 'visible' : 'hidden';
        element.dataset.active = String(active);
        element.dataset.visible = String(panel.geometryVisible && mesh.visible);
        element.dataset.geometryVisible = String(panel.geometryVisible);
        element.dataset.opacity = panel.alpha.toFixed(5);
        element.dataset.targetOpacity = panel.target.toFixed(5);
        element.dataset.edgeOpacity = panel.edge.toFixed(5);
        element.dataset.interactive = String(panel.interactive);
        element.dataset.projectedBounds = JSON.stringify(bounds);
        element.dataset.spatialFrame = String(frame);
        const perceivable = panel.geometryVisible && panel.alpha >= config.interactionOpacity;
        element.inert = !perceivable;
        element.setAttribute('aria-hidden', String(!perceivable || (kind === 'caption' && !active)));
      }
      if (layer) { layer.dataset.visible = 'true'; layer.dataset.spatialFrame = String(frame); }
      if (compass) {
        const yaw = Math.atan2(camera.position.x, camera.position.z);
        compass.style.setProperty('--view-angle', `${-yaw}rad`);
        compass.style.setProperty('--camera-yaw', `${yaw}rad`);
        compass.dataset.cameraYaw = String(yaw);
        compass.dataset.spatialFrame = String(frame);
      }
    },
    setSpatialSettings(value) {
      config = getActionSpatialConfig(value);
      layoutScale = 0;
      resize(layoutWidth, layoutHeight, latestCamera);
    },
    setVisible(value) { enabled = Boolean(value); if (!enabled) hide(); },
    diagnostics() {
      return { renderer: 'webgl-depth', settings: config, panels: panels.map(panel => ({
        kind: panel.kind, id: panel.screen.id, alpha: panel.alpha, target: panel.target,
        edge: panel.edge, interactive: panel.interactive, bounds: { ...panel.bounds },
        world: panel.position.toArray(), depthTest: panel.material.depthTest,
      })) };
    },
    dispose() {
      hide();
      layer?.removeEventListener('pointerdown', guardPointer, true);
      layer?.removeEventListener('click', guardPointer, true);
      eventDisposers.forEach(dispose => dispose());
      for (const panel of panels) {
        panel.material.dispose();
        new Set(Object.values(panel.textures)).forEach(texture => texture.dispose());
        panel.ring?.geometry.dispose(); panel.ring?.material.dispose();
      }
      geometry.dispose(); group.removeFromParent(); group.clear();
    },
  };
}
