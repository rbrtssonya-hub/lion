import type { NarrationController } from '../hooks/useNarration'

function formatTime(seconds: number) {
  const time = Math.max(0, Math.floor(seconds))
  return `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`
}

export function NarrationControls({ narration, compact = false }: { narration: NarrationController; compact?: boolean }) {
  const { enabled, status, activeIndex, message, currentTime, duration, progress } = narration
  const playing = status === 'playing' || status === 'loading'
  const unavailable = !enabled || activeIndex === null

  return <div className={`narration-controls${compact ? ' is-compact' : ''}`} data-status={status}>
    <div className="narration-actions">
      <button type="button" className="narration-toggle" aria-label={enabled ? '关闭自动讲解' : '启用自动讲解'} aria-pressed={enabled} onClick={narration.toggleEnabled}>
        <span className="narration-indicator" aria-hidden="true" />自动讲解 <span>{enabled ? '已开启' : '未开启'}</span>
      </button>
      {!compact && <>
        <button type="button" className="narration-play" disabled={unavailable} aria-label={playing ? '暂停讲解' : '继续讲解'} onClick={narration.togglePlayback}>
          <span aria-hidden="true">{playing ? 'Ⅱ' : '▷'}</span>{playing ? '暂停' : '继续'}
        </button>
        <button type="button" className="narration-replay" disabled={unavailable} aria-label="重新播放讲解" onClick={narration.replay}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a6.5 6.5 0 1 1-.3 5M4 3v4h4" /></svg>重播
        </button>
      </>}
    </div>
    {!compact && <div className="narration-timeline">
      <progress className="narration-progress" max={1} value={progress} aria-label="讲解进度" />
      <span className="narration-time" aria-label={`已播放 ${formatTime(currentTime)}，共 ${formatTime(duration)}`}>{formatTime(currentTime)} / {formatTime(duration)}</span>
    </div>}
    <p className="narration-status" role="status" aria-live="polite">{message}</p>
  </div>
}
