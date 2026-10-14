import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { media } from '../../config/media.js';

const clock = value => `${Math.floor(value / 60).toString().padStart(2, '0')}:${Math.floor(value % 60).toString().padStart(2, '0')}`;
function canPlayHere(frame) {
  if (!frame?.isConnected || document.hidden) return false;
  const full = document.fullscreenElement;
  if (full) return full === frame || frame.contains(full);
  const rect = frame.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
}
function ControlIcon({ kind }) {
  const paths = { play: 'm9 5 12 9-12 9Z', pause: 'M9 6v16M19 6v16', sound: 'M5 11h5l6-5v16l-6-5H5ZM20 9q7 5 0 10', muted: 'M5 11h5l6-5v16l-6-5H5ZM21 10l6 8M27 10l-6 8', fullscreen: 'M4 11V4h7M17 4h7v7M24 17v7h-7M11 24H4v-7' };
  return <svg viewBox="0 0 28 28" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

export default forwardRef(function ActionVideo({ clip, playerId, assets = media, hero = false, onStart }, ref) {
  const frameRef = useRef(null);
  const videoRef = useRef(null);
  const alive = useRef(false);
  const request = useRef(0);
  const wantsPlay = useRef(false);
  const [state, setState] = useState('idle');
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [muted, setMuted] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [notice, setNotice] = useState('');
  const src = clip.videoKey ? assets[clip.videoKey] : undefined;
  const poster = assets[clip.posterKey] || assets.poster;
  const pause = useCallback(() => {
    wantsPlay.current = false;
    request.current += 1;
    videoRef.current?.pause();
    if (alive.current) setState(value => value === 'playing' || value === 'loading' ? 'idle' : value);
  }, []);
  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!src || !video) { setNotice('视频待接入 · 目前可浏览参考示意'); return; }
    if (!canPlayHere(frameRef.current)) { pause(); return; }
    // A repeated watch request must not replace native playing state with loading.
    if (wantsPlay.current) return;
    const version = ++request.current;
    wantsPlay.current = true;
    onStart(playerId, clip.id);
    setNotice('');
    setState('loading');
    try {
      if (video.error) video.load();
      if (video.ended) video.currentTime = 0;
      await video.play();
      // An old promise may finish after pause -> play on this same element.
      // Only stop an abandoned intent/element, never the newer desired playback.
      if (!alive.current || video !== videoRef.current || !wantsPlay.current) video.pause();
      else if (!canPlayHere(frameRef.current)) pause();
    } catch (error) {
      if (!alive.current || version !== request.current) return;
      wantsPlay.current = false;
      setState(error.name === 'NotAllowedError' ? 'blocked' : error.name === 'AbortError' ? 'idle' : 'error');
    }
  }, [src, onStart, playerId, clip.id, pause]);
  useImperativeHandle(ref, () => ({ play, pause, element: videoRef.current }), [play, pause, src]);
  useEffect(() => {
    alive.current = true;
    wantsPlay.current = false;
    setState('idle'); setDuration(0); setCurrent(0); setPosterFailed(false); setNotice('');
    const frame = frameRef.current;
    const observer = new IntersectionObserver(([entry]) => {
      const full = document.fullscreenElement;
      const ownFullscreen = full === frame || (full && frame.contains(full));
      if ((full && !ownFullscreen) || (!entry.isIntersecting && !ownFullscreen)) pause();
    });
    observer.observe(frame);
    const onVisibility = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', onVisibility);
    const onFullscreen = () => { if (!canPlayHere(frame)) pause(); };
    document.addEventListener('fullscreenchange', onFullscreen);
    const video = videoRef.current;
    return () => {
      alive.current = false; wantsPlay.current = false; request.current += 1;
      video?.pause(); observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [src, poster, pause]);
  const fullscreen = async () => {
    try { await frameRef.current.requestFullscreen(); }
    catch { setNotice('当前环境不支持全屏，可继续原位观看'); }
  };
  const validDuration = Number.isFinite(duration) && duration > 0;
  const playing = state === 'playing';
  return <div className="action-player" ref={frameRef} data-player-id={playerId}
    data-media-state={!src ? 'pending' : state} data-playing={playing} aria-label={`${clip.name}片段播放器`}>
    <img className="action-poster" src={posterFailed ? assets.poster : poster}
      alt={`${clip.name} · 醒狮动作参考示意`} loading={hero ? 'eager' : 'lazy'}
      onError={() => setPosterFailed(true)} />
    {src && <video ref={videoRef} className="action-native-video" src={src} poster={posterFailed ? assets.poster : poster}
      playsInline preload={hero ? 'metadata' : 'none'} muted={muted} aria-label={`${clip.name}视频`}
      onPlay={() => {
        if (!alive.current || !wantsPlay.current || !canPlayHere(frameRef.current)) { pause(); return; }
        if (!videoRef.current.paused) { onStart(playerId, clip.id); setState('playing'); }
      }}
      onPause={() => { if (alive.current) setState(value => value === 'playing' ? 'idle' : value); }}
      onEnded={() => { wantsPlay.current = false; request.current += 1; setState('idle'); }}
      onError={() => { wantsPlay.current = false; request.current += 1; setState('error'); videoRef.current?.pause(); }}
      onLoadedMetadata={event => setDuration(event.currentTarget.duration)}
      onDurationChange={event => setDuration(event.currentTarget.duration)}
      onTimeUpdate={event => setCurrent(event.currentTarget.currentTime)} />}
    <span className="action-reference-label">参考示意{!src ? ' · 视频待接入' : ''}</span>
    {!playing && <button type="button" className="action-center-play" disabled={!src}
      aria-label={!src ? `${clip.name}视频待接入` : state === 'error' ? `重试${clip.name}视频` : `播放${clip.name}视频`} onClick={play}>
      <ControlIcon kind="play" />
    </button>}
    {(notice || state === 'error' || state === 'blocked') && <div className="action-player-message" role="status">
      {notice || (state === 'error' ? '视频暂时无法播放，请重试' : '播放未获允许，请再次点击播放')}
      {src && <button type="button" onClick={play}>{state === 'error' ? '重试' : '播放'}</button>}
    </div>}
    <div className="action-player-controls">
      {src ? <>
        <button type="button" aria-label={`${playing ? '暂停' : '播放'}${clip.name}视频`} onClick={playing ? pause : play}><ControlIcon kind={playing ? 'pause' : 'play'} /></button>
        <span className="action-media-time">{validDuration ? `${clock(current)} / ${clock(duration)}` : '时长待读取'}</span>
        <input type="range" min="0" max={validDuration ? duration : 1} step=".1" value={validDuration ? Math.min(current, duration) : 0}
          disabled={!validDuration} aria-label={`${clip.name}播放进度`} onChange={event => { const value = Number(event.target.value); videoRef.current.currentTime = value; setCurrent(value); }} />
        <button type="button" aria-label={`${muted ? '开启' : '关闭'}${clip.name}声音`} aria-pressed={muted} onClick={() => setMuted(value => !value)}><ControlIcon kind={muted ? 'muted' : 'sound'} /></button>
        <button type="button" aria-label={`全屏观看${clip.name}`} onClick={fullscreen}><ControlIcon kind="fullscreen" /></button>
      </> : <span className="action-media-status">视频待接入 <span> / REFERENCE STUDY</span></span>}
    </div>
  </div>;
});
