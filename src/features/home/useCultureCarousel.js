import { useCallback, useEffect, useMemo, useState } from 'react';

const INTERVAL = 6000;

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useCultureCarousel(count, interval = INTERVAL) {
  const [position, setPosition] = useState(0);
  const currentIndex = ((position % count) + count) % count;
  const [isPlaying, setIsPlaying] = useState(() => !prefersReducedMotion());
  const [isHovered, setHovered] = useState(false);
  const [isFocused, setFocused] = useState(false);
  const [isInView, setInView] = useState(false);
  const [isPageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const isAutoplaying = isPlaying && !reducedMotion && !isHovered && !isFocused && isPageVisible && isInView && count > 1;

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
  const toggle = useCallback(() => setIsPlaying((value) => !value), []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = (event) => {
      setReducedMotion(event.matches);
      if (event.matches) setIsPlaying(false);
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
    if (!isAutoplaying) return undefined;
    const timer = window.setInterval(next, interval);
    return () => window.clearInterval(timer);
  }, [interval, isAutoplaying, next]);

  return useMemo(() => ({
    currentIndex,
    position,
    reducedMotion,
    isPageVisible,
    isAutoplaying,
    isPlaying: isPlaying && !reducedMotion,
    next,
    previous,
    select,
    toggle,
    setHovered,
    setFocused,
    setInView,
  }), [currentIndex, position, isPageVisible, isPlaying, isAutoplaying, next, previous, reducedMotion, select, toggle]);
}
