import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { getSurfaceStyle } from '../../developer-settings/surfaceSettings.js'
import { projects } from '../data/projects'
import { SafeImage } from './SafeImage'

export interface GallerySelection { project: number; image: number }
export interface GalleryTourReading { remainingSeconds: number; onContinue: () => void; paused?: boolean }

export function ProjectGallery({ selection, onClose, tourReading, settings }: { selection: GallerySelection; onClose: () => void; tourReading?: GalleryTourReading; settings?: Record<string, unknown> }) {
  const dialog = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const project = projects[selection.project]

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    const focused = document.activeElement as HTMLElement | null
    element.querySelector<HTMLButtonElement>('.gallery-close')?.focus({ preventScroll: true })
    return () => { if (focused?.isConnected) focused.focus({ preventScroll: true }) }
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeRef.current()
    } else if (event.key === 'Tab') {
      const element = event.currentTarget
      const controls = [...element.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(control => control.getClientRects().length > 0)
      const first = controls[0], last = controls[controls.length - 1]
      if (!first) { event.preventDefault(); element.focus({ preventScroll: true }); return }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) {
        event.preventDefault(); last.focus({ preventScroll: true })
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element)) {
        event.preventDefault(); first.focus({ preventScroll: true })
      }
    }
  }

  return <div className="depth-gallery-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="gallery" ref={dialog} role="dialog" aria-modal="true" tabIndex={-1} aria-labelledby="depth-gallery-title" data-surface="expressionOverlay" style={settings ? getSurfaceStyle(settings, 'expressionOverlay') as CSSProperties : undefined} data-lenis-prevent onKeyDown={onKeyDown}>
    <div className="gallery-content">
      <div className="gallery-header"><div><span className="gallery-kicker">{project.number} / 08 · 神态解读</span><h2 id="depth-gallery-title">{project.title} · {project.subtitle}</h2></div><button type="button" className="gallery-close" onClick={onClose} aria-label="关闭神态解读">关闭 <span>×</span></button></div>
      <div className="lion-reading">
        <div className="gallery-image"><SafeImage src={project.images[0]} alt={`${project.title}态醒狮AI辅助示意，非真实表演样本`} /><span className="gallery-counter">{project.number} / 08</span></div>
        <div className="lion-reading-copy" aria-live="polite"><p className="lion-reading-verse">{project.coordinates}</p><dl>{[['看眉眼 · 读狮口', project.emotion], ['听锣鼓 · 观身段', project.motion], ['观察线索', project.posture]].map(([label, text]) => <div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl><p className="lion-reading-note">{project.intent}</p></div>
      </div>
      {tourReading && <div className="gallery-tour-reading"><p role="status">{tourReading.paused ? '巡游已暂停，继续后恢复读秒。' : <>自动巡游 · <strong>{Math.max(0, Math.ceil(tourReading.remainingSeconds))}</strong> 秒后继续下一态。</>}</p><button className="gallery-tour-continue" onClick={tourReading.onContinue}>{tourReading.paused ? '继续巡游' : '提前继续巡游'}</button></div>}
      <div className="gallery-note">AI辅助视觉 · 八态定性观察提示<span>等待真实图片 / 视频样本校核</span></div>
    </div>
    </div>
  </div>
}
