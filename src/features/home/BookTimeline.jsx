import { useLayoutEffect, useRef } from 'react';
import { media } from '../../config/media.js';
import { lionBookPages } from '../../data/lion-book.js';
import '../../styles/home-navigation.css';

// Generalize the original ink loop to a vertical rail. Every retarget starts
// from the last painted position; no game/physics runtime is involved.
export function useHomeNavigationMotion({ index, playbackEnabled, particlesEnabled, visible = true, vertical = false, sprite = false, markerDuration = 650 }) {
  const navRef = useRef(null), markerRef = useRef(null), canvasRef = useRef(null), spriteRef = useRef(null);
  const updateRef = useRef(null), latest = useRef(null);
  latest.current = { index, playbackEnabled, particlesEnabled, visible, markerDuration };

  useLayoutEffect(() => {
    const nav = navRef.current, marker = markerRef.current, canvas = canvasRef.current;
    const ctx = canvas.getContext('2d'), spriteCtx = spriteRef.current?.getContext('2d');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let options = latest.current, alive = true, focused = document.hasFocus();
    let frame = null, previousTime = null, move = null, observer = null, focusTimer = null;
    let position = 0, cross = 0, stops = [], particles = [], width = 1, height = 1;
    let inView = false, images = null, ready = false, clock = 0, painted = '';
    const target = () => stops[options.index] ?? stops[0] ?? 0;
    const canPlay = () => options.visible && inView && options.playbackEnabled && focused && !document.hidden && !reduced.matches;
    const paintMarker = () => {
      marker.style.left = `${vertical ? cross : position}px`;
      marker.style.top = `${vertical ? position : cross - 63}px`;
      if (!sprite) return;
      const animation = reduced.matches ? 'poster' : move ? 'mov' : 'idle';
      marker.dataset.animation = animation;
      if (!ready || !spriteCtx) return;
      const fps = animation === 'mov' ? 30 : 24;
      const cell = animation === 'poster' ? 0 : Math.floor(clock / (1000 / fps)) % (animation === 'mov' ? 12 : 20);
      const direction = move?.direction || 1;
      const signature = `${animation}:${cell}:${direction}`;
      if (signature === painted) return;
      painted = signature;
      spriteCtx.clearRect(0, 0, 256, 256);
      spriteCtx.save();
      if (direction < 0) { spriteCtx.translate(256, 0); spriteCtx.scale(-1, 1); }
      spriteCtx.drawImage(images[animation], cell % 8 * 256, Math.floor(cell / 8) * 256, 256, 256, 0, 0, 256, 256);
      spriteCtx.restore();
    };
    const paintParticles = () => {
      ctx?.clearRect(0, 0, width, height);
      if (!ctx) return;
      for (const p of particles) {
        ctx.globalAlpha = .85 * (1 - p.age / p.life);
        ctx.fillStyle = vertical ? '#bc3427' : p.gold ? '#d8a34c' : '#bc3427';
        ctx.beginPath();
        ctx.arc(vertical ? p.cross : p.position, vertical ? p.position : p.cross,
          p.size * (1 - p.age / p.life * .65), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    const measure = () => {
      const bounds = nav.getBoundingClientRect();
      width = bounds.width; height = bounds.height;
      inView = width > 0 && height > 0 && bounds.bottom > 0 && bounds.top < innerHeight;
      const nodes = [...nav.querySelectorAll('[data-navigation-stop]')].map(node => node.getBoundingClientRect());
      stops = nodes.map(box => vertical ? box.top + box.height / 2 - bounds.top : box.left + box.width / 2 - bounds.left);
      cross = nodes.length ? vertical ? nodes[0].left + nodes[0].width / 2 - bounds.left : nodes[0].top + nodes[0].height / 2 - bounds.top : 0;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr)); canvas.height = Math.max(1, Math.round(height * dpr));
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      position = target(); move = null; particles = [];
      paintMarker(); paintParticles();
    };
    const schedule = () => {
      // CSS media changes may deliver a resize before the media change event.
      // Reconcile resources with the same policy every time drawing is scheduled.
      observe();
      if (!options.particlesEnabled || reduced.matches || !options.visible) { particles = []; paintParticles(); }
      if (reduced.matches || !options.visible || !options.playbackEnabled) {
        position = target(); move = null; paintMarker();
      }
      const playing = canPlay() && Boolean(move || particles.length || (sprite && ready));
      nav.dataset.playing = String(playing);
      nav.dataset.particlesPlaying = String(canPlay() && options.particlesEnabled && Boolean(move || particles.length));
      marker.dataset.playing = String(playing);
      if (!playing && frame !== null) { cancelAnimationFrame(frame); frame = null; previousTime = null; }
      if (playing && frame === null) frame = requestAnimationFrame(tick);
    };
    function tick(now) {
      frame = null;
      const delta = previousTime === null ? 0 : Math.min(50, now - previousTime);
      previousTime = now; clock += delta;
      for (const p of particles) { p.age += delta; p.position += p.velocity * delta / 1000; }
      particles = particles.filter(p => p.age < p.life);
      if (move) {
        const previous = position;
        move.elapsed = Math.min(options.markerDuration, move.elapsed + delta);
        position = move.from + (target() - move.from) * (1 - (1 - move.elapsed / options.markerDuration) ** 3);
        const distance = Math.abs(position - previous);
        if (options.particlesEnabled && ctx && distance > .2) {
          const count = Math.min(12, Math.ceil(distance / 4));
          for (let i = 0; i < count; i++) particles.push({
            position: previous + (position - previous) * i / count, cross: cross + (Math.random() - .5) * (vertical ? 6 : 12),
            age: 0, life: 500 + Math.random() * 350, size: 1.3 + Math.random() * 1.8,
            velocity: -Math.sign(position - previous) * (5 + Math.random() * 12), gold: Math.random() > .65,
          });
          particles = particles.slice(-80);
        }
        if (move.elapsed === options.markerDuration) { move = null; clock = 0; }
      }
      paintMarker(); paintParticles();
      if (!move && !particles.length && !sprite) previousTime = null;
      schedule();
    }
    // Hidden, reduced and background navigations own no observer or RAF.
    // Static scroll tracking still works without scheduling animation.
    const observe = () => {
      const allowed = options.visible && options.playbackEnabled && focused && !document.hidden && !reduced.matches && inView;
      if (!allowed && observer) { observer.disconnect(); observer = null; }
      if (allowed && !observer) {
        observer = new ResizeObserver(() => {
          const bounds = nav.getBoundingClientRect();
          if (Math.abs(bounds.width - width) > .5 || Math.abs(bounds.height - height) > .5) measure();
          schedule();
        });
        observer.observe(nav);
      }
      nav.dataset.observing = String(Boolean(observer));
    };
    const visibility = () => {
      const bounds = nav.getBoundingClientRect();
      inView = bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < innerHeight;
      schedule();
    };
    const resize = () => { measure(); schedule(); };
    const blur = event => {
      focused = false; visibility(); clearTimeout(focusTimer);
      // Moving into the real sandbox blurs its parent window without leaving
      // this document. Recheck after that native focus transfer has finished.
      if (event.isTrusted) focusTimer = setTimeout(() => {
        if (alive && document.hasFocus() && document.activeElement?.tagName === 'IFRAME') { focused = true; visibility(); }
      }, 0);
    };
    const focus = () => { focused = document.hasFocus(); visibility(); };
    updateRef.current = next => {
      const changed = next.index !== options.index;
      const becomingVisible = next.visible && !options.visible;
      options = next;
      if (becomingVisible) measure();
      if (changed && !becomingVisible) {
        move = { from: position, direction: Math.sign(target() - position) || 1, elapsed: 0 };
        previousTime = performance.now(); clock = 0;
      }
      paintMarker(); visibility();
    };
    if (sprite) {
      images = Object.fromEntries(Object.entries({ idle: media.actionGuideIdle, mov: media.actionGuideMove, poster: media.actionGuidePoster })
        .map(([name, src]) => { const image = new Image(); image.src = src; return [name, image]; }));
      Promise.all(Object.values(images).map(image => image.decode())).then(() => {
        if (!alive) return;
        ready = true; marker.dataset.ready = 'true'; paintMarker(); schedule();
      }).catch(() => { if (alive) marker.dataset.ready = 'false'; });
    }
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur); window.addEventListener('focus', focus);
    window.addEventListener('scroll', visibility, { passive: true }); window.addEventListener('resize', resize);
    reduced.addEventListener('change', visibility);
    resize();
    return () => {
      alive = false;
      clearTimeout(focusTimer);
      if (frame !== null) cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus);
      window.removeEventListener('scroll', visibility); window.removeEventListener('resize', resize);
      reduced.removeEventListener('change', visibility); updateRef.current = null;
    };
  }, [vertical, sprite, markerDuration]);
  useLayoutEffect(() => { updateRef.current?.(latest.current); }, [index, playbackEnabled, particlesEnabled, visible, markerDuration]);
  return { navRef, markerRef, canvasRef, spriteRef };
}

