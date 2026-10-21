import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DEFAULT_VIDEO_VOLUME } from '../config/playback.js';

export default function VideoStage({ src, poster, loop = false, playing = true, audioEnabled = true, hitEnabled = true, onReady, onEnded, onContinue, continueLabel = '浏览整体模型', label, className = '', id }) {
  const ref = useRef(null);
  const failedRef = useRef(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const [status, setStatus] = useState('playing');
  const [loadAttempt, setLoadAttempt] = useState(0);

  // The prewarmed home stays mounted: stop it before the next route's
  // layout effects can start another audible video.
  useLayoutEffect(() => {
    if (!playing) ref.current?.pause();
  }, [playing]);

  useEffect(() => {
    const video = ref.current;
    let active = true;
    let reported = false;
    failedRef.current = false;
    setStatus('playing');
    const report = success => {
      if (!active || reported) return;
      reported = true;
      onReadyRef.current?.(success);
    };
    const ready = () => {
      if (!active || video.readyState < 2) return;
      clearTimeout(timeout);
      report(true);
    };
    const fail = reason => {
      if (!active) return;
      clearTimeout(timeout);
      failedRef.current = true;
      video.pause();
      setStatus(reason);
      report(false);
    };
    const failed = () => fail('error');
    const timeout = setTimeout(() => fail('timeout'), 25_000);
    video.addEventListener('loadeddata', ready);
    video.addEventListener('canplay', ready);
    video.addEventListener('error', failed);
    if (loadAttempt > 0) video.load();
    if (video.error) failed();
    else ready();
    return () => {
      active = false;
      clearTimeout(timeout);
      video.removeEventListener('loadeddata', ready);
      video.removeEventListener('canplay', ready);
      video.removeEventListener('error', failed);
    };
  }, [src, loadAttempt]);

  useEffect(() => {
    const video = ref.current;
    let active = true;
    // Set volume before the first play call, never after audible autoplay.
    video.volume = DEFAULT_VIDEO_VOLUME;
    video.muted = !audioEnabled;
    const updatePlayback = () => {
      if (!playing || document.hidden || failedRef.current) { video.pause(); return; }
      setStatus('playing');
      video.play()?.catch((error) => {
        if (active && !failedRef.current && error.name !== 'AbortError') {
          const blocked = error.name === 'NotAllowedError' && !video.error;
          if (!blocked) failedRef.current = true;
          setStatus(blocked ? 'blocked' : 'error');
        }
      });
    };
    document.addEventListener('visibilitychange', updatePlayback);
    updatePlayback();
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', updatePlayback);
      video.pause();
    };
  }, [src, playing, audioEnabled, loadAttempt]);

  const replay = () => {
    const video = ref.current;
    if (!playing || document.hidden) return;
    if (failedRef.current) {
      setLoadAttempt(attempt => attempt + 1);
      return;
    }
    setStatus('playing');
    video.play()?.catch((error) => {
      if (!failedRef.current && error.name !== 'AbortError') {
        const blocked = error.name === 'NotAllowedError' && !video.error;
        if (!blocked) failedRef.current = true;
        setStatus(blocked ? 'blocked' : 'error');
      }
    });
  };

  return (
    <>
      <video ref={ref} id={id} className={`media-video ${className}`} src={src} poster={poster}
        muted={!audioEnabled} loop={loop} playsInline preload="auto" onEnded={onEnded}
        disablePictureInPicture={!hitEnabled} disableRemotePlayback={!hitEnabled}
        controlsList="nodownload noremoteplayback" draggable={false}
        onContextMenu={event => { if (!hitEnabled) event.preventDefault(); }}
        style={{ pointerEvents: hitEnabled ? 'auto' : 'none', userSelect: hitEnabled ? 'auto' : 'none' }}
        aria-label={label} />
      {status !== 'playing' && (
        <div className="video-status" role="status">
          <span>{status === 'timeout' ? '视频准备较慢，请重试' : status === 'error' ? '视频暂时无法播放' : audioEnabled ? '浏览器需要一次点击才能播放声音' : '点击继续播放视频'}</span>
          <button type="button" onClick={replay}>{status === 'error' || status === 'timeout' ? '重试' : audioEnabled ? '开启声音并播放' : '播放'}</button>
          {onContinue && <button type="button" onClick={onContinue}>{continueLabel}</button>}
        </div>
      )}
    </>
  );
}
