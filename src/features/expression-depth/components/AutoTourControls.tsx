import type { AutoTourController } from '../hooks/useAutoTour'

export function AutoTourControls({ tour }: { tour: AutoTourController }) {
  const active = tour.status === 'running' || tour.status === 'paused'
  return <div className={`auto-tour${active ? ' is-active' : ''}`} role="region" aria-label="自动巡游" data-status={tour.status} data-phase={tour.phase} data-station={tour.station}>
    {active ? <>
      <div className="auto-tour-copy"><span>{tour.stationTitle}<i>{tour.status === 'paused' ? '已暂停' : tour.phase === 'moving' ? '运镜中' : tour.phase === 'animating' ? '动效中' : tour.phase === 'reading' ? '解读中' : '待点击'}</i></span><small role="status" aria-live="polite">{tour.message}</small></div>
      <button type="button" className="auto-tour-action" onClick={tour.status === 'running' ? tour.pause : tour.resume} aria-label={tour.status === 'running' ? '暂停自动巡游' : '继续自动巡游'}>{tour.status === 'running' ? '暂停' : '继续'}</button>
      <button type="button" className="auto-tour-exit" onClick={tour.exit} aria-label="退出自动巡游">退出</button>
      <progress max={1} value={tour.progress} aria-label="巡游进度" />
    </> : <button type="button" className="auto-tour-start" onClick={tour.start} aria-label={tour.status === 'ended' ? '重新开始自动巡游' : '开始自动巡游'}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="12" cy="12" r="10" /><path d="m10 8 6 4-6 4Z" fill="currentColor" stroke="none" /></svg><span>{tour.status === 'ended' ? '再次巡游' : '自动巡游'}<small>运镜 · 讲解</small></span></button>}
  </div>
}
