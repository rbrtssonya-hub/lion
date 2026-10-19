import { useLayoutEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import { useHomeNavigationMotion } from './BookTimeline.jsx';
import '../../styles/home-navigation.css';

const sections = [
  { id: 'homeLionBook', label: '岭南醒狮志' },
  { id: 'homeCulture', label: '醒狮文化' },
  { id: 'homeLionTypes', label: '醒狮种类' },
  { id: 'homeInheritors', label: '传承人物' },
  { id: 'homeCultureSources', label: '参考资料' },
];

function headerBottom() {
  return Math.max(0, document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0);
}

function heading(section) {
  return document.getElementById(section.getAttribute('aria-labelledby')) || section.querySelector('h2') || section;
}

function destination(section) {
  const top = scrollY + heading(section).getBoundingClientRect().top - headerBottom() - 24;
  return Math.max(0, Math.min(top, document.documentElement.scrollHeight - innerHeight));
}

export default function HomeArchiveNav({ playbackEnabled = true, particlesEnabled = true }) {
  const [current, setCurrent] = useState(0), [visible, setVisible] = useState(false);
  const { navRef, markerRef, canvasRef } = useHomeNavigationMotion({ index: current, playbackEnabled, particlesEnabled, visible, vertical: true });
  const buttons = useRef([]), jumpRef = useRef(null);

  useLayoutEffect(() => {
    const nav = navRef.current, home = nav.closest('.home-page');
    const page = nav.closest('.site-page') || home;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let layoutObserver = null, shown = false, focused = document.hasFocus();
    const observeLayout = () => {
      const allowed = shown && playbackEnabled && focused && !document.hidden && !reduced.matches;
      if (!allowed && layoutObserver) { layoutObserver.disconnect(); layoutObserver = null; }
      if (allowed && !layoutObserver) {
        layoutObserver = new ResizeObserver(onLayout);
        for (const node of [page, home, document.querySelector('.site-header')]) if (node) layoutObserver.observe(node);
      }
      nav.dataset.layoutObserving = String(Boolean(layoutObserver));
    };
    const sync = () => {
      const nodes = sections.map(item => home?.querySelector(`#${item.id}`));
      const first = nodes[0], last = nodes.at(-1);
      const boundary = headerBottom();
      // Detect return from the hero without a permanent observer or RAF.
      shown = Boolean(first && last && first.getBoundingClientRect().width > 0 && first.getBoundingClientRect().top <= boundary + 1 && last.getBoundingClientRect().bottom > boundary);
      setVisible(shown);
      observeLayout();
      if (!shown) return;
      const pageBounds = page.getBoundingClientRect();
      nav.style.left = `${pageBounds.left + 12}px`;
      nav.style.setProperty('--archive-nav-header', `${boundary}px`);
      const probe = boundary + 24;
      let next = 0;
      nodes.forEach((node, index) => { if (node && node.getBoundingClientRect().top <= probe + 1) next = index; });
      // A short final credits section may never reach the header at page end.
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2 && last.getBoundingClientRect().top < innerHeight) next = sections.length - 1;
      const jump = jumpRef.current;
      if (jump) {
        if (Math.abs(scrollY - jump.top) <= 2) jumpRef.current = null;
        else next = jump.index;
      }
      setCurrent(next);
    };
    const onLayout = () => {
      const jump = jumpRef.current;
      const section = jump && home?.querySelector(`#${sections[jump.index].id}`);
      if (section) {
        const top = destination(section);
        if (Math.abs(top - jump.top) > 2) {
          jump.top = top;
          window.scrollTo({ top, behavior: reduced.matches ? 'instant' : 'smooth' });
        }
      }
      sync();
    };
    const cancelJump = () => { jumpRef.current = null; sync(); };
    const stopJump = () => {
      if (jumpRef.current) window.scrollTo({ top: scrollY, behavior: 'instant' });
      jumpRef.current = null;
    };
    const onBlur = () => { focused = false; stopJump(); observeLayout(); };
    const onFocus = () => { focused = document.hasFocus(); sync(); };
    const onVisibility = () => { if (document.hidden) stopJump(); sync(); };
    const onReduced = () => {
      if (reduced.matches && jumpRef.current) window.scrollTo({ top: jumpRef.current.top, behavior: 'instant' });
      sync();
    };
    const onPointer = event => { if (!nav.contains(event.target)) cancelJump(); };
    const onKey = event => {
      if (!nav.contains(event.target) && ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) cancelJump();
    };
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', onLayout);
    window.addEventListener('focus', onFocus); window.addEventListener('blur', onBlur);
    window.addEventListener('wheel', cancelJump, { passive: true });
    window.addEventListener('pointerdown', onPointer); window.addEventListener('keydown', onKey);
    window.addEventListener('transitionend', onLayout);
    document.addEventListener('visibilitychange', onVisibility);
    reduced.addEventListener('change', onReduced);
    sync();
    return () => {
      window.removeEventListener('scroll', sync); window.removeEventListener('resize', onLayout);
      layoutObserver?.disconnect(); stopJump();
      window.removeEventListener('focus', onFocus); window.removeEventListener('blur', onBlur);
      window.removeEventListener('wheel', cancelJump); window.removeEventListener('pointerdown', onPointer); window.removeEventListener('keydown', onKey);
      window.removeEventListener('transitionend', onLayout);
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onReduced);
    };
  }, [navRef, playbackEnabled]);

  const select = index => {
    const section = document.getElementById(sections[index].id);
    if (!section) return;
    const top = destination(section);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    jumpRef.current = reduced ? null : { index, top };
    setCurrent(index);
    window.scrollTo({ top, behavior: reduced ? 'instant' : 'smooth' });
  };
  const onKeyDown = event => {
    event.stopPropagation();
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'PageUp' || event.key === 'PageDown') jumpRef.current = null;
    const index = buttons.current.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % sections.length;
    if (event.key === 'ArrowUp') next = (index - 1 + sections.length) % sections.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = sections.length - 1;
    if (next === undefined) return;
    event.preventDefault(); buttons.current[next]?.focus({ preventScroll: true });
  };

  return <nav ref={navRef} className="home-archive-nav" aria-label="首页章节导航" hidden={!visible}
    data-particles-enabled={particlesEnabled} style={{ '--archive-nav-index': current }} onKeyDown={onKeyDown}>
    <span className="home-archive-nav-track" aria-hidden="true" />
    <canvas ref={canvasRef} className="home-archive-nav-particles" aria-hidden="true" />
    <span ref={markerRef} className="home-archive-nav-lion" aria-hidden="true"><img src={media.navLion} width="48" height="48" alt="" draggable="false" /></span>
    {sections.map((section, index) => <button type="button" key={section.id} data-home-section={section.id}
      ref={node => { buttons.current[index] = node; }} aria-controls={section.id}
      aria-current={current === index ? 'location' : undefined} onClick={() => select(index)}>
      <i data-navigation-stop="" aria-hidden="true" /><span>{section.label}</span>
    </button>)}
  </nav>;
}
