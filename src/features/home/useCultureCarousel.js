import { useCallback, useEffect, useMemo, useState } from 'react';

const INTERVAL = 6000;

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useCultureCarousel(count, interval = INTERVAL) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(() => !prefersReducedMotion());
  const [isHovered, setHovered] = useState(false);
  const [isFocused, setFocused] = useState(false);
  const [isPageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);

  const move = useCallback((step) => {
    setCurrentIndex((value) => (value + step + count) % count);
  }, [count]);
  const next = useCallback(() => move(1), [move]);
  const previous = useCallback(() => move(-1), [move]);
  const select = useCallback((index) => {
    setCurrentIndex(Math.min(Math.max(index, 0), count - 1));
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
    if (!isPlaying || reducedMotion || isHovered || isFocused || !isPageVisible || count < 2) return undefined;
    const timer = window.setInterval(next, interval);
    return () => window.clearInterval(timer);
  }, [count, interval, isFocused, isHovered, isPageVisible, isPlaying, next, reducedMotion]);

  return useMemo(() => ({
    currentIndex,
    isPlaying: isPlaying && !reducedMotion,
    next,
    previous,
    select,
    toggle,
    setHovered,
    setFocused,
  }), [currentIndex, isPlaying, next, previous, reducedMotion, select, toggle]);
}
