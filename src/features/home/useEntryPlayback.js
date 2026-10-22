import { useCallback, useEffect, useState } from 'react';

const sessionKey = 'nanfeng-lion:intro-seen:v1';
let startedInThisPage = false;

function hasPlayedIntro() {
  try {
    return startedInThisPage || sessionStorage.getItem(sessionKey) === '1';
  } catch {
    return startedInThisPage;
  }
}

export function useEntryPlayback(enabled = true) {
  const [phase, setPhase] = useState(() => hasPlayedIntro() ? 'home' : 'animation');
  const [playbackId, setPlaybackId] = useState(0);
  const introActive = phase === 'video';
  const entryAnimationActive = phase === 'animation';

  useEffect(() => {
    if (phase === 'home' || !enabled) return;
    startedInThisPage = true;
    try {
      sessionStorage.setItem(sessionKey, '1');
    } catch {
      // Keep once-per-visit playback within this page when storage is unavailable.
    }
  }, [phase, enabled]);

  const finishIntro = useCallback(() => setPhase('home'), []);
  const finishVideo = useCallback(() => setPhase('home'), []);
  const finishEntryAnimation = useCallback(() => setPhase('video'), []);
  const replayIntro = useCallback(() => {
    setPlaybackId((value) => value + 1);
    setPhase('animation');
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, []);

  return { introActive, entryAnimationActive, playbackId, finishIntro, finishVideo, finishEntryAnimation, replayIntro };
}
