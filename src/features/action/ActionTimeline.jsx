import { useRef } from 'react';
import ActionGuideCharacter from './ActionGuideCharacter.jsx';

export default function ActionTimeline({ items, activeId, onSelect, placement, skin = 'heritage' }) {
  const buttons = useRef([]);
  const focusNode = (event, index) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    buttons.current[next]?.focus({ preventScroll: true });
  };
  return <nav className="action-timeline" data-placement={placement} data-skin={skin}
    aria-label={placement === 'hero' ? '首屏动作时间轴' : '片段目录时间轴'}>
    <span className="action-timeline-line" aria-hidden="true" />
    {skin === 'game' && <><span className="action-game-caption" aria-hidden="true">狮行四境 · 选择阶段</span><ActionGuideCharacter index={Math.max(0, items.findIndex(item => item.id === activeId))} /></>}
    {items.map((item, index) => <button type="button" key={item.id} ref={el => { buttons.current[index] = el; }}
      aria-label={item.name} aria-pressed={activeId === item.id}
      className={activeId === item.id ? 'is-current' : ''} onClick={() => onSelect(item.id)}
      onKeyDown={event => focusNode(event, index)}>
      <i aria-hidden="true" data-step={String(index + 1).padStart(2, '0')} /><span>{item.name}</span>
    </button>)}
  </nav>;
}
