import { useCallback, useEffect, useRef, useState } from 'react';

const storageKey = 'nanfeng-xiaoxing-position-v1';
const margin = 14;
const viewportSize = () => ({ width: window.innerWidth, height: window.innerHeight });
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));
const constrain = (point, viewport, size) => ({
  x: clamp(point.x, margin, viewport.width - size.width - margin),
  y: clamp(point.y, margin, viewport.height - size.height - margin),
});

function defaultPosition(size, viewport, chapter) {
  if (chapter === 'model') return constrain({ x: margin, y: viewport.height - size.height - margin }, viewport, size);
  if (chapter === 'state') return constrain({ x: clamp(viewport.width * .135, 180, 250), y: viewport.height - size.height - margin }, viewport, size);
  return constrain({ x: viewport.width - size.width - 30, y: viewport.height - size.height - 124 }, viewport, size);
}

function initialPosition(size, chapter) {
  const viewport = viewportSize();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)
      && Number.isFinite(saved.width) && saved.width > 0 && Number.isFinite(saved.height) && saved.height > 0) {
      return { point: constrain({ x: saved.x * viewport.width / saved.width, y: saved.y * viewport.height / saved.height }, viewport, size), manual: true };
    }
  } catch { /* The companion remains movable when browser storage is unavailable. */ }
  return { point: defaultPosition(size, viewport, chapter), manual: false };
}

export default function usePetPosition(size, chapter = 'entry') {
  const initial = useRef(null);
  if (!initial.current) initial.current = initialPosition(size, chapter);
  const [position, setPosition] = useState(initial.current.point);
  const [viewport, setViewport] = useState(viewportSize);
  const [dragging, setDragging] = useState(false);
  const pointRef = useRef(position);
  const sizeRef = useRef(size);
  const chapterRef = useRef(chapter);
  const manualRef = useRef(initial.current.manual);
  const gesture = useRef(null);
  const suppressClick = useRef(false);
  sizeRef.current = size;
  chapterRef.current = chapter;

  const moveTo = useCallback(point => {
    const next = constrain(point, viewportSize(), sizeRef.current);
    pointRef.current = next;
    setPosition(next);
    return next;
  }, []);
  const save = useCallback(() => {
    manualRef.current = true;
    try { localStorage.setItem(storageKey, JSON.stringify({ ...pointRef.current, ...viewportSize() })); }
    catch { /* Persistence is optional; never interrupt a drag to report it. */ }
  }, []);

  const cancelGesture = useCallback(() => {
    const active = gesture.current;
    if (!active) return;
    gesture.current = null;
    suppressClick.current = true;
    setDragging(false);
    moveTo(active.from);
    if (active.target.hasPointerCapture(active.pointerId)) active.target.releasePointerCapture(active.pointerId);
  }, [moveTo]);

  useEffect(() => {
    const resize = () => {
      cancelGesture();
      const viewport = viewportSize();
      setViewport(viewport);
      moveTo(manualRef.current ? pointRef.current : defaultPosition(sizeRef.current, viewport, chapterRef.current));
      if (manualRef.current) save();
    };
    window.addEventListener('resize', resize);
    window.addEventListener('blur', cancelGesture);
    return () => { window.removeEventListener('resize', resize); window.removeEventListener('blur', cancelGesture); };
  }, [moveTo, cancelGesture, save]);
  useEffect(() => {
    moveTo(manualRef.current ? pointRef.current : defaultPosition(sizeRef.current, viewportSize(), chapter));
  }, [size.width, size.height, chapter, moveTo]);

  const onPointerDown = event => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick.current = false;
    gesture.current = { pointerId: event.pointerId, target: event.currentTarget, clientX: event.clientX, clientY: event.clientY,
      from: pointRef.current, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = event => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = event.clientX - active.clientX, dy = event.clientY - active.clientY;
    if (!active.moved && Math.hypot(dx, dy) < 6) return;
    active.moved = true;
    suppressClick.current = true;
    setDragging(true);
    moveTo({ x: active.from.x + dx, y: active.from.y + dy });
  };
  const finish = (event, cancelled = false) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    gesture.current = null;
    setDragging(false);
    if (cancelled) { suppressClick.current = true; moveTo(active.from); }
    else if (active.moved) save();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onKeyDown = event => {
    const delta = event.shiftKey ? 40 : 16;
    const direction = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] }[event.key];
    if (!direction || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    moveTo({ x: pointRef.current.x + direction[0], y: pointRef.current.y + direction[1] });
    save();
  };

  return { position, viewport, dragging, consumeClick: () => {
    const ignored = suppressClick.current;
    suppressClick.current = false;
    return ignored;
  }, handlers: { onPointerDown, onPointerMove, onPointerUp: event => finish(event),
    onPointerCancel: event => finish(event, true), onLostPointerCapture: event => finish(event, true), onKeyDown } };
}
