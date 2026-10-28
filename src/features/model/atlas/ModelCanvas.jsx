import { useEffect, useRef, useState } from 'react';
import { createLionAtlasScene } from '../../../services/lionAtlasScene.js';

export default function ModelCanvas({ worldRef, retryRef, onLoading, onSelect, onReady, onProgress, onError, getReferenceAspect, lightingSettings, active }) {
  const host = useRef(null);
  const callbacks = useRef({});
  const [lightingStatus, setLightingStatus] = useState(null);
  const [attempt, setAttempt] = useState(0);
  callbacks.current = { onLoading, onSelect, onReady, onProgress, onError, getReferenceAspect, lightingSettings, active };
  retryRef.current = () => setAttempt(value => value + 1);
  useEffect(() => {
    callbacks.current.onLoading();
    const controller = new AbortController();
    let world;
    const timeout = setTimeout(() => {
      controller.abort();
      callbacks.current.onError('模型准备超时，可重新载入。');
    }, 45_000);
    createLionAtlasScene({
      container: host.current,
      lightingSettings: callbacks.current.lightingSettings,
      active: callbacks.current.active && !document.hidden,
      signal: controller.signal,
      getReferenceAspect: () => callbacks.current.getReferenceAspect(),
      onSelect: id => callbacks.current.onSelect(id),
      onProgress: value => { if (!controller.signal.aborted) callbacks.current.onProgress(value); },
      onError: error => { if (!controller.signal.aborted) callbacks.current.onError(error); },
      onLightingStatus: status => { if (!controller.signal.aborted) setLightingStatus(status); },
    }).then(scene => {
      clearTimeout(timeout);
      if (controller.signal.aborted) { scene.dispose(); return; }
      world = scene;
      worldRef.current = world;
      world.setLightingSettings(callbacks.current.lightingSettings);
      world.setActive(callbacks.current.active && !document.hidden);
      callbacks.current.onReady(scene.registry);
    }).catch(error => {
      clearTimeout(timeout);
      if (!controller.signal.aborted) callbacks.current.onError(error.message || '模型载入失败，可重新载入。');
    });
    return () => {
      controller.abort();
      clearTimeout(timeout);
      world?.dispose();
      if (worldRef.current === world) worldRef.current = null;
    };
  }, [attempt, worldRef]);
  useEffect(() => {
    worldRef.current?.setLightingSettings(lightingSettings);
  }, [lightingSettings, worldRef]);
  return <>
    <div id="sceneContainer" className="canvas-host" ref={host}
      aria-label="醒狮三维模型，可拖动旋转、滚轮缩放或点击部件观察" />
    {lightingStatus?.phase === 'error' && <p className="atlas-hdri-notice" role="status">HDRI 环境光载入失败
      <button onClick={() => worldRef.current?.retryHdri()?.catch(() => {})}>重新载入 HDRI</button></p>}
  </>;
}
