import { useEffect, useRef, useState } from 'react';
import '../styles/resize-handles.css';

function clampValue(next, min, max, step) {
  const bounded = Math.min(max, Math.max(min, next));
  const increment = Math.max(1, step);
  return Math.min(max, Math.max(min, min + Math.round((bounded - min) / increment) * increment));
}

/** A full-edge divider with a small visual grip in its centre. */
export default function ResizeHandle({
  label, axis, value, min, max, defaultValue, direction = 1, step = 1,
  className = '', style, onChange, onCommit, onCancel,
}) {
  const [resizing, setResizing] = useState(false);
  const session = useRef(null);
  const frame = useRef(null);
  const mounted = useRef(false);
  const callbacks = useRef({ onChange, onCommit, onCancel });
  callbacks.current = { onChange, onCommit, onCancel };

  function cancelFrame() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }

  function finish(cancel, updateState = true) {
    const active = session.current;
    if (!active) return;
    session.current = null;
    cancelFrame();
    document.documentElement.classList.remove(`lion-resizing-${active.axis}`);
    if (updateState && mounted.current) setResizing(false);

    // Flush the last move before committing; cancellation restores the start value.
    const next = cancel ? active.value : active.current;
    callbacks.current.onChange(next);
    if (cancel) callbacks.current.onCancel?.();
    else callbacks.current.onCommit?.(next);

    try {
      if (active.target.hasPointerCapture?.(active.id)) active.target.releasePointerCapture(active.id);
    } catch { /* The browser may already have released capture after cancellation. */ }
  }

  function move(event) {
    const active = session.current;
    if (!active || active.id !== event.pointerId) return;
    if (event.cancelable) event.preventDefault();
    const coordinate = active.axis === 'x' ? event.clientX : event.clientY;
    active.current = clampValue(
      active.value + (coordinate - active.origin) * active.direction,
      active.min, active.max, active.step,
    );
    if (frame.current !== null || active.current === active.rendered) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (session.current !== active || active.current === active.rendered) return;
      active.rendered = active.current;
      callbacks.current.onChange(active.current);
    });
  }

  useEffect(() => {
    mounted.current = true;
    const cancel = () => finish(true);
    const visibility = () => { if (document.visibilityState === 'hidden') cancel(); };
    const key = (event) => {
      if (event.key !== 'Escape' || !session.current) return;
      event.preventDefault();
      event.stopPropagation();
      cancel();
    };
    const up = (event) => {
      if (session.current?.id !== event.pointerId) return;
      move(event);
      finish(false);
    };
    const pointerCancel = (event) => {
      if (session.current?.id === event.pointerId) cancel();
    };

    // Window listeners also cover browsers that cannot capture this pointer.
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', pointerCancel);
    window.addEventListener('blur', cancel);
    window.addEventListener('pagehide', cancel);
    window.addEventListener('keydown', key, true);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      mounted.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', pointerCancel);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('pagehide', cancel);
      window.removeEventListener('keydown', key, true);
      document.removeEventListener('visibilitychange', visibility);
      finish(true, false);
      cancelFrame();
      document.documentElement.classList.remove(`lion-resizing-${axis}`);
    };
  }, [axis]);

  function apply(next) {
    const bounded = clampValue(next, min, max, step);
    callbacks.current.onChange(bounded);
    callbacks.current.onCommit?.(bounded);
  }

  return <div
    role="separator" tabIndex={0} aria-label={label}
    aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
    aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
    aria-valuetext={`${value} 像素`}
    title={`${label}：拖动或方向键调整，Shift 加速，双击恢复默认`}
    className={`lion-resize-handle lion-resize-handle-${axis} ${className}${resizing ? ' is-resizing' : ''}`}
    style={style}
    onDoubleClick={() => { if (!session.current) apply(defaultValue); }}
    onKeyDown={(event) => {
      const decrease = axis === 'x' ? 'ArrowLeft' : 'ArrowUp';
      const increase = axis === 'x' ? 'ArrowRight' : 'ArrowDown';
      if (![decrease, increase, 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (session.current) return;
      const increment = step * (event.shiftKey ? 10 : 1);
      apply(event.key === 'Home' ? min : event.key === 'End' ? max
        : value + (event.key === increase ? 1 : -1) * direction * increment);
    }}
    onPointerDown={(event) => {
      if (event.button !== 0 || session.current) return;
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      session.current = {
        id: event.pointerId, axis, direction, min, max, step,
        origin: axis === 'x' ? event.clientX : event.clientY,
        value, current: value, rendered: value, target: event.currentTarget,
      };
      try { event.currentTarget.setPointerCapture?.(event.pointerId); }
      catch { /* Window listeners retain the drag if pointer capture is unavailable. */ }
      document.documentElement.classList.add(`lion-resizing-${axis}`);
      setResizing(true);
    }}
    onLostPointerCapture={(event) => {
      if (session.current?.id === event.pointerId) finish(true);
    }}
  >
    <span aria-hidden="true" />
  </div>;
}
