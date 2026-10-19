import {
  ACESFilmicToneMapping,
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector3,
  Vector2,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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
  geometries.forEach((geometry) => geometry.dispose());
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
  onStatus = () => {},
  onAutoRotateChange = () => {},
  onSelectPart = () => {},
}) {
  if (signal?.aborted || !container.isConnected || !interactionElement?.isConnected) throw aborted();
  activeScenes.get(container)?.();

  const loadController = new AbortController();
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.025, 30);
  camera.position.set(2.7, 1.05, 4);
  let renderer;
  let environmentTarget;
  let maxRenderSize;
  let controls;
  let observer;
  let animationFrame = 0;
  let loadTimeout = 0;
  let disposed = false;
  let modelReady = false;
  let isActive = active;
  let draw;
  let modelScenes = [];
  let viewTween = null;
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
  const pointer = new Vector2();
  const pickMeshes = [];
  const meshParts = new WeakMap();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const initialCameraPosition = new Vector3();
  const initialTarget = new Vector3();

  const report = (status) => {
    if (!disposed && !signal?.aborted) onStatus(status);
  };
  const stopRotation = () => {
    if (disposed) return;
    viewTween = null;
    manuallyAdjusted = true;
    controls.autoRotate = false;
    onAutoRotateChange(false);
  };

  const classifyHit = (hit) => {
    const objectPart = meshParts.get(hit.object);
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
    if (!event.isPrimary) { pointerDown = null; return; }
    if (event.button !== 0) return;
    pointerDown = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
  };
  const onPointerMove = (event) => {
    pointerPosition = { x: event.clientX, y: event.clientY };
    pointerNeedsCheck = true;
    if (pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 6) pointerDown.dragged = true;
  };
  const onPointerUp = (event) => {
    const start = pointerDown;
    pointerDown = null;
    if (!start || start.id !== event.pointerId || start.dragged || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
    const selected = pick(event.clientX, event.clientY);
    if (selected) onSelectPart(selected.id, selected.point);
  };
  const clearPointer = () => {
    pointerDown = null;
    pointerPosition = null;
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
    canvas.dataset.cameraDistance = camera.position.distanceTo(controls.target).toFixed(4);
    canvas.dataset.focusState = viewTween ? 'running' : 'idle';
    canvas.dataset.focusedPart = focusedPart;
    const target = projectClient(controls.target);
    canvas.dataset.targetScreen = JSON.stringify({ x: target.x, y: target.y });
    const signature = [...camera.position.toArray(), ...controls.target.toArray()].map(value => value.toFixed(3)).join(',');
    if (isActive && !viewTween && !controls.autoRotate && signature !== lastPickSignature) {
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
  const resize = () => {
    if (disposed || !renderer) return;
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height) return;
    const canvasBounds = container.getBoundingClientRect();
    const frame = interactionElement.getBoundingClientRect();
    if (!frame.width || !frame.height) return;
    // Frame the lion in the left column while rendering beyond that column.
    // Negative offsets extend its frustum across the page without a nested crop.
    camera.setViewOffset(
      frame.width, frame.height,
      canvasBounds.left - frame.left, canvasBounds.top - frame.top,
      width, height,
    );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2, maxRenderSize / Math.max(width, height)));
    renderer.setSize(width, height, false);
    if (modelReady) fitOverview(focusedPart === 'overall' && !viewTween && !manuallyAdjusted);
    if (modelReady && focusedPart === 'overall' && viewTween) {
      viewTween.toCamera.copy(initialCameraPosition);
      viewTween.toTarget.copy(initialTarget);
    }
    lastPickSignature = '';
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    loadController.abort();
    clearTimeout(loadTimeout);
    if (activeScenes.get(container) === dispose) activeScenes.delete(container);
    window.cancelAnimationFrame(animationFrame);
    observer?.disconnect();
    window.removeEventListener('resize', resize);
    signal?.removeEventListener('abort', dispose);
    controls?.removeEventListener('start', stopRotation);
    interactionElement.removeEventListener('pointerdown', onPointerDown);
    interactionElement.removeEventListener('pointermove', onPointerMove);
    interactionElement.removeEventListener('pointerup', onPointerUp);
    interactionElement.removeEventListener('pointercancel', clearPointer);
    interactionElement.removeEventListener('pointerleave', clearPointer);
    window.removeEventListener('blur', clearPointer);
    interactionElement.style.cursor = '';
    controls?.dispose();
    disposeResources(scene, ...modelScenes);
    scene.environment = null;
    environmentTarget?.dispose();
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
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    // The authored PBR model includes metallic trim. A neutral environment
    // gives those surfaces reflections without adding any visible backdrop.
    const environment = new RoomEnvironment();
    const pmrem = new PMREMGenerator(renderer);
    try {
      environmentTarget = pmrem.fromScene(environment, 0.04);
      scene.environment = environmentTarget.texture;
    } finally {
      environment.dispose();
      pmrem.dispose();
    }
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, interactionElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.42;
    controls.minDistance = 0.32;
    controls.maxDistance = 8;
    controls.target.set(0, 0.08, 0);
    controls.addEventListener('start', stopRotation);
    interactionElement.addEventListener('pointerdown', onPointerDown);
    interactionElement.addEventListener('pointermove', onPointerMove);
    interactionElement.addEventListener('pointerup', onPointerUp);
    interactionElement.addEventListener('pointercancel', clearPointer);
    interactionElement.addEventListener('pointerleave', clearPointer);
    window.addEventListener('blur', clearPointer);
    initialCameraPosition.copy(camera.position);
    initialTarget.copy(controls.target);

    scene.add(new HemisphereLight(0xd5c7a4, 0x0b1513, 1.9));
    const key = new DirectionalLight(0xffe2b2, 3.3);
    key.position.set(-3, 5, 4);
    scene.add(key);
    const rim = new DirectionalLight(0x8eb5a3, 1.8);
    rim.position.set(4, 3, -4);
    scene.add(rim);
    const fill = new PointLight(0xa84431, 5, 7, 2);
    fill.position.set(-2, 1.2, 2.4);
    scene.add(fill);

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
      if (disposed) return;
      try {
        if (viewTween) {
          const elapsed = performance.now() - viewTween.startedAt;
          const progress = viewTween.duration === 0 ? 1 : Math.min(1, elapsed / viewTween.duration);
          const eased = 1 - ((1 - progress) ** 3);
          camera.position.lerpVectors(viewTween.fromCamera, viewTween.toCamera, eased);
          controls.target.lerpVectors(viewTween.fromTarget, viewTween.toTarget, eased);
          if (progress >= 1) viewTween = null;
        }
        controls.update();
        renderer.render(scene, camera);
        const now = performance.now();
        if (modelReady && now - lastDiagnostics >= 160) { updateDiagnostics(); lastDiagnostics = now; }
        if (pointerNeedsCheck && pointerPosition && !pointerDown && now - lastPointerCheck > 100) {
          interactionElement.style.cursor = pick(pointerPosition.x, pointerPosition.y) ? 'pointer' : '';
          lastPointerCheck = now;
          pointerNeedsCheck = false;
        }
        if (isActive) animationFrame = window.requestAnimationFrame(render);
      } catch (error) {
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
    const buffer = await readModel(modelUrl, loadController.signal, report);
    if (disposed || signal?.aborted) throw aborted();
    report({ phase: 'loading', message: '正在解析醒狮模型' });
    const baseUrl = new URL('.', new URL(modelUrl, window.location.href)).href;
    const gltf = await new GLTFLoader().parseAsync(buffer, baseUrl);
    const parsedScenes = gltf.scenes?.length ? gltf.scenes : [gltf.scene];
    if (disposed || signal?.aborted) {
      disposeResources(...parsedScenes);
      throw aborted();
    }
    modelScenes = parsedScenes;

    const model = gltf.scene;
    modelRoot = model;
    model.name = 'Lion_Structure';
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      pickMeshes.push(object);
      const part = hotspots.find((item) => item.objectNames?.some((prefix) => object.name.startsWith(prefix)));
      if (part) meshParts.set(object, part.id);
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
    // Fit the complete new lion into the left interaction area, including its
    // tail and paws. The transparent canvas still extends across the page.
    const fittedBox = new Box3().setFromObject(modelGroup);
    const overviewTarget = fittedBox.getCenter(new Vector3());
    const direction = new Vector3(1.05, 0.48, 2.3).normalize();
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
      initialCameraPosition.copy(overviewTarget).addScaledVector(direction, Math.max(2.2, fitDistance));
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

    return {
      setActive(value) {
        if (disposed || isActive === Boolean(value)) return;
        isActive = Boolean(value);
        cancelAnimationFrame(animationFrame);
        if (!isActive) clearPointer();
        if (isActive) { lastPickSignature = ''; resize(); draw(); }
      },
      setAutoRotate(value) {
        if (!disposed && modelReady) {
          controls.autoRotate = Boolean(value);
          if (value) manuallyAdjusted = true;
        }
      },
      focusOn({ id, target, distance, point }) {
        if (disposed || !modelReady || !Array.isArray(target) || target.length !== 3) return;
        const nextTarget = point ? new Vector3(...point.map(Number)) : modelRoot.localToWorld(new Vector3(...target.map(Number)));
        const nextDistance = Number(distance);
        if (!nextTarget.toArray().every(Number.isFinite) || !Number.isFinite(nextDistance) || nextDistance <= 0) return;

        const part = hotspots.find((item) => item.id === id);
        // Return to a useful viewing side instead of zooming into the back
        // after the visitor has orbited the complete model.
        const direction = new Vector3(...(part?.viewDirection ?? [0.18, 0.12, 1])).normalize();
        const nextCamera = nextTarget.clone().addScaledVector(direction, Math.min(8, Math.max(0.4, nextDistance)));
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
      },
      resetView() {
        if (disposed || !modelReady) return;
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
