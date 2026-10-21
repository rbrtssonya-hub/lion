import {
  ClampToEdgeWrapping,
  DataTexture,
  EquirectangularReflectionMapping,
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  NoBlending,
  NoToneMapping,
  OrthographicCamera,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
} from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { media } from '../config/media.js';

// Only decoded CPU pixels are shared. Every scene/renderer owns its own GPU
// texture, PMREM target and generator, including during simultaneous chapters.
const decodedSources = new Map();
const rotationDelay = 140;
const requestTimeout = 30_000;
const abortError = () => new DOMException('HDRI 载入已取消', 'AbortError');

async function acquireSource(url, signal, format) {
  if (signal.aborted) throw abortError();
  let entry = decodedSources.get(url);
  if (!entry) {
    entry = { controller: new AbortController(), users: 0 };
    decodedSources.set(url, entry);
    entry.promise = Promise.resolve().then(async () => {
      const timeout = setTimeout(() => {
        entry.timedOut = true;
        entry.controller.abort();
      }, requestTimeout);
      try {
        const response = await fetch(url, { signal: entry.controller.signal });
        if (!response.ok) throw new Error(`HDRI 请求失败：HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        if (entry.controller.signal.aborted) throw abortError();
        const radiance = new Uint8Array(bytes)[0] === 35 || format === 'hdr';
        const loader = radiance ? new RGBELoader() : new EXRLoader();
        const source = loader.setDataType(HalfFloatType).parse(bytes);
        source.flipY = radiance;
        if (entry.controller.signal.aborted) throw abortError();
        if (!source.data || !source.width || !source.height || source.width !== source.height * 2) {
          throw new Error('HDRI 必须是完整的 2:1 经纬度 EXR 或 HDR 图像');
        }
        return source;
      } finally {
        clearTimeout(timeout);
      }
    }).catch(error => {
      if (decodedSources.get(url) === entry) decodedSources.delete(url);
      if (entry.timedOut) throw new Error('HDRI 请求超时，请重试');
      throw error;
    });
  }
  entry.users += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    entry.users -= 1;
    if (!entry.users) {
      if (decodedSources.get(url) === entry) decodedSources.delete(url);
      entry.controller.abort();
    }
  };
  let onAbort;
  try {
    const source = await Promise.race([
      entry.promise,
      new Promise((_, reject) => {
        onAbort = () => reject(abortError());
        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) onAbort();
      }),
    ]);
    if (signal.aborted) throw abortError();
    return { source, release };
  } catch (error) {
    release();
    throw error;
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

function rotationOf(settings) {
  const value = Number(settings?.hdriRotation);
  return Number.isFinite(value) ? Math.min(180, Math.max(-180, value)) : 0;
}

/**
 * Creates an immediately usable handle: settings may change while EXR loads.
 * `ready`/`retry()` resolve after the requested initial environment is installed
 * (or when disabled). Failures are also reported through onError; callers may
 * keep the model and its direct lights running while showing a lighting retry.
 * Material intensity, exposure and auxiliary lights belong to the host scene.
 */
export function createLionHdriEnvironment({
  renderer,
  scene,
  signal,
  sourceUrl = media.lionHdri,
  sourceFormat = 'exr',
  settings = {},
  onUpdate = () => {},
  onError = () => {},
}) {
  const controller = new AbortController();
  let disposed = false;
  let enabled = settings.hdriEnabled !== false;
  let requestedRotation = rotationOf(settings);
  let appliedRotation = null;
  let phase = enabled ? 'loading' : 'disabled';
  let lastError = null;
  let lease;
  let sourceTexture;
  let pmrem;
  let environmentTarget;
  let rotationTimer = 0;
  let loading = null;
  let ready = Promise.resolve();

  const snapshot = () => ({
    phase,
    enabled,
    source: sourceUrl,
    width: lease?.source.width ?? null,
    height: lease?.source.height ?? null,
    requestedRotation,
    appliedRotation,
    error: lastError?.message ?? null,
  });
  const notify = () => { if (!disposed) onUpdate(snapshot()); };

  function makeSourceTexture() {
    if (sourceTexture) return;
    const source = lease.source;
    if (source.width > renderer.capabilities.maxTextureSize || source.height > renderer.capabilities.maxTextureSize) {
      throw new Error(`显卡无法完整载入 ${source.width}×${source.height} HDRI`);
    }
    sourceTexture = new DataTexture(source.data, source.width, source.height, source.format, source.type);
    sourceTexture.name = 'Lion.HDRI.Source';
    sourceTexture.mapping = EquirectangularReflectionMapping;
    sourceTexture.colorSpace = source.colorSpace ?? LinearSRGBColorSpace;
    sourceTexture.minFilter = LinearFilter;
    sourceTexture.magFilter = LinearFilter;
    sourceTexture.wrapS = RepeatWrapping;
    sourceTexture.wrapT = ClampToEdgeWrapping;
    sourceTexture.generateMipmaps = false;
    sourceTexture.flipY = source.flipY; // EXR parse flips scanlines; RGBE load flips at upload.
    sourceTexture.needsUpdate = true;
  }

  function generateEnvironment() {
    if (disposed) return snapshot();
    if (!enabled || !lease) { notify(); return snapshot(); }
    if (environmentTarget && appliedRotation === requestedRotation) {
      scene.environment = environmentTarget.texture;
      phase = 'ready';
      lastError = null;
      notify();
      return snapshot();
    }
    makeSourceTexture();
    const previousTarget = renderer.getRenderTarget();
    const previousFace = renderer.getActiveCubeFace();
    const previousMip = renderer.getActiveMipmapLevel();
    const previousAutoClear = renderer.autoClear;
    const previousToneMapping = renderer.toneMapping;
    const previousXrEnabled = renderer.xr.enabled;
    let rotatedTarget;
    let rotationGeometry;
    let rotationMaterial;
    let nextTarget;
    try {
      renderer.xr.enabled = false;
      renderer.autoClear = true;
      renderer.toneMapping = NoToneMapping;
      let input = sourceTexture;
      if (requestedRotation !== 0) {
        // r160 has no environmentRotation and PMREM ignores texture transforms.
        // Rotate the full-resolution linear HDR panorama before prefiltering;
        // fromScene() would silently reduce it to a fixed 256px cubemap.
        rotatedTarget = new WebGLRenderTarget(lease.source.width, lease.source.height, {
          type: HalfFloatType,
          format: RGBAFormat,
          colorSpace: LinearSRGBColorSpace,
          minFilter: LinearFilter,
          magFilter: LinearFilter,
          depthBuffer: false,
          stencilBuffer: false,
          generateMipmaps: false,
        });
        rotatedTarget.texture.name = 'Lion.HDRI.Rotated';
        rotatedTarget.texture.mapping = EquirectangularReflectionMapping;
        rotationGeometry = new PlaneGeometry(2, 2);
        rotationMaterial = new ShaderMaterial({
          name: 'Lion.HDRI.Yaw',
          uniforms: {
            panorama: { value: sourceTexture },
            // equirectUv uses atan(z, x): positive Three Y rotation samples
            // the original panorama at longitude + yaw (inverse environment).
            turns: { value: requestedRotation / 360 },
          },
          vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
          fragmentShader: `
            uniform sampler2D panorama;
            uniform float turns;
            varying vec2 vUv;
            void main() {
              gl_FragColor = vec4(texture2D(panorama, vec2(fract(vUv.x + turns), vUv.y)).rgb, 1.0);
            }
          `,
          blending: NoBlending,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        });
        const rotationScene = new Scene();
        rotationScene.add(new Mesh(rotationGeometry, rotationMaterial));
        renderer.setRenderTarget(rotatedTarget);
        renderer.render(rotationScene, new OrthographicCamera(-1, 1, 1, -1, 0, 1));
        input = rotatedTarget.texture;
      }
      pmrem ??= new PMREMGenerator(renderer);
      nextTarget = pmrem.fromEquirectangular(input);
      nextTarget.texture.name = 'Lion.HDRI.PMREM';
      const previousEnvironment = environmentTarget;
      environmentTarget = nextTarget;
      appliedRotation = requestedRotation;
      scene.environment = environmentTarget.texture;
      previousEnvironment?.dispose();
      phase = 'ready';
      lastError = null;
    } catch (error) {
      if (nextTarget && nextTarget !== environmentTarget) nextTarget.dispose();
      throw error;
    } finally {
      rotationMaterial?.dispose();
      rotationGeometry?.dispose();
      rotatedTarget?.dispose();
      renderer.setRenderTarget(previousTarget, previousFace, previousMip);
      renderer.autoClear = previousAutoClear;
      renderer.toneMapping = previousToneMapping;
      renderer.xr.enabled = previousXrEnabled;
    }
    notify();
    return snapshot();
  }

  function failed(error) {
    if (disposed || error?.name === 'AbortError') return;
    lastError = error;
    phase = enabled ? 'error' : 'disabled';
    notify();
    if (enabled) onError(error);
  }

  function load() {
    if (disposed) return Promise.reject(abortError());
    if (!enabled) return Promise.resolve(snapshot());
    if (loading) {
      phase = lease ? 'updating' : 'loading';
      notify();
      return loading;
    }
    phase = lease ? 'updating' : 'loading';
    lastError = null;
    notify();
    loading = (async () => {
      if (!lease) {
        const acquired = await acquireSource(sourceUrl, controller.signal, sourceFormat);
        if (disposed) { acquired.release(); throw abortError(); }
        lease = acquired;
      }
      return generateEnvironment();
    })().catch(error => { failed(error); throw error; }).finally(() => { loading = null; });
    // Loading is observable through ready/retry without an unhandled rejection
    // when a chapter unmounts or chooses to handle errors through its callback.
    loading.catch(() => {});
    ready = loading;
    return loading;
  }

  function update(nextSettings = {}) {
    if (disposed) return;
    const wasEnabled = enabled;
    const previousRotation = requestedRotation;
    enabled = nextSettings.hdriEnabled !== false;
    requestedRotation = rotationOf(nextSettings);
    if (!enabled) {
      clearTimeout(rotationTimer);
      rotationTimer = 0;
      scene.environment = null;
      phase = 'disabled';
      notify();
      return;
    }
    if (!lease) {
      if (!wasEnabled || phase !== 'error') load().catch(() => {});
      else notify();
      return;
    }
    if (!wasEnabled || previousRotation !== requestedRotation) {
      clearTimeout(rotationTimer);
      rotationTimer = 0;
      if (appliedRotation === requestedRotation && environmentTarget) {
        generateEnvironment();
        return;
      }
      phase = 'updating';
      notify();
      rotationTimer = setTimeout(() => {
        rotationTimer = 0;
        try { generateEnvironment(); } catch (error) { failed(error); }
      }, rotationDelay);
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearTimeout(rotationTimer);
    signal?.removeEventListener('abort', dispose);
    renderer.domElement.removeEventListener('webglcontextlost', dispose);
    controller.abort();
    if (scene.environment === environmentTarget?.texture) scene.environment = null;
    environmentTarget?.dispose();
    environmentTarget = null;
    pmrem?.dispose();
    pmrem = null;
    sourceTexture?.dispose();
    sourceTexture = null;
    lease?.release();
    lease = null;
  }

  signal?.addEventListener('abort', dispose, { once: true });
  renderer.domElement.addEventListener('webglcontextlost', dispose);
  if (signal?.aborted) dispose();
  else if (enabled) load().catch(() => {});
  else { scene.environment = null; ready = Promise.resolve(snapshot()); notify(); }

  return {
    update,
    dispose,
    retry() {
      clearTimeout(rotationTimer);
      rotationTimer = 0;
      return load();
    },
    get ready() { return ready; },
    get status() { return snapshot(); },
  };
}
