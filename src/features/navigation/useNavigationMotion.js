import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

export const navigationEasings = Object.freeze({
  smooth: 'cubic-bezier(0.65, 0, 0.35, 1)',
  swift: 'cubic-bezier(0.22, 1, 0.36, 1)',
  soft: 'cubic-bezier(0.4, 0, 0.2, 1)',
});

export function useNavigationMotion(headerRef, current, settings) {
  const pending = useRef(null);
  const running = useRef(new Map());
  const previousRoute = useRef(current);

  const stop = useCallback(() => {
    for (const [icon, animation] of running.current) {
      animation.onfinish = null;
      animation.cancel();
      icon.style.removeProperty('will-change');
    }
    running.current.clear();
    if (headerRef.current) headerRef.current.dataset.navAnimating = 'false';
  }, [headerRef]);

  const capture = useCallback(() => {
    const header = headerRef.current;
    if (!header) return;
    // Read the composited positions before cancellation, including an interrupted flight.
    pending.current = new Map([...header.querySelectorAll('.site-nav-icon')]
      .map(icon => [icon, icon.getBoundingClientRect().left]));
    stop();
  }, [headerRef, stop]);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const changedRoute = previousRoute.current !== current;
    previousRoute.current = current;
    if (!changedRoute) {
      pending.current = null;
      stop();
      return;
    }
    const positions = pending.current;
    pending.current = null;
    stop();
    if (!positions || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    for (const [icon, from] of positions) {
      if (!icon.isConnected || typeof icon.animate !== 'function') continue;
      const delta = from - icon.getBoundingClientRect().left;
      if (Math.abs(delta) < .5) continue;
      icon.style.willChange = 'transform';
      const animation = icon.animate([
        { transform: `translateX(${delta}px)` },
        { transform: 'translateX(0px)' },
      ], {
        duration: settings.navigationDuration,
        easing: navigationEasings[settings.navigationEasing] || navigationEasings.smooth,
        fill: 'both',
      });
      running.current.set(icon, animation);
      animation.finished.catch(() => {});
      animation.onfinish = () => {
        if (running.current.get(icon) !== animation) return;
        running.current.delete(icon);
        animation.onfinish = null;
        animation.cancel();
        icon.style.removeProperty('will-change');
        if (!running.current.size) header.dataset.navAnimating = 'false';
      };
    }
    header.dataset.navAnimating = String(running.current.size > 0);
  }, [headerRef, current, settings.navigationDuration, settings.navigationEasing,
    settings.compactNavGap, settings.compactNavInset, settings.navIconSize,
    settings.navFontSize, settings.helperFontSize, settings.headerHeight, settings.brandPadding, stop]);

  useEffect(() => {
    const header = headerRef.current;
    const page = header?.closest('.site-page');
    if (!header || !page) return;
    let width = page.getBoundingClientRect().width;
    const resize = new ResizeObserver(() => {
      const nextWidth = page.getBoundingClientRect().width;
      if (Math.abs(nextWidth - width) < .5) return;
      width = nextWidth;
      pending.current = null;
      stop();
    });
    resize.observe(page);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduceMotion = () => { if (reduced.matches) { pending.current = null; stop(); } };
    reduced.addEventListener('change', reduceMotion);
    return () => {
      resize.disconnect();
      reduced.removeEventListener('change', reduceMotion);
      pending.current = null;
      stop();
    };
  }, [headerRef, stop]);

  return capture;
}
