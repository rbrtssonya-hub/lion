import {
  ACESFilmicToneMapping,
  Box3,
  CircleGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
  modelUrl,
  signal,
  autoRotate = true,
  onStatus = () => {},
  onAutoRotateChange = () => {},
}) {
  if (signal?.aborted || !container.isConnected) throw aborted();
  activeScenes.get(container)?.();

  const loadController = new AbortController();
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.01, 1000);
  camera.position.set(2.7, 1.05, 4);
  let renderer;
  let controls;
  let observer;
  let animationFrame = 0;
  let disposed = false;
  let modelReady = false;
  let modelScenes = [];

  const report = (status) => {
    if (!disposed && !signal?.aborted) onStatus(status);
  };
  const stopRotation = () => {
    if (disposed) return;
    controls.autoRotate = false;
    onAutoRotateChange(false);
  };
  const resize = () => {
    if (disposed || !renderer) return;
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    loadController.abort();
    if (activeScenes.get(container) === dispose) activeScenes.delete(container);
    window.cancelAnimationFrame(animationFrame);
    observer?.disconnect();
    window.removeEventListener('resize', resize);
    signal?.removeEventListener('abort', dispose);
    controls?.removeEventListener('start', stopRotation);
    controls?.dispose();
    disposeResources(scene, ...modelScenes);
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.42;
    controls.minDistance = 1.8;
    controls.maxDistance = 8;
    controls.target.set(0, 0.08, 0);
    controls.addEventListener('start', stopRotation);

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

    const ground = new Mesh(
      new CircleGeometry(4.5, 64),
      new MeshBasicMaterial({ color: 0x0a0e0d, transparent: true, opacity: 0.72 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.15;
    scene.add(ground);

    signal?.addEventListener('abort', dispose, { once: true });
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(resize);
      observer.observe(container);
    } else {
      window.addEventListener('resize', resize);
    }
    resize();

    const render = () => {
      if (disposed) return;
      try {
        controls.update();
        renderer.render(scene, camera);
        animationFrame = window.requestAnimationFrame(render);
      } catch (error) {
        report({ phase: 'error', message: '3D 显示暂不可用 · 保留结构预览' });
        console.error('醒狮模型渲染失败', error);
        dispose();
      }
    };

    report({ phase: 'loading', message: '正在载入醒狮模型' });
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
    model.name = 'LionHead_Overall';
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
    const box = new Box3().setFromObject(model);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(maxSize) || maxSize <= 0) {
      throw new Error('模型没有可显示的几何结构');
    }
    model.position.sub(center);
    const modelGroup = new Group();
    modelGroup.add(model);
    modelGroup.scale.setScalar(2.2 / maxSize);
    modelGroup.position.y = -0.066;
    scene.add(modelGroup);
    modelReady = true;
    controls.update();
    render();
    if (disposed) throw new Error('WebGL 渲染失败');
    report({ phase: 'ready', message: '模型已载入 · 可交互' });

    return {
      setAutoRotate(value) {
        if (!disposed && modelReady) controls.autoRotate = Boolean(value);
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