export default function BookTimeline({ book, index: timelineIndex = book.index, send, inkEnabled = true, playbackEnabled = true }) {
  const { navRef, markerRef, canvasRef, spriteRef } = useHomeNavigationMotion({
    index: timelineIndex, playbackEnabled, particlesEnabled: inkEnabled, sprite: true, markerDuration: 400,
  });
  const buttons = useRef([]);
  const onKeyDown = event => {
    // The parent also handles book keys: never send a second engine command.
    event.stopPropagation();
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const index = buttons.current.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % lionBookPages.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + lionBookPages.length) % lionBookPages.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = lionBookPages.length - 1;
    if (next === undefined) return;
    event.preventDefault(); buttons.current[next]?.focus({ preventScroll: true });
    if (book.ready && playbackEnabled) send('goTo', next);
  };
  return <nav ref={navRef} className="lion-book-timeline lion-book-game-nav" aria-label="醒狮历史时间线"
    aria-describedby="lion-book-instructions" data-particles-enabled={inkEnabled} style={{ '--book-nav-index': timelineIndex }} onKeyDown={onKeyDown}>
    <span className="lion-book-game-track" aria-hidden="true" />
    <canvas ref={canvasRef} className="lion-book-particles" aria-hidden="true" />
    <span ref={markerRef} className="lion-book-guide-character" data-ready="false" aria-hidden="true">
      <img src={media.actionGuidePoster} alt="" draggable="false" />
      <canvas ref={spriteRef} width="256" height="256" />
    </span>
    {lionBookPages.map((page, index) => <button type="button" key={page.id} ref={node => { buttons.current[index] = node; }}
      data-book-page={page.id} aria-label={`翻阅${page.stage}：${page.title}`}
      aria-current={timelineIndex === index ? 'step' : undefined} disabled={!book.ready || !playbackEnabled}
      onClick={() => send('goTo', index)}>
      <i className="lion-book-game-platform" data-navigation-stop="" data-step={String(index + 1).padStart(2, '0')} aria-hidden="true" />
      <span className="lion-book-wave-label">{page.stage}</span>
    </button>)}
  </nav>;
}
