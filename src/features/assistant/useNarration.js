import { useCallback, useEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import { chooseChineseFemaleVoice, fixedNarrationChapter, narrationMediaKeys, voiceProfile } from './voiceProfile.js';

// Keep the site's chosen volume as a base, then temporarily lower only DOM
// media around this narration. The narration Audio is detached from the DOM.
function duckPageMedia() {
  const mediaStates = new Map();
  const epsilon = 0.00001;
  let released = false;
  const isPageMedia = element => element && /^(VIDEO|AUDIO)$/.test(element.tagName) && document.contains(element);
  const getState = element => {
    if (!mediaStates.has(element)) mediaStates.set(element, { base: element.volume, expected: null });
    return mediaStates.get(element);
  };
  const lower = (element, state) => {
    if (element.paused || element.ended || element.muted || !state.base) return;
    state.expected = state.base * 0.18;
    element.volume = state.expected;
  };
  const update = event => {
    const element = event.target;
    if (released || !isPageMedia(element)) return;
    const state = getState(element);
    // A queued event from our own assignment (or a mute-only change) leaves
    // the user volume alone. A new volume becomes the new base immediately.
    if (state.expected !== null && Math.abs(element.volume - state.expected) < epsilon) return;
    state.base = element.volume;
    state.expected = null;
    lower(element, state);
  };
  const onPlay = event => {
    const element = event.target;
    if (released || !isPageMedia(element)) return;
    const state = getState(element);
    if (state.expected === null || Math.abs(element.volume - state.expected) >= epsilon) state.base = element.volume;
    lower(element, state);
  };
  document.addEventListener('volumechange', update, true);
  document.addEventListener('play', onPlay, true);
  document.querySelectorAll('video, audio').forEach(element => lower(element, getState(element)));
  return () => {
    if (released) return;
    released = true;
    document.removeEventListener('volumechange', update, true);
    document.removeEventListener('play', onPlay, true);
    for (const [element, state] of mediaStates) {
      // If the user changed volume just before stop and its event is still
      // queued, preserve that value rather than restoring an older base.
      if (state.expected !== null && Math.abs(element.volume - state.expected) < epsilon) element.volume = state.base;
    }
    mediaStates.clear();
  };
}

export default function useNarration() {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const [enabled, setEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [browserVoice, setBrowserVoice] = useState(() => chooseChineseFemaleVoice(synth?.getVoices() ?? []));
  const [playbackError, setPlaybackError] = useState('');
  const enabledRef = useRef(false);
  const mounted = useRef(true);
  const revision = useRef(0);
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);
  const releaseDucking = useRef(null);

  const stop = useCallback(() => {
    revision.current += 1;
    releaseDucking.current?.();
    releaseDucking.current = null;
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) {
      audio.onplaying = null; audio.onended = null; audio.onerror = null;
      audio.pause(); audio.removeAttribute('src'); audio.load();
    }
    const utterance = utteranceRef.current;
    utteranceRef.current = null;
    if (utterance) {
      utterance.onstart = null; utterance.onend = null; utterance.onerror = null;
      synth?.cancel();
    }
    if (mounted.current) setSpeaking(false);
  }, [synth]);

  const toggleEnabled = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    setPlaybackError('');
    if (!next) stop();
    return next;
  }, [stop]);

  const speak = useCallback(text => {
    stop();
    if (!enabledRef.current || document.hidden || typeof text !== 'string' || !text.trim()) return false;
    setPlaybackError('');
    const current = revision.current;
    const stillCurrent = () => mounted.current && revision.current === current && enabledRef.current && !document.hidden;
    const onStart = () => { if (stillCurrent()) setSpeaking(true); else if (revision.current === current) stop(); };
    const onFinish = () => { if (revision.current === current) stop(); };
    const chapter = fixedNarrationChapter(text);
    if (chapter && typeof Audio !== 'undefined' && media[narrationMediaKeys[chapter]]) {
      const audio = new Audio(media[narrationMediaKeys[chapter]]);
      audioRef.current = audio;
      audio.preload = 'auto';
      audio.onplaying = onStart;
      audio.onended = onFinish;
      audio.onerror = () => {
        if (!stillCurrent()) return;
        setPlaybackError('讲解音频暂未载入，请重新点击播放。');
        stop();
      };
      releaseDucking.current = duckPageMedia();
      try {
        const started = audio.play();
        started?.then(() => { if (!stillCurrent()) audio.pause(); }).catch(() => {
          if (!stillCurrent()) return;
          setPlaybackError('声音暂未播放，请重新点击朗读。');
          stop();
        });
      } catch {
        setPlaybackError('声音暂未播放，请重新点击朗读。');
        stop();
        return false;
      }
      return true;
    }
    const voice = chooseChineseFemaleVoice(synth?.getVoices() ?? []);
    if (!voice || typeof SpeechSynthesisUtterance === 'undefined') return false;
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 5000));
    utteranceRef.current = utterance;
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.pitch = voiceProfile.browserPitch;
    utterance.rate = voiceProfile.browserRate;
    utterance.volume = 0.92;
    utterance.onstart = onStart;
    utterance.onend = onFinish;
    utterance.onerror = () => {
      if (!stillCurrent()) return;
      setPlaybackError('问答朗读暂不可用，文字讲解可以继续阅读。');
      stop();
    };
    releaseDucking.current = duckPageMedia();
    try { synth.speak(utterance); return true; }
    catch { onFinish(); return false; }
  }, [stop, synth]);

  useEffect(() => {
    mounted.current = true;
    const updateVoices = () => setBrowserVoice(chooseChineseFemaleVoice(synth?.getVoices() ?? []));
    const onVisibility = () => { if (document.hidden) stop(); };
    synth?.addEventListener('voiceschanged', updateVoices);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('hashchange', stop);
    window.addEventListener('pagehide', stop);
    updateVoices();
    return () => {
      mounted.current = false;
      stop();
      synth?.removeEventListener('voiceschanged', updateVoices);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('hashchange', stop);
      window.removeEventListener('pagehide', stop);
    };
  }, [stop, synth]);

  const recordedSupported = typeof Audio !== 'undefined' && Object.values(narrationMediaKeys).every(key => typeof media[key] === 'string');
  const voiceLabel = playbackError || (browserVoice
    ? `固定讲解：小醒中文女声 · 问答：${browserVoice.name}`
    : '小醒中文女声 · 四章固定讲解；当前设备无匹配的问答朗读音色');
  return { supported: recordedSupported || Boolean(browserVoice), speaking, enabled, toggleEnabled, speak, stop, voiceLabel };
}
