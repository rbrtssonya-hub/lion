import { resolveHdriSettings } from '../config/hdri.js';
import { media } from '../config/media.js';
import { createLionHdriEnvironment } from './lionHdriEnvironment.js';

// Share a local file's URL between the two mounted chapter renderers. Revoke
// only after the last owner releases its independently allocated GPU resources.
const localSources = new WeakMap();
function sourceFor(settings) {
  if (settings.hdriSource === 'local' && settings.hdriFile) {
    const file = settings.hdriFile;
    let entry = localSources.get(file);
    if (!entry) { entry = { url: URL.createObjectURL(file), users: 0 }; localSources.set(file, entry); }
    entry.users += 1;
    return { url: entry.url, name: file.name, release: () => {
      entry.users -= 1;
      if (!entry.users) { URL.revokeObjectURL(entry.url); localSources.delete(file); }
    } };
  }
  if (settings.hdriSource === 'url') {
    const url = new URL(settings.hdriUrl, window.location.href);
    if (!settings.hdriUrl || !['http:', 'https:'].includes(url.protocol)) throw new Error('请输入 HTTP(S) HDRI 地址');
    return { url: url.href, name: url.pathname };
  }
  const url = settings.hdriSource === 'default' ? media.lionHdri : media.lionForestHdri;
  return { url, name: url };
}

/** Instance-local lighting and replaceable HDRI; authored colors stay intact. */
export function createLionLightingControls({ renderer, scene, signal, settings, onStatus = () => {}, requestDraw = () => {} }) {
  let current = resolveHdriSettings(settings);
  let disposed = false;
  let environment;
  let source;
  const lightIntensities = new WeakMap();
  const materialIntensities = new WeakMap();
  const canvas = renderer.domElement;
  const publish = status => {
    if (disposed) return;
    canvas.dataset.hdriState = status.phase;
    canvas.dataset.hdriSource = status.source ?? '';
    canvas.dataset.hdriName = source?.name ?? '';
    canvas.dataset.hdriRotation = Number.isFinite(status.appliedRotation) ? String(status.appliedRotation) : '';
    canvas.dataset.hdriResolution = status.width && status.height ? `${status.width}x${status.height}` : '';
    onStatus(status);
    requestDraw();
  };
  const releaseEnvironment = () => {
    environment?.dispose();
    environment = null;
    source?.release?.();
    source = null;
  };
  const replaceEnvironment = () => {
    releaseEnvironment();
    try {
      source = sourceFor(current);
      environment = createLionHdriEnvironment({
        renderer, scene, signal, settings: current,
        sourceUrl: source.url,
        sourceFormat: /\.hdr(?:$|[?#])/i.test(source.name) ? 'hdr' : 'exr',
        onUpdate: publish,
        onError: error => publish({ phase: 'error', source: source?.url, error: error.message }),
      });
    } catch (error) { publish({ phase: 'error', error: error.message }); }
  };
  const refresh = () => {
    if (disposed) return;
    renderer.toneMappingExposure = 2 ** current.hdriExposure;
    scene.traverse(object => {
      if (object.isLight) {
        if (!lightIntensities.has(object)) lightIntensities.set(object, object.intensity);
        object.intensity = lightIntensities.get(object) * current.hdriLightIntensity;
      }
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
        if (!material || !('envMapIntensity' in material)) continue;
        if (!materialIntensities.has(material)) materialIntensities.set(material, material.envMapIntensity);
        material.envMapIntensity = materialIntensities.get(material) * current.hdriIntensity;
      }
    });
    canvas.dataset.hdriSettings = JSON.stringify(current);
    requestDraw();
  };
  refresh();
  replaceEnvironment();
  return {
    get ready() { return environment?.ready ?? Promise.resolve(); },
    refresh,
    update(settings) {
      if (disposed) return;
      const previous = current;
      current = resolveHdriSettings(settings);
      refresh();
      if (current.hdriSource !== previous.hdriSource || current.hdriUrl !== previous.hdriUrl || current.hdriFile !== previous.hdriFile) replaceEnvironment();
      else environment?.update(current);
    },
    retry() {
      if (!environment) { replaceEnvironment(); return environment?.ready ?? Promise.resolve(); }
      return environment.retry();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      releaseEnvironment();
    },
  };
}
