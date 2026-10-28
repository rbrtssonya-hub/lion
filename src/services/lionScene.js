import {
  AgXToneMapping,
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector3,
  Vector2,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import { media } from '../config/media.js';
import { acquireFullLion } from './lionFullHair.js';
import { createLionLightingControls } from './lionLightingSettings.js';
import { resolveViewSettings } from '../config/viewSettings.js';

const activeScenes = new WeakMap();

function aborted() {
  return new DOMException('场景已取消载入', 'AbortError');
}

function disposeResources(...roots) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const images = new Set();

  roots.forEach((root) => {
    root.traverse((object) => {
      if (object.userData.sharedLionResources) return;
      if (object.geometry) geometries.add(object.geometry);
      if (object.skeleton?.boneTexture) textures.add(object.skeleton.boneTexture);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      objectMaterials.filter(Boolean).forEach((material) => materials.add(material));
    });
  });
  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value?.isTexture) textures.add(value);
    });
    Object.values(material.uniforms ?? {}).forEach(({ value }) => {
      if (value?.isTexture) textures.add(value);
    });
  });
  textures.forEach((texture) => {
    const textureImages = Array.isArray(texture.image) ? texture.image : [texture.image];
    textureImages.filter(Boolean).forEach((image) => images.add(image));
    texture.dispose();
  });
  images.forEach((image) => image.close?.());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => {
    disposeBoundsTree.call(geometry);
    geometry.dispose();
  });
}

