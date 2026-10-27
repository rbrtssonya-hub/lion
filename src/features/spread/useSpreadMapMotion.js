import { useEffect, useRef, useState } from 'react';

// Video frames correspond to Blender frames 1–204 at the source's 24 fps.
const FPS = 24;
const LAST_TIME = 203 / FPS;
const stops = { guangdong: 0, china: 99 / FPS, world: LAST_TIME };

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

export default function useSpreadMapMotion(level) {
  const forwardRef = useRef(null);
  const reverseRef = useRef(null);
  const positionRef = useRef(0);
  const activeRef = useRef(null);
  const [displayLevel, setDisplayLevel] = useState(level);
  const [motion, setMotion] = useState('idle');
  const [direction, setDirection] = useState('forward');

  useEffect(() => {
    const forward = forwardRef.current;
    const reverse = reverseRef.current;
    const controller = new AbortController();
    let animationFrame = 0;
    let playingVideo = null;
    let onPlaybackError = null;
    const active = activeRef.current;
    if (active) {
      positionRef.current = Math.max(0, Math.min(LAST_TIME,
        active.direction === 'forward' ? active.video.currentTime : LAST_TIME - active.video.currentTime));
    }
    forward.pause();
    reverse.pause();
    activeRef.current = null;
    const target = stops[level];
    const finish = (status = 'idle') => {
      if (playingVideo && onPlaybackError) playingVideo.removeEventListener('error', onPlaybackError);
      playingVideo = null;
      onPlaybackError = null;
      positionRef.current = target;
      activeRef.current = null;
      setDisplayLevel(level);
      setMotion(status);
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(target - positionRef.current) < 1 / FPS) {
      finish();
    } else {
      const nextDirection = target > positionRef.current ? 'forward' : 'reverse';
      const video = nextDirection === 'forward' ? forward : reverse;
      const start = nextDirection === 'forward' ? positionRef.current : LAST_TIME - positionRef.current;
      setDirection(nextDirection);
      setMotion('loading');
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
          await video.play();
          if (controller.signal.aborted) return;
          activeRef.current = { video, direction: nextDirection };
          playingVideo = video;
          onPlaybackError = () => {
            cancelAnimationFrame(animationFrame);
            video.pause();
            finish('failed');
          };
          video.addEventListener('error', onPlaybackError, { once: true });
          setMotion('moving');
          const tick = () => {
            const position = nextDirection === 'forward' ? video.currentTime : LAST_TIME - video.currentTime;
            positionRef.current = Math.max(0, Math.min(LAST_TIME, position));
            if ((nextDirection === 'forward' && position >= target) || (nextDirection === 'reverse' && position <= target) || video.ended) {
              video.pause();
              finish();
            } else animationFrame = requestAnimationFrame(tick);
          };
          animationFrame = requestAnimationFrame(tick);
        } catch (error) {
          if (error.name !== 'AbortError' && !controller.signal.aborted) finish('failed');
        }
      };
      startPlayback();
    }
    return () => {
      controller.abort();
      cancelAnimationFrame(animationFrame);
      if (playingVideo && onPlaybackError) playingVideo.removeEventListener('error', onPlaybackError);
      if (activeRef.current) {
        const { video, direction: playingDirection } = activeRef.current;
        positionRef.current = Math.max(0, Math.min(LAST_TIME,
          playingDirection === 'forward' ? video.currentTime : LAST_TIME - video.currentTime));
        video.pause();
        activeRef.current = null;
      }
      forward.pause();
      reverse.pause();
    };
  }, [level]);

  return { forwardRef, reverseRef, displayLevel, motion, direction };
}
