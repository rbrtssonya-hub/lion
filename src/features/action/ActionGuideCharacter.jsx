import { useLayoutEffect, useRef } from 'react';
import { media } from '../../config/media.js';

// Original ZIP animation, baked offline: 256px cells, eight columns, 24fps.
// No skeleton runtime or game engine is shipped to the page.
export default function ActionGuideCharacter({ index }) {
  const hostRef = useRef(null), canvasRef = useRef(null), updateRef = useRef(null);
  const firstIndex = useRef(index);
  useLayoutEffect(() => {
    const host = hostRef.current, canvas = canvasRef.current, ctx = canvas.getContext('2d');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let active = true, visible = false, ready = false, frame = null, last = null;
    let target = 12.5 + firstIndex.current * 25, position = target, move = null, clock = 0;
    let painted = '', images;
    const paint = () => {
      host.style.left = `${position}%`;
      const animation = reduced.matches ? 'poster' : move ? 'mov' : 'idle';
      host.dataset.animation = animation;
      if (!ready || !ctx) return;
      const count = animation === 'mov' ? 12 : 20;
      const cell = animation === 'poster' ? 0 : Math.floor(clock / (1000 / 24)) % count;
      const signature = `${animation}:${cell}:${move?.direction || 1}`;
      if (painted === signature) return;
      painted = signature;
      ctx.clearRect(0, 0, 256, 256);
      ctx.save();
      if (move?.direction === -1) { ctx.translate(256, 0); ctx.scale(-1, 1); }
      ctx.drawImage(images[animation], cell % 8 * 256, Math.floor(cell / 8) * 256, 256, 256, 0, 0, 256, 256);
      ctx.restore();
    };
    const canPlay = () => visible && !document.hidden && document.hasFocus() && !reduced.matches && ready;
    const schedule = () => {
      if (reduced.matches) { position = target; move = null; paint(); }
      host.dataset.playing = String(canPlay());
      if (!canPlay() && frame !== null) { cancelAnimationFrame(frame); frame = null; last = null; }
      if (canPlay() && frame === null) frame = requestAnimationFrame(tick);
    };
    function tick(now) {
      frame = null;
      const delta = last === null ? 0 : Math.min(50, now - last); last = now; clock += delta;
      if (move) {
        move.elapsed = Math.min(480, move.elapsed + delta);
        position = move.from + (target - move.from) * (1 - (1 - move.elapsed / 480) ** 3);
        if (move.elapsed === 480) { move = null; clock = 0; }
      }
      paint(); schedule();
    }
    updateRef.current = next => {
      const destination = 12.5 + next * 25;
      if (destination !== target) {
        target = destination;
        move = { from: position, direction: Math.sign(target - position) || 1, elapsed: 0 }; clock = 0;
      }
      // Navigation stays usable even if a decorative image could not decode.
      if (!ready) { position = target; move = null; }
      paint(); schedule();
    };
    const urls = { idle: media.actionGuideIdle, mov: media.actionGuideMove, poster: media.actionGuidePoster };
    images = Object.fromEntries(Object.entries(urls).map(([name, src]) => { const img = new Image(); img.src = src; return [name, img]; }));
    Promise.all(Object.values(images).map(img => img.decode())).then(() => {
      if (!active || !ctx) return;
      ready = true; paint(); host.dataset.ready = 'true'; schedule();
    }).catch(() => { if (active) host.dataset.ready = 'false'; });
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); });
    observer.observe(host.parentElement);
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('blur', schedule); window.addEventListener('focus', schedule);
    reduced.addEventListener('change', schedule); paint();
    return () => {
      active = false; if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect(); document.removeEventListener('visibilitychange', schedule);
      window.removeEventListener('blur', schedule); window.removeEventListener('focus', schedule);
      reduced.removeEventListener('change', schedule); updateRef.current = null;
    };
  }, []);
  useLayoutEffect(() => { updateRef.current?.(index); }, [index]);
  return <span ref={hostRef} className="action-guide-character" data-ready="false" aria-hidden="true">
    <img src={media.actionGuidePoster} alt="" draggable="false" />
    <canvas ref={canvasRef} width="256" height="256" />
  </span>;
}
