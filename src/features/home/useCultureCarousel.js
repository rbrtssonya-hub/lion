import { useCallback, useEffect, useMemo, useState } from 'react';
import { homeCultureStories } from '../../data/home-culture.js';

export const CULTURE_CAROUSEL_INTERVAL = 6000;

export function useCultureCarousel(stories = homeCultureStories) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isDocumentHidden, setIsDocumentHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  const activeStory = useMemo(() => stories[activeIndex] ?? stories[0], [activeIndex, stories]);
  const canAutoAdvance = isPlaying && !isHovered && !isFocused && !isDocumentHidden && !prefersReducedMotion;

  const goTo = useCallback((nextIndex) => {
    setActiveIndex((current) => {
      const normalized = Number.isFinite(nextIndex) ? nextIndex : current;
      return (normalized + stories.length) % stories.length;
    });
  }, [stories.length]);

  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const previous = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);
  const togglePlaying = useCallback(() => setIsPlaying((playing) => !playing), []);

  useEffect(() => {
    if (!canAutoAdvance || stories.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % stories.length);
    }, CULTURE_CAROUSEL_INTERVAL);
    return () => window.clearInterval(timer);
  }, [canAutoAdvance, stories.length]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = (event) => setPrefersReducedMotion(event.matches);
    const updateVisibility = () => setIsDocumentHidden(document.hidden);
    mediaQuery.addEventListener?.('change', updateMotionPreference);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      mediaQuery.removeEventListener?.('change', updateMotionPreference);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  return {
    activeIndex,
    activeStory,
    isPlaying: isPlaying && !prefersReducedMotion,
    isAutoAdvancing: canAutoAdvance,
    goTo,
    next,
    previous,
    togglePlaying,
    pauseOnHover: () => setIsHovered(true),
    resumeAfterHover: () => setIsHovered(false),
    pauseOnFocus: () => setIsFocused(true),
    resumeAfterFocus: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false);
    },
  };
}
