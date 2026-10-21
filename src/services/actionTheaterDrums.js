import { Box3, Group, InstancedMesh, Matrix4, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { media } from '../config/media.js';

export const THEATER_DRUM_PLACEMENTS = Object.freeze([
  Object.freeze([-6, -6]), Object.freeze([6, -6]),
  Object.freeze([-6, 6]), Object.freeze([6, 6]),
]);

function releaseDrumResources(root) {
  if (!root) return;
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const images = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material])
      .filter(Boolean).forEach(material => materials.add(material));
  });
  materials.forEach(material => {
    Object.values(material).filter(value => value?.isTexture).forEach(texture => textures.add(texture));
    material.dispose();
  });
  textures.forEach(texture => {
    (Array.isArray(texture.image) ? texture.image : [texture.image])
      .filter(Boolean).forEach(image => images.add(image));
    texture.dispose();
  });
  images.forEach(image => image.close?.());
  geometries.forEach(geometry => geometry.dispose());
}

/** Independent optional prop loading; a failed drum never fails the theater. */
export function createActionTheaterDrums({
  scene, url = media.actionTheaterDrum, signal,
  onReady = () => {}, onError = () => {},
  height = 2, floorY = 0.015,
} = {}) {
  const root = new Group();
  root.name = 'Theater_User_Drum_Ensemble';
  root.userData.source = url;
  root.userData.count = THEATER_DRUM_PLACEMENTS.length;
  scene.add(root);
  const controller = new AbortController();
  let disposed = false;
  let sourceRoot = null;
  let pending = null;
  let timeout = null;
  const stats = { status: 'loading', count: 4, height, floorY, batches: 0, url };

  function releaseInstances() {
    for (const child of [...root.children]) {
      child.dispose?.(); // Instance attributes; geometry/material are shared.
      root.remove(child);
    }
    releaseDrumResources(sourceRoot);
    sourceRoot = null;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    stats.status = 'disposed';
    clearTimeout(timeout);
    controller.abort();
    signal?.removeEventListener('abort', dispose);
    releaseInstances();
    root.removeFromParent();
  }

  async function load() {
    if (disposed) throw new DOMException('鼓场景已退出', 'AbortError');
    if (sourceRoot) return stats;
    if (pending) return pending;
    stats.status = 'loading';
    // Each retry owns its timeout; aborting a failed fetch does not permanently
    // poison the controller used for a later explicit retry.
    const attempt = new AbortController();
    const abortAttempt = () => attempt.abort(controller.signal.reason);
    controller.signal.addEventListener('abort', abortAttempt, { once: true });
    timeout = setTimeout(() => attempt.abort(new Error('鼓模型载入超时')), 45_000);
    pending = (async () => {
      let parsedRoot = null;
      try {
        const response = await fetch(url, { signal: attempt.signal });
        if (!response.ok) throw new Error(`鼓模型请求失败：HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        if (disposed || attempt.signal.aborted) throw attempt.signal.reason;
        const gltf = await new GLTFLoader().parseAsync(buffer, new URL('.', new URL(url, window.location.href)).href);
        parsedRoot = gltf.scene;
        if (disposed || attempt.signal.aborted) {
          releaseDrumResources(parsedRoot);
          parsedRoot = null;
          throw attempt.signal.reason;
        }
        parsedRoot.updateMatrixWorld(true);
        const box = new Box3().setFromObject(parsedRoot);
        const dimensions = box.getSize(new Vector3());
        if (!Number.isFinite(dimensions.y) || dimensions.y <= 0) throw new Error('鼓模型没有可用尺寸');
        const center = box.getCenter(new Vector3());
        const scale = height / dimensions.y;
        const normalize = new Matrix4().makeScale(scale, scale, scale)
          .multiply(new Matrix4().makeTranslation(-center.x, -box.min.y, -center.z));
        let triangles = 0;
        parsedRoot.traverse(object => {
          if (!object.isMesh) return;
          const batch = new InstancedMesh(object.geometry, object.material, THEATER_DRUM_PLACEMENTS.length);
          batch.name = `Theater_Drum_${object.name}`;
          batch.castShadow = true;
          batch.receiveShadow = true;
          for (const [index, [x, z]] of THEATER_DRUM_PLACEMENTS.entries()) {
            const transform = new Matrix4().makeTranslation(x, floorY, z)
              .multiply(new Matrix4().makeRotationY(Math.atan2(-x, -z)))
              .multiply(normalize).multiply(object.matrixWorld);
            batch.setMatrixAt(index, transform);
          }
          batch.instanceMatrix.needsUpdate = true;
          batch.computeBoundingBox();
          batch.computeBoundingSphere();
          triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
          root.add(batch);
        });
        if (!root.children.length) throw new Error('鼓模型中没有可显示网格');
        sourceRoot = parsedRoot;
        parsedRoot = null;
        Object.assign(stats, {
          status: 'ready', batches: root.children.length, trianglesPerDrum: triangles,
          totalTriangles: triangles * THEATER_DRUM_PLACEMENTS.length,
          sourceDimensions: dimensions.toArray(),
          positions: THEATER_DRUM_PLACEMENTS.map(([x, z]) => [x, floorY, z]),
        });
        root.userData.stats = stats;
        onReady(stats);
        return stats;
      } catch (error) {
        releaseDrumResources(parsedRoot);
        if (!disposed) {
          releaseInstances();
          stats.status = 'error';
          stats.error = error?.message ?? '鼓模型载入失败';
          onError(error instanceof Error ? error : new Error(stats.error));
        }
        throw error;
      } finally {
        clearTimeout(timeout);
        timeout = null;
        controller.signal.removeEventListener('abort', abortAttempt);
        pending = null;
      }
    })();
    return pending;
  }

  signal?.addEventListener('abort', dispose, { once: true });
  if (signal?.aborted) dispose();
  const ready = load();
  ready.catch(() => {}); // Caller may inspect/retry; optional props are isolated.
  return { root, stats, ready, retry: load, dispose };
}
