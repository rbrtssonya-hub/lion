import { useSyncExternalStore } from 'react';

const storageKey = 'nanfeng-lion:media-audio:v1';
const listeners = new Set();
let audioEnabled = true;
try { audioEnabled = sessionStorage.getItem(storageKey) !== 'muted'; } catch { /* Storage is optional. */ }

export function setMediaAudioPreference(enabled) {
  audioEnabled = Boolean(enabled);
  try { sessionStorage.setItem(storageKey, audioEnabled ? 'enabled' : 'muted'); } catch { /* Keep this page's choice. */ }
  for (const listener of [...listeners]) listener();
}

export function useMediaAudioPreference() {
  const enabled = useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, () => audioEnabled);
  return [enabled, setMediaAudioPreference];
}

// Call native play in the actual input stack. Synthetic events cannot grant
// autoplay permission, and the sound button owns its own explicit choice.
export function isAudioUnlockGesture(event) {
  return event.isTrusted && !event.target?.closest?.('[data-sound-control]')
    && (event.type !== 'pointerdown' || event.button === 0)
    && (event.type !== 'keydown' || (!event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey));
}
