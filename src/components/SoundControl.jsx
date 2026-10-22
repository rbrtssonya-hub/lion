import '../styles/sound-control.css';

export default function SoundControl({ id, enabled, pending = false, onToggle, className = '', variant = 'standard' }) {
  const line = variant === 'line';
  return <button id={id} type="button" className={`sound-control${line ? ' sound-control-line' : ''} ${className}`} data-sound-control
    data-audio-state={enabled ? 'enabled' : pending ? 'awaiting-gesture' : 'muted'}
    aria-label={enabled ? '关闭声音' : '开启声音'} aria-pressed={enabled} onClick={onToggle}
    title={line ? undefined : pending ? '视频正在静音播放，点击开启声音' : enabled ? '关闭声音' : '开启声音'}>
    {line ? <svg viewBox="0 0 60 24" aria-hidden="true" focusable="false">
      <path d={enabled ? 'M 3 12 C 7.5 12 7.5 5 12 5 S 16.5 19 21 19 S 25.5 5 30 5 S 34.5 19 39 19 S 43.5 5 48 5 S 52.5 12 57 12' : 'M 3 12 H 57'} />
    </svg> : <><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z" />
      {enabled ? <><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></> : <path d="m16 9 6 6m0-6-6 6" />}
    </svg>
    <span>{enabled ? '声音已开启' : pending ? '点击开启声音' : '声音已关闭'}</span></>}
  </button>;
}
