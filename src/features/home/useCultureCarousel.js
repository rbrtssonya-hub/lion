import { useCallback, useEffect, useMemo, useState } from 'react';

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useCultureCarousel(count, { autoplay = true, interval = 6000, resumeDelay = 3000 } = {}) {
  const [position, setPosition] = useState(0);
  const currentIndex = ((position % count) + count) % count;
  const [isHovered, setHovered] = useState(false);
  const [isFocused, setFocused] = useState(false);
  const [isWaiting, setWaiting] = useState(false);
  const [isInView, setInView] = useState(false);
  const [isPageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const isInteracting = isHovered || isFocused;
  const isAutoplaying = autoplay && !reducedMotion && !isInteracting && !isWaiting && isPageVisible && isInView && count > 1;
  const playbackStatus = !autoplay ? 'disabled' : reducedMotion ? 'reduced' : !isPageVisible ? 'hidden'
    : !isInView ? 'offscreen' : isInteracting ? 'focused' : isWaiting ? 'waiting' : 'playing';

  const move = useCallback((step) => {
    setPosition((value) => value + step);
  }, []);
  const next = useCallback(() => move(1), [move]);
  const previous = useCallback(() => move(-1), [move]);
  const select = useCallback((index) => {
    const target = Math.min(Math.max(index, 0), count - 1);
    setPosition((value) => {
      const current = ((value % count) + count) % count;
      let distance = target - current;
      if (distance > count / 2) distance -= count;
      if (distance < -count / 2) distance += count;
      return value + distance;
    });
  }, [count]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = (event) => {
      setReducedMotion(event.matches);
    };
    mediaQuery.addEventListener('change', updateMotion);
    return () => mediaQuery.removeEventListener('change', updateMotion);
  }, []);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    if (isInteracting) {
      setWaiting(true);
      return undefined;
    }
    if (!isWaiting) return undefined;
    const timer = window.setTimeout(() => setWaiting(false), resumeDelay);
    return () => window.clearTimeout(timer);
  }, [isInteracting, isWaiting, resumeDelay]);

  useEffect(() => {
    if (!isAutoplaying) return undefined;
    const timer = window.setTimeout(next, interval);
    return () => window.clearTimeout(timer);
  }, [interval, isAutoplaying, next, position]);

  return useMemo(() => ({
    currentIndex,
    position,
    reducedMotion,
    isPageVisible,
    isAutoplaying,
    playbackStatus,
    isHovered,
    next,
    previous,
    select,
    setHovered,
    setFocused,
    setInView,
  }), [currentIndex, position, isPageVisible, isAutoplaying, playbackStatus, isHovered, next, previous, reducedMotion, select]);
}
