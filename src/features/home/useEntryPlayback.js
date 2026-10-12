import { useEffect, useState } from 'react';

const sessionKey = 'nanfeng-lion:intro-seen:v1';
let startedInThisPage = false;

function hasPlayedIntro() {
  try {
    return startedInThisPage || sessionStorage.getItem(sessionKey) === '1';
  } catch {
    return startedInThisPage;
  }
}

export function useEntryPlayback() {
  const [introActive, setIntroActive] = useState(() => !hasPlayedIntro());
  const [playbackId, setPlaybackId] = useState(0);

  useEffect(() => {
    if (!introActive) return;
    startedInThisPage = true;
    try {
      sessionStorage.setItem(sessionKey, '1');
    } catch {
      // Keep once-per-visit playback within this page when storage is unavailable.
    }
  }, [introActive]);

  const finishIntro = () => setIntroActive(false);
  const replayIntro = () => {
    setPlaybackId((value) => value + 1);
    setIntroActive(true);
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };

  return { introActive, playbackId, finishIntro, replayIntro };
}
