import { useEffect, useRef } from 'react';
import { LionWorld } from '../model/LionWorld.js';
import { PARTS } from '../content/parts.js';

export default function ModelCanvas({ worldRef, onSelect, onReady, onProgress, onError }) {
  const host = useRef(null);
  const callbacks = useRef({ onSelect, onReady, onProgress, onError });
  callbacks.current = { onSelect, onReady, onProgress, onError };
  useEffect(() => {
    let world;
    try {
      world = new LionWorld(host.current, {
        cameraDirection: [5, 2.7, 7],
        fixedAspect: 1.5,
        overscan: true,
        labels: false,
        onSelect: id => callbacks.current.onSelect(id),
        onReady: (...args) => callbacks.current.onReady(...args),
        onProgress: n => callbacks.current.onProgress(n),
        onError: error => callbacks.current.onError(error),
      });
      worldRef.current = world;
      if (import.meta.env.DEV) window.__LION_ATLAS__ = world;
      world.load('/models/lion.glb', PARTS);
    } catch (error) { callbacks.current.onError(error.message); }
    return () => {
      world?.dispose();
      worldRef.current = null;
      if (import.meta.env.DEV) delete window.__LION_ATLAS__;
    };
  }, []);
  return <div className="canvas-host" ref={host}/>;
}
