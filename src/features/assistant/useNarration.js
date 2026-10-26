import { useCallback, useEffect, useRef, useState } from 'react';
import { media } from '../../config/media.js';
import { fixedNarrationChapter, narrationMediaKeys, voiceProfile } from './voiceProfile.js';

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
  const [enabled, setEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const enabledRef = useRef(false);
  const mounted = useRef(true);
  const revision = useRef(0);
  const audioRef = useRef(null);
  const requestRef = useRef(null);
  const objectURLRef = useRef(null);
  const releaseDucking = useRef(null);

  const stop = useCallback(() => {
    revision.current += 1;
    requestRef.current?.abort();
    requestRef.current = null;
    releaseDucking.current?.();
    releaseDucking.current = null;
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) {
      audio.onplaying = null; audio.onended = null; audio.onerror = null;
      audio.pause(); audio.removeAttribute('src'); audio.load();
    }
    if (objectURLRef.current) {
      URL.revokeObjectURL(objectURLRef.current);
      objectURLRef.current = null;
    }
    if (mounted.current) { setSpeaking(false); setPreparing(false); }
  }, []);

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
    setTruncated(text.trim().length > 1200);
    setPreparing(true);
    const current = revision.current;
    const stillCurrent = () => mounted.current && revision.current === current && enabledRef.current && !document.hidden;
    const onFinish = () => { if (revision.current === current) stop(); };
    const fail = () => {
      if (!stillCurrent()) return;
      setPlaybackError('声音暂不可用，文字讲解可继续阅读。');
      stop();
    };
    const play = source => {
      if (!stillCurrent()) return false;
      const audio = new Audio(source);
      audioRef.current = audio;
      audio.preload = 'auto';
      audio.onplaying = () => {
        if (!stillCurrent()) { audio.pause(); return; }
        setPreparing(false); setSpeaking(true);
        releaseDucking.current ??= duckPageMedia();
      };
      audio.onended = onFinish;
      audio.onerror = fail;
      try {
        const started = audio.play();
        started?.then(() => { if (!stillCurrent()) audio.pause(); }).catch(fail);
      } catch { fail(); return false; }
      return true;
    };
    const chapter = fixedNarrationChapter(text);
    const recording = chapter && media[narrationMediaKeys[chapter]];
    if (recording) return play(recording);
    const controller = new AbortController();
    requestRef.current = controller;
    void (async () => {
      try {
        const response = await fetch('/api/xiaoxing/speech', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ text: text.trim().slice(0, 1200) }),
        });
        if (!stillCurrent()) return;
        if (!response.ok || !/^audio\/(?:x-)?wav(?:;|$)/i.test(response.headers.get('Content-Type') || '')) throw Error('speech-unavailable');
        const blob = await response.blob();
        if (!stillCurrent()) return;
        if (!blob.size) throw Error('empty-speech');
        objectURLRef.current = URL.createObjectURL(blob);
        play(objectURLRef.current);
      } catch (error) {
        if (error.name !== 'AbortError') fail();
      } finally {
        if (requestRef.current === controller) requestRef.current = null;
      }
    })();
    return true;
  }, [stop]);

  useEffect(() => {
    mounted.current = true;
    const onVisibility = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('hashchange', stop);
    window.addEventListener('pagehide', stop);
    return () => {
      mounted.current = false;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('hashchange', stop);
      window.removeEventListener('pagehide', stop);
    };
  }, [stop]);

  const supported = typeof Audio !== 'undefined' && typeof fetch === 'function';
  const voiceLabel = playbackError || `${voiceProfile.label}${truncated ? ' · 长回答朗读前 1200 字' : ''}`;
  const status = playbackError || (preparing ? '正在准备声音' : speaking ? '正在讲解' : '');
  return { supported, preparing, speaking, enabled, toggleEnabled, speak, stop, voiceLabel, status };
}
