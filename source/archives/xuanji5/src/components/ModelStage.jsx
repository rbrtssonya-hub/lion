import { useEffect, useRef, useState } from 'react';
import { Plus, Minus, RotateCcw, Play, Pause, MoveUpRight, Scan } from 'lucide-react';
import { LionWorld } from '../model/LionWorld.js';
import { PARTS } from '../content/parts.js';

export default function ModelStage({ selected, mode, explosion, onSelect, onReady, onProgress, onStats, onError, worldRef }) {
  const host = useRef(null);
  const labels = useRef(new Map());
  const callbacks = useRef({ onSelect, onReady, onProgress, onStats, onError });
  callbacks.current = { onSelect, onReady, onProgress, onStats, onError };
  const [hovered, setHovered] = useState(null);
  const [rotating, setRotating] = useState(false);
  useEffect(() => {
    let world;
    try {
      world = new LionWorld(host.current, {
        cameraDirection: [5, 2.7, 7],
        onSelect: id => callbacks.current.onSelect(id),
        onReady: (...args) => callbacks.current.onReady(...args),
        onProgress: n => callbacks.current.onProgress(n),
        onStats: stats => callbacks.current.onStats(stats),
        onError: error => callbacks.current.onError(error),
        onHover: setHovered,
        onLabels: positions => {
          const current = new Map(positions.map(p => [p.id, p]));
          labels.current.forEach((element, id) => {
            if (!element) return;
            const position = current.get(id);
            element.hidden = !position;
            if (position) {
              element.style.transform = `translate3d(${position.x}px, ${position.labelY || position.y}px, 0)`;
              element.style.setProperty('--line-offset', `${position.y - (position.labelY || position.y)}px`);
            }
          });
        },
      });
      worldRef.current = world;
      if (import.meta.env.DEV) window.__LION_ATLAS__ = world;
      world.load('/models/lion.glb', PARTS);
    } catch (error) { callbacks.current.onError(error.message); }
    return () => { world?.dispose(); worldRef.current = null; if (import.meta.env.DEV) delete window.__LION_ATLAS__; };
  }, []);

  useEffect(() => {
    worldRef.current?.setView({ selected, mode, explosion });
  }, [selected, mode, explosion]);

  return <>
    <div className="canvas-host" ref={host}>
      <div className="spatial-labels" aria-label="模型部位标注">
        {PARTS.map(part => <button
          key={part.id}
          hidden
          className={`spatial-label ${hovered === part.id || selected === part.id ? 'is-emphasized' : ''}`}
          ref={element => labels.current.set(part.id, element)}
          onClick={() => onSelect(part.id)}
          aria-label={`研究${part.name}`}
        ><span className="anchor-dot"/><span className="label-leader"/><span className="label-name"><b>{part.number}</b>{part.name}<MoveUpRight size={10}/></span></button>)}
      </div>
    </div>
    <div className="stage-controls" aria-label="三维视图控制">
      <span className="control-caption">VIEW CONTROL</span>
      <button title="放大模型" aria-label="放大模型" onClick={() => worldRef.current?.zoom(0.82)}><Plus size={16}/></button>
      <button title="缩小模型" aria-label="缩小模型" onClick={() => worldRef.current?.zoom(1.22)}><Minus size={16}/></button>
      <span className="control-divider"/>
      <button title="重置视角" aria-label="重置视角" onClick={() => worldRef.current?.reset()}><RotateCcw size={15}/></button>
      <button title={rotating ? '暂停旋转' : '自动旋转'} aria-label={rotating ? '暂停旋转' : '自动旋转'} aria-pressed={rotating} onClick={() => { setRotating(!rotating); worldRef.current?.setAutoRotate(!rotating); }}>{rotating ? <Pause size={15}/> : <Play size={15}/>}</button>
    </div>
    <div className="scene-corner"><Scan size={15}/><span>{selected ? '局部观察 / DETAIL STUDY' : '拖动旋转 · 滚轮缩放'}</span></div>
  </>;
}
