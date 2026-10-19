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
  const layoutWidth = useRef(null);

  const stop = useCallback(() => {
    for (const [element, animation] of running.current) {
      animation.onfinish = null;
      animation.cancel();
      element.style.removeProperty('will-change');
    }
    running.current.clear();
    if (headerRef.current) {
      headerRef.current.dataset.navAnimating = 'false';
      delete headerRef.current.dataset.navFrom;
    }
  }, [headerRef]);

  const capture = useCallback(() => {
    const header = headerRef.current;
    if (!header) return;
    // Read the composited positions before cancellation, including an interrupted flight.
    pending.current = new Map([...header.querySelectorAll('.site-nav-icon, .site-nav-heading, .site-nav-description, .site-brand-capsule, .site-brand-copy')]
      .map(element => {
        const rect = element.getBoundingClientRect();
        return [element, { left: rect.left, top: rect.top, width: rect.width, height: rect.height,
          opacity: getComputedStyle(element).opacity }];
      }));
    stop();
  }, [headerRef, stop]);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const oldRoute = previousRoute.current;
    const changedRoute = oldRoute !== current;
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

    layoutWidth.current = header.closest('.site-page').getBoundingClientRect().width;
    header.dataset.navFrom = oldRoute === 'entry' ? 'expanded' : 'compact';
    const start = (element, keyframes, properties = 'transform') => {
      element.style.willChange = properties;
      const animation = element.animate(keyframes, {
        duration: settings.navigationDuration,
        easing: navigationEasings[settings.navigationEasing] || navigationEasings.smooth,
        fill: 'both',
      });
      running.current.set(element, animation);
      animation.finished.catch(() => {});
      animation.onfinish = () => {
        if (running.current.get(element) !== animation) return;
        running.current.delete(element);
        animation.onfinish = null;
        animation.cancel();
        element.style.removeProperty('will-change');
        if (!running.current.size) {
          header.dataset.navAnimating = 'false';
          delete header.dataset.navFrom;
        }
      };
    };
    // Titles and helpers retain their own DOM nodes throughout the transition.
    // Keep the full red background stationary and measure all destinations
    // before starting any flight, including an interrupted return.
    const targets = new Map();
    for (const [element] of positions) {
      targets.set(element, element.getBoundingClientRect());
    }
    const coordinateScale = header.getBoundingClientRect().width / parseFloat(getComputedStyle(header).width);
    for (const [element, from] of positions) {
      if (!element.isConnected || typeof element.animate !== 'function' || !from.width) continue;
      const target = targets.get(element);
      const targetOpacity = getComputedStyle(element).opacity;
      if (element.matches('.site-brand-copy')) {
        // The lion's parent already flies. Fade its lettering locally instead
        // of applying the parent's world-space movement a second time.
        if (from.opacity !== targetOpacity) start(element, [
          { opacity: from.opacity, visibility: 'visible' },
          { opacity: targetOpacity, visibility: 'visible' },
        ], 'opacity');
        continue;
      }
      const dx = (from.left - target.left) / coordinateScale;
      // Text keeps the same font but has a tighter compact line box. Align
      // centers so changing line-height cannot make the glyphs jump on frame 1.
      const text = element.matches('.site-nav-heading, .site-nav-description');
      const dy = (from.top - target.top + (text ? (from.height - target.height) / 2 : 0)) / coordinateScale;
      const helper = element.matches('.site-nav-description');
      if (Math.abs(dx) < .5 && Math.abs(dy) < .5 && (!helper || from.opacity === targetOpacity)) continue;
      start(element, [
        { transform: `translate(${dx}px, ${dy}px)`, ...(helper ? { opacity: from.opacity, visibility: 'visible' } : {}) },
        { transform: 'translate(0px, 0px)', ...(helper ? { opacity: targetOpacity, visibility: 'visible' } : {}) },
      ], helper ? 'transform, opacity' : 'transform');
    }
    header.dataset.navAnimating = String(running.current.size > 0);
  }, [headerRef, current, settings.navigationDuration, settings.navigationEasing,
    settings.compactNavGap, settings.compactNavInset, settings.navIconSize,
    settings.navFontSize, settings.helperFontSize, settings.headerHeight, settings.headerWidth, settings.brandPadding,
    settings.homeBrandOffset, stop]);

  useEffect(() => {
    const header = headerRef.current;
    const page = header?.closest('.site-page');
    if (!header || !page) return;
    layoutWidth.current = page.getBoundingClientRect().width;
    const resize = new ResizeObserver(() => {
      const nextWidth = page.getBoundingClientRect().width;
      if (Math.abs(nextWidth - layoutWidth.current) < .5) return;
      layoutWidth.current = nextWidth;
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
