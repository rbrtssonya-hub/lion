import { useEffect, useRef, useState } from 'react';

// The source animation runs at 24 fps. The 60 fps version samples the same
// Blender timeline and includes a little extra time in the final still hold.
const LAST_TIME = 203 / 24;
const reverseOrigin = { 24: LAST_TIME, 60: 509 / 60 };
const stops = { guangdong: 0, china: 99 / 24, world: LAST_TIME };
const clampPosition = value => Math.max(0, Math.min(LAST_TIME, value));

function waitFor(video, event, signal) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener(event, done);
      video.removeEventListener('error', fail);
      signal.removeEventListener('abort', abort);
    };
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error('Map video failed')); };
    const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
    if (signal.aborted) return abort();
    video.addEventListener(event, done, { once: true });
    video.addEventListener('error', fail, { once: true });
    signal.addEventListener('abort', abort, { once: true });
  });
}

export default function useSpreadMapMotion(level, frameRate, playbackRate) {
  const videosRef = useRef({});
  const playOwnerRef = useRef(new WeakMap());
  const positionRef = useRef(0);
  const activeRef = useRef(null);
  const rateRef = useRef(playbackRate);
  rateRef.current = playbackRate;
  const [displayLevel, setDisplayLevel] = useState(level);
  const [motion, setMotion] = useState('idle');
  const [visibleVideo, setVisibleVideo] = useState('');

  useEffect(() => {
    for (const video of Object.values(videosRef.current)) video.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const controller = new AbortController();
    const videos = Object.values(videosRef.current);
    let animationFrame = 0;
    let playingVideo = null;
    let onPlaybackError = null;
    let onVisibilityChange = null;
    let visibilityPlayId = 0;
    let loadingTimeout = 0;
    const active = activeRef.current;
    if (active) {
      positionRef.current = clampPosition(active.direction === 'forward'
        ? active.video.currentTime : reverseOrigin[active.frameRate] - active.video.currentTime);
    }
    for (const video of videos) video.pause();
    activeRef.current = null;
    const target = stops[level];
    const finish = (status = 'idle', useStill = false) => {
      if (playingVideo && onPlaybackError) playingVideo.removeEventListener('error', onPlaybackError);
      if (onVisibilityChange) document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimeout(loadingTimeout);
      playingVideo = null;
      onPlaybackError = null;
      onVisibilityChange = null;
      positionRef.current = target;
      activeRef.current = null;
      setDisplayLevel(level);
      if (useStill) setVisibleVideo('');
      setMotion(status);
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish('idle', true);
    } else if (Math.abs(target - positionRef.current) < 1 / 60) {
      finish();
    } else {
      const direction = target > positionRef.current ? 'forward' : 'reverse';
      const key = `${direction}-${frameRate}`;
      const video = videosRef.current[key];
      const start = direction === 'forward' ? positionRef.current : reverseOrigin[frameRate] - positionRef.current;
      setMotion('loading');
      // A stalled request or a play promise that never settles must not leave
      // the map controls and city points hidden indefinitely.
      loadingTimeout = window.setTimeout(() => {
        controller.abort();
        video.pause();
        finish('failed', true);
      }, 12000);
      const startPlayback = async () => {
        try {
          if (video.error) throw new Error('Map video failed');
          if (video.readyState < 1) await waitFor(video, 'loadedmetadata', controller.signal);
          if (controller.signal.aborted) return;
          if (Math.abs(video.currentTime - start) > 0.001) {
            const seeked = waitFor(video, 'seeked', controller.signal);
            video.currentTime = start;
            await seeked;
          }
          if (controller.signal.aborted) return;
          video.playbackRate = rateRef.current;
          playOwnerRef.current.set(video, controller);
          await video.play();
          if (controller.signal.aborted) {
            // An older play promise can resolve after a later transition has
            // reused this element. Only stop it if we still own that play.
            if (playOwnerRef.current.get(video) === controller) video.pause();
            return;
          }
          clearTimeout(loadingTimeout);
          activeRef.current = { video, direction, frameRate };
          playingVideo = video;
          onPlaybackError = () => {
            cancelAnimationFrame(animationFrame);
            video.pause();
            finish('failed', true);
          };
          video.addEventListener('error', onPlaybackError, { once: true });
          onVisibilityChange = () => {
            const playId = ++visibilityPlayId;
            if (document.hidden) video.pause();
            else if (!controller.signal.aborted) video.play().catch(() => {
              if (!controller.signal.aborted && playId === visibilityPlayId && !document.hidden && activeRef.current?.video === video) onPlaybackError?.();
            });
          };
          document.addEventListener('visibilitychange', onVisibilityChange);
          if (document.hidden) video.pause();
          setVisibleVideo(key);
          setMotion('moving');
          const tick = () => {
            const position = direction === 'forward' ? video.currentTime : reverseOrigin[frameRate] - video.currentTime;
            positionRef.current = clampPosition(position);
            if ((direction === 'forward' && position >= target) || (direction === 'reverse' && position <= target) || video.ended) {
              video.pause();
              // Keep the decoded frame on screen: switching to a PNG here
              // produces a visible color/texture jump at the end of a shot.
              finish();
            } else animationFrame = requestAnimationFrame(tick);
          };
          animationFrame = requestAnimationFrame(tick);
        } catch (error) {
          if (error.name !== 'AbortError' && !controller.signal.aborted) finish('failed', true);
        }
      };
      startPlayback();
    }
    return () => {
      controller.abort();
      cancelAnimationFrame(animationFrame);
      clearTimeout(loadingTimeout);
      if (playingVideo && onPlaybackError) playingVideo.removeEventListener('error', onPlaybackError);
      if (onVisibilityChange) document.removeEventListener('visibilitychange', onVisibilityChange);
      if (activeRef.current) {
        const { video, direction, frameRate: activeFps } = activeRef.current;
        positionRef.current = clampPosition(direction === 'forward' ? video.currentTime : reverseOrigin[activeFps] - video.currentTime);
        activeRef.current = null;
      }
      for (const video of videos) video.pause();
    };
  }, [level, frameRate]);

  return { videosRef, displayLevel, motion, visibleVideo };
}
