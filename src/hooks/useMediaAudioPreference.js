import { useSyncExternalStore } from 'react';
import { DEFAULT_VIDEO_VOLUME, normalizeMediaVolume } from '../config/playback.js';

const storageKey = 'nanfeng-lion:media-audio:v1';
const volumeStorageKey = 'nanfeng-lion:media-volume:v1';
const lastVolumeStorageKey = 'nanfeng-lion:media-volume:last-nonzero:v1';
const listeners = new Set();
let audioEnabled = true;
let volume = DEFAULT_VIDEO_VOLUME;
let lastNonzeroVolume = DEFAULT_VIDEO_VOLUME;
try {
  audioEnabled = sessionStorage.getItem(storageKey) !== 'muted';
  const stored = sessionStorage.getItem(volumeStorageKey);
  if (stored !== null) volume = normalizeMediaVolume(stored);
  const previous = sessionStorage.getItem(lastVolumeStorageKey);
  lastNonzeroVolume = previous !== null ? normalizeMediaVolume(previous) : volume || DEFAULT_VIDEO_VOLUME;
  if (lastNonzeroVolume === 0) lastNonzeroVolume = DEFAULT_VIDEO_VOLUME;
  if (volume === 0) audioEnabled = false;
} catch { /* Storage is optional. */ }

const subscribe = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const persistAndNotify = () => {
  try {
    sessionStorage.setItem(storageKey, audioEnabled ? 'enabled' : 'muted');
    sessionStorage.setItem(volumeStorageKey, String(volume));
    sessionStorage.setItem(lastVolumeStorageKey, String(lastNonzeroVolume));
  } catch { /* Keep this page's choice. */ }
  for (const listener of [...listeners]) listener();
};

export function setMediaAudioPreference(enabled) {
  audioEnabled = Boolean(enabled);
  if (audioEnabled && volume === 0) volume = lastNonzeroVolume;
  persistAndNotify();
}

export function getMediaVolumePreference() {
  return volume;
}

export function setMediaVolumePreference(value) {
  volume = normalizeMediaVolume(value);
  if (volume > 0) lastNonzeroVolume = volume;
  audioEnabled = volume > 0;
  persistAndNotify();
  return volume;
}

export function useMediaAudioPreference() {
  const enabled = useSyncExternalStore(subscribe, () => audioEnabled);
  return [enabled, setMediaAudioPreference];
}

export function useMediaVolumePreference() {
  return [useSyncExternalStore(subscribe, getMediaVolumePreference), setMediaVolumePreference];
}

// Call native play in the actual input stack. Synthetic events cannot grant
// autoplay permission, and the sound button owns its own explicit choice.
export function isAudioUnlockGesture(event) {
  return event.isTrusted && !event.target?.closest?.('[data-sound-control]')
    && (event.type !== 'pointerdown' || event.button === 0)
    && (event.type !== 'keydown' || (!event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey));
}
