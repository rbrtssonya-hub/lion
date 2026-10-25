import {
  AgXToneMapping, Box3, Color, DirectionalLight, Group, HemisphereLight,
  PerspectiveCamera, PropertyBinding, Quaternion, Raycaster, Scene, SRGBColorSpace, Vector2,
  Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { acceleratedRaycast, computeBoundsTree } from 'three-mesh-bvh';
import { media } from '../config/media.js';
import { resolveViewSettings } from '../config/viewSettings.js';
import { acquireFullLion } from './lionFullHair.js';
import { createLionLightingControls } from './lionLightingSettings.js';

const owners = new WeakMap();
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const smooth = value => value * value * (3 - 2 * value);
const abortError = () => new DOMException('醒狮交互场景已取消', 'AbortError');
const vector = (value, fallback = [0, 1, 0]) => new Vector3(...(Array.isArray(value) && value.length === 3 ? value : fallback));
const quaternion = new Quaternion();
const headParts = new Set(['head_shell', 'crown', 'forehead', 'brow_l', 'brow_r', 'ear_l', 'ear_r', 'upper_teeth', 'lower_mouth', 'beard']);
const headModuleDirection = new Vector3(-.5, .35, 1.05);
const bodyModuleDirection = new Vector3(.35, .05, -.35);

/**
 * A part owns only source meshes and their authored hair. Every frame starts
 * from the captured rest transform; explode and motion never accumulate TRS.
 * React owns all controls and text, this service owns one WebGL scene.
 */
export async function createLionInteractiveScene({
  container, modelUrl, parts: partInput, signal, active = true, lightingSettings,
  onStatus = () => {}, onSelectPart = () => {}, onProjectParts = () => {},
  onAutoRotateChange = () => {}, onStateChange = () => {},
}) {
  if (!container?.isConnected || signal?.aborted) throw abortError();
  owners.get(container)?.();
  const controller = new AbortController();
  const scene = new Scene();
  const modelGroup = new Group();
  scene.add(modelGroup);
  const partDefinitions = Array.isArray(partInput) ? partInput : (partInput?.parts ?? []);
  const partMap = new Map();
  const meshParts = new WeakMap();
  const pickMeshes = [];
  const highlights = new Map();
  const ownedMaterials = new Set();
  const samples = new Map();
  const pointer = new Vector2();
  const raycaster = new Raycaster();
  raycaster.firstHitOnly = true;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let viewSettings = resolveViewSettings(lightingSettings);
  const camera = new PerspectiveCamera(viewSettings.structureFov, 1, .01, 100);
  let renderer, controls, lighting, observer, fullLion;
  let disposed = false, ready = false, isActive = Boolean(active), frame = 0;
  let renderCount = 0, previousTime = 0, lastDiagnostics = 0, lastProjection = 0;
  let rendering = false, dirty = true, pointerDown = null;
  const activePointers = new Set();
  let multiPointerGesture = false;
  let explode = 0, explodeTarget = 0, explodeAnimation = null;
  let selectedId = null, isolated = false, separated = false;
  let mode = 'explore', motionPlaying = false, motionTime = 0, motionIntensity = .55;
  let labels = true, cameraTween = null, currentProjections = [];
  let overviewDistance = 4, normalizedScale = 1, sourceSize = 1;
  const defaultDirection = new Vector3(1.1, .52, 2.65).normalize();
  const basePosition = new Vector3();
  const baseTarget = new Vector3();

  function state() {
      return { explode: explodeAnimation?.auto ? explode : explodeTarget, mode, motionPlaying, selectedId, isolated, separated, autoRotate: Boolean(controls?.autoRotate), motionIntensity };
  }
  function publish() { if (!disposed) onStateChange(state()); }
  function requestDraw() {
    dirty = true;
    if (ready && isActive && !disposed && !frame && !rendering) frame = requestAnimationFrame(draw);
  }
  function report(status) { if (!disposed && !signal?.aborted) onStatus(status); }
  function stopAutoRotate() {
    if (!controls?.autoRotate) return;
    controls.autoRotate = false;
    onAutoRotateChange(false);
  }
  function boundsFor(id) {
    return new Box3().setFromObject(id ? partMap.get(id)?.group ?? modelGroup : modelGroup);
  }
  function applyLimits(focusDistance) {
    if (!controls) return;
    controls.minDistance = Math.max(.06, (focusDistance ?? overviewDistance) * viewSettings.structureMinDistanceRatio);
    controls.maxDistance = Math.max(overviewDistance * viewSettings.structureMaxDistanceRatio, controls.minDistance + .5);
    camera.near = .01;
    camera.far = Math.max(100, controls.maxDistance * 3);
    camera.updateProjectionMatrix();
  }
  function fitted(box, direction = defaultDirection, objects) {
    const center = box.getCenter(new Vector3());
    const right = new Vector3().crossVectors(camera.up, direction).normalize();
    const up = new Vector3().crossVectors(direction, right).normalize();
    const verticalTan = Math.tan(camera.fov * Math.PI / 360);
    const horizontalTan = verticalTan * camera.aspect;
    let distance = .5;
    const include = point => {
      const relative = point.sub(center);
      distance = Math.max(distance, relative.dot(direction) + Math.abs(relative.dot(right)) / (horizontalTan * .87), relative.dot(direction) + Math.abs(relative.dot(up)) / (verticalTan * .86));
    };
    if (objects?.length) {
      // A single axis-aligned box combines empty head/body corners and leaves
      // too much space around an elongated lion. Fit source surface samples
      // and complete authored hair bounds in the current camera direction.
      objects.forEach(object => {
        if (object.userData.fullHair) {
          const { min, max } = object.geometry.boundingBox;
          for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) include(object.localToWorld(new Vector3(x, y, z)));
        } else {
          const positions = object.geometry?.attributes.position;
          if (!positions) return;
          const step = Math.max(1, Math.floor(positions.count / 160));
          for (let index = 0; index < positions.count; index += step) include(object.localToWorld(new Vector3().fromBufferAttribute(positions, index)));
        }
      });
    } else {
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) include(new Vector3(x, y, z));
    }
    return { center, position: center.clone().addScaledVector(direction, distance), distance };
  }
  function tweenCamera(target, position, duration = 620) {
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
    cameraTween = { from: camera.position.clone(), fromTarget: controls.target.clone(), to: position, target, elapsed: 0, duration: reducedMotion.matches ? 0 : duration / 1000 };
    requestDraw();
  }
  function fitOverview(animate = true) {
    modelGroup.updateMatrixWorld(true);
    const fit = fitted(boundsFor(), defaultDirection, [...partMap.values()].flatMap(part => part.meshes));
    overviewDistance = fit.distance;
    basePosition.copy(fit.position);
    baseTarget.copy(fit.center);
    applyLimits();
    if (animate) tweenCamera(fit.center, fit.position);
    else { camera.position.copy(fit.position); controls.target.copy(fit.center); controls.update(); }
  }
  function focusPart(id) {
    const part = partMap.get(id);
    if (!part) return;
    modelGroup.updateMatrixWorld(true);
    const box = boundsFor(id);
    const fit = fitted(box, vector(part.definition.viewDirection, defaultDirection.toArray()).normalize(), part.meshes);
    applyLimits(fit.distance);
    // Large source groups remain complete while a small ornament can be seen
    // close up. The target follows its currently exploded position.
    tweenCamera(fit.center, fit.position, 680);
  }
  function restoreHighlight() {
    highlights.forEach((original, material) => {
      if (material.emissive && original.emissive) material.emissive.copy(original.emissive);
      if ('emissiveIntensity' in material) material.emissiveIntensity = original.intensity;
      if (material.color && original.color) material.color.copy(original.color);
    });
  }
  function highlightPart() {
    restoreHighlight();
    const part = partMap.get(selectedId);
    part?.group.traverse(object => {
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
        if (!material) continue;
        if (material.emissive) {
          material.emissive.copy(highlights.get(material)?.emissive ?? new Color()).add(new Color('#ad6820').multiplyScalar(.28));
          material.emissiveIntensity = Math.max(highlights.get(material)?.intensity ?? 1, 1);
        }
      }
    });
  }
  function updateVisibility() {
    partMap.forEach(part => { part.group.visible = !isolated || !selectedId || part.definition.id === selectedId; });
  }
  function selectPart(id, { focus = true, toggle = true } = {}) {
    if (disposed || !ready) return;
    const next = partMap.has(id) && !(toggle && selectedId === id) ? id : null;
    selectedId = next;
    separated = false;
    if (!next) isolated = false;
    stopAutoRotate();
    updateVisibility();
    applyTransforms();
    highlightPart();
    if (focus) { if (next) focusPart(next); else fitOverview(); }
    onSelectPart(next);
    publish();
    requestDraw();
  }
  function animationFor(part) {
    const animation = part.definition.animation;
    if (!animation || animation.enabled === false || !['ear', 'tail', 'jaw', 'rotate'].includes(animation.type)) return null;
    return animation;
  }
  function applyTransforms() {
    partMap.forEach(part => {
      const { group, rest, definition } = part;
      group.position.copy(rest.position);
      group.quaternion.copy(rest.quaternion);
      group.scale.copy(rest.scale);
      if (mode === 'explore') {
        const tier = clamp(definition.explodeLevel ?? 1, 1, 3);
        const progress = smooth(clamp(explode - tier + 1, 0, 1));
        const extra = selectedId === definition.id && separated ? 1 : 0;
        const moduleProgress = smooth(clamp(explode - 1, 0, 1));
        const spacing = sourceSize * .38;
        // The head module carries its own ornaments as it moves away from the
        // body. Without this inherited offset, level 2 would move the shell
        // back into the ornaments already separated at level 1.
        if (headParts.has(definition.id)) group.position.addScaledVector(headModuleDirection, moduleProgress * spacing);
        else if (definition.id === 'body' || definition.id === 'body_trim') group.position.addScaledVector(bodyModuleDirection, moduleProgress * spacing);
        if (definition.id !== 'head_shell' && definition.id !== 'body') group.position.addScaledVector(part.explodeDirection, progress * spacing);
        group.position.addScaledVector(part.explodeDirection, extra * .65 * spacing);
      } else {
        const animation = animationFor(part);
        if (!animation || motionIntensity === 0) return;
        const speed = clamp(animation.speed ?? (animation.type === 'ear' ? 2.9 : 1.6), .1, 8);
        const amplitude = clamp(animation.amplitude ?? (animation.type === 'jaw' ? .11 : .065), 0, .3);
        // The lower jaw hinges open in one direction. Ears and tail oscillate
        // around rest; unsupported eyes/head/body are never warped.
        const wave = animation.type === 'jaw' ? (1 - Math.cos(motionTime * speed)) * .5 : Math.sin(motionTime * speed);
        const angle = wave * amplitude * motionIntensity;
        quaternion.setFromAxisAngle(vector(animation.axis, animation.type === 'tail' ? [0, 1, 0] : [1, 0, 0]).normalize(), angle);
        group.quaternion.multiply(quaternion);
      }
    });
    modelGroup.updateMatrixWorld(true);
  }
  function setExplode(value, { animate = true } = {}) {
    if (!ready || disposed) return;
    if (mode !== 'explore') { mode = 'explore'; motionPlaying = false; motionTime = 0; }
    explodeTarget = clamp(value, 0, 3);
    isolated = false;
    separated = false;
    updateVisibility();
    explodeAnimation = { from: explode, to: explodeTarget, elapsed: 0, duration: reducedMotion.matches || !animate ? 0 : .85, fit: true };
    stopAutoRotate();
    // Reserve enough room throughout the transition, rather than letting a
    // selected ornament fly out of a close-up camera.
    const current = explode;
    explode = Math.max(explode, explodeTarget);
    applyTransforms();
    fitOverview();
    explode = current;
    applyTransforms();
    publish();
    requestDraw();
  }
  function playExplode(direction) {
    if (!ready || disposed) return;
    setExplode(direction === 'in' ? 0 : 3);
    explodeAnimation.duration = reducedMotion.matches ? 0 : 4.5;
    explodeAnimation.auto = true;
    publish();
  }
  function setMode(value) {
    if (!ready || disposed) return;
    const next = value === 'motion' ? 'motion' : 'explore';
    if (mode === next) return;
    mode = next;
    explode = explodeTarget = 0;
    explodeAnimation = null;
    motionPlaying = false;
    motionTime = 0;
    isolated = separated = false;
    updateVisibility();
    applyTransforms();
    fitOverview();
    publish();
    requestDraw();
  }
  function resetView() {
    if (!ready || disposed) return;
    selectedId = null;
    isolated = separated = false;
    stopAutoRotate();
    restoreHighlight();
    updateVisibility();
    applyTransforms();
    fitOverview();
    onSelectPart(null);
    publish();
    requestDraw();
  }
  function pickAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickMeshes.filter(mesh => partMap.get(meshParts.get(mesh))?.group.visible), false);
    return hits[0] ? meshParts.get(hits[0].object) : null;
  }
  function onPointerDown(event) {
    if (event.button !== 0 || !isActive) return;
    activePointers.add(event.pointerId);
    if (activePointers.size > 1) multiPointerGesture = true;
    // The stationary finger of a pinch is not a click. Keep the whole touch
    // sequence in gesture mode until every participating pointer is released.
    if (multiPointerGesture) { pointerDown = null; return; }
    pointerDown = { x: event.clientX, y: event.clientY, at: performance.now(), id: event.pointerId };
  }
  function onPointerUp(event) {
    const wasMultiPointerGesture = multiPointerGesture;
    activePointers.delete(event.pointerId);
    if (!activePointers.size) multiPointerGesture = false;
    if (wasMultiPointerGesture) { pointerDown = null; return; }
    if (!pointerDown || pointerDown.id !== event.pointerId) return;
    const start = pointerDown;
    pointerDown = null;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6 || performance.now() - start.at > 650) return;
    selectPart(pickAt(event.clientX, event.clientY));
  }
  function clearPointer() {
    pointerDown = null;
    activePointers.clear();
    multiPointerGesture = false;
  }
  function cancelPointer(event) {
    pointerDown = null;
    activePointers.delete(event.pointerId);
    // If another finger remains, its later release must not become a pick.
    multiPointerGesture = activePointers.size > 0;
  }
  function onControlStart() {
    cameraTween = null;
    stopAutoRotate();
    publish();
    requestDraw();
  }
  function resize() {
    if (disposed || !renderer) return;
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2_600_000 / (width * height)));
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (ready) { if (!selectedId) fitOverview(false); else focusPart(selectedId); }
    requestDraw();
  }
  function projectionFor(part) {
    const group = part.group;
    const rect = renderer.domElement.getBoundingClientRect();
    const position = boundsFor(part.definition.id).getCenter(new Vector3()).project(camera);
    let result = { id: part.definition.id, x: (position.x + 1) * .5 * rect.width, y: (1 - position.y) * .5 * rect.height, visible: group.visible && position.z > -1 && position.z < 1 && Math.abs(position.x) < .96 && Math.abs(position.y) < .94, pickable: false };
    if (!group.visible) return result;
    const candidates = samples.get(part.definition.id) ?? [];
    // A projected bounding-box centre may be empty. Verify source surface
    // samples through the actual Raycaster, and expose the usable one.
    for (const { mesh, position: sample } of candidates) {
      const projected = mesh.localToWorld(sample.clone()).project(camera);
      if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > .94 || Math.abs(projected.y) > .92) continue;
      pointer.set(projected.x, projected.y);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickMeshes.filter(mesh => partMap.get(meshParts.get(mesh))?.group.visible), false)[0];
      if (!hit || meshParts.get(hit.object) !== part.definition.id) continue;
      result = { id: part.definition.id, x: (projected.x + 1) * .5 * rect.width, y: (1 - projected.y) * .5 * rect.height, visible: true, pickable: true };
      break;
    }
    return result;
  }
  function transformError() {
    let error = 0;
    partMap.forEach(({ group, rest }) => {
      error = Math.max(error, group.position.distanceTo(rest.position), 1 - Math.abs(group.quaternion.dot(rest.quaternion)), group.scale.distanceTo(rest.scale));
    });
    return error;
  }
  function getDiagnostics() {
    const highlightedParts = [...partMap].filter(([, part]) => part.meshes.some(mesh =>
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).some(material => {
        const original = highlights.get(material);
        return original?.emissive && material.emissive
          && (!material.emissive.equals(original.emissive) || material.emissiveIntensity !== original.intensity);
      }),
    )).map(([id]) => id);
    const hairDrawn = fullLion && renderer ? fullLion.getDrawStatistics(renderer) : { groups: 0, strands: 0, points: 0 };
    return {
      ready, active: isActive, renderCount, sourceModel: modelUrl,
      selectedPart: selectedId, focusedPart: selectedId ?? 'overall',
      explodeProgress: explode, explodeTarget, transformError: transformError(),
      mode, motionPlaying, motionTime, motionIntensity, isolated, separated,
      cameraDistance: camera.position.distanceTo(controls?.target ?? new Vector3()),
      cameraPosition: camera.position.toArray(), cameraTarget: controls?.target.toArray(),
      cameraLimits: { min: controls?.minDistance, max: controls?.maxDistance, fov: camera.fov },
      viewSettings, partProjections: currentProjections, highlightedParts, hairDrawn,
      partTransforms: [...partMap].map(([id, { group, rest }]) => ({ id, visible: group.visible, position: group.position.toArray(), quaternion: group.quaternion.toArray(), scale: group.scale.toArray(), rest: { position: rest.position.toArray(), quaternion: rest.quaternion.toArray(), scale: rest.scale.toArray() } })),
      hair: fullLion?.statistics,
    };
  }
  function publishDiagnostics() {
    const diagnostics = getDiagnostics();
    const data = renderer.domElement.dataset;
    data.sceneReady = String(ready);
    data.active = String(isActive);
    data.selectedPart = selectedId ?? '';
    data.focusedPart = selectedId ?? 'overall';
    data.explodeProgress = String(explode);
    data.transformError = String(diagnostics.transformError);
    data.motionTime = String(motionTime);
    data.motionPlaying = String(motionPlaying);
    data.motionMode = mode;
    data.renderCount = String(renderCount);
    data.cameraDistance = String(diagnostics.cameraDistance);
    data.cameraLimits = JSON.stringify(diagnostics.cameraLimits);
    data.cameraTarget = JSON.stringify(diagnostics.cameraTarget);
    data.cameraPosition = JSON.stringify(diagnostics.cameraPosition);
    data.viewSettings = JSON.stringify(viewSettings);
    data.partProjections = JSON.stringify(currentProjections);
    data.partTransforms = JSON.stringify(diagnostics.partTransforms);
    data.visibleParts = JSON.stringify(diagnostics.partTransforms.filter(part => part.visible).map(part => part.id));
    data.highlightedParts = JSON.stringify(diagnostics.highlightedParts);
    data.fullHairDrawnGroups = String(diagnostics.hairDrawn.groups);
    data.fullHairDrawnStrands = String(diagnostics.hairDrawn.strands);
    data.fullHairDrawnPoints = String(diagnostics.hairDrawn.points);
  }
  function draw(now) {
    frame = 0;
    if (disposed || !ready || !isActive) return;
    rendering = true;
    const delta = previousTime ? Math.min((now - previousTime) / 1000, .05) : 0;
    previousTime = now;
    let changing = false;
    if (explodeAnimation) {
      explodeAnimation.elapsed += delta;
      const progress = explodeAnimation.duration ? clamp(explodeAnimation.elapsed / explodeAnimation.duration, 0, 1) : 1;
      explode = explodeAnimation.from + (explodeAnimation.to - explodeAnimation.from) * smooth(progress);
      changing = true;
      if (progress === 1) {
        explode = explodeAnimation.to;
        explodeAnimation = null;
        applyTransforms();
        fitOverview();
        publish();
      }
    }
    if (mode === 'motion' && motionPlaying) { motionTime += delta; changing = true; }
    if (changing) applyTransforms();
    if (cameraTween) {
      cameraTween.elapsed += delta;
      const progress = cameraTween.duration ? clamp(cameraTween.elapsed / cameraTween.duration, 0, 1) : 1;
      const eased = smooth(progress);
      camera.position.lerpVectors(cameraTween.from, cameraTween.to, eased);
      controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.target, eased);
      if (progress === 1) cameraTween = null;
      changing = true;
    }
    const cameraChanged = controls.update();
    if (dirty || changing || cameraChanged || controls.autoRotate) {
      renderer.render(scene, camera);
      renderCount += 1;
      dirty = false;
      if (now - lastProjection > 210 || !currentProjections.length || (!changing && !cameraChanged)) {
        currentProjections = [...partMap.values()].map(projectionFor);
        if (labels) onProjectParts(currentProjections);
        lastProjection = now;
      }
      if (now - lastDiagnostics > 160 || (!changing && !cameraChanged)) {
        publishDiagnostics();
        if (explodeAnimation?.auto) publish();
        lastDiagnostics = now;
      }
    }
    rendering = false;
    // A final idle frame may skip rendering after the last tween tick. Commit
    // its final state even when the throttled diagnostic interval has not run.
    if (!changing && !cameraChanged && !controls.autoRotate && !dirty) publishDiagnostics();
    if (!disposed && isActive && (changing || cameraChanged || controls.autoRotate || dirty)) frame = requestAnimationFrame(draw);
  }
  function contextLost(event) {
    event.preventDefault();
    report({ phase: 'error', message: '图形上下文已中断，请重新载入模型' });
    dispose();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    ready = false;
    isActive = false;
    controller.abort();
    clearPointer();
    signal?.removeEventListener('abort', dispose);
    cancelAnimationFrame(frame);
    frame = 0;
    observer?.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', cancelPointer);
    window.removeEventListener('blur', clearPointer);
    renderer?.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer?.domElement.removeEventListener('webglcontextlost', contextLost);
    controls?.removeEventListener('start', onControlStart);
    controls?.removeEventListener('change', requestDraw);
    controls?.dispose();
    lighting?.dispose();
    // The shared lease owns geometry, image textures and instance materials.
    // Do not dispose a borrowed mesh while the action chapter still uses it.
    ownedMaterials.forEach(material => material.dispose());
    ownedMaterials.clear();
    fullLion?.release();
    renderer?.dispose();
    renderer?.forceContextLoss();
    renderer?.domElement.remove();
    if (owners.get(container) === dispose) owners.delete(container);
  }
  owners.set(container, dispose);
  signal?.addEventListener('abort', dispose, { once: true });
  try {
    renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = AgXToneMapping;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute('aria-label', '可交互的醒狮三维模型');
    renderer.domElement.dataset.sourceModel = modelUrl;
    container.appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .085;
    controls.autoRotateSpeed = .55;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('change', requestDraw);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', cancelPointer);
    window.addEventListener('blur', clearPointer);
    window.addEventListener('resize', resize);
    observer = new ResizeObserver(resize);
    observer.observe(container);
    const ambient = new HemisphereLight(0xffeddb, 0x34303f, 2.5);
    const key = new DirectionalLight(0xffeed9, 4.2);
    key.position.set(4, 6, 5);
    const fill = new DirectionalLight(0xc8d8f2, 2.3);
    fill.position.set(-4, 2, 1);
    const rim = new DirectionalLight(0xffba72, 3.4);
    rim.position.set(0, 4, -4);
    scene.add(ambient, key, fill, rim);
    lighting = createLionLightingControls({ renderer, scene, signal: controller.signal, settings: lightingSettings, requestDraw,
      onStatus: status => { renderer.domElement.dataset.lightingState = status.phase; } });
    resize();
    report({ phase: 'loading', message: '正在载入指定醒狮模型' });
    const manifestUrl = media.modelHairKobi;
    fullLion = await acquireFullLion({ modelUrl, manifestUrl, signal: controller.signal,
      resolveAsset: key => media[key] ?? new URL(key, new URL('.', new URL(manifestUrl, window.location.href))).href,
      onStatus: report });
    if (disposed || signal?.aborted) { fullLion.release(); throw abortError(); }
    const source = fullLion.root;
    source.updateMatrixWorld(true);
    const sourceBox = new Box3().setFromObject(source);
    const center = sourceBox.getCenter(new Vector3());
    sourceSize = Math.max(...sourceBox.getSize(new Vector3()).toArray());
    if (!Number.isFinite(sourceSize) || sourceSize <= 0) throw new Error('指定模型没有有效的可见几何');
    normalizedScale = 2.3 / sourceSize;
    modelGroup.scale.setScalar(normalizedScale);
    modelGroup.position.copy(center).multiplyScalar(-normalizedScale);
    modelGroup.add(source);
    source.updateMatrixWorld(true);
    const objects = [];
    source.traverse(object => { if (object.isMesh || object.userData.fullHair) objects.push(object); });
    // Groups share the source coordinate frame. A pivot changes only the
    // decomposition, never the original visible world transform.
    partDefinitions.forEach(definition => {
      const group = new Group();
      group.name = `part:${definition.id}`;
      source.add(group);
      partMap.set(definition.id, { definition, group, meshes: [], rest: null, explodeDirection: vector(definition.direction ?? definition.explodeDirection, [0, 1, 0]) });
    });
    const findDefinition = object => {
      const explicit = object.userData.sourcePart ?? object.userData.partId;
      if (partMap.has(explicit)) return partMap.get(explicit);
      const names = [object.userData.sourceParent, object.userData.name, object.name, object.parent?.userData.name].filter(Boolean);
      return [...partMap.values()].find(({ definition }) => (definition.meshNames ?? definition.objectNames ?? []).some(sourceName => names.some(name => name === sourceName || PropertyBinding.sanitizeNodeName(name) === PropertyBinding.sanitizeNodeName(sourceName))));
    };
    objects.forEach(object => {
      const part = findDefinition(object);
      if (!part) return;
      part.group.attach(object);
      part.meshes.push(object);
      meshParts.set(object, part.definition.id);
      if (object.isMesh && !object.userData.fullHair) {
        if (!object.geometry.boundsTree) computeBoundsTree.call(object.geometry, { indirect: true, maxLeafTris: 12 });
        object.raycast = acceleratedRaycast;
        pickMeshes.push(object);
      }
    });
    const unmatched = objects.filter(object => !meshParts.has(object));
    if (unmatched.length) throw new Error(`模型有${unmatched.length}个未归类可见对象：${unmatched.slice(0, 3).map(object => object.name).join('、')}`);
    for (const [id, part] of partMap) {
      if (!part.meshes.length) { partMap.delete(id); part.group.removeFromParent(); continue; }
      const sourceBounds = boundsFor(id);
      const pivot = part.definition.animation?.pivot;
      const point = pivot ? source.localToWorld(vector(pivot)) : sourceBounds.getCenter(new Vector3());
      const parentPoint = source.worldToLocal(point.clone());
      const children = [...part.group.children];
      children.forEach(child => source.attach(child));
      part.group.position.copy(parentPoint);
      part.group.updateMatrixWorld(true);
      children.forEach(child => part.group.attach(child));
      part.rest = { position: part.group.position.clone(), quaternion: part.group.quaternion.clone(), scale: part.group.scale.clone() };
      const materialCopies = new Map();
      part.meshes.forEach(mesh => {
        if (!mesh.material) return;
        // acquireFullLion clones per instance; several source parts may still
        // share a material. One clone per part prevents selection spillover.
        const clone = material => {
          if (!materialCopies.has(material)) {
            const copy = material.clone();
            copy.onBeforeCompile = material.onBeforeCompile;
            copy.customProgramCacheKey = material.customProgramCacheKey;
            materialCopies.set(material, copy);
            ownedMaterials.add(copy);
            highlights.set(copy, { emissive: copy.emissive?.clone(), color: copy.color?.clone(), intensity: copy.emissiveIntensity });
          }
          return materialCopies.get(material);
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
      });
      const candidates = [];
      for (const mesh of part.meshes) {
        if (!mesh.isMesh || mesh.userData.fullHair) continue;
        const positions = mesh.geometry.attributes.position;
        for (let index = 0; index < Math.min(12, positions.count); index += 1) candidates.push({ mesh, position: new Vector3().fromBufferAttribute(positions, Math.floor(index * (positions.count - 1) / 12)) });
      }
      samples.set(id, candidates);
    }
    if (!partMap.size || !pickMeshes.length) throw new Error('模型尚无可用的真实部件映射');
    lighting.refresh();
    renderer.domElement.dataset.fullHairStrands = String(fullLion.statistics.strands);
    renderer.domElement.dataset.fullHairGroups = String(fullLion.statistics.groups);
    renderer.domElement.dataset.fullHairPoints = String(fullLion.statistics.points);
    ready = true;
    fitOverview(false);
    applyTransforms();
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
    if (disposed || signal?.aborted) throw abortError();
    renderer.render(scene, camera);
    renderCount += 1;
    currentProjections = [...partMap.values()].map(projectionFor);
    onProjectParts(currentProjections);
    publishDiagnostics();
    const animations = [...partMap.values()].filter(animationFor).map(part => ({ id: part.definition.id, name: part.definition.name, type: animationFor(part).type }));
    report({ phase: 'ready', message: `指定模型已就绪 · ${partMap.size}组真实部件`, capabilities: { animations, nativeClips: [] } });
    publish();
    requestDraw();
    return {
      selectPart, resetView, setExplode, playExplode, setMode, getDiagnostics, dispose,
      setActive(value) {
        if (disposed) return;
        isActive = Boolean(value);
        previousTime = 0;
        if (!isActive) { cancelAnimationFrame(frame); frame = 0; clearPointer(); publishDiagnostics(); }
        else { resize(); requestDraw(); }
      },
      setAutoRotate(value) {
        if (disposed) return;
        controls.autoRotate = Boolean(value);
        cameraTween = null;
        onAutoRotateChange(controls.autoRotate);
        publish(); requestDraw();
      },
      setIsolate(value) {
        if (disposed) return;
        isolated = Boolean(value && selectedId);
        updateVisibility(); publish(); requestDraw();
      },
      separateSelected(value) {
        if (disposed || !selectedId || mode !== 'explore') return;
        separated = Boolean(value);
        applyTransforms(); focusPart(selectedId); publish(); requestDraw();
      },
      setMotionPlaying(value) {
        if (disposed || mode !== 'motion') return;
        motionPlaying = Boolean(value);
        previousTime = 0;
        publish(); requestDraw();
      },
      setMotionIntensity(value) {
        if (disposed) return;
        motionIntensity = clamp(value, 0, 1);
        applyTransforms(); publish(); requestDraw();
      },
      resetMotion() {
        if (disposed) return;
        motionTime = 0; motionPlaying = false;
        applyTransforms(); publish(); requestDraw();
      },
      setLabels(value) { labels = Boolean(value); if (labels) onProjectParts(currentProjections); requestDraw(); },
      setLightingSettings(value) {
        if (disposed) return;
        lighting?.update(value);
        const next = resolveViewSettings(value);
        if (JSON.stringify(next) !== JSON.stringify(viewSettings)) {
          viewSettings = next;
          camera.fov = next.structureFov;
          camera.updateProjectionMatrix();
          if (selectedId) focusPart(selectedId); else fitOverview();
        }
        requestDraw();
      },
      retryHdri: () => lighting?.retry(),
    };
  } catch (error) {
    if (error.name !== 'AbortError' && !signal?.aborted) report({ phase: 'error', message: `模型载入失败：${error.message}` });
    dispose();
    throw error;
  }
}
