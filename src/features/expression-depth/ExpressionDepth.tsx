import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Hero } from './components/Hero'
import { Navigation } from './components/Navigation'
import { About } from './components/About'
import { ProjectSection } from './components/ProjectSection'
import { Contact } from './components/Contact'
import { ProjectGallery, type GallerySelection } from './components/ProjectGallery'
import { projects, chapterIds } from './data/projects'
import { useMediaQuery } from './hooks/usePreferences'
import { useScrollExperience } from './hooks/useScrollExperience'
import { useDepthPanels } from './hooks/useDepthPanels'
import { useNarration } from './hooks/useNarration'
import { useAutoTour } from './hooks/useAutoTour'
import { AutoTourControls } from './components/AutoTourControls'
import { motionState } from './lib/motion'
import { media } from '../../config/media.js'
import { resolveExpressionDepthSettings } from '../../config/expressionDepthSettings.js'
import './expression-depth.css'

type ReadingSelection = GallerySelection & { tour?: boolean }
type FaceRequest = { project: number; token: number; tour: boolean }

const Scene = lazy(() => import('./scene/Scene'))

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.failed ? null : this.props.children }
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2')
    if (!context) return false
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch { return false }
}

export default function ExpressionDepth({ active = true, observation, onReturnToModel, onReturnToAction, settings = {} }: { active?: boolean; observation?: { expressionId?: string; partLabel?: string }; onReturnToModel?: () => void; onReturnToAction?: () => void; settings?: Record<string, any> }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const parameters = resolveExpressionDepthSettings(settings)
  const [settingsEditing, setSettingsEditing] = useState(false)
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [webgl] = useState(() => !new URLSearchParams(location.search).has('static') && supportsWebGL())
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [gallery, setGallery] = useState<ReadingSelection | null>(null)
  const [playRequest, setPlayRequest] = useState<FaceRequest | null>(null)
  const pendingFace = useRef<FaceRequest | null>(null)
  const requestNumber = useRef(0)
  const use3D = !reduced && webgl && !failed
  const { chapter, progress, navigate, setScrollLocked } = useScrollExperience(reduced, rootRef, scrollRef, contentRef, observation?.expressionId ?? 'home', parameters.expressionDepthWheelSpeed)
  const narration = useNarration(chapter, Boolean(gallery && !gallery.tour) || !active || settingsEditing)
  const cancelNavigation = useCallback(() => {
    // Lenis.stop() resets its current interpolation, so a tour pause hands the
    // original scroll playhead back without changing any camera mathematics.
    setScrollLocked(true)
    if (!gallery) setScrollLocked(false)
  }, [gallery, setScrollLocked])
  const openReading = useCallback((project: number) => setGallery({ project, image: 0, tour: true }), [])
  const closeReading = useCallback(() => {
    setGallery(current => current?.tour ? null : current)
    setScrollLocked(false)
  }, [setScrollLocked])
  const tour = useAutoTour({ rootRef, moveDuration: parameters.expressionTourMoveDuration, readingDuration: parameters.expressionTourReadingDuration, navigate, cancelNavigation, narration, blocked: Boolean(gallery && !gallery.tour) || settingsEditing || !active, ready: (!use3D || ready) && active, openReading, closeReading })
  const clearFace = useCallback(() => { pendingFace.current = null; setPlayRequest(null) }, [])
  const manualNavigate = useCallback((id: string) => { clearFace(); tour.takeControl(); setScrollLocked(false); navigate(id) }, [clearFace, tour.takeControl, navigate, setScrollLocked])
  const onReady = useCallback(() => setReady(true), [])
  const onFailure = useCallback(() => { setFailed(true); setReady(false) }, [])
  const onFaceComplete = useCallback((project: number) => {
    const pending = pendingFace.current
    if (!pending || pending.project !== project) return
    clearFace()
    if (pending.tour) tour.faceComplete(project)
    else setGallery({ project, image: 0 })
  }, [clearFace, tour.faceComplete])
  const onOpen = useCallback((project: number) => {
    if (pendingFace.current || gallery || (use3D && Math.abs(motionState.chapter - (project + 2)) > .12)) return
    const owned = tour.beginAnimation(project)
    if (!owned) tour.pause()
    if (!use3D) {
      if (owned) tour.faceComplete(project)
      else setGallery({ project, image: 0 })
      return
    }
    const pending = { project, token: ++requestNumber.current, tour: owned }
    pendingFace.current = pending
    setPlayRequest(pending)
  }, [gallery, use3D, tour.beginAnimation, tour.pause, tour.faceComplete])
  const closeGallery = useCallback(() => {
    if (gallery?.tour) {
      if (tour.status === 'paused') { closeReading(); tour.exit() }
      else tour.completeReading()
    } else setGallery(null)
  }, [gallery, tour.status, tour.completeReading, tour.exit, closeReading])
  useDepthPanels(rootRef)
  useEffect(() => { if (!use3D) setReady(false) }, [use3D])
  const interactionLocked = Boolean(gallery || playRequest || settingsEditing || !active)
  useEffect(() => { setScrollLocked(interactionLocked); return () => setScrollLocked(false) }, [interactionLocked, setScrollLocked])
  useEffect(() => {
    if (pendingFace.current?.tour && (tour.status !== 'running' || tour.phase !== 'animating')) clearFace()
  }, [tour.status, tour.phase, clearFace])
  useEffect(() => {
    const cancel = () => { if (pendingFace.current) clearFace() }
    const key = (event: KeyboardEvent) => { if (['Escape','ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)) cancel() }
    const hidden = () => { if (document.hidden) cancel() }
    const root = rootRef.current!
    root.addEventListener('wheel', cancel, { passive: true, capture: true })
    root.addEventListener('touchstart', cancel, { passive: true, capture: true })
    root.addEventListener('keydown', key, true)
    document.addEventListener('visibilitychange', hidden)
    return () => { root.removeEventListener('wheel', cancel, true); root.removeEventListener('touchstart', cancel, true); root.removeEventListener('keydown', key, true); document.removeEventListener('visibilitychange', hidden) }
  }, [clearFace])
  useEffect(() => {
    const shell = rootRef.current?.closest('.site-shell')
    if (!shell) return
    const update = () => setSettingsEditing(shell.getAttribute('data-settings-open') === 'true')
    update()
    const observer = new MutationObserver(update)
    observer.observe(shell, { attributes: true, attributeFilter: ['data-settings-open'] })
    return () => observer.disconnect()
  }, [])
  useEffect(() => { if (settingsEditing || !active) clearFace() }, [settingsEditing, active, clearFace])
  useEffect(() => { if (failed && pendingFace.current) onFaceComplete(pendingFace.current.project) }, [failed, onFaceComplete])

  const fonts = [['Nanfeng Depth Brush', media.depthFontBrush, '400', 'normal'], ['Nanfeng Depth Serif', media.depthFontSerif, '400 600', 'normal'], ['Nanfeng Depth Sans', media.depthFontSans, '400 600', 'normal'], ['Nanfeng Depth Manrope', media.depthFontManrope, '200 800', 'normal'], ['Nanfeng Depth Space', media.depthFontSpace, '300 700', 'normal'], ['Nanfeng Depth Instrument', media.depthFontInstrument, '400', 'italic']]
  return <div ref={rootRef} id="chapterStage" data-chapter="state" className={`expression-depth portfolio ${use3D && ready ? 'has-webgl' : 'is-static'} ${reduced ? 'reduced-motion' : ''}`} role="region" aria-label="醒狮八态纵深图鉴" tabIndex={0} style={{ '--depth-text-scale': parameters.expressionDepthTextScale / 100, '--depth-marker-size': `${parameters.expressionDepthMarkerSize}px`, '--depth-paper-image': `url("${new URL(media.depthPaperBackground, document.baseURI).href}")`, '--depth-title-atlas': `url("${new URL(media.depthTitleAtlas, document.baseURI).href}")`, '--depth-contact-atlas': `url("${new URL(media.depthContactAtlas, document.baseURI).href}")` } as React.CSSProperties}>
    <style>{fonts.map(([family, url, weight, style]) => `@font-face{font-family:"${family}";src:url("${url}") format("woff2");font-weight:${weight};font-style:${style};font-display:swap}`).join('')}</style>
    <h1 className="sr-only" id="chapterTitle">神态</h1>
    <div className="depth-scroll-viewport" ref={scrollRef} aria-hidden="true"><div className="depth-scroll-content" ref={contentRef}>{chapterIds.map(id => <div key={id} className="depth-anchor" data-depth-anchor={id} data-depth-chapter={id} />)}</div></div>
    <div className="depth-host-actions"><button type="button" onClick={() => manualNavigate('home')}>回到卷首</button>{observation && <button type="button" onClick={onReturnToModel}>返回{observation.partLabel ?? '结构'}部位</button>}<button type="button" onClick={onReturnToAction}>返回戏台</button></div>
    <a className="skip-link" href="#/state" onClick={event => { event.preventDefault(); manualNavigate('about') }}>跳到神态导言</a>
    <Navigation chapter={chapter} navigate={manualNavigate} />
    <AutoTourControls tour={tour} />
    <div className="paper-atmosphere" aria-hidden="true" />
    {use3D && <SceneBoundary onFailure={onFailure}><Suspense fallback={null}><Scene chapter={chapter} onOpen={onOpen} playRequest={playRequest} onFaceComplete={onFaceComplete} onFaceUnavailable={onFaceComplete} reduced={reduced} blocked={Boolean(gallery) || settingsEditing || !active} settings={settings} onReady={onReady} onFailure={onFailure} /></Suspense></SceneBoundary>}
    <div className="background-grain" aria-hidden="true" />
    <div className="edge-mark" aria-hidden="true">南风有狮 / 由形入神 · 醒狮八态</div>
    <div className="depth-panels">
      <Hero navigate={manualNavigate} narration={narration} />
      <About navigate={manualNavigate} narration={narration} />
      {projects.map((project, index) => <ProjectSection key={project.id} project={project} index={index} onOpen={onOpen} narration={narration} />)}
      <Contact navigate={manualNavigate} />
    </div>
    <div className="journey-progress" aria-hidden="true"><span>{String(progress).padStart(2, '0')}%</span><div><i style={{ transform: `scaleY(${progress / 100})` }} /></div></div>
    {gallery && <ProjectGallery settings={settings} selection={gallery} onClose={closeGallery} tourReading={gallery.tour ? { remainingSeconds: tour.readingRemaining, paused: tour.status === 'paused', onContinue: tour.status === 'paused' ? tour.resume : tour.completeReading } : undefined} />}
  </div>
}
