import '../styles/sound-control.css';

export default function SoundControl({ id, enabled, pending = false, onToggle, className = '' }) {
  return <button id={id} type="button" className={`sound-control ${className}`} data-sound-control
    data-audio-state={enabled ? 'enabled' : pending ? 'awaiting-gesture' : 'muted'}
    aria-label={enabled ? '关闭声音' : '开启声音'} aria-pressed={enabled} onClick={onToggle}
    title={pending ? '视频正在静音播放，点击开启声音' : enabled ? '关闭声音' : '开启声音'}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z" />
      {enabled ? <><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></> : <path d="m16 9 6 6m0-6-6 6" />}
    </svg>
    <span>{enabled ? '声音已开启' : pending ? '点击开启声音' : '声音已关闭'}</span>
  </button>;
}
