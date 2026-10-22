import '../styles/sound-control.css';
import { createSoundWave } from '../features/sound-control/soundWaveGeometry.js';

function SoundWave({ settings }) {
  const wave = createSoundWave(settings);
  return <span className="sound-wave-window" aria-hidden="true" style={{ height: `${wave.height}px` }}>
    <svg viewBox={`0 0 ${wave.width} ${wave.height}`} width={wave.width} height={wave.height} focusable="false"
      data-wave-baseline={wave.baseline} data-wave-period={wave.period}>
      <g className="sound-wave-amplitude" style={{ transformOrigin: `0px ${wave.baseline}px` }}>
        <g className="sound-wave-flow" style={{ '--sound-wave-period': `${wave.period}px` }}>
          <path className="sound-wave-path" d={wave.d} strokeWidth={wave.stroke} vectorEffect="non-scaling-stroke" />
        </g>
      </g>
  </svg></span>;
}

export default function SoundControl({ id, enabled, pending = false, playing = true, volume = .25, onToggle, onVolumeChange, className = '', variant = 'standard', settings }) {
  const percentage = Math.round(volume * 100);
  const state = enabled && volume > 0 ? 'enabled' : pending && volume > 0 ? 'awaiting-gesture' : 'muted';
  return <div className={`sound-control-widget${variant === 'line' ? ' sound-control-widget-home' : ''} ${className}`}
    data-sound-control data-audio-state={state} data-wave-playing={state === 'enabled' && playing}
    style={{ '--sound-volume': `${percentage}%` }}>
    <button id={id} type="button" className="sound-control sound-control-line" data-sound-control data-audio-state={state}
      aria-label={enabled ? '关闭声音' : '开启声音'} aria-pressed={enabled} onClick={onToggle}
      title={pending ? '视频正在静音播放，点击开启声音' : enabled ? '关闭声音' : '开启声音'}>
      <span className="sound-control-label">音量</span><SoundWave settings={settings} />
    </button>
    <div className="sound-volume-row">
      <input className="sound-volume-slider" type="range" min="0" max="100" step="1" value={percentage}
        aria-label="音量" aria-valuetext={`${percentage}%`} onChange={event => onVolumeChange?.(Number(event.target.value) / 100)} />
      <span className="sound-volume-value" aria-hidden="true">{percentage}</span>
    </div>
  </div>;
}
