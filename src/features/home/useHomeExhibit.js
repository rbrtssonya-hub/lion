import { useCallback, useLayoutEffect, useRef, useState } from 'react';

// The hero and the archive are two vertical destinations. Inside the archive,
// only its four navigation buttons change the displayed exhibit.
export default function useHomeExhibit(enabled) {
  const archiveRef = useRef(null);
  const destination = useRef('hero');
  const wheelInput = useRef({ amount: 0, time: 0 });
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const target = useCallback(() => {
    const archive = archiveRef.current;
    return archive ? Math.max(0, scrollY + archive.getBoundingClientRect().top - (document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0)) : 0;
  }, []);
  const scroll = useCallback(top => {
    window.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, []);
  const enter = useCallback(() => { destination.current = 'archive'; setActive(0); scroll(target()); }, [scroll, target]);
  const select = useCallback(index => { destination.current = 'archive'; setActive(index); scroll(target()); }, [scroll, target]);
  const returnHome = useCallback(() => { destination.current = 'hero'; scroll(0); }, [scroll]);
  const wheel = useCallback(deltaY => {
    if (!enabled) return;
    const input = wheelInput.current, now = performance.now();
    if (now - input.time > 180 || Math.sign(input.amount) !== Math.sign(deltaY)) input.amount = 0;
    input.time = now; input.amount += deltaY;
    if (Math.abs(input.amount) < 36) return;
    if (input.amount > 0 && scrollY < target() - 3) enter();
    if (input.amount < 0 && scrollY > 1) returnHome();
    input.amount = 0;
  }, [enabled, enter, returnHome, target]);

  useLayoutEffect(() => {
    if (!enabled) {
      destination.current = 'hero';
      wheelInput.current = { amount: 0, time: 0 };
      setVisible(false);
      return;
    }
    const archive = archiveRef.current;
    const home = archive.closest('.home-page');
    const inputSurface = home.closest('.site-page') || home;
    const sync = () => setVisible(enabled && scrollY >= target() - 3 && target() > 0);
    const onResize = () => {
      if (enabled && destination.current === 'archive') window.scrollTo({ top: target(), behavior: 'instant' });
      sync();
    };
    const onWheel = event => {
      if (!enabled || event.ctrlKey || event.defaultPrevented || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (event.target.closest('input, textarea, select, [role="slider"]')) return;
      // Long source lists and reading columns retain native local scrolling.
      for (let node = event.target; node && node !== inputSurface; node = node.parentElement) {
        if (!/(auto|scroll)/.test(getComputedStyle(node).overflowY) || node.scrollHeight <= node.clientHeight + 2) continue;
        if (event.deltaY < 0 && node.scrollTop > 1 || event.deltaY > 0 && node.scrollTop + node.clientHeight < node.scrollHeight - 1) return;
      }
      event.preventDefault();
      wheel(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1));
    };
    const onKey = event => {
      if (!enabled || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!inputSurface.contains(event.target) && !['BODY', 'HTML'].includes(event.target.tagName)) return;
      for (let node = event.target; node && node !== inputSurface && inputSurface.contains(node); node = node.parentElement) {
        if (!/(auto|scroll)/.test(getComputedStyle(node).overflowY) || node.scrollHeight <= node.clientHeight + 2) continue;
        if (event.key === 'Home' || event.key === 'End' || event.key === 'PageUp' && node.scrollTop > 1 || (event.key === 'PageDown' || event.key === ' ') && node.scrollTop + node.clientHeight < node.scrollHeight - 1) return;
      }
      if (event.key === 'PageDown' || event.key === ' ' && !event.shiftKey && !event.target.closest('button, a')) { event.preventDefault(); if (scrollY < target() - 3) enter(); }
      if (event.key === 'PageUp' || event.key === 'Home') { event.preventDefault(); returnHome(); }
    };
    const observer = new ResizeObserver(onResize);
    const header = document.querySelector('.site-header');
    if (header) observer.observe(header);
    observer.observe(home);
    inputSurface.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', onResize);
    sync();
    return () => {
      observer.disconnect();
      inputSurface.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', sync);
      window.removeEventListener('resize', onResize);
    };
  }, [enabled, enter, returnHome, target, wheel]);
  return { archiveRef, active, visible, enter, select, returnHome, wheel };
}
