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
    pending.current = new Map([...header.querySelectorAll('.site-nav-symbol, .site-nav-copy, .site-brand-capsule')]
      .map(element => {
        const rect = element.getBoundingClientRect();
        return [element, { left: rect.left, top: rect.top, width: rect.width, height: rect.height,
          opacity: Number(getComputedStyle(element).opacity) }];
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
    const start = (element, keyframes) => {
      element.style.willChange = 'transform, opacity';
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
    for (const [element, from] of positions) {
      if (!element.isConnected || typeof element.animate !== 'function' || !from.width) continue;
      const copy = element.classList.contains('site-nav-copy');
      const retiringHome = current !== 'entry' && element.closest('[data-route="entry"]');
      if (retiringHome && oldRoute !== 'entry') continue;
      const style = getComputedStyle(element);
      const targetTransform = style.transform === 'none' ? 'translate(0px, 0px)' : style.transform;
      const targetOpacity = retiringHome ? 0 : Number(style.opacity);
      if (copy && from.opacity === 0 && targetOpacity === 0) continue;
      // Neutralize only the target transform while measuring its layout box.
      // The captured box includes any interrupted animation, so a new flight
      // starts from the actually visible text/brand position without a flash.
      element.style.transform = 'none';
      const target = element.getBoundingClientRect();
      element.style.removeProperty('transform');
      const dx = from.left - target.left;
      const dy = from.top - target.top;
      const fromScale = copy ? ` scale(${from.width / Math.max(1, target.width)}, ${from.height / Math.max(1, target.height)})` : '';
      if (!copy && !retiringHome && Math.abs(dx) < .5 && Math.abs(dy) < .5) continue;
      const fromTransform = `translate(${dx}px, ${dy}px)${fromScale}`;
      if (copy) {
        // Both title and helper text move and compress as one readable group.
        start(element, [
          { transform: fromTransform, opacity: from.opacity },
          { transform: targetTransform, opacity: targetOpacity },
        ]);
      } else {
        start(element, [
          { transform: fromTransform, opacity: from.opacity },
          { transform: 'translate(0px, 0px)', opacity: targetOpacity },
        ]);
      }
    }
    header.dataset.navAnimating = String(running.current.size > 0);
  }, [headerRef, current, settings.navigationDuration, settings.navigationEasing,
    settings.compactNavGap, settings.compactNavInset, settings.navIconSize,
    settings.navFontSize, settings.helperFontSize, settings.headerHeight, settings.brandPadding,
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
