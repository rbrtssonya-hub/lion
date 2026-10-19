import { useLayoutEffect, useRef } from 'react';
import { media } from '../../config/media.js';
import { lionBookPages } from '../../data/lion-book.js';

const points = lionBookPages.map((_, index) => ({ x: 60 + index * 880 / 6, y: 64 }));

export default function BookTimeline({ book, index: timelineIndex = book.index, send, inkEnabled, playbackEnabled }) {
  const navRef = useRef(null);
  const markerRef = useRef(null);
  const canvasRef = useRef(null);
  const motionRef = useRef(null);
  const initial = useRef({ index: timelineIndex, inkEnabled, playbackEnabled });

  useLayoutEffect(() => {
    const nav = navRef.current, marker = markerRef.current, canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let options = initial.current, position = points[options.index].x;
    let visible = false, frame = null, previousTime = null, move = null;
    let particles = [], width = 1;
    const paintMarker = () => { marker.style.left = `${position / 10}%`; marker.style.top = '64px'; };
    const paintParticles = () => {
      ctx?.clearRect(0, 0, width, 142);
      if (!ctx) return;
      for (const p of particles) {
        ctx.globalAlpha = .85 * (1 - p.age / p.life);
        ctx.fillStyle = p.gold ? '#d8a34c' : '#bc3427';
        ctx.beginPath(); ctx.arc(p.x * width / 1000, p.y, p.size * (1 - p.age / p.life * .65), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    const resize = () => {
      width = nav.getBoundingClientRect().width;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr)); canvas.height = Math.round(142 * dpr);
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0); paintParticles();
    };
    const canPlay = () => visible && options.playbackEnabled && !document.hidden && document.hasFocus();
    const schedule = () => {
      nav.dataset.particlesPlaying = String(canPlay() && !reduced.matches);
      if (!options.inkEnabled || reduced.matches) { particles = []; paintParticles(); }
      if (reduced.matches) { position = points[options.index].x; move = null; paintMarker(); }
      if (frame !== null && (!canPlay() || reduced.matches)) { cancelAnimationFrame(frame); frame = null; previousTime = null; }
      if (frame === null && canPlay() && !reduced.matches && (move || particles.length)) frame = requestAnimationFrame(tick);
    };
    function tick(now) {
      frame = null;
      const delta = previousTime === null ? 0 : Math.min(50, now - previousTime); previousTime = now;
      for (const p of particles) { p.age += delta; p.x += p.vx * delta / 1000; p.y += p.vy * delta / 1000; }
      particles = particles.filter(p => p.age < p.life);
      if (move) {
        const previous = position;
        move.elapsed = Math.min(650, move.elapsed + delta);
        position = move.from + (move.to - move.from) * (1 - (1 - move.elapsed / 650) ** 3);
        paintMarker();
        const distance = Math.abs(position - previous) * width / 1000;
        if (options.inkEnabled && ctx && distance > .2) {
          const count = Math.min(12, Math.ceil(distance / 4));
          for (let i = 0; i < count; i++) {
            particles.push({ x: previous + (position - previous) * i / count, y: 64 + (Math.random() - .5) * 12,
              age: 0, life: 500 + Math.random() * 350, size: 1.3 + Math.random() * 1.8,
              vx: -Math.sign(position - previous) * (5 + Math.random() * 12), vy: (Math.random() - .35) * 18, gold: Math.random() > .65 });
          }
          particles = particles.slice(-80);
        }
        if (move.elapsed === 650) move = null;
      }
      paintParticles();
      if (!move && !particles.length) previousTime = null;
      schedule();
    }
    motionRef.current = next => {
      if (next.index !== options.index) { move = { from: position, to: points[next.index].x, elapsed: 0 }; previousTime = null; }
      options = next; schedule();
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); });
    const resizeObserver = new ResizeObserver(resize);
    observer.observe(nav); resizeObserver.observe(nav);
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('blur', schedule); window.addEventListener('focus', schedule);
    reduced.addEventListener('change', schedule);
    resize(); paintMarker();
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect(); resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', schedule);
      window.removeEventListener('blur', schedule); window.removeEventListener('focus', schedule);
      reduced.removeEventListener('change', schedule); motionRef.current = null;
    };
  }, []);
  useLayoutEffect(() => { motionRef.current?.({ index: timelineIndex, inkEnabled, playbackEnabled }); }, [timelineIndex, inkEnabled, playbackEnabled]);

  return <nav ref={navRef} className="lion-book-timeline" aria-label="醒狮历史时间线" aria-describedby="lion-book-instructions" data-particles-enabled={inkEnabled}>
    <svg className="lion-book-track" viewBox="0 0 1000 142" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <path className="lion-book-track-line" d="M 60 64 H 940" />
    </svg>
    <canvas ref={canvasRef} className="lion-book-particles" aria-hidden="true" />
    <span ref={markerRef} className="lion-book-traveling-lion" aria-hidden="true"><img src={media.navLion} alt="" draggable="false" /></span>
    {lionBookPages.map((page, index) => <button type="button" key={page.id} data-book-page={page.id} className={index === 0 || index === 6 ? 'lion-book-endpoint' : ''}
      style={{ left: `${points[index].x / 10}%`, top: '46px' }}
      aria-label={`翻阅${page.stage}：${page.title}`} aria-current={timelineIndex === index ? 'step' : undefined} disabled={!book.ready || !playbackEnabled}
      onClick={() => send('goTo', index)}>
      <span className="lion-book-node" aria-hidden="true">{index === 0 ? '序' : index === 6 ? '终' : String(index).padStart(2, '0')}</span>
      <span className="lion-book-wave-label">{page.stage}</span><small>{index > 0 && index < 6 ? page.era : index === 0 ? '开启史册' : '南风有狮'}</small>
    </button>)}
  </nav>;
}
