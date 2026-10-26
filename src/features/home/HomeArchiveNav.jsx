import { useLayoutEffect, useRef } from 'react';
import { media } from '../../config/media.js';
import { useHomeNavigationMotion } from './BookTimeline.jsx';
import '../../styles/home-navigation.css';

const sections = [
  { id: 'homeLionBook', label: '岭南醒狮志' },
  { id: 'homeCulture', label: '醒狮文化' },
  { id: 'homeLionTypes', label: '醒狮种类' },
  { id: 'homeCultureSources', label: '参考资料' },
];

export default function HomeArchiveNav({ playbackEnabled = true, particlesEnabled = true, current = 0, visible = false, onSelect, onReturnHome }) {
  const { navRef, markerRef, canvasRef } = useHomeNavigationMotion({ index: current, playbackEnabled, particlesEnabled, visible, vertical: true });
  const buttons = useRef([]);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!visible || !playbackEnabled) { nav.dataset.layoutObserving = 'false'; return; }
    const page = nav.closest('.site-page');
    const header = document.querySelector('.site-header');
    const layout = () => {
      nav.style.left = `${(page?.getBoundingClientRect().left ?? 0) + 12}px`;
      nav.style.setProperty('--archive-nav-header', `${header?.getBoundingClientRect().bottom ?? 0}px`);
    };
    const observer = new ResizeObserver(layout);
    if (page) observer.observe(page);
    if (header) observer.observe(header);
    window.addEventListener('resize', layout);
    nav.dataset.layoutObserving = 'true';
    layout();
    return () => { observer.disconnect(); window.removeEventListener('resize', layout); nav.dataset.layoutObserving = 'false'; };
  }, [navRef, visible, playbackEnabled]);
  const onKeyDown = event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const index = buttons.current.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % sections.length;
    if (event.key === 'ArrowUp') next = (index - 1 + sections.length) % sections.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = sections.length - 1;
    if (next === undefined) return;
    event.preventDefault(); event.stopPropagation(); buttons.current[next]?.focus({ preventScroll: true });
  };
  return <nav ref={navRef} className="home-archive-nav" aria-label="首页章节导航" hidden={!visible}
    data-particles-enabled={particlesEnabled} style={{ '--archive-nav-index': current }} onKeyDown={onKeyDown}>
    <span className="home-archive-nav-track" aria-hidden="true" />
    <canvas ref={canvasRef} className="home-archive-nav-particles" aria-hidden="true" />
    <span ref={markerRef} className="home-archive-nav-lion" aria-hidden="true"><img src={media.navLion} width="48" height="48" alt="" draggable="false" /></span>
    {sections.map((section, index) => <button type="button" key={section.id} data-home-section={section.id}
      ref={node => { buttons.current[index] = node; }} aria-controls={section.id}
      aria-current={current === index ? 'location' : undefined} onClick={() => onSelect(index)}>
      <i data-navigation-stop="" aria-hidden="true" /><span>{section.label}</span>
    </button>)}
    <button type="button" className="home-archive-return interaction-cue" onClick={onReturnHome}>↑ 上滑返回首页</button>
  </nav>;
}
