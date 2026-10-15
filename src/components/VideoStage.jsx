import { useEffect, useRef, useState } from 'react';

export default function VideoStage({ src, poster, loop = false, playing = true, hitEnabled = true, onReady, onEnded, onContinue, continueLabel = '浏览整体模型', label, className = '', id }) {
  const ref = useRef(null);
  const failedRef = useRef(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const [status, setStatus] = useState('playing');
  const [loadAttempt, setLoadAttempt] = useState(0);

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
    if (!playing || failedRef.current) { video.pause(); return; }
    setStatus('playing');
    video.play()?.catch((error) => {
      if (active && !failedRef.current && error.name !== 'AbortError') {
        const blocked = error.name === 'NotAllowedError' && !video.error;
        if (!blocked) failedRef.current = true;
        setStatus(blocked ? 'blocked' : 'error');
      }
    });
    return () => {
      active = false;
      video.pause();
    };
  }, [src, playing, loadAttempt]);

  const replay = () => {
    const video = ref.current;
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
        autoPlay={playing} muted loop={loop} playsInline preload="auto" onEnded={onEnded}
        disablePictureInPicture={!hitEnabled} disableRemotePlayback={!hitEnabled}
        controlsList="nodownload noremoteplayback" draggable={false}
        onContextMenu={event => { if (!hitEnabled) event.preventDefault(); }}
        style={{ pointerEvents: hitEnabled ? 'auto' : 'none', userSelect: hitEnabled ? 'auto' : 'none' }}
        aria-label={label} />
      {status !== 'playing' && (
        <div className="video-status" role="status">
          <span>{status === 'timeout' ? '视频准备较慢，请重试' : status === 'error' ? '视频暂时无法播放' : '点击继续播放视频'}</span>
          <button type="button" onClick={replay}>{status === 'error' || status === 'timeout' ? '重试' : '播放'}</button>
          {onContinue && <button type="button" onClick={onContinue}>{continueLabel}</button>}
        </div>
      )}
    </>
  );
}
