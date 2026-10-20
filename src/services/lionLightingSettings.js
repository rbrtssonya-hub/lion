import { resolveHdriSettings } from '../config/hdri.js';
import { media } from '../config/media.js';
import { createLionHdriEnvironment } from './lionHdriEnvironment.js';

/** Instance-local illumination controls. Never changes geometry or authored colors. */
export function createLionLightingControls({ renderer, scene, signal, settings, onStatus = () => {}, requestDraw = () => {} }) {
  let current = resolveHdriSettings(settings);
  let disposed = false;
  const lightIntensities = new WeakMap();
  const materialIntensities = new WeakMap();
  const canvas = renderer.domElement;
  const publish = status => {
    if (disposed) return;
    canvas.dataset.hdriState = status.phase;
    if (Number.isFinite(status.appliedRotation)) canvas.dataset.hdriRotation = String(status.appliedRotation);
    if (status.width && status.height) canvas.dataset.hdriResolution = `${status.width}x${status.height}`;
    onStatus(status);
    requestDraw();
  };
  const environment = createLionHdriEnvironment({
    renderer, scene, signal, settings: current,
    onUpdate: publish,
    onError: () => publish({ phase: 'error', message: 'HDRI 环境光载入失败' }),
  });
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
    canvas.dataset.hdriSource = media.lionHdri;
    requestDraw();
  };
  refresh();
  return {
    ready: environment.ready,
    refresh,
    update(settings) {
      if (disposed) return;
      current = resolveHdriSettings(settings);
      refresh();
      environment.update(current);
    },
    retry: () => environment.retry(),
    dispose() {
      if (disposed) return;
      disposed = true;
      environment.dispose();
    },
  };
}
