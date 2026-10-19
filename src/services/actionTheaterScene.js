import {
  ACESFilmicToneMapping,
  Box3,
  CanvasTexture,
  Color,
  DirectionalLight,
  HemisphereLight,
  LinearFilter,
  MeshBasicMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SpotLight,
  SRGBColorSpace,
  Vector2,
  Vector3,
  VideoTexture,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { chooseScreen, constrainOrbit, containedVideoScale, shortestAngle, THEATER_ORBIT } from './actionTheaterMath.js';
import { createTheaterArchitecture } from './actionTheaterArchitecture.js';
import { createTheaterReflection } from './actionTheaterReflection.js';

const mountedScenes = new WeakMap();
const ROTATION_SPEED = Math.PI * 2 / 36;
const TRANSITION_MS = 450;

// Cold context/PMREM/shader preparation must not interrupt the shared header's
// title/helper flight. Observe its actual lifecycle, including interruptions,
// rather than assuming a fixed navigation duration. Unmount cancels the wait.
function waitForHeaderMotion(signal) {
  return new Promise(resolve => {
    let frame = 0;
    let observer;
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      cancelAnimationFrame(frame);
      frame = 0;
      observer?.disconnect();
      signal.removeEventListener('abort', abort);
      resolve(value);
    };
    const abort = () => finish(false);
    const check = () => {
      if (settled) return;
      cancelAnimationFrame(frame);
      frame = 0;
      if (signal.aborted) { finish(false); return; }
      const header = document.querySelector('.site-header');
      if (header?.dataset.navAnimating === 'true') {
        observer ??= new MutationObserver(check);
        observer.observe(header, { attributes: true, attributeFilter: ['data-nav-animating'] });
      } else {
        frame = requestAnimationFrame(() => {
          if (header?.dataset.navAnimating === 'true') check();
          else finish(true);
        });
      }
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { finish(false); return; }
    // React's layout effects establish the current header flight before heavy
    // scene preparation. A direct action URL proceeds after these paint frames.
    frame = requestAnimationFrame(() => { frame = requestAnimationFrame(check); });
  });
}

// Project each mesh's local bounds, rather than a single world AABB whose
// empty corners would overstate a rotating lion's visible height.
function projectedBounds(root, camera, { vertices = false } = {}) {
  const point = new Vector3();
  const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  let inFront = false;
  const add = () => {
    point.project(camera);
    if (point.z <= -1 || point.z >= 1) return;
    inFront = true;
    bounds.left = Math.min(bounds.left, (point.x + 1) / 2);
    bounds.right = Math.max(bounds.right, (point.x + 1) / 2);
    bounds.top = Math.min(bounds.top, (1 - point.y) / 2);
    bounds.bottom = Math.max(bounds.bottom, (1 - point.y) / 2);
  };
  root.traverseVisible(object => {
    if (!object.geometry || object.isInstancedMesh) return;
    const { geometry } = object;
    if (vertices) {
      const position = geometry.attributes.position;
      for (let i = 0; i < position.count; i += 1) { point.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld); add(); }
    } else {
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const { min, max } = geometry.boundingBox;
      for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
        point.set(x, y, z).applyMatrix4(object.matrixWorld); add();
      }
    }
  });
  return { ...bounds, inFront, visible: inFront && bounds.right > 0 && bounds.left < 1 && bounds.bottom > 0 && bounds.top < 1, widthRatio: bounds.right - bounds.left, heightRatio: bounds.bottom - bounds.top };
}

// Three r160's VideoTexture creates a recurring video-frame callback without
// retaining its cancellation handle. Start it without a video, then own the
// real callback so leaving the chapter releases every decoder callback.
class OwnedVideoTexture extends VideoTexture {
  constructor(video) {
    super({ readyState: 0 });
    this.image = video;
    this.colorSpace = SRGBColorSpace;
    this.flipY = false; // The screen's authored glTF UVs already use top-left V.
    this.minFilter = LinearFilter;
    this.magFilter = LinearFilter;
    this.videoFrame = null;
    this.closed = false;
    this.lastTime = -1;
    this.needsUpdate = true;
    this.receiveFrame = () => {
      if (this.closed) return;
      this.needsUpdate = true;
      this.videoFrame = video.requestVideoFrameCallback(this.receiveFrame);
    };
    if (typeof video.requestVideoFrameCallback === 'function') {
      this.videoFrame = video.requestVideoFrameCallback(this.receiveFrame);
    }
  }