async function readModel(modelUrl, signal, report) {
  const response = await fetch(modelUrl, { signal });
  if (!response.ok) throw new Error(`模型请求失败：HTTP ${response.status}`);
  const total = Number(response.headers.get('content-length'));
  if (!response.body || !total) return response.arrayBuffer();

  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  let lastProgress = -1;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal?.aborted) throw aborted();
      chunks.push(value);
      loaded += value.byteLength;
      const progress = Math.min(100, Math.round((loaded / total) * 100));
      if (progress !== lastProgress) {
        lastProgress = progress;
        report({ phase: 'loading', message: `正在载入醒狮模型 ${progress}%` });
      }
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }

  const buffer = new Uint8Array(loaded);
  let offset = 0;
  chunks.forEach((chunk) => {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return buffer.buffer;
}

/** A single mounted model view owns this scene and its AbortController. */
export async function createLionScene({
  container,
  interactionElement,
  layoutElement,
  modelUrl,
  signal,
  autoRotate = false,
  active = true,
  hotspots = [],
  lightingSettings,
  onLightingStatus = () => {},
  onStatus = () => {},
  onAutoRotateChange = () => {},
  onSelectPart = () => {},
  onProjectParts = () => {},
  atlas,
}) {
  if (signal?.aborted || !container.isConnected || !interactionElement?.isConnected) throw aborted();
  activeScenes.get(container)?.();

  const loadController = new AbortController();
  const scene = new Scene();
  let viewSettings = resolveViewSettings(lightingSettings);
  let overviewDistance = 3;
  let focusDistance = null;
  const camera = new PerspectiveCamera(viewSettings.structureFov, 1, 0.025, 100);
  camera.position.set(2.7, 1.05, 4);
  let renderer;
  let lighting;
  let maxRenderSize;
  let controls;
  const applyCameraLimits = () => {
    if (!controls) return;
    const reference = focusDistance ?? overviewDistance;
    controls.minDistance = reference * viewSettings.structureMinDistanceRatio;
    controls.maxDistance = overviewDistance * viewSettings.structureMaxDistanceRatio;
    renderer.domElement.dataset.viewSettings = JSON.stringify(viewSettings);
    renderer.domElement.dataset.cameraLimits = JSON.stringify({ min: controls.minDistance, max: controls.maxDistance, fov: camera.fov });
  };
  let observer;
  let animationFrame = 0;
  let settlingTimer = 0;
  let interacting = false;
  let rendering = false;
  let needsRender = true;
  let lastCameraChange = 0;
  let loadTimeout = 0;
  let disposed = false;
  let modelReady = false;
  let isActive = active;
  let draw;
  let modelScenes = [];
  let fullLion;
  let viewTween = null;
  let isInteractive = true;
  let savedOverview = null;
  let atlasRegistry = null;
  let modelGroup;
  let modelRoot;
  let pointerDown = null;
  let pointerPosition = null;
  let lastPointerCheck = 0;
  let pointerNeedsCheck = false;
  let lastDiagnostics = 0;
  let lastPickSignature = '';
  let projections = {};
  let fitOverview = () => {};
  let focusedPart = 'overall';
  let manuallyAdjusted = false;
  const raycaster = new Raycaster();
  raycaster.firstHitOnly = true;
  const pointer = new Vector2();
  const pickMeshes = [];
  const meshParts = new WeakMap();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const initialCameraPosition = new Vector3();
  const initialTarget = new Vector3();
  const requestDraw = () => {
    needsRender = true;
    if (!disposed && isActive && modelReady && !animationFrame && !rendering) {
      animationFrame = window.requestAnimationFrame(draw);
    }
  };
  const cancelFlight = () => {
    const previous = viewTween;
    viewTween = null;
    previous?.resolve?.({ completed: false });
    if (controls) controls.enableDamping = true;
  };

  const report = (status) => {
    if (!disposed && !signal?.aborted) onStatus(status);
  };
  const stopRotation = () => {
    if (disposed) return;
    cancelFlight();
    manuallyAdjusted = true;
    controls.autoRotate = false;
    onAutoRotateChange(false);
    interacting = true;
    requestDraw();
  };
  const endInteraction = () => {
    interacting = false;
    requestDraw();
  };
  const onCameraChange = () => {
    lastCameraChange = performance.now();
    requestDraw();
  };

  const classifyHit = (hit) => {
    const objectPart = meshParts.get(hit.object);
    if (atlas) return objectPart ?? null;
    if (objectPart && objectPart !== 'outer_shell') return objectPart;
    // Some visible features share the head shell. These measured surface
    // regions label that surface; they do not claim independent geometry.
    const localPoint = modelRoot.worldToLocal(hit.point.clone()).toArray();
    for (const part of hotspots) {
      if (part.id === 'outer_shell') continue;
      for (const region of part.surfaceRegions ?? []) {
        const distance = localPoint.reduce((sum, value, axis) => (
          sum + ((value - region.center[axis]) / region.radii[axis]) ** 2
        ), 0);
        if (distance <= 1) return part.id;
      }
    }
    return objectPart ?? 'outer_shell';
  };
  const pick = (clientX, clientY) => {
    if (!modelReady || disposed || !isActive) return null;
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(((clientX - bounds.left) / bounds.width) * 2 - 1, -((clientY - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickMeshes, false)[0];
    return hit ? { id: classifyHit(hit), point: hit.point.toArray() } : null;
  };
  const onPointerDown = (event) => {
    if (!isInteractive) return;
    if (!event.isPrimary) { pointerDown = null; return; }
    if (event.button !== 0) return;
    pointerDown = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
  };
  const onPointerMove = (event) => {
    if (!isInteractive) return;
    pointerPosition = { x: event.clientX, y: event.clientY };
    pointerNeedsCheck = true;
    if (pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 6) pointerDown.dragged = true;
    if (!pointerDown) requestDraw();
  };
  const onPointerUp = (event) => {
    if (!isInteractive) return;
    const start = pointerDown;
    pointerDown = null;
    if (!start || start.id !== event.pointerId || start.dragged || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
    const selected = pick(event.clientX, event.clientY);
    if (selected?.id) onSelectPart(selected.id, selected.point);
  };
  const clearPointer = () => {
    pointerDown = null;
    pointerPosition = null;
    pointerNeedsCheck = false;
    interacting = false;
    interactionElement.style.cursor = '';
  };
  const projectClient = (point) => {
    const projected = point.clone().project(camera);
    const bounds = renderer.domElement.getBoundingClientRect();
    return { x: bounds.left + (projected.x + 1) * bounds.width / 2, y: bounds.top + (1 - projected.y) * bounds.height / 2,
      visible: projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 };
  };
  const updateDiagnostics = () => {
    // Read-only observations of the rendered camera and actual pickable surface.
    // They also make browser regression checks independent of React's state.
    const canvas = renderer.domElement;
    const hairDraws = fullLion?.getDrawStatistics(renderer);
    canvas.dataset.fullHairDrawnGroups = String(hairDraws?.groups ?? 0);
    canvas.dataset.fullHairDrawnStrands = String(hairDraws?.strands ?? 0);
    canvas.dataset.fullHairDrawnPoints = String(hairDraws?.points ?? 0);
    canvas.dataset.renderLines = String(renderer.info.render.lines);
    canvas.dataset.cameraDistance = camera.position.distanceTo(controls.target).toFixed(4);
    canvas.dataset.focusState = viewTween ? 'running' : 'idle';
    canvas.dataset.focusedPart = focusedPart;
    const target = projectClient(controls.target);
    canvas.dataset.targetScreen = JSON.stringify({ x: target.x, y: target.y });
    const signature = [...camera.position.toArray(), ...controls.target.toArray()].map(value => value.toFixed(3)).join(',');
    // Actual-surface observations are only needed after the view has settled.
    if (isActive && !interacting && !pointerDown && !viewTween && !controls.autoRotate
        && performance.now() - lastCameraChange > 140 && signature !== lastPickSignature) {
      lastPickSignature = signature;
      projections = {};
      hotspots.forEach((part) => {
        const candidates = part.pickPoints ?? [part.focusTarget];
        for (const candidate of candidates) {
          if (!candidate) continue;
          const projected = projectClient(modelRoot.localToWorld(new Vector3(...candidate)));
          const hit = projected.visible ? pick(projected.x, projected.y) : null;
          projections[part.id] = { ...projected, visible: hit?.id === part.id };
          if (projections[part.id].visible) break;
        }
      });
    }
    canvas.dataset.partProjections = JSON.stringify(projections);
  };
  const updatePartAnchors = () => {
    const frame = interactionElement.getBoundingClientRect();
    onProjectParts(hotspots.map((part) => {
      const point = projectClient(modelRoot.localToWorld(new Vector3(...part.focusTarget)));
      return { id: part.id, x: point.x - frame.left, y: point.y - frame.top,
        visible: point.visible && point.x >= frame.left && point.x <= frame.right
          && point.y >= frame.top && point.y <= frame.bottom };
    }));
  };
  const resize = () => {
    if (disposed || !renderer) return;
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height) return;
    const canvasBounds = container.getBoundingClientRect();
    const frame = interactionElement.getBoundingClientRect();
    if (!frame.width || !frame.height) return;
    // Frame the lion in the left column while rendering beyond that column.
    // Negative offsets extend its frustum across the page without a nested crop.
    if (atlas) {
      // Register the complete generated picture with the same central 3:2
      // camera aperture used by the external experiment. The page owns the
      // host's origin below its secondary navigation.
      const candidate = Number(atlas.getReferenceAspect?.());
      const referenceAspect = Number.isFinite(candidate) && candidate > 0 ? candidate : 1720 / 914;
      const pictureHeight = Math.min(height, width / referenceAspect);
      const apertureWidth = pictureHeight * 1.5;
      camera.setViewOffset(apertureWidth, pictureHeight,
        -(width - apertureWidth) / 2, -(height - pictureHeight) / 2, width, height);
    } else {
      camera.setViewOffset(
        frame.width, frame.height,
        canvasBounds.left - frame.left, canvasBounds.top - frame.top,
        width, height,
      );
    }
    const pixelBudget = Math.sqrt(2_600_000 / (width * height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5, pixelBudget, maxRenderSize / Math.max(width, height)));
    renderer.setSize(width, height, false);
    if (modelReady) fitOverview(focusedPart === 'overall' && !viewTween && !manuallyAdjusted);
    if (!atlas && modelReady && focusedPart === 'overall' && viewTween) {
      viewTween.toCamera.copy(initialCameraPosition);
      viewTween.toTarget.copy(initialTarget);
    }
    lastPickSignature = '';
    requestDraw();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelFlight();
    loadController.abort();
    clearTimeout(loadTimeout);
    clearTimeout(settlingTimer);
    if (activeScenes.get(container) === dispose) activeScenes.delete(container);
    window.cancelAnimationFrame(animationFrame);
    observer?.disconnect();
    window.removeEventListener('resize', resize);
    signal?.removeEventListener('abort', dispose);
    controls?.removeEventListener('start', stopRotation);
    controls?.removeEventListener('end', endInteraction);
    controls?.removeEventListener('change', onCameraChange);
    interactionElement.removeEventListener('pointerdown', onPointerDown);
    interactionElement.removeEventListener('pointermove', onPointerMove);
    interactionElement.removeEventListener('pointerup', onPointerUp);
    interactionElement.removeEventListener('pointercancel', clearPointer);
    interactionElement.removeEventListener('pointerleave', clearPointer);
    window.removeEventListener('blur', clearPointer);
    interactionElement.style.cursor = '';
    controls?.dispose();
    lighting?.dispose();
    fullLion?.release();
    fullLion = null;
    disposeResources(scene, ...modelScenes);
    scene.environment = null;
    modelScenes = [];
    scene.clear();
    if (renderer) {
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    }
  };
  const onContextLost = (event) => {
    event.preventDefault();
    report({ phase: 'error', message: '3D 显示已中断 · 保留结构预览' });
    dispose();
  };
  activeScenes.set(container, dispose);

  try {
    // Let browsers try their available WebGL implementation, including software rendering.
    renderer = new WebGLRenderer({ antialias: true, alpha: true });
    // Composite the lion directly over the page's shared background.
    renderer.setClearColor(0x000000, 0);
    const context = renderer.getContext();
    maxRenderSize = context.getParameter(context.MAX_RENDERBUFFER_SIZE);
    renderer.outputColorSpace = SRGBColorSpace;
    // Use the source's AgX tone-mapping family without changing materials;
    // Three.js and Blender's OCIO transforms are not pixel-identical.
    renderer.toneMapping = AgXToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, interactionElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.42;
    applyCameraLimits();
    controls.target.set(0, 0.08, 0);
    controls.addEventListener('start', stopRotation);
    controls.addEventListener('end', endInteraction);
    controls.addEventListener('change', onCameraChange);
    interactionElement.addEventListener('pointerdown', onPointerDown);
    interactionElement.addEventListener('pointermove', onPointerMove);
    interactionElement.addEventListener('pointerup', onPointerUp);
    interactionElement.addEventListener('pointercancel', clearPointer);
    interactionElement.addEventListener('pointerleave', clearPointer);
    window.addEventListener('blur', clearPointer);
    initialCameraPosition.copy(camera.position);
    initialTarget.copy(controls.target);

    scene.add(new HemisphereLight(0xffffff, 0xb0a496, 0.35));
    const key = new DirectionalLight(0xfff4e8, 1.6);
    key.position.set(-2.2, 3.1, 3.2);
    scene.add(key);
    // The source studio includes a lower opposite-side fill. Keep the same
    // warm key / neutral fill balance while allowing inspection from below.
    const fill = new DirectionalLight(0xeaf2ff, 0.9);
    fill.position.set(2.8, 1.8, 1.5);
    scene.add(fill);
    const rim = new DirectionalLight(0xfff0df, 0.65);
    rim.position.set(0.5, 2.8, -2.1);
    scene.add(rim);
    lighting = createLionLightingControls({
      renderer, scene, signal: loadController.signal, settings: lightingSettings,
      onStatus: onLightingStatus, requestDraw,
    });

    signal?.addEventListener('abort', dispose, { once: true });
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(resize);
      observer.observe(container);
      observer.observe(interactionElement);
      if (layoutElement) observer.observe(layoutElement);
    } else {
      window.addEventListener('resize', resize);
    }
    resize();

    const render = () => {
      animationFrame = 0;
      if (disposed) return;
      try {
        rendering = true;
        needsRender = false;
        if (viewTween) {
          const elapsed = performance.now() - viewTween.startedAt;
          const progress = viewTween.duration === 0 ? 1 : Math.min(1, elapsed / viewTween.duration);
          const eased = viewTween.orbit
            ? (progress < .5 ? 4 * progress ** 3 : 1 - ((-2 * progress + 2) ** 3) / 2)
            : 1 - ((1 - progress) ** 3);
          controls.target.lerpVectors(viewTween.fromTarget, viewTween.toTarget, eased);
          if (viewTween.orbit) {
            const { fromDirection, rotation, fromRadius, toRadius } = viewTween.orbit;
            const turn = new Quaternion().slerpQuaternions(new Quaternion(), rotation, eased);
            const direction = fromDirection.clone().applyQuaternion(turn);
            const radius = fromRadius + (toRadius - fromRadius) * eased
              + Math.sin(Math.PI * eased) * Math.max(fromRadius, toRadius) * .10;
            camera.position.copy(controls.target).addScaledVector(direction, radius);
          } else camera.position.lerpVectors(viewTween.fromCamera, viewTween.toCamera, eased);
          if (progress >= 1) {
            const finished = viewTween;
            viewTween = null;
            controls.enableDamping = true;
            finished.resolve?.({ completed: true });
          }
        }
        const cameraChanged = controls.update();
        renderer.render(scene, camera);
        const now = performance.now();
        if (modelReady) updatePartAnchors();
        if (modelReady && (now - lastDiagnostics >= 160 || (!cameraChanged && !viewTween))) { updateDiagnostics(); lastDiagnostics = now; }
        if (isInteractive && pointerNeedsCheck && pointerPosition && !pointerDown && !interacting && !viewTween
            && now - lastCameraChange > 100 && now - lastPointerCheck > 100) {
          interactionElement.style.cursor = pick(pointerPosition.x, pointerPosition.y) ? 'pointer' : '';
          lastPointerCheck = now;
          pointerNeedsCheck = false;
        }
        rendering = false;
        if (isActive && (viewTween || controls.autoRotate || cameraChanged || needsRender)) {
          animationFrame = window.requestAnimationFrame(render);
        } else if (isActive && modelReady) {
          // One settled frame refreshes hover and surface observations. A static
          // model then uses no animation frames or GPU draws until new input.
          clearTimeout(settlingTimer);
          const signature = [...camera.position.toArray(), ...controls.target.toArray()].map(value => value.toFixed(3)).join(',');
          if (lastPickSignature !== signature || pointerNeedsCheck) settlingTimer = setTimeout(requestDraw, 170);
        }
      } catch (error) {
        rendering = false;
        report({ phase: 'error', message: '3D 显示暂不可用 · 保留结构预览' });
        console.error('醒狮模型渲染失败', error);
        dispose();
      }
    };
    draw = render;

    report({ phase: 'loading', message: '正在载入醒狮模型' });
    loadTimeout = setTimeout(() => {
      report({ phase: 'error', message: '模型准备超时 · 保留结构预览，可重新载入' });
      dispose();
    }, 45_000);
    const loadedLion = await acquireFullLion({
      modelUrl,
      manifestUrl: media.modelHair,
      resolveAsset: key => media[key],
      signal: loadController.signal,
      onStatus: report,
      readModel: sharedSignal => readModel(modelUrl, sharedSignal, report),
    });
    if (disposed || signal?.aborted) {
      loadedLion.release();
      throw aborted();
    }
    fullLion = loadedLion;
    renderer.domElement.dataset.fullHairStrands = String(fullLion.statistics.strands);
    renderer.domElement.dataset.fullHairGroups = String(fullLion.statistics.groups);
    renderer.domElement.dataset.fullHairPoints = String(fullLion.statistics.points);
    renderer.domElement.dataset.sourceModel = fullLion.statistics.sourceModel;
    const model = fullLion.root;
    modelRoot = model;
    model.name = 'Lion_Structure';
    model.traverse((object) => {
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
        if (material && 'envMapIntensity' in material) material.envMapIntensity = 0.65;
      }
      if (!object.isMesh || object.userData.fullHair) return;
      object.castShadow = true;
      object.receiveShadow = true;
      // Acceleration is instance-local; other Three.js features are unaffected.
      // Indirect mode also preserves the authored index / material group order.
      if (!object.geometry.boundsTree) computeBoundsTree.call(object.geometry, { indirect: true, maxLeafTris: 12 });
      object.raycast = acceleratedRaycast;
      pickMeshes.push(object);
      const part = atlas
        ? atlas.parts.find(item => item.matches(object))
        : hotspots.find((item) => item.objectNames?.some((prefix) => object.name.startsWith(prefix)));
      if (part) meshParts.set(object, part.id);
      else if (atlas?.headAlias?.test(object.name)) meshParts.set(object, 'brows');
    });
    const box = new Box3().setFromObject(model);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(maxSize) || maxSize <= 0) {
      throw new Error('模型没有可显示的几何结构');
    }
    model.position.sub(center);
    modelGroup = new Group();
    modelGroup.add(model);
    // Keep the complete lion inside the interactive viewport.
    // Focus views can still move closer through the camera API.
    modelGroup.scale.setScalar(1.78 / maxSize);
    modelGroup.position.y = -0.066;
    scene.add(modelGroup);
    modelGroup.updateMatrixWorld(true);
    if (atlas) {
      const parts = new Map();
      for (const definition of atlas.parts) {
        const meshes = pickMeshes.filter(mesh => definition.matches(mesh));
        const bounds = new Box3();
        meshes.forEach(mesh => bounds.union(new Box3().setFromObject(mesh)));
        const framingBounds = definition.referenceBounds
          ? new Box3(new Vector3(...definition.referenceBounds.min), new Vector3(...definition.referenceBounds.max)).applyMatrix4(modelRoot.matrixWorld)
          : bounds;
        if (!bounds.isEmpty()) parts.set(definition.id, {
          id: definition.id, meshes, bounds, framingBounds,
          center: bounds.getCenter(new Vector3()), size: bounds.getSize(new Vector3()),
        });
      }
      atlasRegistry = { get: id => parts.get(id), all: () => [...parts.values()] };
    }
    lighting.refresh();
    // A missing environment is reported separately and can be retried without
    // discarding the complete model or its camera/selection state.
    await lighting.ready.catch(error => { if (error.name === 'AbortError') throw error; });
    if (disposed || signal?.aborted) throw aborted();
    // Fit the complete new lion into the left interaction area, including its
    // tail and paws. The transparent canvas still extends across the page.
    const fittedBox = new Box3().setFromObject(modelGroup);
    const overviewTarget = fittedBox.getCenter(new Vector3());
    const direction = atlas ? new Vector3(5, 2.7, 7).normalize() : new Vector3(1.05, 0.48, 2.3).normalize();
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize();
    const up = new Vector3().crossVectors(direction, right).normalize();
    const fitPoints = [];
    pickMeshes.forEach((mesh) => {
      const position = mesh.geometry.attributes.position;
      const step = Math.max(1, Math.floor(position.count / 400));
      for (let index = 0; index < position.count; index += step) {
        fitPoints.push(mesh.localToWorld(new Vector3().fromBufferAttribute(position, index)).sub(overviewTarget));
      }
    });
    // Instanced hair positions live in strand attributes. Include each complete
    // group bound in the overview fit instead of reading its template vertices.
    model.traverse(object => {
      if (!object.userData.fullHair) return;
      const { min, max } = object.geometry.boundingBox;
      for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
        fitPoints.push(object.localToWorld(new Vector3(x, y, z)).sub(overviewTarget));
      }
    });
    fitOverview = (apply = true) => {
      const frame = interactionElement.getBoundingClientRect();
      const verticalTan = Math.tan(camera.fov * Math.PI / 360);
      const horizontalTan = verticalTan * frame.width / frame.height;
      let fitDistance = 0;
      fitPoints.forEach((relative) => {
        fitDistance = Math.max(fitDistance,
          relative.dot(direction) + Math.abs(relative.dot(up)) / (verticalTan * 0.86),
          relative.dot(direction) + Math.abs(relative.dot(right)) / (horizontalTan * 0.86));
      });
      // The atlas scales its editorial camera poses into this scene's existing
      // 1.78-unit model. It never rescales meshes or alters rendering materials.
      const distance = atlas
        ? Math.max(size.x, size.y, size.z) * modelGroup.scale.x / (2 * verticalTan) * .99
        : Math.max(2.2, fitDistance);
      initialCameraPosition.copy(overviewTarget).addScaledVector(direction, distance);
      overviewDistance = initialCameraPosition.distanceTo(overviewTarget);
      applyCameraLimits();
      initialTarget.copy(overviewTarget);
      if (apply) {
        camera.position.copy(initialCameraPosition);
        controls.target.copy(initialTarget);
      }
    };
    fitOverview();
    modelReady = true;
    controls.update();
    // Compile on the renderer that remains mounted for later chapter visits.
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
    if (disposed || signal?.aborted) throw aborted();
    render();
    if (disposed) throw new Error('WebGL 渲染失败');
    clearTimeout(loadTimeout);
    report({ phase: 'ready', message: '模型已载入 · 可交互' });

    const flyCameraTo = (position, target, { duration = 2.2 } = {}) => {
      cancelFlight();
      if (disposed || !modelReady) return Promise.resolve({ completed: false });
      controls.autoRotate = false;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = false;
      const fromVector = camera.position.clone().sub(controls.target);
      const toVector = position.clone().sub(target);
      // Editorial camera endpoints are not manual zooms. Avoid clamping close
      // part poses to the overview's saved interaction range during the flight.
      focusDistance = toVector.length();
      applyCameraLimits();
      return new Promise(resolve => {
        viewTween = {
          fromCamera: camera.position.clone(), fromTarget: controls.target.clone(),
          toCamera: position.clone(), toTarget: target.clone(),
          startedAt: performance.now(), duration: reducedMotion.matches ? 0 : Math.max(0, duration * 1000),
          resolve,
          orbit: {
            fromDirection: fromVector.clone().normalize(),
            rotation: new Quaternion().setFromUnitVectors(fromVector.clone().normalize(), toVector.clone().normalize()),
            fromRadius: fromVector.length(), toRadius: toVector.length(),
          },
        };
        isActive = true;
        requestDraw();
      });
    };
    const getPartPose = id => {
      const part = atlasRegistry?.get(id), framing = atlas?.framings[id];
      if (!part || !framing) return null;
      const bounds = part.framingBounds ?? part.bounds;
      const size = bounds.getSize(new Vector3());
      const target = bounds.getCenter(new Vector3()).add(new Vector3(...framing.offset).multiply(size));
      const distance = Math.max(size.x, size.y, size.z, .65 * 1.78 / 5.2)
        / (2 * Math.tan(camera.fov * Math.PI / 360)) * framing.distanceFactor;
      const position = target.clone().addScaledVector(new Vector3(...framing.direction).normalize(), distance);
      return { id, position, target };
    };

    return {
      registry: atlasRegistry,
      cancelFlight,
      resize,
      getCameraPose: () => ({ position: camera.position.toArray(), target: controls.target.toArray(), fov: camera.fov, aspect: camera.aspect, selected: focusedPart }),
      getPartPose(id) {
        const pose = getPartPose(id);
        return pose && { ...pose, position: pose.position.toArray(), target: pose.target.toArray() };
      },
      setInteractive(value) {
        if (disposed) return;
        isInteractive = Boolean(value);
        controls.enabled = isInteractive;
        controls.autoRotate = false;
        clearPointer();
      },
      flyToPart(id, options) {
        const pose = getPartPose(id);
        if (!pose) return Promise.resolve({ completed: false });
        if (focusedPart === 'overall' && !savedOverview) savedOverview = {
          position: camera.position.clone(), target: controls.target.clone(),
        };
        focusedPart = id;
        manuallyAdjusted = false;
        return flyCameraTo(pose.position, pose.target, options);
      },
      restoreOverview(options) {
        const pose = savedOverview ?? { position: initialCameraPosition, target: initialTarget };
        focusedPart = 'overall';
        manuallyAdjusted = false;
        return flyCameraTo(pose.position, pose.target, options).then(result => {
          if (result.completed) { savedOverview = null; focusDistance = null; applyCameraLimits(); }
          return result;
        });
      },
      setLightingSettings(value) {
        if (disposed) return;
        lighting?.update(value);
        const next = resolveViewSettings(value);
        if (JSON.stringify(next) === JSON.stringify(viewSettings)) return;
        viewSettings = next;
        if (!atlas) cancelFlight();
        camera.fov = next.structureFov;
        camera.updateProjectionMatrix();
        fitOverview(false);
        if (atlas) {
          const pose = focusedPart === 'overall'
            ? (savedOverview ?? { position: initialCameraPosition, target: initialTarget })
            : getPartPose(focusedPart);
          if (viewTween && pose) {
            // A settings preview may change FOV while React is awaiting this
            // flight. Keep its resolver alive and update its registered end.
            viewTween.toCamera.copy(pose.position);
            viewTween.toTarget.copy(pose.target);
            if (viewTween.orbit) {
              const end = pose.position.clone().sub(pose.target);
              viewTween.orbit.rotation.setFromUnitVectors(viewTween.orbit.fromDirection, end.clone().normalize());
              viewTween.orbit.toRadius = end.length();
            }
          } else if (pose && focusedPart !== 'overall') {
            camera.position.copy(pose.position);
            controls.target.copy(pose.target);
          }
          if (pose && focusedPart !== 'overall') {
            focusDistance = pose.position.distanceTo(pose.target);
            applyCameraLimits();
          }
        }
        controls.update();
        requestDraw();
      },
      retryHdri: () => lighting?.retry(),
      setActive(value) {
        if (disposed || isActive === Boolean(value)) return;
        isActive = Boolean(value);
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        clearTimeout(settlingTimer);
        if (!isActive) clearPointer();
        if (isActive) { lastPickSignature = ''; resize(); requestDraw(); }
      },
      setAutoRotate(value) {
        if (!disposed && modelReady) {
          controls.autoRotate = Boolean(value);
          if (value) manuallyAdjusted = true;
          requestDraw();
        }
      },
      focusOn({ id, target, distance, point }) {
        if (disposed || !modelReady || !Array.isArray(target) || target.length !== 3) return;
        const nextTarget = point ? new Vector3(...point.map(Number)) : modelRoot.localToWorld(new Vector3(...target.map(Number)));
        const nextDistance = Number(distance);
        if (!nextTarget.toArray().every(Number.isFinite) || !Number.isFinite(nextDistance) || nextDistance <= 0) return;
        cancelFlight();
        focusDistance = Math.min(8, Math.max(0.4, nextDistance));
        applyCameraLimits();

        const part = hotspots.find((item) => item.id === id);
        // Return to a useful viewing side instead of zooming into the back
        // after the visitor has orbited the complete model.
        const direction = new Vector3(...(part?.viewDirection ?? [0.18, 0.12, 1])).normalize();
        const nextCamera = nextTarget.clone().addScaledVector(direction, Math.min(controls.maxDistance, Math.max(controls.minDistance, focusDistance)));
        controls.enableDamping = false;
        controls.update();
        controls.enableDamping = true;
        controls.autoRotate = false;
        manuallyAdjusted = false;
        focusedPart = id ?? 'part';
        onAutoRotateChange(false);
        viewTween = {
          fromCamera: camera.position.clone(),
          fromTarget: controls.target.clone(),
          toCamera: nextCamera,
          toTarget: nextTarget,
          startedAt: performance.now(),
          duration: reducedMotion.matches ? 0 : 720,
        };
        requestDraw();
      },
      resetView() {
        if (disposed || !modelReady) return;
        cancelFlight();
        savedOverview = null;
        focusDistance = null;
        fitOverview(false);
        controls.autoRotate = false;
        onAutoRotateChange(false);
        focusedPart = 'overall';
        manuallyAdjusted = false;
        controls.enableDamping = false;
        controls.update();
        controls.enableDamping = true;
        viewTween = {
          fromCamera: camera.position.clone(),
          fromTarget: controls.target.clone(),
          toCamera: initialCameraPosition.clone(),
          toTarget: initialTarget.clone(),
          startedAt: performance.now(),
          duration: reducedMotion.matches ? 0 : 620,
        };
        requestDraw();
      },
      dispose,
    };
  } catch (error) {
    if (!signal?.aborted && error.name !== 'AbortError') {
      report({ phase: 'error', message: '模型载入失败 · 保留结构预览' });
    }
    dispose();
    throw error;
  }
}
