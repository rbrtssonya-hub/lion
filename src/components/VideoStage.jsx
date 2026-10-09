import { useEffect, useRef, useState } from 'react';

export default function VideoStage({ src, poster, loop = false, onEnded, onContinue, label, className = '', id }) {
  const ref = useRef(null);
  const [status, setStatus] = useState('playing');

  useEffect(() => {
    const video = ref.current;
    let active = true;
    setStatus('playing');
    video.play()?.catch((error) => {
      if (active && error.name !== 'AbortError') {
        setStatus(error.name === 'NotAllowedError' && !video.error ? 'blocked' : 'error');
      }
    });
    return () => {
      active = false;
      video.pause();
    };
  }, [src]);

  const replay = () => {
    const video = ref.current;
    if (status === 'error') video.load();
    setStatus('playing');
    video.play()?.catch((error) => {
      if (error.name !== 'AbortError') {
        setStatus(error.name === 'NotAllowedError' && !video.error ? 'blocked' : 'error');
      }
    });
  };

  return (
    <>
      <video ref={ref} id={id} className={`media-video ${className}`} src={src} poster={poster}
        autoPlay muted loop={loop} playsInline preload="auto" onEnded={onEnded}
        onError={() => setStatus('error')} aria-label={label} />
      {status !== 'playing' && (
        <div className="video-status" role="status">
          <span>{status === 'error' ? '视频暂时无法播放' : '点击继续播放视频'}</span>
          <button type="button" onClick={replay}>{status === 'error' ? '重试' : '播放'}</button>
          {onContinue && <button type="button" onClick={onContinue}>浏览整体模型</button>}
        </div>
      )}
    </>
  );
}
