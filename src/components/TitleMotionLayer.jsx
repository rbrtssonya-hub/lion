import { useEffect, useRef } from 'react';
import { media } from '../config/media.js';

export default function TitleMotionLayer() {
  const rootRef = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current?.closest('.final-home');
    const title = titleRef.current;
    if (!root || !title || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let pointerX = 0;
    let pointerY = 0;
    let frame = 0;
    const render = (time) => {
      title.style.setProperty('--title-shift-x', `${(pointerX * 10 + Math.sin(time / 2600) * 2.4).toFixed(2)}px`);
      title.style.setProperty('--title-shift-y', `${(pointerY * 7 + Math.cos(time / 3100) * 2.2).toFixed(2)}px`);
      frame = requestAnimationFrame(render);
    };
    const move = (event) => {
      const bounds = root.getBoundingClientRect();
      pointerX = Math.min(1, Math.max(-1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
      pointerY = Math.min(1, Math.max(-1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    };
    const reset = () => { pointerX = 0; pointerY = 0; };
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerleave', reset);
    frame = requestAnimationFrame(render);
    return () => {
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerleave', reset);
      cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={rootRef} className="entry-title-live2d" data-title-live2d="true">
    <img ref={titleRef} className="entry-title-art" src={media.title} alt="南风有狮" />
  </div>;
}
