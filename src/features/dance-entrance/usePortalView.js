import { useEffect, useRef, useState } from 'react';

const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

// Mostar's layered pointer/scroll idea is rewritten for this bounded, draggable
// two-destination stage. No third-party source or global document state is used.
export function usePortalView(rootRef, stageRef) {
  const target = useRef({ yaw: 0, pitch: 0 });
  const view = useRef({ yaw: 0, pitch: 0 });
  const [moved, setMoved] = useState(false);
  const reset = () => { target.current = { yaw: 0, pitch: 0 }; setMoved(false); };

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let previous = 0;
    let current = { yaw: 0, pitch: 0 };
    let pointer = null;
    let suppressUntil = 0;
    let disposed = false;

    const paint = time => {
      frame = 0;
      if (disposed) return;
      const amount = reduced.matches ? 1 : 1 - Math.exp(-Math.min(time - (previous || time - 16), 50) / 90);
      previous = time;
      for (const axis of ['yaw', 'pitch']) current[axis] += (target.current[axis] - current[axis]) * amount;
      Object.assign(view.current, current);
      root.style.setProperty('--view-yaw', `${current.yaw.toFixed(3)}deg`);
      root.style.setProperty('--view-pitch', `${current.pitch.toFixed(3)}deg`);
      if (Math.abs(target.current.yaw - current.yaw) + Math.abs(target.current.pitch - current.pitch) > .01) schedule();
    };
    const schedule = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(paint); };
    const down = event => {
      if (event.button !== 0 || event.target.closest('button')) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, ...target.current, dragging: false };
    };
    const move = event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      if (event.pointerType === 'mouse' && event.buttons === 0) { up(event); return; }
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (!pointer.dragging && Math.hypot(dx, dy) < 6) return;
      if (!pointer.dragging) { pointer.dragging = true; stage.setPointerCapture(event.pointerId); root.dataset.dragging = 'true'; }
      event.preventDefault();
      target.current = { yaw: clamp(pointer.yaw + dx / stage.clientWidth * 45, 19), pitch: clamp(pointer.pitch - dy / stage.clientHeight * 22, 7) };
      setMoved(true);
      schedule();
    };
    const up = event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      if (pointer.dragging) suppressUntil = performance.now() + 250;
      pointer = null;
      root.dataset.dragging = 'false';
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    };
    const click = event => {
      if (performance.now() < suppressUntil && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const cancel = () => { if (pointer) up({ pointerId: pointer.id }); };
    const key = event => {
      if (event.target !== stage) return;
      const directions = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, 2], ArrowDown: [0, -2] };
      if (event.key === 'Home' || event.key === 'Escape') { event.preventDefault(); reset(); schedule(); }
      else if (directions[event.key]) {
        event.preventDefault();
        const [x, y] = directions[event.key];
        target.current = { yaw: clamp(target.current.yaw + x, 19), pitch: clamp(target.current.pitch + y, 7) };
        setMoved(true); schedule();
      }
    };
    const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else schedule(); };
    const resetView = () => schedule();
    stage.addEventListener('pointerdown', down);
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('lostpointercapture', up);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', cancel);
    stage.addEventListener('click', click, true);
    stage.addEventListener('keydown', key);
    root.addEventListener('portalreset', resetView);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      if (pointer && stage.hasPointerCapture(pointer.id)) stage.releasePointerCapture(pointer.id);
      stage.removeEventListener('pointerdown', down);
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerup', up);
      stage.removeEventListener('pointercancel', up);
      stage.removeEventListener('lostpointercapture', up);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', cancel);
      stage.removeEventListener('click', click, true);
      stage.removeEventListener('keydown', key);
      root.removeEventListener('portalreset', resetView);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [rootRef, stageRef]);

  return { view, moved, reset: () => { reset(); rootRef.current?.dispatchEvent(new Event('portalreset')); } };
}
