import '../styles/sound-control.css';

// Geometry and wave-to-line/hover transitions follow the user's local
// Verminoble SourceSoundControl. Repeated waves add rightward flow in place.
const wave = 'M0 .5c19.1 0 19.1 40.9 37.7 40.9C56.8 41.4 56.8.5 75.4.5c19.1 0 19.1 40.9 37.7 40.9';
const tail = 'M565.5 40.9c19.1 0 19.1-38.1 37.7-38.1 19.1 0 19.1 33.1 37.7 33.1 19.1 0 19.1-27.7 37.7-27.7 19.1 0 19.1 22.7 37.7 22.7 19.1 0 19.1-17.7 37.7-17.7 19.1 0 19.1 12.7 37.7 12.7 19.1 0 19.1-7.7 37.7-7.7 19.1 0 19.1 5 37.7 5 19.1 0 19.1-1.8 37.7-1.8 19.1 0 17.7 0 36.3 0 19.1 0 13.6 0 32.2 0 19.1 0 23.6 0 42.7 0 19.1 0 264.2 0 283.3 0H2200';

function SoundWave() {
  return <span className="sound-wave-window" aria-hidden="true"><svg viewBox="0 0 2200 41.9" preserveAspectRatio="none" focusable="false">
    <g className="sound-wave-flow">
      {Array.from({ length: 8 }, (_, repeat) => <g key={repeat} className="sound-wave-traces" transform={`translate(${repeat * 75.4} 0)`}>
        <path d={wave} /><path d={wave} />
      </g>)}
    </g>
    <path className="sound-wave-tail" d={tail} />
  </svg></span>;
}

export default function SoundControl({ id, enabled, pending = false, playing = true, volume = .25, onToggle, onVolumeChange, className = '', variant = 'standard' }) {
  const percentage = Math.round(volume * 100);
  const state = enabled && volume > 0 ? 'enabled' : pending && volume > 0 ? 'awaiting-gesture' : 'muted';
  return <div className={`sound-control-widget${variant === 'line' ? ' sound-control-widget-home' : ''} ${className}`}
    data-sound-control data-audio-state={state} data-wave-playing={state === 'enabled' && playing}
    style={{ '--sound-volume': `${percentage}%` }}>
    <button id={id} type="button" className="sound-control sound-control-line" data-sound-control data-audio-state={state}
      aria-label={enabled ? '关闭声音' : '开启声音'} aria-pressed={enabled} onClick={onToggle}
      title={pending ? '视频正在静音播放，点击开启声音' : enabled ? '关闭声音' : '开启声音'}>
      <span className="sound-control-label">音量</span><SoundWave />
    </button>
    <div className="sound-volume-row">
      <input className="sound-volume-slider" type="range" min="0" max="100" step="1" value={percentage}
        aria-label="音量" aria-valuetext={`${percentage}%`} onChange={event => onVolumeChange?.(Number(event.target.value) / 100)} />
      <span className="sound-volume-value" aria-hidden="true">{percentage}</span>
    </div>
  </div>;
}
