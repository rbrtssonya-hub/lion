import { useLayoutEffect, useRef, useState } from 'react';
import { DEFAULT_VIDEO_VOLUME } from '../config/playback.js';
import { isAudioUnlockGesture } from '../hooks/useMediaAudioPreference.js';

export default function VideoStage({ src, poster, loop = false, playing = true, audioEnabled = true, onAudioState, resumeAudioRef, hitEnabled = true, onReady, onEnded, onContinue, continueLabel = '浏览整体模型', label, className = '', id }) {
  const ref = useRef(null);
  const failedRef = useRef(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onAudioStateRef = useRef(onAudioState);
  onAudioStateRef.current = onAudioState;
  const replayRef = useRef(null);
  const [status, setStatus] = useState('playing');
  const [loadAttempt, setLoadAttempt] = useState(0);

  // The prewarmed home stays mounted: stop it before the next route's
  // layout effects can start another audible video.
  useLayoutEffect(() => {
    if (!playing && ref.current) { ref.current.muted = true; ref.current.pause(); }
  }, [playing]);

  useLayoutEffect(() => {
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
      video.muted = true;
      video.pause();
      onAudioStateRef.current?.({ enabled: false, pending: false });
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

  useLayoutEffect(() => {
    const video = ref.current;
    let active = true;
    let revision = 0;
    let audioBlocked = false;
    // Set volume before the first play call, never after audible autoplay.
    video.volume = DEFAULT_VIDEO_VOLUME;
    const publishAudio = () => onAudioStateRef.current?.({ enabled: !video.muted, pending: audioEnabled && audioBlocked });
    const mayPlay = () => active && playing && !document.hidden && !failedRef.current && video.isConnected;
    const requestPlay = (withAudio = audioEnabled && !audioBlocked) => {
      if (!mayPlay()) { video.muted = true; video.pause(); publishAudio(); return; }
      const request = ++revision;
      video.muted = !withAudio;
      setStatus('playing');
      publishAudio();
      const failed = error => {
        if (!mayPlay() || request !== revision) return;
        if (error.name === 'NotAllowedError' && withAudio && !video.error) {
          // No modal or stopped frame: native muted playback is allowed even
          // when Chrome refuses the initial audible request.
          audioBlocked = true;
          requestPlay(false);
        } else if (error.name !== 'AbortError') {
          failedRef.current = true;
          video.muted = true;
          video.pause();
          setStatus('error');
          publishAudio();
        }
      };
      try {
        video.play()?.then(() => {
          if (!mayPlay() || request !== revision) return;
          if (withAudio) audioBlocked = false;
          publishAudio();
        }, failed);
      } catch (error) { failed(error); }
    };
    const updatePlayback = () => requestPlay();
    const unlockAudio = event => {
      if (audioEnabled && audioBlocked && mayPlay() && isAudioUnlockGesture(event)) requestPlay(true);
    };
    replayRef.current = () => requestPlay();
    if (resumeAudioRef) resumeAudioRef.current = () => requestPlay(true);
    document.addEventListener('visibilitychange', updatePlayback);
    document.addEventListener('pointerdown', unlockAudio, true);
    document.addEventListener('keydown', unlockAudio, true);
    updatePlayback();
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', updatePlayback);
      document.removeEventListener('pointerdown', unlockAudio, true);
      document.removeEventListener('keydown', unlockAudio, true);
      replayRef.current = null;
      if (resumeAudioRef) resumeAudioRef.current = null;
      video.muted = true;
      video.pause();
    };
  }, [src, playing, audioEnabled, loadAttempt, resumeAudioRef]);

  const replay = () => {
    const video = ref.current;
    if (!playing || document.hidden) return;
    if (failedRef.current) {
      setLoadAttempt(attempt => attempt + 1);
      return;
    }
    replayRef.current?.();
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
          <span>{status === 'timeout' ? '视频准备较慢，请重试' : '视频暂时无法播放'}</span>
          <button type="button" onClick={replay}>重试</button>
          {onContinue && <button type="button" onClick={onContinue}>{continueLabel}</button>}
        </div>
      )}
    </>
  );
}