  update() {
    const video = this.image;
    if (!this.closed && this.videoFrame === null && video.readyState >= 2 && video.currentTime !== this.lastTime) {
      this.lastTime = video.currentTime;
      this.needsUpdate = true;
    }
  }

  dispose() {
    if (this.closed) return;
    this.closed = true;
    if (this.videoFrame !== null) this.image.cancelVideoFrameCallback?.(this.videoFrame);
    this.videoFrame = null;
    super.dispose();
  }
}

function releaseResources(roots, extraMaterials = [], extraTextures = []) {
  const geometries = new Set();
  const materials = new Set(extraMaterials);
  const textures = new Set(extraTextures);
  const images = new Set();
  roots.filter(Boolean).forEach((root) => root.traverse((object) => {
    if (object.isInstancedMesh) object.dispose();
    if (object.geometry) geometries.add(object.geometry);
    if (object.skeleton?.boneTexture) textures.add(object.skeleton.boneTexture);
    (Array.isArray(object.material) ? object.material : [object.material]).filter(Boolean).forEach((material) => materials.add(material));
  }));
  materials.forEach((material) => {
    Object.values(material).filter((value) => value?.isTexture).forEach((texture) => textures.add(texture));
  });
  textures.forEach((texture) => {
    (Array.isArray(texture.image) ? texture.image : [texture.image]).filter(Boolean).forEach((image) => images.add(image));
    texture.dispose();
  });
  images.forEach((image) => image.close?.());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

function makePlaceholder(title) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 576;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#130e0b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#62503b';
  ctx.lineWidth = 1;
  ctx.strokeRect(28, 28, 968, 520);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d4bd96';
  ctx.font = '48px serif';
  ctx.fillText(title || '醒狮动作', 512, 272);
  ctx.fillStyle = '#9a8c77';
  ctx.font = '24px serif';
  ctx.fillText('视频尚未就绪', 512, 326);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false;
  return texture;
}

function makeScreenMaterial(texture, contain) {
  const material = new MeshBasicMaterial({ map: texture, color: 0xffffff, toneMapped: false });
  material.name = 'Theater_Video_Contained';
  // Contain, rather than cropping/stretching, clips outside the fitted video
  // rectangle to black while keeping Three's standard sRGB video decoding.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.theaterVideoScale = { value: contain };
    shader.fragmentShader = `uniform vec2 theaterVideoScale;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec2 theaterUv = (vMapUv - 0.5) / theaterVideoScale + 0.5;
        vec4 sampledDiffuseColor = texture2D(map, clamp(theaterUv, 0.0, 1.0));
        #ifdef DECODE_VIDEO_TEXTURE
          sampledDiffuseColor.rgb = mix(pow(sampledDiffuseColor.rgb * 0.9478672986 + vec3(0.0521327014), vec3(2.4)), sampledDiffuseColor.rgb * 0.0773993808, vec3(lessThanEqual(sampledDiffuseColor.rgb, vec3(0.04045))));
        #endif
        float theaterInside = step(0.0, theaterUv.x) * step(theaterUv.x, 1.0) * step(0.0, theaterUv.y) * step(theaterUv.y, 1.0);
        diffuseColor *= vec4(sampledDiffuseColor.rgb * theaterInside, sampledDiffuseColor.a);
      #endif
    `);
  };
  material.customProgramCacheKey = () => 'theater-contained-video-v1';
  return material;
}

