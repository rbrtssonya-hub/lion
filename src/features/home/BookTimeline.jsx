import { useLayoutEffect, useMemo, useRef } from 'react';
import { media } from '../../config/media.js';
import { lionBookPages } from '../../data/lion-book.js';

const points = lionBookPages.map((_, index) => ({ x: 60 + index * 880 / 6, y: [64, 38, 64, 90, 64, 38, 64][index] }));
const segments = points.slice(1).map((point, index) => {
  const previous = points[index];
  return `M ${previous.x} ${previous.y} C ${previous.x + 49} ${previous.y}, ${point.x - 49} ${point.y}, ${point.x} ${point.y}`;
});
const curve = `M ${points[0].x} ${points[0].y}` + segments.map(segment => segment.slice(segment.indexOf(' C'))).join('');

export default function BookTimeline({ book, send, inkEnabled, playbackEnabled }) {
  const navRef = useRef(null);
  const markerRef = useRef(null);
  const pathRef = useRef(null);
  const trailRef = useRef(null);
  const washRef = useRef(null);
  const motionRef = useRef(null);
  const initial = useRef({ index: book.index, inkEnabled, playbackEnabled });
  const filterId = useMemo(() => `book-ink-${crypto.randomUUID()}`, []);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const path = pathRef.current;
    const marker = markerRef.current;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    // Measure each cubic, not index/6: different slopes need different lengths.
    const lengths = [0];
    for (const d of segments) {
      const part = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      part.setAttribute('d', d);
      lengths.push(lengths.at(-1) + part.getTotalLength());
    }
    const total = path.getTotalLength();
    let options = initial.current;
    let position = lengths[options.index];
    let visible = false;
    let frame = null;
    let previousTime = null;
    let move = null;
    let fading = null;

    const paintMarker = () => {
      const point = path.getPointAtLength(position);
      marker.style.left = `${point.x / 10}%`;
      marker.style.top = `${point.y}px`;
    };
    const paintTrail = (from = position, to = position, opacity = 0) => {
      for (const element of [trailRef.current, washRef.current]) {
        element.style.strokeDasharray = `${Math.abs(to - from)} ${total + 1}`;
        element.style.strokeDashoffset = `${-Math.min(from, to)}`;
        element.style.opacity = options.inkEnabled && !reduced.matches ? String(opacity) : '0';
      }
    };
    const canPlay = () => visible && options.playbackEnabled && !document.hidden && document.hasFocus();
    const schedule = () => {
      nav.dataset.inkPlaying = String(canPlay() && !reduced.matches);
      if (reduced.matches) {
        position = lengths[options.index]; move = null; fading = null;
        paintMarker(); paintTrail();
      }
      if (frame !== null && (!canPlay() || reduced.matches)) {
        cancelAnimationFrame(frame); frame = null; previousTime = null;
      }
      if (frame === null && canPlay() && !reduced.matches && (move || fading)) frame = requestAnimationFrame(tick);
    };
    function tick(now) {
      frame = null;
      const delta = previousTime === null ? 0 : now - previousTime;
      previousTime = now;
      if (move) {
        move.elapsed = Math.min(650, move.elapsed + delta);
        const progress = 1 - (1 - move.elapsed / 650) ** 3;
        position = move.from + (move.to - move.from) * progress;
        paintMarker(); paintTrail(move.from, position, .76);
        if (move.elapsed === 650) {
          fading = { from: move.from, to: move.to, elapsed: 0 };
          move = null;
        }
      } else if (fading) {
        fading.elapsed = Math.min(900, fading.elapsed + delta);
        paintTrail(fading.from, fading.to, .76 * (1 - fading.elapsed / 900));
        if (fading.elapsed === 900) fading = null;
      }
      if (!move && !fading) previousTime = null;
      schedule();
    }
    motionRef.current = next => {
      if (next.index !== options.index) {
        move = { from: position, to: lengths[next.index], elapsed: 0 };
        fading = null; previousTime = null;
        paintTrail();
      }
      options = next;
      if (!next.inkEnabled) paintTrail();
      schedule();
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); });
    observer.observe(nav);
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('blur', schedule);
    window.addEventListener('focus', schedule);
    reduced.addEventListener('change', schedule);
    paintMarker(); paintTrail();
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', schedule);
      window.removeEventListener('blur', schedule);
      window.removeEventListener('focus', schedule);
      reduced.removeEventListener('change', schedule);
      motionRef.current = null;
    };
  }, []);

  useLayoutEffect(() => { motionRef.current?.({ index: book.index, inkEnabled, playbackEnabled }); }, [book.index, inkEnabled, playbackEnabled]);

  return <nav ref={navRef} className="lion-book-timeline" aria-label="醒狮历史时间线" aria-describedby="lion-book-instructions" data-ink-enabled={inkEnabled}>
    <svg className="lion-book-wave" viewBox="0 0 1000 142" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <defs><filter id={filterId} x="-10%" y="-100%" width="120%" height="300%"><feTurbulence type="fractalNoise" baseFrequency=".035 .14" numOctaves="2" seed="8" result="grain" /><feDisplacementMap in="SourceGraphic" in2="grain" scale="3" xChannelSelector="R" yChannelSelector="G" /><feGaussianBlur stdDeviation=".6" /></filter></defs>
      <path className="lion-book-wave-wash" d={curve} filter={`url(#${filterId})`} />
      <path ref={pathRef} className="lion-book-wave-line" d={curve} />
      <path className="lion-book-wave-gold" d={curve} />
      <path ref={washRef} className="lion-book-ink-wash" d={curve} filter={`url(#${filterId})`} />
      <path ref={trailRef} className="lion-book-ink-trail" d={curve} />
    </svg>
    <span ref={markerRef} className="lion-book-traveling-lion" aria-hidden="true"><img src={media.navLion} alt="" draggable="false" /></span>
    {lionBookPages.map((page, index) => <button type="button" key={page.id} data-book-page={page.id} className={index === 0 || index === 6 ? 'lion-book-endpoint' : ''}
      style={{ left: `${points[index].x / 10}%`, top: `${points[index].y - 18}px` }}
      aria-label={`翻阅${page.stage}：${page.title}`} aria-current={book.index === index ? 'step' : undefined} disabled={!book.ready || !playbackEnabled}
      onClick={() => send('goTo', index)}>
      <span className="lion-book-node" aria-hidden="true">{index === 0 ? '序' : index === 6 ? '终' : String(index).padStart(2, '0')}</span>
      <span className="lion-book-wave-label">{page.stage}</span><small>{index > 0 && index < 6 ? page.era : index === 0 ? '开启史册' : '南风有狮'}</small>
    </button>)}
  </nav>;
}