/** Owns one renderer, one RAF, and all room/model resources for this mount. */
export function createActionTheater({
  container,
  modelUrl,
  screenDefinitions,
  onActiveScreen = () => {},
  onReady = () => {},
  onError = () => {},
  onAnchorUpdate = () => {},
}) {
  mountedScenes.get(container)?.();
  const loadController = new AbortController();
  const scene = new Scene();
  scene.background = new Color('#080605');
  const camera = new PerspectiveCamera(56, 1, 0.12, 45);
  camera.position.set(0, 1.6, 8.6);
  const orbitTarget = new Vector3(...THEATER_ORBIT.target);
  const screenRecords = new Map();
  const pendingVideos = new Map();
  const replacedMaterials = new Set();
  const projectedAnchor = new Vector3();
  const forward = new Vector3();
  const activeScenes = [];
  let renderer;
  let controls;
  let observer;
  let environmentTarget;
  let lionRoot;
  let architecture;
  let reflection;
  let animationFrame = 0;
  let loadTimeout = 0;
  let disposed = false;
  let failed = false;
  let ready = false;
  let visible = true;
  let interacting = false;
  let lastFrameTime = 0;
  let lastDiagnosticTime = 0;
  let renderedFrames = 0;
  let frameWidth = 1;
  let frameHeight = 1;
  let activeId = screenDefinitions[0]?.id ?? null;
  let pendingId = null;
  let pendingSince = 0;
  let focusTween = null;
  let queuedFocus = null;
  let brightnessTransition = null;
  let pausedAt = document.hidden ? performance.now() : null;
  let qualityReduced = false;
  let sampleFrames = 0;
  let sampleTime = 0;
  const composition = () => {
    if (!architecture || !lionRoot) return null;
    const lionBox = new Box3().setFromObject(lionRoot);
    const stageBox = new Box3().setFromObject(architecture.stageTopMesh);
    const nodes = [];
    architecture.root.traverse(object => { if (object.isMesh) nodes.push(object); });
    return {
      lion: { ...projectedBounds(lionRoot, camera), worldMinY: lionBox.min.y, worldHeight: lionBox.max.y - lionBox.min.y },
      stage: { ...projectStage(), worldTopY: stageBox.max.y, radius: architecture.stageRadius },
      screens: Object.fromEntries([...screenRecords].map(([id, { object }]) => {
        object.geometry.computeBoundingBox();
        const size = object.geometry.boundingBox.getSize(new Vector3()).multiply(object.scale).toArray().sort((a,b) => b-a);
        return [id, { ...projectedBounds(object, camera, { vertices: true }), worldWidth: size[0], worldHeight: size[1] }];
      })),
      architecture: {
        meshBatches: nodes.length,
        instancedDraws: nodes.filter(node => node.isInstancedMesh).length,
        instances: nodes.reduce((sum, node) => sum + (node.count ?? 1), 0),
        groups: Object.fromEntries(nodes.map(node => [node.name, node.count ?? 1])),
        components: architecture.root.userData.componentCounts,
        gridVisibleCount: activeScenes.reduce((sum, root) => { root.traverseVisible(node => { if (/Floor_Joint/.test(node.name)) sum += 1; }); return sum; }, 0),
        stoneRoughness: architecture.materials.stone?.roughness,
      },
      reflection: reflection?.diagnostics(),
      lighting: { exposure: renderer.toneMappingExposure, lights: scene.children.filter(node => node.isLight).map(node => ({ type: node.type, name: node.name, color: `#${node.color.getHexString()}`, intensity: node.intensity, shadow: node.castShadow })) },
      quality: { pixelRatio: renderer.getPixelRatio(), reduced: qualityReduced, fov: camera.fov, width: frameWidth, height: frameHeight },
    };
  };
  const projectStage = () => {
    const point = new Vector3();
    const result = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    // Both the actual instanced base and actual cylinder top contribute to the
    // silhouette. A box's nonexistent front corners cannot stand in for a disc.
    const add = value => {
      point.copy(value).applyMatrix4(architecture.root.matrixWorld).project(camera);
      result.left = Math.min(result.left, (point.x + 1) / 2);
      result.right = Math.max(result.right, (point.x + 1) / 2);
      result.top = Math.min(result.top, (1 - point.y) / 2);
      result.bottom = Math.max(result.bottom, (1 - point.y) / 2);
    };
    architecture.stageBoundsPoints.forEach(add);
    const top = projectedBounds(architecture.stageTopMesh, camera, { vertices: true });
    result.left = Math.min(result.left, top.left); result.right = Math.max(result.right, top.right);
    result.top = Math.min(result.top, top.top); result.bottom = Math.max(result.bottom, top.bottom);
    return { ...result, inFront: true, visible: true, widthRatio: result.right - result.left, heightRatio: result.bottom - result.top };
  };

  const canRender = () => !disposed && !failed && ready && visible && !document.hidden;
  const requestFrame = () => {
    if (canRender() && !animationFrame) animationFrame = requestAnimationFrame(draw);
  };
  const updateAnchor = () => {
    const anchor = screenRecords.get(activeId)?.anchor;
    if (!anchor) return;
    anchor.getWorldPosition(projectedAnchor);
    projectedAnchor.project(camera);
    onAnchorUpdate({
      id: activeId,
      x: (projectedAnchor.x + 1) * frameWidth / 2,
      y: (1 - projectedAnchor.y) * frameHeight / 2,
      visible: visible && projectedAnchor.z > -1 && projectedAnchor.z < 1 && Math.abs(projectedAnchor.x) < 1 && Math.abs(projectedAnchor.y) < 1,
    });
  };
  const getDiagnostics = () => ({
    ready,
    visible: visible && !document.hidden,
    disposed,
    activeScreen: activeId,
    pendingScreen: pendingId,
    cameraPosition: camera.position.toArray(),
    cameraTarget: controls?.target.toArray() ?? orbitTarget.toArray(),
    cameraRadius: camera.position.distanceTo(orbitTarget),
    cameraAzimuth: Math.atan2(camera.position.x, camera.position.z),
    cameraState: interacting ? 'dragging' : focusTween ? 'focusing' : 'idle',
    lionRotation: lionRoot?.rotation.y ?? 0,
    rotationSpeed: ROTATION_SPEED,
    screenBrightness: Object.fromEntries([...screenRecords].map(([id, record]) => [id, record.brightness])),
    videoBindings: Object.fromEntries([...screenRecords].map(([id, { video }]) => [id, {
      bound: Boolean(video), width: video?.videoWidth ?? 0, height: video?.videoHeight ?? 0,
      time: video?.currentTime ?? 0, readyState: video?.readyState ?? 0,
    }])),
    renderedFrames,
    drawCalls: renderer?.info.render.calls ?? 0,
    triangles: renderer?.info.render.triangles ?? 0,
  });
  const publishDiagnostics = () => {
    if (!renderer) return;
    const state = getDiagnostics();
    const { dataset } = renderer.domElement;
    dataset.sceneReady = String(state.ready);
    dataset.cameraPosition = JSON.stringify(state.cameraPosition);
    dataset.cameraTarget = JSON.stringify(state.cameraTarget);
    dataset.cameraRadius = state.cameraRadius.toFixed(4);
    dataset.cameraAzimuth = state.cameraAzimuth.toFixed(4);
    dataset.lionRotation = state.lionRotation.toFixed(5);
    dataset.activeScreen = state.activeScreen ?? '';
    dataset.screenBrightness = JSON.stringify(state.screenBrightness);
    dataset.videoBindings = JSON.stringify(state.videoBindings);
    dataset.cameraState = state.cameraState;
    dataset.renderState = state.visible && !disposed ? 'active' : 'inactive';
    dataset.renderedFrames = String(renderedFrames);
    dataset.composition = JSON.stringify(composition());
  };
  const resize = () => {
    if (disposed || !renderer) return;
    const bounds = container.getBoundingClientRect();
    frameWidth = Math.max(1, bounds.width);
    frameHeight = Math.max(1, bounds.height);
    camera.aspect = frameWidth / frameHeight;
    // A pushed desktop navigation panel can leave only ~460 px for the room.
    // Preserve the full round dais on narrow desktop/pushed layouts. The
    // circular silhouette needs 74° horizontally at the initial orbit.
    const horizontalFitFov = 2 * Math.atan(Math.tan(37 * Math.PI / 180) / camera.aspect) * 180 / Math.PI;
    camera.fov = Math.min(110, Math.max(camera.aspect < 1.45 ? 59 : 56, horizontalFitFov));
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityReduced ? 1 : frameWidth < 1100 ? 1.25 : 1.5));
    renderer.setSize(frameWidth, frameHeight, false);
    if (ready) { updateAnchor(); requestFrame(); }
  };
  const commitActive = (nextId, now) => {
    if (!nextId || nextId === activeId) return;
    activeId = nextId;
    pendingId = null;
    pendingSince = 0;
    brightnessTransition = {
      startedAt: now,
      from: new Map([...screenRecords].map(([id, record]) => [id, record.brightness])),
    };
    onActiveScreen(activeId);
  };
  const updateScreenDirection = (now) => {
    camera.getWorldDirection(forward);
    const selection = chooseScreen({ forward: forward.toArray(), definitions: screenDefinitions, activeId, pendingId, pendingSince, now });
    pendingId = selection.pendingId;
    pendingSince = selection.pendingSince;
    commitActive(selection.activeId, now);
  };
  const onControlStart = () => {
    interacting = true;
    focusTween = null;
    pendingId = null;
    pendingSince = 0;
    requestFrame();
  };
  const onControlEnd = () => { interacting = false; requestFrame(); };
  const preventPageWheel = (event) => { if (visible) event.preventDefault(); };
  const synchronizeActivityClock = () => {
    const now = performance.now();
    if (!visible || document.hidden) {
      if (pausedAt === null) pausedAt = now;
    } else if (pausedAt !== null) {
      // Resume both motions from their displayed frame, including a direction
      // tween started while the chapter was off screen.
      if (focusTween) focusTween.startedAt += now - Math.max(pausedAt, focusTween.startedAt);
      if (brightnessTransition) brightnessTransition.startedAt += now - Math.max(pausedAt, brightnessTransition.startedAt);
      pausedAt = null;
    }
    lastFrameTime = 0;
  };
  const onDocumentVisibility = () => {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    synchronizeActivityClock();
    // A hidden-tab delay must not finish a direction dwell without observation.
    pendingId = null;
    pendingSince = 0;
    publishDiagnostics();
    requestFrame();
  };
  const fail = (error) => {
    if (disposed || failed) return;
    failed = true;
    onError(error instanceof Error ? error : new Error(String(error)));
    dispose();
  };
  const onContextLost = (event) => {
    event.preventDefault();
    fail(new Error('三维画面连接已中断，请重新载入巨幕厅'));
  };

  function draw(now) {
    animationFrame = 0;
    if (!canRender()) return;
    try {
      const dt = lastFrameTime ? Math.min(0.08, Math.max(0, (now - lastFrameTime) / 1000)) : 0;
      lastFrameTime = now;
      if (!qualityReduced && dt > 0 && !interacting && !focusTween) {
        sampleTime += dt;
        sampleFrames += 1;
        if (sampleFrames >= 180) {
          if (sampleTime / sampleFrames > 1 / 35) {
            qualityReduced = true;
            reflection.reduceQuality();
            scene.children.filter(light => light.castShadow).forEach(light => {
              light.shadow.mapSize.set(512, 512);
              light.shadow.map?.dispose(); light.shadow.map = null;
            });
            resize();
          }
          sampleTime = 0; sampleFrames = 0;
        }
      }
      // The model alone rotates; changing the camera never resets its phase.
      lionRoot.rotation.y = (lionRoot.rotation.y + dt * ROTATION_SPEED) % (Math.PI * 2);
      if (focusTween) {
        const fraction = Math.min(1, (now - focusTween.startedAt) / focusTween.duration);
        const eased = fraction * fraction * (3 - 2 * fraction);
        const theta = focusTween.fromAngle + focusTween.angleDelta * eased;
        camera.position.set(Math.sin(theta) * focusTween.horizontal, focusTween.height, Math.cos(theta) * focusTween.horizontal);
        if (fraction >= 1) focusTween = null;
      }
      controls.update();
      camera.position.fromArray(constrainOrbit(camera.position.toArray()));
      camera.lookAt(orbitTarget);
      camera.updateMatrixWorld();
      updateScreenDirection(now);
      const fraction = brightnessTransition ? Math.min(1, (now - brightnessTransition.startedAt) / TRANSITION_MS) : 1;
      const eased = fraction * fraction * (3 - 2 * fraction);
      screenRecords.forEach((record, id) => {
        const target = id === activeId ? 1 : 0.25;
        record.brightness = brightnessTransition ? brightnessTransition.from.get(id) + (target - brightnessTransition.from.get(id)) * eased : target;
        record.material.color.setScalar(record.brightness);
      });
      if (fraction >= 1) brightnessTransition = null;
      renderer.render(scene, camera);
      renderedFrames += 1;
      updateAnchor();
      if (now - lastDiagnosticTime > 180) { publishDiagnostics(); lastDiagnosticTime = now; }
      requestFrame();
    } catch (error) {
      fail(error);
    }
  }

  function setVideo(id, video) {
    if (disposed) return;
    if (!screenRecords.has(id)) { pendingVideos.set(id, video); return; }
    const record = screenRecords.get(id);
    if (record.video === video) return;
    record.removeVideoListeners?.();
    record.videoTexture?.dispose();
    record.videoTexture = null;
    record.video = video ?? null;
    if (video) {
      record.videoTexture = new OwnedVideoTexture(video);
      const updateAspect = () => {
        record.contain.fromArray(containedVideoScale(video.videoWidth, video.videoHeight));
        // A bound element can still be waiting for its first decoded frame.
        // Uploading it then causes an invalid texImage2D operation in WebGL.
        const nextMap = video.readyState >= 2 && video.videoWidth > 0 ? record.videoTexture : record.placeholder;
        if (record.material.map !== nextMap) {
          record.material.map = nextMap;
          record.material.needsUpdate = true;
        }
        requestFrame();
      };
      video.addEventListener('loadedmetadata', updateAspect);
      video.addEventListener('loadeddata', updateAspect);
      video.addEventListener('emptied', updateAspect);
      video.addEventListener('resize', updateAspect);
      record.removeVideoListeners = () => {
        video.removeEventListener('loadedmetadata', updateAspect);
        video.removeEventListener('loadeddata', updateAspect);
        video.removeEventListener('emptied', updateAspect);
        video.removeEventListener('resize', updateAspect);
      };
      updateAspect();
    } else {
      record.removeVideoListeners = null;
      record.contain.set(1, 1);
      record.material.map = record.placeholder;
    }
    record.material.needsUpdate = true;
    publishDiagnostics();
    requestFrame();
  }

  function focusScreen(id, { instant = false } = {}) {
    if (disposed) return;
    const definition = screenDefinitions.find((item) => item.id === id);
    if (!definition) return;
    if (!ready) { queuedFocus = { id, instant }; return; }
    // Flush OrbitControls inertia before a deliberate direction change.
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
    const fromAngle = Math.atan2(camera.position.x, camera.position.z);
    const toAngle = Math.atan2(-definition.direction[0], -definition.direction[2]);
    const delta = shortestAngle(fromAngle, toAngle);
    const horizontal = Math.hypot(camera.position.x, camera.position.z);
    pendingId = null;
    pendingSince = 0;
    if (instant) {
      focusTween = null;
      camera.position.set(Math.sin(toAngle) * horizontal, camera.position.y, Math.cos(toAngle) * horizontal);
      controls.update();
      commitActive(id, performance.now());
    } else {
      focusTween = { fromAngle, angleDelta: delta, horizontal, height: camera.position.y, startedAt: performance.now(), duration: Math.abs(delta) > 2 ? 900 : 720 };
    }
    requestFrame();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    loadController.abort();
    clearTimeout(loadTimeout);
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    observer?.disconnect();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onDocumentVisibility);
    controls?.removeEventListener('start', onControlStart);
    controls?.removeEventListener('end', onControlEnd);
    controls?.dispose();
    screenRecords.forEach((record) => {
      record.removeVideoListeners?.();
      record.videoTexture?.dispose();
    });
    publishDiagnostics();
    const placeholders = [...screenRecords.values()].map((record) => record.placeholder);
    reflection?.dispose();
    releaseResources(activeScenes, replacedMaterials, placeholders);
    screenRecords.clear();
    pendingVideos.clear();
    scene.environment = null;
    environmentTarget?.dispose();
    scene.traverse((object) => { if (object.isLight) object.dispose?.(); });
    if (renderer) {
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('wheel', preventPageWheel);
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    }
    scene.clear();
    if (mountedScenes.get(container) === dispose) mountedScenes.delete(container);
    onAnchorUpdate({ id: activeId, x: 0, y: 0, visible: false });
  }

  const api = {
    setVideo,
    setVisible(value) {
      if (disposed || visible === Boolean(value)) return;
      visible = Boolean(value);
      if (controls) controls.enabled = visible;
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      synchronizeActivityClock();
      pendingId = null;
      pendingSince = 0;
      publishDiagnostics();
      if (!visible) onAnchorUpdate({ id: activeId, x: 0, y: 0, visible: false });
      requestFrame();
    },
    focusScreen,
    getDiagnostics,
    dispose,
  };
  mountedScenes.set(container, dispose);

  // Return the lifecycle handle immediately. Model loading is abortable and a
  // late GLTF parse is disposed independently of the unmounted room.
  Promise.resolve().then(async () => {
    if (!await waitForHeaderMotion(loadController.signal)) return;
    if (disposed) return;
    try {
      if (!container.isConnected) throw new Error('巨幕厅容器尚未挂载');
      if (screenDefinitions.length !== 4) throw new Error('巨幕厅需要四个独立屏幕定义');
      renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFSoftShadowMap;
      renderer.domElement.className = 'action-theater__canvas';
      renderer.domElement.setAttribute('aria-label', '醒狮四面巨幕厅，可拖拽调整观看方向');
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.touchAction = 'none';
      renderer.domElement.addEventListener('webglcontextlost', onContextLost);
      renderer.domElement.addEventListener('wheel', preventPageWheel, { passive: false });
      container.append(renderer.domElement);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(orbitTarget);
      controls.enablePan = false;
      controls.autoRotate = false;
      controls.enableDamping = true;
      controls.dampingFactor = 0.075;
      controls.rotateSpeed = 0.42;
      controls.zoomSpeed = 0.65;
      controls.minDistance = THEATER_ORBIT.radiusMin;
      controls.maxDistance = THEATER_ORBIT.radiusMax;
      controls.minPolarAngle = THEATER_ORBIT.polarMin;
      controls.maxPolarAngle = THEATER_ORBIT.polarMax;
      controls.enabled = visible;
      controls.addEventListener('start', onControlStart);
      controls.addEventListener('end', onControlEnd);
      controls.update();
      document.addEventListener('visibilitychange', onDocumentVisibility);
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(resize);
        observer.observe(container);
      } else window.addEventListener('resize', resize);
      resize();

      const environment = new RoomEnvironment();
      const pmrem = new PMREMGenerator(renderer);
      try { environmentTarget = pmrem.fromScene(environment, 0.03); scene.environment = environmentTarget.texture; }
      finally { environment.dispose(); pmrem.dispose(); }
      scene.add(new HemisphereLight(0xffddba, 0x100907, 0.24));
      const key = new DirectionalLight(0xffe3bd, 3.25);
      key.name = 'Theater_Warm_Front_Key';
      key.position.set(2.5, 7.5, 5.5);
      key.target.position.set(0, 1.7, 0);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -3.5;
      key.shadow.camera.right = 3.5;
      key.shadow.camera.top = 3.5;
      key.shadow.camera.bottom = -3.5;
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 17;
      key.shadow.bias = -0.00035;
      key.shadow.normalBias = 0.025;
      key.shadow.radius = 2;
      scene.add(key, key.target);
      const rim = new DirectionalLight(0xffe9cd, 1.7);
      rim.name = 'Theater_Soft_Contour';
      rim.position.set(-3, 5, -4);
      scene.add(rim);
      const side = new DirectionalLight(0xffb365, 0.85);
      side.name = 'Theater_Gold_Bounce';
      side.position.set(-6, 5, 2);
      scene.add(side);
      for (const [x, z] of [[-7,-7],[7,-7],[7,7],[-7,7]]) {
        const wash = new SpotLight(0xffb66d, 75, 19, Math.PI / 3.6, 0.7, 1.3);
        wash.name = 'Theater_Architectural_Warm_Wash';
        wash.position.set(x*.7, 6, z*.7);
        wash.target.position.set(x*1.2, 8.8, z*1.2);
        scene.add(wash, wash.target);
      }

      loadTimeout = setTimeout(() => fail(new Error('巨幕厅载入超时，请检查网络后重新载入')), 60_000);
      const response = await fetch(modelUrl, { signal: loadController.signal });
      if (!response.ok) throw new Error(`巨幕厅请求失败：HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      if (disposed) return;
      const gltf = await new GLTFLoader().parseAsync(buffer, new URL('.', new URL(modelUrl, window.location.href)).href);
      const parsedScenes = gltf.scenes?.length ? gltf.scenes : [gltf.scene];
      if (disposed) { releaseResources(parsedScenes); return; }
      activeScenes.push(...parsedScenes);
      const room = gltf.scene;
      scene.add(room);
      lionRoot = room.getObjectByName('Lion_RotationRoot');
      if (!lionRoot) throw new Error('巨幕厅缺少醒狮整体旋转节点');
      // Keep the verified source lion and screen UVs. The blockout shell stays
      // loaded for provenance but the ornate reusable room replaces its meshes.
      const screenNames = new Set(screenDefinitions.map(item => item.objectName));
      room.traverse((object) => {
        if (!object.isMesh) return;
        let parent = object;
        let isLion = false;
        while (parent) { if (parent === lionRoot) { isLion = true; break; } parent = parent.parent; }
        if (!isLion && !screenNames.has(object.name) && !object.name.startsWith('Room_')) object.visible = false;
        object.castShadow = isLion;
        object.receiveShadow = !isLion;
        (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => {
          if ('envMapIntensity' in material) material.envMapIntensity = isLion ? 0.65 : 0.18;
          if (isLion && material.roughness > .75) material.envMapIntensity = .4;
          // The source floor uses Blender procedural noise, which glTF cannot
          // carry. Its exporter falls back to white; restore the documented
          // authored stone base here rather than lighting a white showroom.
          if (material.name === 'Floor_Polished_BrownBlack_Stone') material.color.setRGB(0.034, 0.019, 0.014);
        });
      });
      architecture = createTheaterArchitecture({ stageRadius: 4.7 });
      scene.add(architecture.root);
      activeScenes.push(architecture.root);
      lionRoot.scale.multiplyScalar(1.3);
      room.updateMatrixWorld(true);
      const lionBox = new Box3().setFromObject(lionRoot);
      lionRoot.position.y += architecture.stageTop - lionBox.min.y;
      reflection = createTheaterReflection({ size: frameWidth < 1100 ? 512 : 768, floorY: .014 });
      scene.add(reflection.object);
      activeScenes.push(reflection.object);
      for (const definition of screenDefinitions) {
        const object = room.getObjectByName(definition.objectName);
        if (!object?.isMesh) throw new Error(`巨幕厅缺少显示面：${definition.objectName}`);
        object.scale.multiplyScalar(.9);
        object.position.y = 4.85;
        const anchor = room.getObjectByName(definition.anchorName ?? definition.objectName.replace('Screen_', 'UI_Anchor_'));
        if (!anchor) throw new Error(`巨幕厅缺少解说锚点：${definition.id}`);
        (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => replacedMaterials.add(material));
        const placeholder = makePlaceholder(definition.title);
        const contain = new Vector2(1, 1);
        const material = makeScreenMaterial(placeholder, contain);
        const brightness = definition.id === activeId ? 1 : 0.25;
        material.color.setScalar(brightness);
        object.material = material;
        object.castShadow = false;
        object.receiveShadow = false;
        screenRecords.set(definition.id, { object, anchor, material, placeholder, contain, brightness, video: null, videoTexture: null, removeVideoListeners: null });
        if (pendingVideos.has(definition.id)) setVideo(definition.id, pendingVideos.get(definition.id));
      }
      pendingVideos.clear();
      room.updateMatrixWorld(true);
      // r160 compileAsync owns uncancellable timers that read material programs
      // after disposal. Submit compilation synchronously after header motion;
      // the first render can finish GPU work without leaving callbacks behind.
      renderer.compile(scene, camera);
      if (disposed) return;
      clearTimeout(loadTimeout);
      ready = true;
      resize();
      if (queuedFocus) { focusScreen(queuedFocus.id, { instant: queuedFocus.instant }); queuedFocus = null; }
      publishDiagnostics();
      onReady({ screenIds: [...screenRecords.keys()], rotationPeriod: 36, modelUrl, coordinateSystem: 'GLTF_METERS_Y_UP_FRONT_MINUS_Z' });
      onActiveScreen(activeId);
      requestFrame();
    } catch (error) {
      if (!disposed && error.name !== 'AbortError') fail(error);
    }
  });
  return api;
}
